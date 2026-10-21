import { describe, expect, it } from "vitest";
import { migrateState } from "./localStorage";

describe("migrateState", () => {
  const legacy = {
    globalConfig: { fteCount: 3, weeklyHours: 38, annualSalary: 120000, capacityEfficiencyFactor: 0.7 },
    services: [{ id: "x", name: "X", deployHours: 1, maintenanceHours: 2, isActive: true, hasExpertise: true, isAutomated: false }],
  };

  it("converts legacy config into a default team and assigns services", () => {
    const s = migrateState(legacy)!;
    expect(s.teams).toEqual([
      { id: "default-team", name: "Core SRE", fteCount: 3, weeklyHours: 38, effectiveCapacityPercentage: 0.7, annualSalaryBaseline: 120000 },
    ]);
    expect(s.services[0].teamId).toBe("default-team");
    expect(s.selectedTeamId).toBe("all");
    expect(s.globalConfig).toEqual(legacy.globalConfig);
  });

  it("keeps existing teams and falls back on an unknown selection", () => {
    const teams = [{ id: "t", name: "T", fteCount: 1, weeklyHours: 40, effectiveCapacityPercentage: 0.8, annualSalaryBaseline: 1 }];
    const s = migrateState({ ...legacy, teams, selectedTeamId: "gone" })!;
    expect(s.teams).toEqual(teams);
    expect(s.selectedTeamId).toBe("all");
    expect(s.services[0].teamId).toBe("t");
  });

  it("returns null for invalid input", () => {
    expect(migrateState(null)).toBeNull();
    expect(migrateState({ services: [] })).toBeNull();
  });
});
