import type { DashboardState, GlobalConfig, Service } from "../engine/types";

export interface NewCustomService {
  name: string;
  deployHours: number;
  maintenanceHours: number;
}

export type DashboardAction =
  | { type: "TOGGLE_ACTIVE"; serviceId: string }
  | { type: "TOGGLE_EXPERTISE"; serviceId: string }
  | { type: "TOGGLE_AUTOMATION"; serviceId: string }
  | { type: "UPDATE_SERVICE_WEIGHT"; serviceId: string; weight: number }
  | { type: "ADD_CUSTOM_SERVICE"; payload: NewCustomService }
  | { type: "UPDATE_GLOBAL_CONFIG"; payload: Partial<GlobalConfig> }
  | { type: "RESET"; payload: DashboardState };

function toggleServiceField<K extends keyof Service>(
  state: DashboardState,
  serviceId: string,
  field: K,
): DashboardState {
  return {
    ...state,
    services: state.services.map((service) =>
      service.id === serviceId ? { ...service, [field]: !service[field] } : service,
    ),
  };
}

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/(^_|_$)/g, "");
}

export function dashboardReducer(state: DashboardState, action: DashboardAction): DashboardState {
  switch (action.type) {
    case "TOGGLE_ACTIVE":
      return toggleServiceField(state, action.serviceId, "isActive");
    case "TOGGLE_EXPERTISE":
      return toggleServiceField(state, action.serviceId, "hasExpertise");
    case "TOGGLE_AUTOMATION":
      return toggleServiceField(state, action.serviceId, "isAutomated");
    case "UPDATE_SERVICE_WEIGHT": {
      const safeWeight = Number.isFinite(action.weight) && action.weight > 0 ? action.weight : 1;
      return {
        ...state,
        services: state.services.map((service) =>
          service.id === action.serviceId ? { ...service, weight: safeWeight } : service,
        ),
      };
    }
    case "ADD_CUSTOM_SERVICE": {
      const { name, deployHours, maintenanceHours } = action.payload;
      const baseSlug = slugify(name) || "custom_service";
      let id = `custom_${baseSlug}`;
      let suffix = 1;
      while (state.services.some((service) => service.id === id)) {
        suffix += 1;
        id = `custom_${baseSlug}_${suffix}`;
      }
      const newService: Service = {
        id,
        name: name.trim() || "Custom Service",
        deployHours,
        maintenanceHours,
        isActive: true,
        hasExpertise: true,
        isAutomated: false,
        isCustom: true,
      };
      return { ...state, services: [...state.services, newService] };
    }
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
