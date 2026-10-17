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
} from "./types";

/** Divisor applied to a service's hours once it has been automated ("1/3 Automation Rule"). */
export const AUTOMATION_REDUCTION_FACTOR = 3;

/** Effort multiplier applied to services the team lacks expertise to operate. */
export const EXPERTISE_EFFORT_MULTIPLIER = 1.25;

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
 * weight, then multiplied by 1.25 when the team lacks expertise. Inactive
 * services contribute 0 hours to the active workload.
 */
export function getRequiredHours(service: Service): number {
  if (!service.isActive) return 0;
  const expertiseMultiplier = service.hasExpertise ? 1 : EXPERTISE_EFFORT_MULTIPLIER;
  return (getBaseHours(service) / getAutomationDivisor(service)) * getServiceWeight(service) * expertiseMultiplier * getOwnershipMultiplier(service);
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
