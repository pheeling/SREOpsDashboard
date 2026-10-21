import type { DashboardState, TeamConfig, OwnershipModel, Service, SloStatus } from "../engine/types";
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
  | { type: "TOGGLE_PRR_APPROVED"; serviceId: string }
  | { type: "SET_SLO_STATUS"; serviceId: string; sloStatus: SloStatus }
  | { type: "UPDATE_SERVICE_WEIGHT"; serviceId: string; weight: number }
  | { type: "APPLY_STABILIZATION_SPRINT"; serviceId: string }
  | { type: "SET_OWNERSHIP"; serviceId: string; ownershipModel: OwnershipModel }
  | { type: "ASSIGN_SERVICE_TEAM"; serviceId: string; teamId: string }
  | { type: "SET_SELECTED_TEAM"; teamId: DashboardState["selectedTeamId"] }
  | { type: "ADD_TEAM"; payload: TeamConfig }
  | { type: "ADD_CUSTOM_SERVICE"; payload: NewCustomService }
  | { type: "DELETE_SERVICE"; serviceId: string }
  | { type: "DELETE_ALL_SERVICES" }
  | { type: "RESTORE_DEFAULT_SERVICES" }
  | { type: "UPDATE_GLOBAL_CONFIG"; payload: Partial<TeamConfig> }
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
    case "TOGGLE_PRR_APPROVED":
      return toggleServiceField(state, action.serviceId, "prrApproved");
    case "SET_SLO_STATUS":
      return {
        ...state,
        services: state.services.map((service) =>
          service.id === action.serviceId ? { ...service, sloStatus: action.sloStatus } : service,
        ),
      };
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
    case "ASSIGN_SERVICE_TEAM":
      if (!state.teams.some((team) => team.id === action.teamId)) return state;
      return {
        ...state,
        services: state.services.map((service) =>
          service.id === action.serviceId ? { ...service, teamId: action.teamId } : service,
        ),
      };
    case "SET_SELECTED_TEAM":
      return {
        ...state,
        selectedTeamId:
          action.teamId === "all" || state.teams.some((team) => team.id === action.teamId)
            ? action.teamId
            : state.selectedTeamId,
      };
    case "ADD_TEAM":
      if (state.teams.some((team) => team.id === action.payload.id)) return state;
      return { ...state, teams: [...state.teams, action.payload], selectedTeamId: action.payload.id };
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
        prrApproved: true,
        sloStatus: "healthy",
        teamId: state.selectedTeamId === "all" ? state.teams[0]?.id ?? "default-team" : state.selectedTeamId,
        isCustom: true,
      };
      return { ...state, services: [...state.services, newService] };
    }
    case "DELETE_SERVICE":
      return { ...state, services: state.services.filter((service) => service.id !== action.serviceId) };
    case "DELETE_ALL_SERVICES":
      return {
        ...state,
        services:
          state.selectedTeamId === "all"
            ? []
            : state.services.filter((service) => service.teamId !== state.selectedTeamId),
      };
    case "RESTORE_DEFAULT_SERVICES": {
      const restoredServices = cloneDefaultServices().map((service) => ({
        ...service,
        teamId: state.selectedTeamId === "all" ? service.teamId : state.selectedTeamId,
      }));
      return {
        ...state,
        services:
          state.selectedTeamId === "all"
            ? restoredServices
            : [
                ...state.services.filter((service) => service.teamId !== state.selectedTeamId),
                ...restoredServices,
              ],
      };
    }
    case "UPDATE_GLOBAL_CONFIG":
      return {
        ...state,
        teams: state.teams.map((team) =>
          team.id === (state.selectedTeamId === "all" ? state.teams[0]?.id : state.selectedTeamId)
            ? { ...team, ...action.payload }
            : team,
        ),
      };
    case "RESET":
      return action.payload;
    default:
      return state;
  }
}
