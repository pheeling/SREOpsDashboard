import { describe, expect, it } from "vitest";
import type { DashboardState, Service } from "./types";
import {
  AUTOMATION_REDUCTION_FACTOR,
  SME_PENALTY_MODIFIER,
  computeCapacityReport,
  getAutomationRoiHours,
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
    baseHours: 10,
    hasSME: true,
    isAutomated: false,
    weight: 1,
    ...overrides,
  };
}

describe("getRequiredHours", () => {
  it("applies no modifiers when SME is present and automation is off", () => {
    const service = makeService({ baseHours: 8, hasSME: true, isAutomated: false });
    expect(getRequiredHours(service)).toBe(8);
  });

  it("applies the 1.25x SME penalty when SME is missing", () => {
    const service = makeService({ baseHours: 8, hasSME: false, isAutomated: false });
    expect(getRequiredHours(service)).toBeCloseTo(8 * SME_PENALTY_MODIFIER);
  });

  it("divides hours by 3 when automated (1/3 Automation Rule)", () => {
    const service = makeService({ baseHours: 9, hasSME: true, isAutomated: true });
    expect(getRequiredHours(service)).toBeCloseTo(9 / AUTOMATION_REDUCTION_FACTOR);
  });

  it("stacks the SME penalty and automation factor together", () => {
    const service = makeService({ baseHours: 9, hasSME: false, isAutomated: true });
    expect(getRequiredHours(service)).toBeCloseTo((9 * SME_PENALTY_MODIFIER) / AUTOMATION_REDUCTION_FACTOR);
  });

  it("applies the systemic-importance weight multiplier", () => {
    const service = makeService({ baseHours: 10, hasSME: true, isAutomated: false, weight: 1.5 });
    expect(getRequiredHours(service)).toBeCloseTo(15);
  });
});

describe("getTotalAvailableHours / getTotalRequiredHours", () => {
  it("multiplies FTE count by weekly hours", () => {
    expect(getTotalAvailableHours({ fteCount: 5, weeklyHours: 40, annualSalary: 150000 })).toBe(200);
  });

  it("sums required hours across all services", () => {
    const services = [makeService({ id: "a", baseHours: 5 }), makeService({ id: "b", baseHours: 15 })];
    expect(getTotalRequiredHours(services)).toBe(20);
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
    const service = makeService({ baseHours: 9, hasSME: true, isAutomated: false });
    expect(getAutomationRoiHours(service)).toBeCloseTo(9 - 9 / 3);
  });
});

describe("computeCapacityReport - SRE scenario validation", () => {
  it("Scenario 1: The Overloaded Startup breaches the Red Zone with a large hiring cost", () => {
    const services: Service[] = DEFAULT_SERVICES.map((s) => ({
      ...s,
      hasSME: false,
      isAutomated: false,
    }));
    const state: DashboardState = {
      globalConfig: { fteCount: 2, weeklyHours: 40, annualSalary: 150000 },
      services,
    };

    const report = computeCapacityReport(state);

    expect(report.isRedZone).toBe(true);
    expect(report.operationalToilRatio).toBeGreaterThan(0.5);
    expect(report.totalRequiredHours).toBeGreaterThan(report.totalAvailableHours);
    expect(report.hiringCost).toBeGreaterThan(0);
  });

  it("Scenario 2: The Automated Enterprise stays well below the Red Zone", () => {
    const services: Service[] = DEFAULT_SERVICES.map((s) => ({
      ...s,
      hasSME: true,
      isAutomated: true,
    }));
    const state: DashboardState = {
      globalConfig: { fteCount: 10, weeklyHours: 40, annualSalary: 150000 },
      services,
    };

    const report = computeCapacityReport(state);

    expect(report.isRedZone).toBe(false);
    expect(report.operationalToilRatio).toBeLessThan(0.5);
    expect(report.buckets.innovation).toBeGreaterThan(
      report.buckets.maintenance + report.buckets.emergencyResponse + report.buckets.eliminatingToil,
    );
    expect(report.hiringCost).toBe(0);
  });

  it("Scenario 3: The Expertise Gap triggers alerts even with adequate headcount", () => {
    const withSme: DashboardState = {
      globalConfig: { fteCount: 10, weeklyHours: 40, annualSalary: 150000 },
      services: DEFAULT_SERVICES.map((s) => ({ ...s, hasSME: true })),
    };
    const withoutSmeForCriticalServices: DashboardState = {
      globalConfig: { fteCount: 10, weeklyHours: 40, annualSalary: 150000 },
      services: DEFAULT_SERVICES.map((s) =>
        s.id === "databases" || s.id === "internal_networking" ? { ...s, hasSME: false } : { ...s, hasSME: true },
      ),
    };

    const baseline = computeCapacityReport(withSme);
    const withGap = computeCapacityReport(withoutSmeForCriticalServices);

    expect(withGap.totalRequiredHours).toBeGreaterThan(baseline.totalRequiredHours);
    expect(withGap.buckets.emergencyResponse).toBeGreaterThan(baseline.buckets.emergencyResponse);
    expect(withGap.operationalToilRatio).toBeGreaterThan(baseline.operationalToilRatio);
  });
});

describe("Toil Elimination Audit", () => {
  it("reduces required hours to a third when toggling automation on, across service counts", () => {
    for (const count of [1, 5, 10, 20]) {
      const services = DEFAULT_SERVICES.slice(0, count).map((s) => ({ ...s, hasSME: true, isAutomated: false }));
      const manualTotal = getTotalRequiredHours(services);
      const automatedTotal = getTotalRequiredHours(services.map((s) => ({ ...s, isAutomated: true })));
      expect(automatedTotal).toBeCloseTo(manualTotal / AUTOMATION_REDUCTION_FACTOR);
    }
  });
});
