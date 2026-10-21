import type { DashboardState, GlobalConfig, OwnershipModel, Service, SloStatus } from "../engine/types";
import { cloneDefaultServices } from "../engine/seedServices";
import { ensureTeams, newTeamId, ORGANIZATION_VIEW, syncGlobalConfig, DEFAULT_TEAM_CONFIG } from "../engine/teams";
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
  | { type: "ADD_CUSTOM_SERVICE"; payload: NewCustomService }
  | { type: "DELETE_SERVICE"; serviceId: string }
  | { type: "DELETE_ALL_SERVICES" }
  | { type: "RESTORE_DEFAULT_SERVICES" }
  | { type: "UPDATE_GLOBAL_CONFIG"; payload: Partial<GlobalConfig> }
  | { type: "ADD_TEAM"; name: string }
  | { type: "RENAME_TEAM"; teamId: string; name: string }
  | { type: "DELETE_TEAM"; teamId: string; reassignToTeamId?: string }
  | { type: "SELECT_TEAM"; teamId: string }
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
        teamId: state.teams?.some((team) => team.id === state.selectedTeamId)
          ? state.selectedTeamId
          : state.teams?.[0]?.id,
      };
      return { ...state, services: [...state.services, newService] };
    }
    case "DELETE_SERVICE":
      return { ...state, services: state.services.filter((service) => service.id !== action.serviceId) };
    case "DELETE_ALL_SERVICES":
      return { ...state, services: [] };
    case "RESTORE_DEFAULT_SERVICES":
      return ensureTeams({ ...state, services: cloneDefaultServices() });
    case "UPDATE_GLOBAL_CONFIG": {
      const selected = state.teams?.find((team) => team.id === state.selectedTeamId);
      if (!selected) {
        return { ...state, globalConfig: { ...state.globalConfig, ...action.payload } };
      }
      return syncGlobalConfig({
        ...state,
        teams: state.teams!.map((team) =>
          team.id === selected.id ? { ...team, config: { ...team.config, ...action.payload } } : team,
        ),
      });
    }
    case "ADD_TEAM": {
      const base = ensureTeams(state);
      const team = {
        id: newTeamId(action.name, base.teams!),
        name: action.name.trim() || "New Team",
        config: { ...DEFAULT_TEAM_CONFIG },
      };
      return syncGlobalConfig({ ...base, teams: [...base.teams!, team], selectedTeamId: team.id });
    }
    case "RENAME_TEAM": {
      const name = action.name.trim();
      if (!name || !state.teams) return state;
      return {
        ...state,
        teams: state.teams.map((team) => (team.id === action.teamId ? { ...team, name } : team)),
      };
    }
    case "DELETE_TEAM": {
      const teams = state.teams;
      if (!teams || teams.length <= 1 || !teams.some((team) => team.id === action.teamId)) return state;
      const remaining = teams.filter((team) => team.id !== action.teamId);
      const target =
        remaining.find((team) => team.id === action.reassignToTeamId) ?? remaining[0];
      return syncGlobalConfig({
        ...state,
        teams: remaining,
        selectedTeamId:
          state.selectedTeamId === action.teamId ? target.id : state.selectedTeamId,
        services: state.services.map((service) =>
          service.teamId === action.teamId ? { ...service, teamId: target.id } : service,
        ),
      });
    }
    case "SELECT_TEAM": {
      if (!state.teams) return state;
      if (action.teamId !== ORGANIZATION_VIEW && !state.teams.some((team) => team.id === action.teamId)) {
        return state;
      }
      return syncGlobalConfig({ ...state, selectedTeamId: action.teamId });
    }
    case "RESET":
      return action.payload;
    default:
      return state;
  }
}
