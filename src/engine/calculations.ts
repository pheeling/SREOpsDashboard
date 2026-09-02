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

/** Inverse modifier applied when a service has no in-house SME (the "cognitive tax"). */
export const SME_PENALTY_MODIFIER = 1.25;

/** Divisor applied to a service's hours once it has been automated ("1/3 Automation Rule"). */
export const AUTOMATION_REDUCTION_FACTOR = 3;

/** SRE-mandated ceiling on manual operational work as a share of total capacity. */
export const RED_ZONE_THRESHOLD = 0.5;

/** Fixed baseline used for financial modeling, per the design plan. */
export const DEFAULT_ANNUAL_SALARY = 150_000;

export function getSmeMultiplier(service: Pick<Service, "hasSME">): number {
  return service.hasSME ? 1 : SME_PENALTY_MODIFIER;
}

export function getAutomationDivisor(service: Pick<Service, "isAutomated">): number {
  return service.isAutomated ? AUTOMATION_REDUCTION_FACTOR : 1;
}

/**
 * Required_Hours for a single service, after applying the SME penalty, the
 * automation reduction factor, and the service's systemic-importance weight.
 */
export function getRequiredHours(service: Service): number {
  const smeMultiplier = getSmeMultiplier(service);
  const automationDivisor = getAutomationDivisor(service);
  return (service.baseHours * smeMultiplier * (service.weight ?? 1)) / automationDivisor;
}

export function getTotalRequiredHours(services: Service[]): number {
  return services.reduce((sum, service) => sum + getRequiredHours(service), 0);
}

export function getTotalAvailableHours(globalConfig: GlobalConfig): number {
  return globalConfig.fteCount * globalConfig.weeklyHours;
}

/**
 * Decomposes a single service's Required_Hours into the Maintenance and
 * Emergency Response capacity buckets, and estimates the engineering
 * investment (Eliminating Toil) needed to automate it if it isn't already.
 */
export function getServiceBreakdown(service: Service): ServiceBreakdown {
  const weight = service.weight ?? 1;
  const automationDivisor = getAutomationDivisor(service);
  const weightedBase = (service.baseHours * weight) / automationDivisor;

  const maintenanceHours = weightedBase;
  const emergencyResponseHours = service.hasSME
    ? 0
    : weightedBase * (SME_PENALTY_MODIFIER - 1);
  const eliminatingToilHours = service.isAutomated
    ? 0
    : (service.baseHours * weight) / AUTOMATION_REDUCTION_FACTOR;

  return {
    id: service.id,
    name: service.name,
    requiredHours: maintenanceHours + emergencyResponseHours,
    maintenanceHours,
    emergencyResponseHours,
    eliminatingToilHours,
  };
}

/**
 * Allocates total available capacity across the seven Capacity Budget
 * buckets. Maintenance, Emergency Response and Eliminating Toil are derived
 * directly from the service matrix; Monitoring, Testing and Scaling use
 * modest fixed baselines proportional to estate size/headcount; Innovation
 * absorbs whatever capacity remains (never negative).
 */
export function getCapacityBuckets(state: DashboardState): CapacityBuckets {
  const { services, globalConfig } = state;
  const totalAvailableHours = getTotalAvailableHours(globalConfig);

  const breakdowns = services.map(getServiceBreakdown);
  const maintenance = breakdowns.reduce((sum, s) => sum + s.maintenanceHours, 0);
  const emergencyResponse = breakdowns.reduce((sum, s) => sum + s.emergencyResponseHours, 0);
  const eliminatingToil = breakdowns.reduce((sum, s) => sum + s.eliminatingToilHours, 0);

  const monitoring = services.length * 0.5;
  const testing = services.length * 0.25;
  const scaling = totalAvailableHours * 0.05;

  const allocated = maintenance + emergencyResponse + eliminatingToil + monitoring + testing + scaling;
  const innovation = Math.max(0, totalAvailableHours - allocated);

  return {
    innovation,
    scaling,
    maintenance,
    eliminatingToil,
    monitoring,
    emergencyResponse,
    testing,
  };
}

/**
 * Financial Widget: "Hiring Cost Estimator".
 * ((Required_Hours - Available_Hours) / Total_Available_Weekly_Hours) * Annual_Salary_Baseline
 */
export function getHiringCost(
  totalRequiredHours: number,
  totalAvailableHours: number,
  globalConfig: GlobalConfig,
): number {
  if (totalRequiredHours <= totalAvailableHours) {
    return 0;
  }
  const deficitHours = totalRequiredHours - totalAvailableHours;
  return (deficitHours / globalConfig.weeklyHours) * globalConfig.annualSalary;
}

/**
 * Runs the full engine over the current dashboard state, producing every
 * derived number the UI needs (buckets, red-zone status, hiring cost, etc).
 */
export function computeCapacityReport(state: DashboardState): CapacityReport {
  const { services, globalConfig } = state;

  const totalAvailableHours = getTotalAvailableHours(globalConfig);
  const totalRequiredHours = getTotalRequiredHours(services);
  const buckets = getCapacityBuckets(state);
  const operationalToilHours = buckets.eliminatingToil + buckets.maintenance + buckets.emergencyResponse;
  const operationalToilRatio = totalAvailableHours > 0 ? operationalToilHours / totalAvailableHours : 0;

  return {
    services: services.map(getServiceBreakdown),
    totalAvailableHours,
    totalRequiredHours,
    buckets,
    operationalToilHours,
    operationalToilRatio,
    isRedZone: operationalToilRatio > RED_ZONE_THRESHOLD,
    hiringCost: getHiringCost(totalRequiredHours, totalAvailableHours, globalConfig),
  };
}

/**
 * Automation ROI: the weekly hours saved for a service by toggling
 * automation on, converted into an annualized dollar figure using the
 * salary baseline (mirrors the Hiring Cost conversion rate).
 */
export function getAutomationRoiHours(service: Service): number {
  const withoutAutomation = getRequiredHours({ ...service, isAutomated: false });
  const withAutomation = getRequiredHours({ ...service, isAutomated: true });
  return withoutAutomation - withAutomation;
}

export function getAutomationRoiDollars(service: Service, globalConfig: GlobalConfig): number {
  const hoursSavedPerWeek = getAutomationRoiHours(service);
  return (hoursSavedPerWeek / globalConfig.weeklyHours) * globalConfig.annualSalary;
}
