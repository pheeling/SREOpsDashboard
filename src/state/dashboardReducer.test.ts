import { describe, expect, it } from "vitest";
import type { DashboardState } from "../engine/types";
import { DEFAULT_SERVICES, cloneDefaultServices } from "../engine/seedServices";
import { dashboardReducer } from "./dashboardReducer";

function createState(): DashboardState {
  return {
    globalConfig: { fteCount: 1, weeklyHours: 40, annualSalary: 150000 },
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
});
