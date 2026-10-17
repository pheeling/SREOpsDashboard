import { describe, expect, it } from "vitest";
import type { DashboardState, Service } from "./types";
import {
  AUTOMATION_REDUCTION_FACTOR,
  DEFAULT_CAPACITY_EFFICIENCY_FACTOR,
  DEFAULT_SERVICE_WEIGHT,
  EXPERTISE_EFFORT_MULTIPLIER,
  ON_CALL_MONITORING_SHARE,
  SECURITY_COMPLIANCE_SHARE,
  computeCapacityReport,
  getAutomationRoiHours,
  getBaseHours,
  getCapacityBuckets,
  getEffectiveAvailableHours,
  getHiringCost,
  getParetoToilRanking,
  simulateStabilizationSprint,
  getRequiredHours,
  getServiceWeight,
  getTotalAvailableHours,
  getTotalRequiredHours,
  getAutomationRoiDollars,
} from "./calculations";
import { DEFAULT_SERVICES } from "./seedServices";

function makeService(overrides: Partial<Service> = {}): Service {
  return {
    id: "svc",
    name: "Service",
    deployHours: 5,
    maintenanceHours: 5,
    isActive: true,
    hasExpertise: true,
    isAutomated: false,
    ...overrides,
  };
}

describe("getBaseHours", () => {
  it("sums deploy hours and maintenance hours", () => {
    expect(getBaseHours({ deployHours: 3, maintenanceHours: 4 })).toBe(7);
  });

  it("treats missing, invalid, and non-finite service hours as zero", () => {
    expect(getBaseHours({ deployHours: undefined, maintenanceHours: Number.NaN } as unknown as Service)).toBe(0);
    expect(getBaseHours({ deployHours: "12", maintenanceHours: Number.POSITIVE_INFINITY } as unknown as Service)).toBe(12);
  });
});

describe("DEFAULT_SERVICES", () => {
  it("prefills the 19 standard services with their monthly estimates", () => {
    expect(DEFAULT_SERVICES).toHaveLength(19);
    expect(DEFAULT_SERVICES).toMatchObject([
      { id: "backup", deployHours: 30, maintenanceHours: 15 },
      { id: "frontend_proxy", deployHours: 20, maintenanceHours: 8 },
      { id: "reverse_proxy", deployHours: 15, maintenanceHours: 6 },
      { id: "file_services", deployHours: 20, maintenanceHours: 10 },
      { id: "web_service", deployHours: 25, maintenanceHours: 12 },
      { id: "file_transfer_service", deployHours: 15, maintenanceHours: 8 },
      { id: "firewall", deployHours: 40, maintenanceHours: 20 },
      { id: "internal_networking", deployHours: 50, maintenanceHours: 25 },
      { id: "cicd", deployHours: 60, maintenanceHours: 30 },
      { id: "routing", deployHours: 30, maintenanceHours: 15 },
      { id: "email", deployHours: 35, maintenanceHours: 15 },
      { id: "productivity_suite", deployHours: 40, maintenanceHours: 10 },
      { id: "chat", deployHours: 20, maintenanceHours: 10 },
      { id: "telephone", deployHours: 30, maintenanceHours: 12 },
      { id: "printing", deployHours: 15, maintenanceHours: 10 },
      { id: "edr", deployHours: 45, maintenanceHours: 20 },
      { id: "antivirus", deployHours: 20, maintenanceHours: 8 },
      { id: "vulnerability_management", deployHours: 40, maintenanceHours: 25 },
      { id: "databases", deployHours: 80, maintenanceHours: 40 },
    ]);
    expect(DEFAULT_SERVICES.every((service) => service.isActive && service.hasExpertise && !service.isAutomated)).toBe(true);
  });
});

