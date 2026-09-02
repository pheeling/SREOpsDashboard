import type { DashboardState, GlobalConfig } from "../engine/types";

export type DashboardAction =
  | { type: "TOGGLE_SME"; serviceId: string }
  | { type: "TOGGLE_AUTOMATION"; serviceId: string }
  | { type: "UPDATE_GLOBAL_CONFIG"; payload: Partial<GlobalConfig> }
  | { type: "RESET"; payload: DashboardState };

export function dashboardReducer(state: DashboardState, action: DashboardAction): DashboardState {
  switch (action.type) {
    case "TOGGLE_SME":
      return {
        ...state,
        services: state.services.map((service) =>
          service.id === action.serviceId ? { ...service, hasSME: !service.hasSME } : service,
        ),
      };
    case "TOGGLE_AUTOMATION":
      return {
        ...state,
        services: state.services.map((service) =>
          service.id === action.serviceId ? { ...service, isAutomated: !service.isAutomated } : service,
        ),
      };
    case "UPDATE_GLOBAL_CONFIG":
      return {
        ...state,
        globalConfig: { ...state.globalConfig, ...action.payload },
      };
    case "RESET":
      return action.payload;
    default:
      return state;
  }
}
