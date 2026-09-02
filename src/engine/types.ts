/**
 * Core domain types for the SRE Infrastructure Complexity & Operational
 * Capacity Calculator.
 *
 * The shape mirrors the "Normalized State Schema" defined in the technical
 * design plan so that the reducer/state layer can be persisted verbatim to
 * LocalStorage.
 */

export interface GlobalConfig {
  /** Total number of Full-Time Employees available to operate the estate. */
  fteCount: number;
  /** Average weekly hours worked per FTE. */
  weeklyHours: number;
  /** Market rate baseline used for hiring-cost projections ($/year/FTE). */
  annualSalary: number;
}

export interface Service {
  id: string;
  name: string;
  /** Baseline weekly hours required to run the service with no modifiers. */
  baseHours: number;
  /** Whether the team has in-house Subject Matter Expertise for this service. */
  hasSME: boolean;
  /** Whether toil for this service has been automated away. */
  isAutomated: boolean;
  /**
   * Systemic importance multiplier. High-impact services (e.g. Databases,
   * Internal Networking) are weighted above 1 to reflect the outsized
   * operational cost of getting them wrong.
   */
  weight: number;
}

export interface DashboardState {
  globalConfig: GlobalConfig;
  services: Service[];
}

/** The seven Capacity Budget buckets described in the design plan. */
export interface CapacityBuckets {
  innovation: number;
  scaling: number;
  maintenance: number;
  eliminatingToil: number;
  monitoring: number;
  emergencyResponse: number;
  testing: number;
}

export interface ServiceBreakdown {
  id: string;
  name: string;
  /** Hours required after the SME penalty and automation factor are applied. */
  requiredHours: number;
  /** Portion of requiredHours attributable to steady-state upkeep. */
  maintenanceHours: number;
  /** Portion of requiredHours attributable to the missing-SME "cognitive tax". */
  emergencyResponseHours: number;
  /** Engineering investment needed to automate this service, if not already automated. */
  eliminatingToilHours: number;
}

export interface CapacityReport {
  services: ServiceBreakdown[];
  totalAvailableHours: number;
  totalRequiredHours: number;
  buckets: CapacityBuckets;
  /** buckets.eliminatingToil + buckets.maintenance + buckets.emergencyResponse */
  operationalToilHours: number;
  /** operationalToilHours / totalAvailableHours, expressed 0..1 (or higher if over capacity). */
  operationalToilRatio: number;
  /** True when operationalToilRatio exceeds the 50% SRE threshold. */
  isRedZone: boolean;
  /** Fractional-FTE hiring cost required to close the Required/Available gap. */
  hiringCost: number;
}
