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
  /** Share of contracted hours available for technical work (defaults to 0.8). */
  capacityEfficiencyFactor?: number;
  /** Market rate baseline used for hiring-cost projections ($/year/FTE). */
  annualSalary: number;
  /** Dedicate 1 FTE to interrupts so the other N-1 engineers are shielded (defaults to false). */
  hasInterruptShield?: boolean;
}

export type OwnershipModel = "sre_full" | "shared" | "dev_owned";

export type SloStatus = "healthy" | "warning" | "exhausted";

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
  /** Whether the service has passed its Production Readiness Review. */
  prrApproved: boolean;
  /** Current health of this service's SLO error budget. */
  sloStatus: SloStatus;
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
  /** Who carries the pager/toil for this service; defaults to `sre_full`. */
  ownershipModel?: OwnershipModel;
  /** ID of the team this service is assigned to. */
  teamId?: string;
}

/** Independently configured team in the multi-team data model. */
export interface TeamConfig {
  id: string;
  name: string;
  fteCount: number;
  weeklyHours: number;
  /** Share (0..1) of contracted hours available for technical work. */
  effectiveCapacityPercentage: number;
  annualSalaryBaseline: number;
}

/** 'all' for the whole organization, or a specific team ID. */
export type DashboardScope = "all" | string;

export interface DashboardState {
  globalConfig: GlobalConfig;
  services: Service[];
  teams?: TeamConfig[];
  selectedTeamId?: DashboardScope;
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
  /** Ownership model applied to required hours (see `Service.ownershipModel`). */
  ownershipModel: OwnershipModel;
  /** Raw Base Hours = Deploy Hours + Maintenance Hours (before automation). */
  baseHours: number;
  /** Hours required after the automation divisor and weight are applied (0 when inactive). */
  requiredHours: number;
}

export interface CapacityReport {
  services: ServiceBreakdown[];
  /** Raw FTE capacity: fteCount * weeklyHours. */
  totalAvailableHours: number;
  /** Alias for totalAvailableHours, retained for consumers of the capacity report. */
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
  /** Innovation hours lost to context switching (0 when the interrupt shield is enabled). */
  cognitiveOverheadHours: number;
  /** Innovation hours recovered by enabling the interrupt shield (0 when disabled). */
  recoveredInnovationHours: number;
  /** Toil hours to shed to reach the 50% threshold (0 when not in the Red Zone). */
  deficitHours: number;
}

/** Organization-wide (or single-team) aggregate metrics for a dashboard scope. */
export interface ScopedCapacityReport {
  scope: DashboardScope;
  /** Sum of fteCount * weeklyHours across the teams in scope. */
  totalContractedHours: number;
  /** Sum of fteCount * weeklyHours * effectiveCapacityPercentage across the teams in scope. */
  totalEffectiveCapacity: number;
  /** Required hours of active services in scope. */
  totalRoutineOperations: number;
  /** Sum of per-team hiring shortfalls (over-staffed teams never mask deficits). */
  hiringShortfall: number;
  /** Per-team reports for the teams in scope. */
  teamReports: { team: TeamConfig; report: CapacityReport }[];
}
