import type { DashboardState, GlobalConfig, OwnershipModel, Service, SloStatus, Team } from "../engine/types";
import { ALL_TEAMS_ID } from "../engine/types";
import { cloneDefaultServices } from "../engine/seedServices";
import { applyStabilizationSprint, getScopedConfig, getServiceTeamId, getTeams } from "../engine/calculations";

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
  | { type: "ADD_CUSTOM_SERVICE"; payload: NewCustomService }
  | { type: "DELETE_SERVICE"; serviceId: string }
  | { type: "DELETE_ALL_SERVICES" }
  | { type: "RESTORE_DEFAULT_SERVICES" }
  | { type: "UPDATE_GLOBAL_CONFIG"; payload: Partial<GlobalConfig> }
  | { type: "ADD_TEAM"; name: string }
  | { type: "SET_SELECTED_TEAM"; teamId: string }
  | { type: "SET_SERVICE_TEAM"; serviceId: string; teamId: string }
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

/**
 * Guarantees `teams`, a valid `selectedTeamId` and team-assigned services, and
 * keeps `globalConfig` in sync with the active scope.
 */
export function normalizeState(state: DashboardState): DashboardState {
  const teams = getTeams(state);
  const selectedTeamId =
    state.selectedTeamId === ALL_TEAMS_ID || teams.some((team) => team.id === state.selectedTeamId)
      ? state.selectedTeamId!
      : teams[0].id;
  return {
    ...state,
    teams,
    selectedTeamId,
    globalConfig: getScopedConfig(teams, selectedTeamId),
    services: state.services.map((service) =>
      service.teamId === getServiceTeamId(service, teams) ? service : { ...service, teamId: getServiceTeamId(service, teams) },
    ),
  };
}

export function dashboardReducer(state: DashboardState, action: DashboardAction): DashboardState {
  return normalizeState(reduce(normalizeState(state), action));
}

function reduce(state: DashboardState, action: DashboardAction): DashboardState {
  const teams = state.teams as Team[];
  const activeTeamId = state.selectedTeamId === ALL_TEAMS_ID ? teams[0].id : (state.selectedTeamId as string);
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
        isCustom: true,
        teamId: activeTeamId,
      };
      return { ...state, services: [...state.services, newService] };
    }
    case "DELETE_SERVICE":
      return { ...state, services: state.services.filter((service) => service.id !== action.serviceId) };
    case "DELETE_ALL_SERVICES":
      return {
        ...state,
        services:
          state.selectedTeamId === ALL_TEAMS_ID
            ? []
            : state.services.filter((service) => service.teamId !== activeTeamId),
      };
    case "RESTORE_DEFAULT_SERVICES": {
      if (state.selectedTeamId === ALL_TEAMS_ID) return { ...state, services: cloneDefaultServices() };
      const kept = state.services.filter((service) => service.teamId !== activeTeamId);
      const takenIds = new Set(kept.map((service) => service.id));
      const defaults = cloneDefaultServices()
        .filter((service) => !takenIds.has(service.id))
        .map((service) => ({ ...service, teamId: activeTeamId }));
      return { ...state, services: [...kept, ...defaults] };
    }
    case "UPDATE_GLOBAL_CONFIG":
      if (state.selectedTeamId === ALL_TEAMS_ID) return state;
      return {
        ...state,
        teams: teams.map((team) =>
          team.id === activeTeamId ? { ...team, config: { ...team.config, ...action.payload } } : team,
        ),
      };
    case "ADD_TEAM": {
      const name = action.name.trim();
      if (!name) return state;
      const baseSlug = `team_${slugify(name) || "new"}`;
      let id = baseSlug;
      let suffix = 1;
      while (teams.some((team) => team.id === id)) {
        suffix += 1;
        id = `${baseSlug}_${suffix}`;
      }
      const template = teams.find((team) => team.id === activeTeamId) ?? teams[0];
      return { ...state, teams: [...teams, { id, name, config: { ...template.config } }], selectedTeamId: id };
    }
    case "SET_SELECTED_TEAM":
      return { ...state, selectedTeamId: action.teamId };
    case "SET_SERVICE_TEAM":
      return teams.some((team) => team.id === action.teamId)
        ? {
            ...state,
            services: state.services.map((service) =>
              service.id === action.serviceId ? { ...service, teamId: action.teamId } : service,
            ),
          }
        : state;
    case "RESET":
      return action.payload;
    default:
      return state;
  }
}
