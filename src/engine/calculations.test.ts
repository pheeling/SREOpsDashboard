import { describe, expect, it } from "vitest";
import type { DashboardState, Service } from "./types";
import {
  AUTOMATION_REDUCTION_FACTOR,
  EXPERTISE_AVAILABILITY_PENALTY,
  computeCapacityReport,
  getAutomationRoiHours,
  getBaseHours,
  getEffectiveAvailableHours,
  getExpertisePenaltyHours,
  getHiringCost,
  getRequiredHours,
  getTotalAvailableHours,
  getTotalRequiredHours,
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
});

describe("getExpertisePenaltyHours", () => {
  it("is 0 when the team has expertise", () => {
    const service = makeService({ hasExpertise: true, deployHours: 4, maintenanceHours: 4 });
    expect(getExpertisePenaltyHours(service)).toBe(0);
  });

  it("is 0 when the service is inactive, even without expertise", () => {
    const service = makeService({ hasExpertise: false, isActive: false });
    expect(getExpertisePenaltyHours(service)).toBe(0);
  });

  it("reduces availability by 20% of the service's required hours when expertise is missing", () => {
    const service = makeService({ hasExpertise: false, deployHours: 4, maintenanceHours: 4, isAutomated: false });
    expect(getExpertisePenaltyHours(service)).toBeCloseTo(8 * EXPERTISE_AVAILABILITY_PENALTY);
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
});

describe("getEffectiveAvailableHours", () => {
  it("subtracts the expertise penalty from raw available hours", () => {
    const state: DashboardState = {
      globalConfig: { fteCount: 5, weeklyHours: 40, annualSalary: 150000 },
      services: [makeService({ deployHours: 10, maintenanceHours: 0, hasExpertise: false })],
    };
    // raw = 200, penalty = 10 * 0.2 = 2
    expect(getEffectiveAvailableHours(state)).toBeCloseTo(198);
  });
});

describe("getHiringCost", () => {
  const globalConfig = { fteCount: 5, weeklyHours: 40, annualSalary: 150000 };

  it("returns 0 when required hours do not exceed available hours", () => {
    expect(getHiringCost(150, 200, globalConfig)).toBe(0);
  });

  it("computes the fractional-FTE hiring cost when there is a deficit", () => {
    // deficit of 40 hours / 40 weekly hours = 1 FTE => full annual salary
    expect(getHiringCost(240, 200, globalConfig)).toBeCloseTo(150000);
  });

  it("scales proportionally for partial FTE deficits", () => {
    // deficit of 20 hours / 40 = 0.5 FTE => half annual salary
    expect(getHiringCost(220, 200, globalConfig)).toBeCloseTo(75000);
  });
});

describe("getAutomationRoiHours", () => {
  it("reports the weekly hours saved by automating a service", () => {
    const service = makeService({ deployHours: 5, maintenanceHours: 4, hasExpertise: true, isAutomated: false });
    expect(getAutomationRoiHours(service)).toBeCloseTo(9 - 9 / 3);
  });
});

describe("computeCapacityReport - SRE scenario validation", () => {
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
    const state: DashboardState = {
      globalConfig: { fteCount: 10, weeklyHours: 40, annualSalary: 150000 },
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

  it("Scenario 4: The Expertise Gap increases operational load via the availability penalty", () => {
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

    expect(withGap.effectiveAvailableHours).toBeLessThan(baseline.effectiveAvailableHours);
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