describe("getRequiredHours", () => {
  it("returns 0 for an inactive service regardless of other modifiers", () => {
    const service = makeService({ isActive: false, deployHours: 10, maintenanceHours: 10 });
    expect(getRequiredHours(service)).toBe(0);
  });

  it("returns base hours unchanged when automation is off", () => {
    const service = makeService({ deployHours: 5, maintenanceHours: 3, isAutomated: false });
    expect(getRequiredHours(service)).toBe(8);
  });

  it("divides hours by 3 when automated (1/3 Automation Rule)", () => {
    const service = makeService({ deployHours: 6, maintenanceHours: 3, isAutomated: true });
    expect(getRequiredHours(service)).toBeCloseTo(9 / AUTOMATION_REDUCTION_FACTOR);
  });

  it("defaults to a weight of 1 when unset", () => {
    const service = makeService({ deployHours: 5, maintenanceHours: 3 });
    expect(getServiceWeight(service)).toBe(DEFAULT_SERVICE_WEIGHT);
  });

  it("preserves an explicit zero criticality weight", () => {
    expect(getServiceWeight(makeService({ weight: 0 }))).toBe(0);
  });

  it("multiplies required hours by the service's criticality weight", () => {
    const service = makeService({ deployHours: 5, maintenanceHours: 3, weight: 2 });
    expect(getRequiredHours(service)).toBe(16);
  });

  it("applies weight after the automation divisor", () => {
    const service = makeService({ deployHours: 6, maintenanceHours: 3, isAutomated: true, weight: 2 });
    expect(getRequiredHours(service)).toBeCloseTo((9 / AUTOMATION_REDUCTION_FACTOR) * 2);
  });

  it("increases a service's required hours by 25% when expertise is missing", () => {
    const withExpertise = getRequiredHours(makeService({ deployHours: 4, maintenanceHours: 4 }));
    const withoutExpertise = getRequiredHours(makeService({ deployHours: 4, maintenanceHours: 4, hasExpertise: false }));
    expect(withoutExpertise).toBeCloseTo(withExpertise * EXPERTISE_EFFORT_MULTIPLIER);
  });
});

describe("getTotalAvailableHours / getTotalRequiredHours", () => {
  it("multiplies FTE count by weekly hours", () => {
    expect(getTotalAvailableHours({ fteCount: 5, weeklyHours: 40, annualSalary: 150000 })).toBe(200);
  });

  it("sums required hours across all active services and skips inactive ones", () => {
    const services = [
      makeService({ id: "a", deployHours: 3, maintenanceHours: 2 }),
      makeService({ id: "b", deployHours: 10, maintenanceHours: 5, isActive: false }),
    ];
    expect(getTotalRequiredHours(services)).toBe(5);
  });

  it("treats invalid FTE capacity and criticality values defensively", () => {
    expect(
      getTotalAvailableHours({ fteCount: Number.NaN, weeklyHours: undefined, annualSalary: 150000 } as unknown as DashboardState["globalConfig"]),
    ).toBe(0);
    const service = makeService({
      deployHours: Number.NaN,
      maintenanceHours: 5,
      weight: Number.POSITIVE_INFINITY,
    });
    expect(getRequiredHours(service)).toBe(5);
  });
});

describe("effective capacity", () => {
  it("defaults to 80% of contracted hours and honors a configured efficiency factor", () => {
    expect(getEffectiveCapacityHours({ fteCount: 5, weeklyHours: 40, annualSalary: 150000 })).toBe(160);
    expect(
      getEffectiveCapacityHours({
        fteCount: 5,
        weeklyHours: 40,
        capacityEfficiencyFactor: 0.5,
        annualSalary: 150000,
      }),
    ).toBe(100);
    expect(DEFAULT_CAPACITY_EFFICIENCY_FACTOR).toBe(0.8);
  });

  it("uses effective capacity for fixed bucket allocations and utilization", () => {
    const report = computeCapacityReport({
      globalConfig: { fteCount: 5, weeklyHours: 40, annualSalary: 150000 },
      services: [],
    });

    expect(report.totalAvailableHours).toBe(200);
    expect(report.effectiveAvailableHours).toBe(160);
    expect(report.buckets.emergencyResponse).toBe(16);
    expect(report.buckets.innovation).toBe(112);
    expect(report.operationalLoadRatio).toBeCloseTo(0.3);
  });

  it("uses the configured factor for reserves and utilization", () => {
    const report = computeCapacityReport({
      globalConfig: {
        fteCount: 5,
        weeklyHours: 40,
        capacityEfficiencyFactor: 0.5,
        annualSalary: 150000,
      },
      services: [],
    });

    expect(report.effectiveAvailableHours).toBe(100);
    expect(report.buckets.emergencyResponse).toBe(10);
    expect(report.operationalLoadRatio).toBeCloseTo(0.3);
  });
});

