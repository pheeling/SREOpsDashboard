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
  Service,
  ServiceBreakdown,
} from "./types";

/** Divisor applied to a service's hours once it has been automated ("1/3 Automation Rule"). */
export const AUTOMATION_REDUCTION_FACTOR = 3;

/** Fraction of a service's operational hours reduced from FTE availability when the team lacks expertise. */
export const EXPERTISE_AVAILABILITY_PENALTY = 0.2;

/** Fixed share of raw capacity reserved for unexpected incidents/outages. */
export const EMERGENCY_RESPONSE_SHARE = 0.1;

/** Fixed share of raw capacity reserved for user-growth prep/testing. */
export const TESTING_SCALING_SHARE = 0.05;

/** Fixed share of raw capacity reserved for security/compliance patching (CVE remediation, audits). */
export const SECURITY_COMPLIANCE_SHARE = 0.08;

/** Fixed share of raw capacity reserved for on-call rotations, alert triage and SLO/monitoring upkeep. */
export const ON_CALL_MONITORING_SHARE = 0.07;

/** Default criticality/"blast-radius" weight applied to a service when none is specified. */
export const DEFAULT_SERVICE_WEIGHT = 1;

/** SRE-mandated ceiling on manual operational work as a share of total capacity. */
export const RED_ZONE_THRESHOLD = 0.5;

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
  const weight = finiteNumber(service.weight, DEFAULT_SERVICE_WEIGHT);
  return weight > 0 ? weight : DEFAULT_SERVICE_WEIGHT;
}

/** Base Hours = Deploying Hours + Maintenance Hours (before automation is applied). */
export function getBaseHours(service: Pick<Service, "deployHours" | "maintenanceHours">): number {
  return finiteNumber(service.deployHours) + finiteNumber(service.maintenanceHours);
}

/**
 * Required_Hours for a single service: Base Hours divided by 3 when
 * automation is toggled on, then multiplied by the service's criticality
 * weight. Inactive services contribute 0 hours to the active workload.
 */
export function getRequiredHours(service: Service): number {
  if (!service.isActive) return 0;
  return (getBaseHours(service) / getAutomationDivisor(service)) * getServiceWeight(service);
}

/**
 * The availability penalty (in hours) incurred because the team lacks
 * technical expertise for this service: 20% of the service's own required
 * hours, subtracted from overall FTE availability. Only applies to active
 * services.
 */
export function getExpertisePenaltyHours(service: Service): number {
  if (!service.isActive || service.hasExpertise) return 0;
  return getRequiredHours(service) * EXPERTISE_AVAILABILITY_PENALTY;
}

export function getTotalRequiredHours(services: Service[]): number {
  return services.reduce((sum, service) => sum + getRequiredHours(service), 0);
}

export function getTotalAvailableHours(globalConfig: GlobalConfig): number {
  return finiteNumber(globalConfig.fteCount) * finiteNumber(globalConfig.weeklyHours);
}

export function getEffectiveAvailableHours(state: DashboardState): number {
  const totalAvailableHours = getTotalAvailableHours(state.globalConfig);
  const penalty = state.services.reduce((sum, service) => sum + getExpertisePenaltyHours(service), 0);
  return Math.max(0, totalAvailableHours - penalty);
}

export function getServiceBreakdown(service: Service): ServiceBreakdown {
  return {
    id: service.id,
    name: service.name,
    isActive: service.isActive,
    isAutomated: service.isAutomated,
    hasExpertise: service.hasExpertise,
    weight: getServiceWeight(service),
    baseHours: getBaseHours(service),
    requiredHours: getRequiredHours(service),
    expertisePenaltyHours: getExpertisePenaltyHours(service),
  };
}

/**
 * Allocates capacity across the six Capacity Budget buckets. Maintenance &
 * Eliminating Toil is derived directly from active services; Emergency
 * Response, Testing & Scaling, Security & Compliance Patching, and On-Call &
 * Monitoring use fixed shares of raw capacity; Innovation absorbs whatever
 * effective capacity remains (never negative).
 */
export function getCapacityBuckets(state: DashboardState): CapacityBuckets {
  const totalAvailableHours = getTotalAvailableHours(state.globalConfig);
  const effectiveAvailableHours = getEffectiveAvailableHours(state);
  const maintenance = getTotalRequiredHours(state.services);

  const emergencyResponse = totalAvailableHours * EMERGENCY_RESPONSE_SHARE;
  const testingScaling = totalAvailableHours * TESTING_SCALING_SHARE;
  const securityCompliance = totalAvailableHours * SECURITY_COMPLIANCE_SHARE;
  const onCallMonitoring = totalAvailableHours * ON_CALL_MONITORING_SHARE;

  const allocated = maintenance + emergencyResponse + testingScaling + securityCompliance + onCallMonitoring;
  const innovation = Math.max(0, effectiveAvailableHours - allocated);

  return { innovation, maintenance, emergencyResponse, testingScaling, securityCompliance, onCallMonitoring };
}

/**
 * Financial Widget: "External Hiring Costs".
 * ((Required_Hours - Available_Hours) / Total_Available_Weekly_Hours) * Annual_Salary_Baseline
 */
export function getHiringCost(
  totalRequiredHours: number,
  effectiveAvailableHours: number,
  globalConfig: GlobalConfig,
): number {
  totalRequiredHours = finiteNumber(totalRequiredHours);
  effectiveAvailableHours = finiteNumber(effectiveAvailableHours);
  const weeklyHours = finiteNumber(globalConfig.weeklyHours);
  const annualSalary = finiteNumber(globalConfig.annualSalary);
  if (totalRequiredHours <= effectiveAvailableHours) {
    return 0;
  }
  const deficitHours = totalRequiredHours - effectiveAvailableHours;
  return weeklyHours > 0 ? (deficitHours / weeklyHours) * annualSalary : 0;
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
  const operationalLoadHours =
    buckets.maintenance +
    buckets.emergencyResponse +
    buckets.testingScaling +
    buckets.securityCompliance +
    buckets.onCallMonitoring;
  let operationalLoadRatio = 0;
  if (totalAvailableHours > 0) {
    // A fully exhausted effective capacity with raw capacity available is still a red-zone state.
    operationalLoadRatio = effectiveAvailableHours > 0 ? operationalLoadHours / effectiveAvailableHours : 1;
  }

  return {
    services: services.map(getServiceBreakdown),
    totalAvailableHours,
    effectiveAvailableHours,
    totalRequiredHours,
    buckets,
    operationalLoadHours,
    operationalLoadRatio,
    isRedZone: operationalLoadRatio > RED_ZONE_THRESHOLD,
    hiringCost: getHiringCost(totalRequiredHours, effectiveAvailableHours, globalConfig),
  };
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
