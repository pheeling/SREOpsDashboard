/**
 * Core Mathematical Calculations & Backend Engine
 *
 * This module is the single "Source of Truth" for the calculator. Every UI
 * widget derives its numbers from these pure functions so that the math
 * behind the dashboard stays auditable and unit-testable.
 */
import type {
  CapacityBuckets,
  CapacityReport,
  DashboardState,
  GlobalConfig,
  OwnershipModel,
  Service,
  ServiceBreakdown,
  Team,
} from "./types";
import { ALL_TEAMS_ID } from "./types";

/** Divisor applied to a service's hours once it has been automated ("1/3 Automation Rule"). */
export const AUTOMATION_REDUCTION_FACTOR = 3;

/** Effort multiplier applied to services the team lacks expertise to operate. */
export const EXPERTISE_EFFORT_MULTIPLIER = 1.25;

/** Effort multiplier applied to maintenance hours when a service lacks PRR approval. */
export const PRR_FRICTION_MULTIPLIER = 1.2;

/** Default share of contracted hours available for technical work after overhead. */
export const DEFAULT_CAPACITY_EFFICIENCY_FACTOR = 0.8;

/** Fixed share of effective capacity reserved for unexpected incidents/outages. */
export const EMERGENCY_RESPONSE_SHARE = 0.1;

/** Fixed share of effective capacity reserved for user-growth prep/testing. */
export const TESTING_SCALING_SHARE = 0.05;

/** Fixed share of effective capacity reserved for security/compliance patching (CVE remediation, audits). */
export const SECURITY_COMPLIANCE_SHARE = 0.08;

/** Fixed share of effective capacity reserved for on-call rotations, alert triage and SLO/monitoring upkeep. */
export const ON_CALL_MONITORING_SHARE = 0.07;
/** Share of innovation hours lost to context switching without a dedicated interrupt shield. */
export const CONTEXT_SWITCH_DRAG = 0.2;

/** Default criticality/"blast-radius" weight applied to a service when none is specified. */
export const DEFAULT_SERVICE_WEIGHT = 1;

/** Share of a service's toil absorbed by SRE under each ownership model. */
export const OWNERSHIP_MULTIPLIERS: Record<OwnershipModel, number> = {
  sre_full: 1,
  shared: 0.5,
  dev_owned: 0.1,
};

export const OWNERSHIP_LABELS: Record<OwnershipModel, string> = {
  sre_full: "SRE Full",
  shared: "Shared",
  dev_owned: "Dev Owned",
};

/** SRE-mandated ceiling on manual operational work as a share of total capacity. */
export const RED_ZONE_THRESHOLD = 0.5;

/** Ratio used when operational work remains but no effective capacity is available. */
const SATURATED_OPERATIONAL_LOAD_RATIO = 1;

/** Fixed baseline used for financial modeling, per the design plan. */
export const DEFAULT_ANNUAL_SALARY = 150_000;

function finiteNumber(value: unknown, fallback = 0): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function getAutomationDivisor(service: Pick<Service, "isAutomated">): number {
  return service.isAutomated ? AUTOMATION_REDUCTION_FACTOR : 1;
}

/** Criticality/"blast-radius" multiplier for a service; defaults to 1 when unset. */
export function getServiceWeight(service: Pick<Service, "weight">): number {
  if (service.weight == null) return DEFAULT_SERVICE_WEIGHT;
  const weight = finiteNumber(service.weight, DEFAULT_SERVICE_WEIGHT);
  return weight >= 0 ? weight : DEFAULT_SERVICE_WEIGHT;
}

export function getOwnershipModel(service: Pick<Service, "ownershipModel">): OwnershipModel {
  return service.ownershipModel && service.ownershipModel in OWNERSHIP_MULTIPLIERS ? service.ownershipModel : "sre_full";
}

export function getOwnershipMultiplier(service: Pick<Service, "ownershipModel">): number {
  return OWNERSHIP_MULTIPLIERS[getOwnershipModel(service)];
}

/** Base Hours = Deploying Hours + Maintenance Hours (before automation is applied). */
export function getBaseHours(service: Pick<Service, "deployHours" | "maintenanceHours">): number {
  return finiteNumber(service.deployHours) + finiteNumber(service.maintenanceHours);
}