describe("getEffectiveAvailableHours", () => {
  it("remains equal to FTE capacity regardless of service expertise", () => {
    const state: DashboardState = {
      globalConfig: { fteCount: 5, weeklyHours: 40, annualSalary: 150000 },
      services: [makeService({ deployHours: 10, maintenanceHours: 0, hasExpertise: false })],
    };
    expect(getEffectiveAvailableHours(state)).toBe(200);
    expect(getEffectiveAvailableHours({
      ...state,
      services: state.services.map((service) => ({ ...service, hasExpertise: true })),
    })).toBe(200);
  });
});

describe("getCapacityBuckets", () => {
  it("reserves the Security/Compliance and On-Call/Monitoring shares from effective capacity", () => {
    const state: DashboardState = {
      globalConfig: { fteCount: 10, weeklyHours: 40, annualSalary: 150000 },
      services: [],
    };
    const buckets = getCapacityBuckets(state);
    const effectiveCapacityHours = getTotalAvailableHours(state.globalConfig) * DEFAULT_CAPACITY_EFFICIENCY_FACTOR;
    expect(buckets.securityCompliance).toBeCloseTo(effectiveCapacityHours * SECURITY_COMPLIANCE_SHARE);
    expect(buckets.onCallMonitoring).toBeCloseTo(effectiveCapacityHours * ON_CALL_MONITORING_SHARE);
  });
});

describe("getHiringCost", () => {
  const globalConfig = { fteCount: 5, weeklyHours: 40, annualSalary: 150000 };

  it("returns 0 when operational load is at or below 50% of available hours", () => {
    expect(getHiringCost(100, 200, globalConfig)).toBe(0);
    expect(getHiringCost(50, 200, globalConfig)).toBe(0);
  });

  it("returns a positive cost as soon as load exceeds 50%", () => {
    expect(getHiringCost(100.2, 200, globalConfig)).toBeGreaterThan(0);
  });

  it("computes FTE shortfall using 50% of weekly hours per hire", () => {
    // deficit of 20 hours / (0.5 * 40) = 1 FTE => full annual salary
    expect(getHiringCost(120, 200, globalConfig)).toBeCloseTo(150000);
  });

  it("returns a positive cost at 100% load", () => {
    // deficit of 100 hours / 20 = 5 FTE
    expect(getHiringCost(200, 200, globalConfig)).toBeCloseTo(750000);
  });

  it("returns a finite value when weekly hours are zero or invalid", () => {
    expect(getHiringCost(240, 200, { ...globalConfig, weeklyHours: 0 })).toBe(0);
    expect(getHiringCost(Number.NaN, Number.NaN, { ...globalConfig, weeklyHours: Number.NaN })).toBe(0);
  });
});

describe("getAutomationRoiHours", () => {
  it("reports the weekly hours saved by automating a service", () => {
    const service = makeService({ deployHours: 5, maintenanceHours: 4, hasExpertise: true, isAutomated: false });
    expect(getAutomationRoiHours(service)).toBeCloseTo(9 - 9 / 3);
  });
});

describe("getAutomationRoiDollars", () => {
  it("returns 0 when weekly hours are zero or invalid", () => {
    const service = makeService();
    expect(getAutomationRoiDollars(service, { fteCount: 5, weeklyHours: 0, annualSalary: 150000 })).toBe(0);
    expect(getAutomationRoiDollars(service, { fteCount: 5, weeklyHours: Number.NaN, annualSalary: 150000 })).toBe(0);
  });
});

