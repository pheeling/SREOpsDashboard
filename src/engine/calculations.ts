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

/** SRE-mandated ceiling on manual operational work as a share of total capacity. */
export const RED_ZONE_THRESHOLD = 0.5;

/** Fixed baseline used for financial modeling, per the design plan. */
export const DEFAULT_ANNUAL_SALARY = 150_000;

export function getAutomationDivisor(service: Pick<Service, "isAutomated">): number {
  return service.isAutomated ? AUTOMATION_REDUCTION_FACTOR : 1;
}

/** Base Hours = Deploying Hours + Maintenance Hours (before automation is applied). */
export function getBaseHours(service: Pick<Service, "deployHours" | "maintenanceHours">): number {
  return service.deployHours + service.maintenanceHours;
}

/**
 * Required_Hours for a single service: Base Hours divided by 3 when
 * automation is toggled on. Inactive services contribute 0 hours to the
 * active workload.
 */
export function getRequiredHours(service: Service): number {
  if (!service.isActive) return 0;
  return getBaseHours(service) / getAutomationDivisor(service);
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
  return globalConfig.fteCount * globalConfig.weeklyHours;
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
    baseHours: getBaseHours(service),
    requiredHours: getRequiredHours(service),
    expertisePenaltyHours: getExpertisePenaltyHours(service),
  };
}

/**
 * Allocates capacity across the four Capacity Budget buckets. Maintenance &
 * Eliminating Toil is derived directly from active services; Emergency
 * Response and Testing & Scaling use fixed shares of raw capacity;
 * Innovation absorbs whatever effective capacity remains (never negative).
 */
export function getCapacityBuckets(state: DashboardState): CapacityBuckets {
  const totalAvailableHours = getTotalAvailableHours(state.globalConfig);
  const effectiveAvailableHours = getEffectiveAvailableHours(state);
  const maintenance = getTotalRequiredHours(state.services);

  const emergencyResponse = totalAvailableHours * EMERGENCY_RESPONSE_SHARE;
  const testingScaling = totalAvailableHours * TESTING_SCALING_SHARE;

  const allocated = maintenance + emergencyResponse + testingScaling;
  const innovation = Math.max(0, effectiveAvailableHours - allocated);

  return { innovation, maintenance, emergencyResponse, testingScaling };
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
  if (totalRequiredHours <= effectiveAvailableHours) {
    return 0;
  }
  const deficitHours = totalRequiredHours - effectiveAvailableHours;
  return (deficitHours / globalConfig.weeklyHours) * globalConfig.annualSalary;
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
  const operationalLoadHours = buckets.maintenance + buckets.emergencyResponse + buckets.testingScaling;
  const operationalLoadRatio = effectiveAvailableHours > 0 ? operationalLoadHours / effectiveAvailableHours : 0;

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
  return (hoursSavedPerWeek / globalConfig.weeklyHours) * globalConfig.annualSalary;
}