/**
 * Required_Hours for a single service: Base Hours divided by 3 when
 * automation is toggled on, then multiplied by the service's criticality
 * weight, then multiplied by 1.25 when the team lacks expertise. Maintenance
 * hours are multiplied by 1.2 when PRR approval is missing. Inactive services
 * contribute 0 hours to the active workload.
 */
export function getRequiredHours(service: Service): number {
  if (!service.isActive) return 0;
  const expertiseMultiplier = service.hasExpertise ? 1 : EXPERTISE_EFFORT_MULTIPLIER;
  const prrMultiplier = service.prrApproved === false ? PRR_FRICTION_MULTIPLIER : 1;
  const baseHours = finiteNumber(service.deployHours) + finiteNumber(service.maintenanceHours) * prrMultiplier;
  return (baseHours / getAutomationDivisor(service)) * getServiceWeight(service) * expertiseMultiplier * getOwnershipMultiplier(service);
}

export function getTotalRequiredHours(services: Service[]): number {
  return services.reduce((sum, service) => sum + getRequiredHours(service), 0);
}

export function getTotalAvailableHours(globalConfig: GlobalConfig): number {
  return finiteNumber(globalConfig.fteCount) * finiteNumber(globalConfig.weeklyHours);
}

export function getEffectiveCapacityHours(globalConfig: GlobalConfig): number {
  const efficiencyFactor = Math.min(
    1,
    Math.max(0, finiteNumber(globalConfig.capacityEfficiencyFactor, DEFAULT_CAPACITY_EFFICIENCY_FACTOR)),
  );
  return getTotalAvailableHours(globalConfig) * efficiencyFactor;
}

export function getEffectiveAvailableHours(state: DashboardState): number {
  return getTotalAvailableHours(state.globalConfig);
}

export function getServiceBreakdown(service: Service): ServiceBreakdown {
  return {
    id: service.id,
    name: service.name,
    isActive: service.isActive,
    isAutomated: service.isAutomated,
    hasExpertise: service.hasExpertise,
    weight: getServiceWeight(service),
    ownershipModel: getOwnershipModel(service),
    baseHours: getBaseHours(service),
    requiredHours: getRequiredHours(service),
  };
}

/**
 * Allocates capacity across the six Capacity Budget buckets. Routine
 * Operations & Maintenance Toil is derived directly from active services;
 * Emergency Response, Testing & Scaling, Security & Compliance Patching, and
 * On-Call & Monitoring use fixed shares of raw capacity; Innovation & Toil
 * Reduction absorbs whatever effective capacity remains (never negative).
 */
export function getCapacityBuckets(state: DashboardState): CapacityBuckets {
  const effectiveCapacityHours = getEffectiveCapacityHours(state.globalConfig);
  const effectiveAvailableHours = getEffectiveAvailableHours(state);
  const maintenance = getTotalRequiredHours(state.services);

  const emergencyResponse = effectiveCapacityHours * EMERGENCY_RESPONSE_SHARE;
  const testingScaling = effectiveCapacityHours * TESTING_SCALING_SHARE;
  const securityCompliance = effectiveCapacityHours * SECURITY_COMPLIANCE_SHARE;
  const onCallMonitoring = effectiveCapacityHours * ON_CALL_MONITORING_SHARE;

  const allocated = maintenance + emergencyResponse + testingScaling + securityCompliance + onCallMonitoring;
  const rawInnovation = Math.max(0, effectiveAvailableHours - allocated);
  const innovation = state.globalConfig.hasInterruptShield ? rawInnovation : rawInnovation * (1 - CONTEXT_SWITCH_DRAG);

  return { innovation, maintenance, emergencyResponse, testingScaling, securityCompliance, onCallMonitoring };
}

/** Raw innovation hours lost to (or, with the shield, recovered from) context-switching drag. */
export function getRawContextSwitchHours(state: DashboardState): number {
  const buckets = getCapacityBuckets(state);
  const raw = state.globalConfig.hasInterruptShield ? buckets.innovation : buckets.innovation / (1 - CONTEXT_SWITCH_DRAG);
  return raw * CONTEXT_SWITCH_DRAG;
}

/**
 * Financial Widget: "External Hiring Costs".
 * Each hire contributes 50% of weekly hours to operational work, restoring the
 * team to the 50% operational limit:
 * max(0, Operational_Hours - 0.5 * Available_Hours) / (0.5 * weeklyHours) * Annual_Salary
 */