describe("computeCapacityReport - SRE scenario validation", () => {
  it("counts routine and reactive work as operational load, not innovation capacity", () => {
    const report = computeCapacityReport({
      globalConfig: { fteCount: 10, weeklyHours: 40, annualSalary: 150000 },
      services: [],
    });

    expect(report.operationalLoadHours).toBe(120);
    expect(report.buckets.innovation).toBe(280);
    expect(report.operationalLoadRatio).toBe(0.3);
    expect(report.isRedZone).toBe(false);
  });

  it("returns finite zero ratios when capacity and input values are invalid", () => {
    const report = computeCapacityReport({
      globalConfig: {
        fteCount: 0,
        weeklyHours: Number.NaN,
        annualSalary: 150000,
      },
      services: [makeService({ deployHours: undefined as unknown as number, maintenanceHours: Number.NaN })],
    });

    expect(report.totalAvailableHours).toBe(0);
    expect(report.totalRequiredHours).toBe(0);
    expect(report.operationalLoadRatio).toBe(0);
    expect(report.isRedZone).toBe(false);
    expect(Object.values(report.buckets).every(Number.isFinite)).toBe(true);
  });

  it("marks non-zero workload as overloaded when total capacity is zero", () => {
    const report = computeCapacityReport({
      globalConfig: { fteCount: 0, weeklyHours: 40, annualSalary: 150000 },
      services: [makeService({ deployHours: 1, maintenanceHours: 0 })],
    });

    expect(report.operationalLoadRatio).toBe(1);
    expect(report.isRedZone).toBe(true);
  });

  it("recalculates bucket workload when automation and expertise change", () => {
    const state: DashboardState = {
      globalConfig: { fteCount: 5, weeklyHours: 40, annualSalary: 150000 },
      services: [makeService({ deployHours: 60, maintenanceHours: 30, hasExpertise: false })],
    };
    const manualWithoutExpertise = computeCapacityReport(state);
    const automatedWithExpertise = computeCapacityReport({
      ...state,
      services: [{ ...state.services[0], isAutomated: true, hasExpertise: true }],
    });

    expect(manualWithoutExpertise.buckets.maintenance).toBeCloseTo(
      automatedWithExpertise.buckets.maintenance * AUTOMATION_REDUCTION_FACTOR * EXPERTISE_EFFORT_MULTIPLIER,
    );
    expect(automatedWithExpertise.effectiveAvailableHours).toBe(manualWithoutExpertise.effectiveAvailableHours);
  });

  it("Scenario 1: The Overloaded Startup breaches the Red Zone with a large hiring cost", () => {
    const services: Service[] = DEFAULT_SERVICES.map((s) => ({
      ...s,
      hasExpertise: false,
      isAutomated: false,
    }));
    const state: DashboardState = {
      globalConfig: { fteCount: 2, weeklyHours: 40, annualSalary: 150000 },
      services,
    };

    const report = computeCapacityReport(state);

    expect(report.isRedZone).toBe(true);
    expect(report.operationalLoadRatio).toBeGreaterThan(0.5);
    expect(report.totalRequiredHours).toBeGreaterThan(report.effectiveAvailableHours);
    expect(report.hiringCost).toBeGreaterThan(0);
  });

  it("Scenario 2: The Automated Enterprise stays well below the Red Zone", () => {
    const services: Service[] = DEFAULT_SERVICES.map((s) => ({
      ...s,
      hasExpertise: true,
      isAutomated: true,
    }));
    // With the default capacity discount and fixed operational reserves,
    // a larger automated team is needed to stay under the 50% Red Zone line.
    const state: DashboardState = {
      globalConfig: { fteCount: 100, weeklyHours: 40, annualSalary: 150000 },
      services,
    };

    const report = computeCapacityReport(state);

    expect(report.isRedZone).toBe(false);
    expect(report.operationalLoadRatio).toBeLessThan(0.5);
    expect(report.buckets.innovation).toBeGreaterThan(
      report.buckets.maintenance + report.buckets.emergencyResponse + report.buckets.testingScaling,
    );
    expect(report.hiringCost).toBe(0);
  });

  it("Scenario 3: Deactivating services removes their contribution entirely", () => {
    const allActive: DashboardState = {
      globalConfig: { fteCount: 10, weeklyHours: 40, annualSalary: 150000 },
      services: DEFAULT_SERVICES.map((s) => ({ ...s, isActive: true })),
    };
    const someInactive: DashboardState = {
      globalConfig: { fteCount: 10, weeklyHours: 40, annualSalary: 150000 },
      services: DEFAULT_SERVICES.map((s) =>
        s.id === "databases" || s.id === "internal_networking" ? { ...s, isActive: false } : { ...s, isActive: true },
      ),
    };

    const baseline = computeCapacityReport(allActive);
    const withDeactivated = computeCapacityReport(someInactive);

    expect(withDeactivated.totalRequiredHours).toBeLessThan(baseline.totalRequiredHours);
    expect(withDeactivated.operationalLoadRatio).toBeLessThan(baseline.operationalLoadRatio);
  });

  it("Scenario 4: The Expertise Gap increases service workload without changing capacity", () => {
    const withExpertise: DashboardState = {
      globalConfig: { fteCount: 10, weeklyHours: 40, annualSalary: 150000 },
      services: DEFAULT_SERVICES.map((s) => ({ ...s, hasExpertise: true })),
    };
    const withoutExpertiseForCriticalServices: DashboardState = {
      globalConfig: { fteCount: 10, weeklyHours: 40, annualSalary: 150000 },
      services: DEFAULT_SERVICES.map((s) =>
        s.id === "databases" || s.id === "internal_networking" ? { ...s, hasExpertise: false } : { ...s, hasExpertise: true },
      ),
    };

    const baseline = computeCapacityReport(withExpertise);
    const withGap = computeCapacityReport(withoutExpertiseForCriticalServices);

    expect(withGap.totalAvailableHours).toBe(baseline.totalAvailableHours);
    expect(withGap.effectiveAvailableHours).toBe(baseline.effectiveAvailableHours);
    expect(withGap.totalRequiredHours).toBeGreaterThan(baseline.totalRequiredHours);
    expect(withGap.operationalLoadRatio).toBeGreaterThan(baseline.operationalLoadRatio);
  });
});

