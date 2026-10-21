import { describe, expect, it } from "vitest";
import type { DashboardState } from "../engine/types";
import { DEFAULT_SERVICES, cloneDefaultServices } from "../engine/seedServices";
import { dashboardReducer } from "./dashboardReducer";

function createState(): DashboardState {
  return {
    globalConfig: { fteCount: 1, weeklyHours: 40, annualSalary: 150000 },
    teams: [
      { id: "team_a", name: "Team A" },
      { id: "team_b", name: "Team B" },
    ],
    services: cloneDefaultServices(),
  };
}

describe("SLO status state", () => {
  it("seeds every default service with a healthy SLO status", () => {
    expect(DEFAULT_SERVICES.every((service) => service.sloStatus === "healthy")).toBe(true);
    expect(cloneDefaultServices().every((service) => service.sloStatus === "healthy")).toBe(true);
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

  it("assigns a service to an existing team and ignores unknown teams", () => {
    const state = createState();
    const updated = dashboardReducer(state, { type: "SET_SERVICE_TEAM", serviceId: "databases", teamId: "team_b" });
    expect(updated.services.find((service) => service.id === "databases")?.teamId).toBe("team_b");
    expect(dashboardReducer(state, { type: "SET_SERVICE_TEAM", serviceId: "databases", teamId: "nope" })).toBe(state);
  });

  it("assigns custom services to the chosen team, falling back to the first team", () => {
    const chosen = dashboardReducer(createState(), {
      type: "ADD_CUSTOM_SERVICE",
      payload: { name: "Queue", deployHours: 1, maintenanceHours: 1, teamId: "team_b" },
    });
    expect(chosen.services.find((service) => service.id === "custom_queue")?.teamId).toBe("team_b");
    const fallback = dashboardReducer(createState(), {
      type: "ADD_CUSTOM_SERVICE",
      payload: { name: "Queue", deployHours: 1, maintenanceHours: 1, teamId: "nope" },
    });
    expect(fallback.services.find((service) => service.id === "custom_queue")?.teamId).toBe("team_a");
  });

  it("assigns restored default services to the primary team", () => {
    const restored = dashboardReducer(createState(), { type: "RESTORE_DEFAULT_SERVICES" });
    expect(restored.services).toHaveLength(19);
    expect(restored.services.every((service) => service.teamId === "team_a")).toBe(true);
  });
});