export function getHiringCost(
  operationalHours: number,
  effectiveAvailableHours: number,
  globalConfig: GlobalConfig,
): number {
  operationalHours = finiteNumber(operationalHours);
  effectiveAvailableHours = finiteNumber(effectiveAvailableHours);
  const weeklyHours = finiteNumber(globalConfig.weeklyHours);
  const annualSalary = finiteNumber(globalConfig.annualSalary);
  const toilDeficit = Math.max(0, operationalHours - RED_ZONE_THRESHOLD * effectiveAvailableHours);
  if (toilDeficit <= 0 || weeklyHours <= 0) return 0;
  return (toilDeficit / (RED_ZONE_THRESHOLD * weeklyHours)) * annualSalary;
}

export interface UpskillingDividend {
  hoursRecoveredPerWeek: number;
  annualizedValue: number;
  affectedServices: string[];
}

/** Estimates the weekly effort penalty and annual value recovered by closing expertise gaps. */
export function calculateUpskillingDividend(services: Service[], globalConfig: GlobalConfig): UpskillingDividend {
  let hoursRecoveredPerWeek = 0;
  const affectedServices: string[] = [];

  for (const service of services) {
    if (!service.isActive || service.hasExpertise) continue;

    const requiredHours = getRequiredHours(service);
    const recoveredHours = Math.max(
      0,
      finiteNumber(requiredHours - requiredHours / EXPERTISE_EFFORT_MULTIPLIER),
    );
    if (recoveredHours > 0) {
      hoursRecoveredPerWeek += recoveredHours;
      affectedServices.push(service.name);
    }
  }

  const weeklyHours = finiteNumber(globalConfig.weeklyHours);
  const annualizedValue =
    weeklyHours > 0 ? (hoursRecoveredPerWeek / weeklyHours) * finiteNumber(globalConfig.annualSalary) : 0;

  return { hoursRecoveredPerWeek, annualizedValue, affectedServices };
}

/**
 * Measures operational load against effective capacity. No operational work
 * yields zero; nonzero work with no effective capacity is treated as saturated.
 */
function getOperationalLoadRatio(operationalLoadHours: number, effectiveAvailableHours: number): number {
  if (operationalLoadHours <= 0) return 0;
  if (effectiveAvailableHours <= 0) return SATURATED_OPERATIONAL_LOAD_RATIO;
  return operationalLoadHours / effectiveAvailableHours;
}

/**
 * Runs the full engine over the current dashboard state, producing every
 * derived number the UI needs (buckets, red-zone status, hiring cost, etc).
 */
export function computeCapacityReport(state: DashboardState): CapacityReport {
  const { services, globalConfig } = state;

  const totalAvailableHours = getTotalAvailableHours(globalConfig);
  const effectiveAvailableHours = getEffectiveAvailableHours(state);
  const totalRequiredHours = getTotalRequiredHours(services);
  const buckets = getCapacityBuckets(state);
  // Operational load is routine toil plus reactive/admin reserves only;
  // engineering capacity for automation and toil reduction stays in innovation.
  const operationalLoadHours =
    buckets.maintenance +
    buckets.emergencyResponse +
    buckets.testingScaling +
    buckets.securityCompliance +
    buckets.onCallMonitoring;
  const operationalLoadRatio = getOperationalLoadRatio(operationalLoadHours, effectiveAvailableHours);
  const contextSwitchHours = getRawContextSwitchHours(state);
  const hasShield = Boolean(globalConfig.hasInterruptShield);

  return {
    cognitiveOverheadHours: hasShield ? 0 : contextSwitchHours,
    recoveredInnovationHours: hasShield ? contextSwitchHours : 0,
    services: services.map(getServiceBreakdown),
    totalAvailableHours,
    effectiveAvailableHours,
    totalRequiredHours,
    buckets,
    operationalLoadHours,
    operationalLoadRatio,
    isRedZone: operationalLoadRatio > RED_ZONE_THRESHOLD,
    hiringCost: getHiringCost(operationalLoadHours, effectiveAvailableHours, globalConfig),
    deficitHours: getDeficitHours(operationalLoadHours, effectiveAvailableHours),
  };
}