describe("Toil Elimination Audit", () => {
  it("reduces required hours to a third when toggling automation on, across service counts", () => {
    for (const count of [1, 5, 10, 19]) {
      const services = DEFAULT_SERVICES.slice(0, count).map((s) => ({ ...s, isActive: true, isAutomated: false }));
      const manualTotal = getTotalRequiredHours(services);
      const automatedTotal = getTotalRequiredHours(services.map((s) => ({ ...s, isAutomated: true })));
      expect(automatedTotal).toBeCloseTo(manualTotal / AUTOMATION_REDUCTION_FACTOR);
    }
  });
});

describe("Pareto toil ranking & stabilization sprint", () => {
  const services = [
    makeService({ id: "a", deployHours: 0, maintenanceHours: 6 }),
    makeService({ id: "b", deployHours: 0, maintenanceHours: 2 }),
    makeService({ id: "c", deployHours: 0, maintenanceHours: 1 }),
    makeService({ id: "d", deployHours: 0, maintenanceHours: 1 }),
    makeService({ id: "off", deployHours: 0, maintenanceHours: 50, isActive: false }),
  ];
  const state: DashboardState = {
    globalConfig: { fteCount: 4, weeklyHours: 40, annualSalary: 150_000 },
    services,
  };

  it("ranks active services and flags the top 3", () => {
    const p = getParetoToilRanking(services);
    expect(p.entries.map((e) => e.id)).toEqual(["a", "b", "c", "d"]);
    expect(p.entries[0].share).toBeCloseTo(0.6);
    expect(p.topShare).toBeCloseTo(0.9);
    expect(p.entries.filter((e) => e.isTopContributor)).toHaveLength(3);
    expect(p.entries[3].cumulativeShare).toBeCloseTo(1);
  });

  it("simulates halving the top service without mutating state", () => {
    const s = simulateStabilizationSprint(state)!;
    expect(s.serviceId).toBe("a");
    expect(s.hoursSavedPerWeek).toBeCloseTo(3);
    expect(s.after.buckets.maintenance).toBeCloseTo(s.before.buckets.maintenance - 3);
    expect(s.after.operationalLoadRatio).toBeLessThan(s.before.operationalLoadRatio);
    expect(state.services[0].maintenanceHours).toBe(6);
  });

  it("returns null when no active toil exists", () => {
    expect(simulateStabilizationSprint({ ...state, services: [] })).toBeNull();
  });
});
