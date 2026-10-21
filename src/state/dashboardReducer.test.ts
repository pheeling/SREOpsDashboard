import { describe, expect, it } from "vitest";
import type { DashboardState } from "../engine/types";
import { DEFAULT_SERVICES, cloneDefaultServices } from "../engine/seedServices";
import { dashboardReducer } from "./dashboardReducer";

function createState(): DashboardState {
  return {
    teams: [{
      id: "default-team",
      name: "Core SRE",
      fteCount: 1,
      weeklyHours: 40,
      effectiveCapacityPercentage: 0.8,
      annualSalaryBaseline: 150000,
    }],
    services: cloneDefaultServices(),
    selectedTeamId: "all",
  };
}

describe("SLO status state", () => {
  it("seeds every default service with a healthy SLO status", () => {
    expect(DEFAULT_SERVICES.every((service) => service.sloStatus === "healthy")).toBe(true);
    expect(cloneDefaultServices().every((service) => service.sloStatus === "healthy")).toBe(true);
  });

  describe("multi-team state", () => {
    it("adds teams, assigns services, and places new services in the selected team", () => {
      const state = createState();
      const team = {
        id: "runtime",
        name: "Runtime",
        fteCount: 3,
        weeklyHours: 40,
        effectiveCapacityPercentage: 0.7,
        annualSalaryBaseline: 160_000,
      };
      const withTeam = dashboardReducer(state, { type: "ADD_TEAM", payload: team });
      expect(withTeam.selectedTeamId).toBe("runtime");

      const assigned = dashboardReducer(withTeam, {
        type: "ASSIGN_SERVICE_TEAM",
        serviceId: "databases",
        teamId: "runtime",
      });
      const added = dashboardReducer(assigned, {
        type: "ADD_CUSTOM_SERVICE",
        payload: { name: "Queue", deployHours: 1, maintenanceHours: 2 },
      });

      expect(added.services.find((service) => service.id === "databases")?.teamId).toBe("runtime");
      expect(added.services.find((service) => service.id === "custom_queue")?.teamId).toBe("runtime");
    });
  });

  it("updates and resets a service's SLO status", () => {
    const state = createState();
    const updated = dashboardReducer(state, {
      type: "SET_SLO_STATUS",
      serviceId: "databases",
      sloStatus: "exhausted",
    });
    expect(updated.services.find((service) => service.id === "databases")?.sloStatus).toBe("exhausted");

    const reset = dashboardReducer(updated, { type: "RESET", payload: createState() });
    expect(reset.services.find((service) => service.id === "databases")?.sloStatus).toBe("healthy");

    const restored = dashboardReducer(updated, { type: "RESTORE_DEFAULT_SERVICES" });
    expect(restored.services.every((service) => service.sloStatus === "healthy")).toBe(true);
  });

  it("defaults newly added custom services to healthy", () => {
    const added = dashboardReducer(createState(), {
      type: "ADD_CUSTOM_SERVICE",
      payload: { name: "Message Queue", deployHours: 1, maintenanceHours: 1 },
    });
    expect(added.services.find((service) => service.id === "custom_message_queue")?.sloStatus).toBe("healthy");
  });
});