/** Deficit Hours = Operational Load Hours - 0.5 * Contracted Team Hours (never negative). */
export function getDeficitHours(operationalLoadHours: number, contractedHours: number): number {
  return Math.max(0, finiteNumber(operationalLoadHours) - RED_ZONE_THRESHOLD * finiteNumber(contractedHours));
}

export interface HandbackCandidate {
  serviceId: string;
  name: string;
  /** Weekly hours removed from SRE toil if the service becomes dev-owned. */
  hoursSaved: number;
}

/**
 * Recommends up to `limit` active services whose handback to product
 * development sheds the most toil.
 */
export function getHandbackCandidates(services: Service[], limit = 2): HandbackCandidate[] {
  return services
    .filter((service) => service.isActive && getOwnershipModel(service) !== "dev_owned")
    .map((service) => ({
      serviceId: service.id,
      name: service.name,
      hoursSaved: getRequiredHours(service) - getRequiredHours({ ...service, ownershipModel: "dev_owned" }),
    }))
    .filter((candidate) => candidate.hoursSaved > 0)
    .sort((a, b) => b.hoursSaved - a.hoursSaved)
    .slice(0, limit);
}

/**
 * Automation ROI: the weekly hours saved for a service by toggling
 * automation on, converted into an annualized dollar figure using the
 * salary baseline (mirrors the Hiring Cost conversion rate).
 */
export function getAutomationRoiHours(service: Service): number {
  const withoutAutomation = getRequiredHours({ ...service, isActive: true, isAutomated: false });
  const withAutomation = getRequiredHours({ ...service, isActive: true, isAutomated: true });
  return withoutAutomation - withAutomation;
}

export function getAutomationRoiDollars(service: Service, globalConfig: GlobalConfig): number {
  const hoursSavedPerWeek = getAutomationRoiHours(service);
  const weeklyHours = finiteNumber(globalConfig.weeklyHours);
  return weeklyHours > 0 ? (hoursSavedPerWeek / weeklyHours) * finiteNumber(globalConfig.annualSalary) : 0;
}

/** Share of a service's base hours eliminated by a stabilization sprint. */
export const STABILIZATION_SPRINT_REDUCTION = 0.5;

/** Duration of a stabilization sprint, in weeks, with 1 FTE dedicated. */
export const STABILIZATION_SPRINT_WEEKS = 2;

/** Number of services flagged as "Top Toil Contributors". */
export const TOP_TOIL_CONTRIBUTOR_COUNT = 3;

export interface ParetoToilEntry {
  id: string;
  name: string;
  /** 1-based rank by required hours (descending). */
  rank: number;
  requiredHours: number;
  /** Share of total active toil, 0..1. */
  share: number;
  /** Running share including this service, 0..1. */
  cumulativeShare: number;
  isTopContributor: boolean;
}

export interface ParetoToilSummary {
  entries: ParetoToilEntry[];
  totalHours: number;
  topCount: number;
  /** Combined share (0..1) of the top contributors. */
  topShare: number;
}

/** Ranks active services by their contribution to total operational toil. */
export function getParetoToilRanking(services: Service[]): ParetoToilSummary {
  const active = services
    .filter((service) => service.isActive)
    .map((service) => ({ service, hours: getRequiredHours(service) }))
    .filter(({ hours }) => hours > 0)
    .sort((a, b) => b.hours - a.hours);
  const totalHours = active.reduce((sum, { hours }) => sum + hours, 0);
  let cumulative = 0;
  const entries = active.map(({ service, hours }, index): ParetoToilEntry => {
    const share = totalHours > 0 ? hours / totalHours : 0;
    cumulative += share;
    return {
      id: service.id,
      name: service.name,
      rank: index + 1,
      requiredHours: hours,
      share,
      cumulativeShare: Math.min(1, cumulative),
      isTopContributor: index < TOP_TOIL_CONTRIBUTOR_COUNT,
    };
  });
  const topCount = Math.min(TOP_TOIL_CONTRIBUTOR_COUNT, entries.length);
  const topShare = entries.slice(0, topCount).reduce((sum, entry) => sum + entry.share, 0);
  return { entries, totalHours, topCount, topShare };
}

/** Returns state with the service's base (deploy + maintenance) hours cut by the sprint reduction. */
export function applyStabilizationSprint(state: DashboardState, serviceId: string): DashboardState {
  const keep = 1 - STABILIZATION_SPRINT_REDUCTION;
  return {
    ...state,
    services: state.services.map((service) =>
      service.id === serviceId
        ? {
            ...service,
            deployHours: finiteNumber(service.deployHours) * keep,
            maintenanceHours: finiteNumber(service.maintenanceHours) * keep,
          }
        : service,
    ),
  };
}

