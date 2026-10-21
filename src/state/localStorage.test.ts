import { describe, expect, it } from "vitest";
import { migrateState } from "./localStorage";

describe("migrateState", () => {
  it("converts legacy team configuration and preserves customized services", () => {
    const service = {
      id: "custom_database",
      name: "Custom Database",
      deployHours: 17,
      maintenanceHours: 9,
      isActive: false,
      hasExpertise: false,
      isAutomated: true,
      prrApproved: false,
      sloStatus: "warning",
    };
    const state = migrateState({
      globalConfig: {
        fteCount: 7,
        weeklyHours: 36,
        capacityEfficiencyFactor: 0.65,
        annualSalary: 175_000,
        hasInterruptShield: true,
      },
      services: [service],
    });

    expect(state).toEqual({
      teams: [{
        id: "default-team",
        name: "Core SRE",
        fteCount: 7,
        weeklyHours: 36,
        hasInterruptShield: true,
        effectiveCapacityPercentage: 0.65,
        annualSalaryBaseline: 175_000,
      }],
      services: [{ ...service, teamId: "default-team" }],
      selectedTeamId: "all",
    });
  });

  it("assigns unlinked services to the first team and falls back to all teams for invalid scope", () => {
    const state = migrateState({
      teams: [
        { id: "platform", name: "Platform", fteCount: 2, weeklyHours: 40, effectiveCapacityPercentage: 0.8, annualSalaryBaseline: 150_000 },
        { id: "runtime", name: "Runtime", fteCount: 3, weeklyHours: 40, effectiveCapacityPercentage: 0.7, annualSalaryBaseline: 160_000 },
      ],
      services: [{ id: "service", prrApproved: false }],
      selectedTeamId: "missing",
    });

    expect(state?.services[0]).toMatchObject({ id: "service", teamId: "platform", prrApproved: false, sloStatus: "healthy" });
    expect(state?.selectedTeamId).toBe("all");
  });

  it("rejects malformed state without throwing", () => {
    expect(migrateState(null)).toBeNull();
    expect(migrateState({ services: [] })).toBeNull();
    expect(migrateState({ globalConfig: {}, services: "invalid" })).toBeNull();
  });
});
