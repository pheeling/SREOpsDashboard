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
  /** Weekly hours required to initially deploy/roll out the service. */
  deployHours: number;
  /** Weekly hours required for steady-state maintenance of the service. */
  maintenanceHours: number;
  /** Whether this service is actively selected and contributing to the workload. */
  isActive: boolean;
  /** Whether the team has in-house technical expertise for this service. */
  hasExpertise: boolean;
  /** Whether toil for this service has been automated away. */
  isAutomated: boolean;
  /** Whether this service was added by the user (vs. a standard seeded service). */
  isCustom?: boolean;
  /**
   * Criticality/"blast-radius" multiplier applied to the service's required
   * hours. Defaults to 1 (see `DEFAULT_SERVICE_WEIGHT`); high-impact
   * services (e.g. Databases, Internal Networking, Firewall) can be seeded
   * with a value above 1 to reflect that an outage or misconfiguration
   * there costs the operations team disproportionately more effort.
   */
  weight?: number;
}

export interface DashboardState {
  globalConfig: GlobalConfig;
  services: Service[];
}

/** The six Capacity Budget buckets. */
export interface CapacityBuckets {
  /** New Features / Innovation & Toil Reduction: remaining engineering capacity, target >= 50%. */
  innovation: number;
  /** Routine Operations & Maintenance Toil: required hours for active services. */
  maintenance: number;
  /** Emergency Response & Troubleshooting: reserve for unexpected incidents. */
  emergencyResponse: number;
  /** Testing & User Scaling: prep time for user growth. */
  testingScaling: number;
  /** Security & Compliance Patching: reserve for CVE remediation, audits, policy upkeep. */
  securityCompliance: number;
  /** On-Call & Monitoring: reserve for alert triage, dashboards, SLO tracking. */
  onCallMonitoring: number;
}

export interface ServiceBreakdown {
  id: string;
  name: string;
  isActive: boolean;
  isAutomated: boolean;
  hasExpertise: boolean;
  /** Criticality multiplier applied to required hours (see `Service.weight`). */
  weight: number;
  /** Raw Base Hours = Deploy Hours + Maintenance Hours (before automation). */
  baseHours: number;
  /** Hours required after the automation divisor and weight are applied (0 when inactive). */
  requiredHours: number;
  /** Availability penalty (hours) incurred because the team lacks expertise. */
  expertisePenaltyHours: number;
}

export interface CapacityReport {
  services: ServiceBreakdown[];
  /** Raw FTE capacity: fteCount * weeklyHours. */
  totalAvailableHours: number;
  /** Available hours after the expertise-gap availability penalty is applied. */
  effectiveAvailableHours: number;
  /** Sum of active services' required operational hours. */
  totalRequiredHours: number;
  buckets: CapacityBuckets;
  /** Routine operations/toil plus incident response, testing/scaling, patching, and on-call reserves. */
  operationalLoadHours: number;
  /** operationalLoadHours / effectiveAvailableHours, expressed 0..1 (or higher if over capacity). */
  operationalLoadRatio: number;
  /** True when operationalLoadRatio exceeds the 50% SRE threshold. */
  isRedZone: boolean;
  /** Fractional-FTE hiring cost required to close the Required/Available gap. */
  hiringCost: number;
}