export interface StabilizationSprintScenario {
  serviceId: string;
  serviceName: string;
  /** Hours dedicated to the sprint: 1 FTE x weeklyHours x sprint weeks. */
  sprintHours: number;
  hoursSavedPerWeek: number;
  before: CapacityReport;
  after: CapacityReport;
}

/**
 * Pure what-if simulation: halves the #1 toil contributor's base hours and
 * reports the capacity picture before and after. Never mutates the input.
 */
export function simulateStabilizationSprint(state: DashboardState): StabilizationSprintScenario | null {
  const [top] = getParetoToilRanking(state.services).entries;
  if (!top) return null;
  const before = computeCapacityReport(state);
  const after = computeCapacityReport(applyStabilizationSprint(state, top.id));
  return {
    serviceId: top.id,
    serviceName: top.name,
    sprintHours: finiteNumber(state.globalConfig.weeklyHours) * STABILIZATION_SPRINT_WEEKS,
    hoursSavedPerWeek: before.totalRequiredHours - after.totalRequiredHours,
    before,
    after,
  };
}

export const DEFAULT_TEAM_ID = "default";

/** Returns the stored teams, or a single default team built from the legacy `globalConfig`. */
export function getTeams(state: DashboardState): Team[] {
  return state.teams?.length
    ? state.teams
    : [{ id: DEFAULT_TEAM_ID, name: "Default Team", config: state.globalConfig }];
}

export function isOrganizationView(state: DashboardState): boolean {
  return state.selectedTeamId === ALL_TEAMS_ID;
}

/** Service ownership with unassigned services falling back to the first team. */
export function getServiceTeamId(service: Service, teams: Team[]): string {
  return service.teamId && teams.some((team) => team.id === service.teamId) ? service.teamId : teams[0].id;
}

/** Aggregates team configs: summed FTEs, FTE-weighted averages for hours, capacity and salary. */
export function aggregateTeamConfigs(teams: Team[]): GlobalConfig {
  if (teams.length === 1) return teams[0].config;
  const fte = teams.reduce((sum, team) => sum + finiteNumber(team.config.fteCount), 0);
  const hours = teams.reduce((sum, team) => sum + getTotalAvailableHours(team.config), 0);
  const effective = teams.reduce((sum, team) => sum + getEffectiveCapacityHours(team.config), 0);
  const salaryTotal = teams.reduce(
    (sum, team) => sum + finiteNumber(team.config.fteCount) * finiteNumber(team.config.annualSalary),
    0,
  );
  return {
    fteCount: fte,
    weeklyHours: fte > 0 ? hours / fte : 0,
    capacityEfficiencyFactor: hours > 0 ? effective / hours : DEFAULT_CAPACITY_EFFICIENCY_FACTOR,
    annualSalary: fte > 0 ? salaryTotal / fte : 0,
    hasInterruptShield: teams.every((team) => team.config.hasInterruptShield),
  };
}

/** Config for the selected scope: one team's config, or the aggregate for the Organization View. */
export function getScopedConfig(teams: Team[], selectedTeamId: string): GlobalConfig {
  return teams.find((team) => team.id === selectedTeamId)?.config ?? aggregateTeamConfigs(teams);
}

/** Services visible in the selected scope. */
export function getScopedServices(services: Service[], teams: Team[], selectedTeamId: string): Service[] {
  return selectedTeamId === ALL_TEAMS_ID
    ? services
    : services.filter((service) => getServiceTeamId(service, teams) === selectedTeamId);
}

/** Hiring exposure for the selected scope; the Organization View sums each team's own shortfall. */
export function getScopedHiringCost(state: DashboardState): number {
  const teams = getTeams(state);
  const selected = state.selectedTeamId ?? teams[0].id;
  const scopedTeams = selected === ALL_TEAMS_ID ? teams : teams.filter((team) => team.id === selected);
  return scopedTeams.reduce(
    (sum, team) =>
      sum +
      computeCapacityReport({
        globalConfig: team.config,
        services: state.services.filter((service) => getServiceTeamId(service, teams) === team.id),
      }).hiringCost,
    0,
  );
}
