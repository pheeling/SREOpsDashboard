import type { DashboardState, GlobalConfig, OwnershipModel, Service } from "../engine/types";
import { cloneDefaultServices } from "../engine/seedServices";
import { applyStabilizationSprint } from "../engine/calculations";

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
  | { type: "APPLY_STABILIZATION_SPRINT"; serviceId: string }
  | { type: "SET_OWNERSHIP"; serviceId: string; ownershipModel: OwnershipModel }
  | { type: "ADD_CUSTOM_SERVICE"; payload: NewCustomService }
  | { type: "DELETE_SERVICE"; serviceId: string }
  | { type: "DELETE_ALL_SERVICES" }
  | { type: "RESTORE_DEFAULT_SERVICES" }
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
    case "APPLY_STABILIZATION_SPRINT":
      return applyStabilizationSprint(state, action.serviceId);
    case "SET_OWNERSHIP":
      return {
        ...state,
        services: state.services.map((service) =>
          service.id === action.serviceId ? { ...service, ownershipModel: action.ownershipModel } : service,
        ),
      };
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
    case "DELETE_SERVICE":
      return { ...state, services: state.services.filter((service) => service.id !== action.serviceId) };
    case "DELETE_ALL_SERVICES":
      return { ...state, services: [] };
    case "RESTORE_DEFAULT_SERVICES":
      return { ...state, services: cloneDefaultServices() };
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
