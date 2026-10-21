import type { DashboardState, GlobalConfig, TeamConfig } from "./types";
import {
  DEFAULT_ANNUAL_SALARY,
  DEFAULT_CAPACITY_EFFICIENCY_FACTOR,
  DEFAULT_TEAM_ID,
  DEFAULT_TEAM_NAME,
  globalConfigToTeam,
  teamToGlobalConfig,
} from "./calculations";

export const ORGANIZATION_VIEW = "all";
export const MIN_ONCALL_FTE = 4;

export const DEFAULT_NEW_TEAM: Omit<TeamConfig, "id" | "name"> = {
  fteCount: 5,
  weeklyHours: 40,
  effectiveCapacityPercentage: DEFAULT_CAPACITY_EFFICIENCY_FACTOR,
  annualSalaryBaseline: DEFAULT_ANNUAL_SALARY,
};

export function newTeamId(name: string, teams: TeamConfig[]): string {
  const slug =
    name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/(^_|_$)/g, "") || "team";
  let id = `team_${slug}`;
  let suffix = 1;
  while (teams.some((team) => team.id === id)) {
    suffix += 1;
    id = `team_${slug}_${suffix}`;
  }
  return id;
}

/** Combine team configs into a single org-level config (FTE-weighted averages). */
export function aggregateTeamConfigs(
  teams: TeamConfig[],
  base?: Pick<GlobalConfig, "hasInterruptShield">,
): GlobalConfig {
  const totalFte = teams.reduce((sum, t) => sum + t.fteCount, 0);
  if (!teams.length || totalFte <= 0) {
    return teamToGlobalConfig({ id: DEFAULT_TEAM_ID, name: DEFAULT_TEAM_NAME, ...DEFAULT_NEW_TEAM }, base);
  }
  const weighted = (value: (t: TeamConfig) => number, weight: (t: TeamConfig) => number) => {
    const totalWeight = teams.reduce((sum, t) => sum + weight(t), 0);
    return totalWeight > 0 ? teams.reduce((sum, t) => sum + value(t) * weight(t), 0) / totalWeight : 0;
  };
  const byFte = (t: TeamConfig) => t.fteCount;
  return {
    fteCount: totalFte,
    weeklyHours: weighted((t) => t.weeklyHours, byFte),
    capacityEfficiencyFactor: weighted(
      (t) => t.effectiveCapacityPercentage,
      (t) => t.fteCount * t.weeklyHours,
    ),
    annualSalary: Math.round(weighted((t) => t.annualSalaryBaseline, byFte)),
    hasInterruptShield: base?.hasInterruptShield,
  };
}

/** The team whose parameters are editable: the selected team, or the only team in org view. */
export function getEditableTeam(state: DashboardState): TeamConfig | undefined {
  const teams = state.teams ?? [];
  return (
    teams.find((team) => team.id === state.selectedTeamId) ??
    (teams.length === 1 ? teams[0] : undefined)
  );
}

/** Recompute `globalConfig` from the selected team (or the org aggregate). */
export function syncGlobalConfig(state: DashboardState): DashboardState {
  const teams = state.teams;
  if (!teams?.length) return state;
  const selected = teams.find((team) => team.id === state.selectedTeamId);
  return {
    ...state,
    selectedTeamId: selected ? selected.id : ORGANIZATION_VIEW,
    globalConfig: selected
      ? teamToGlobalConfig(selected, state.globalConfig)
      : aggregateTeamConfigs(teams, state.globalConfig),
  };
}

/** Migrate legacy single-team state into a team list (idempotent). */
export function ensureTeams(state: DashboardState): DashboardState {
  const teams = state.teams?.length ? state.teams : [globalConfigToTeam(state.globalConfig)];
  const fallback = teams[0].id;
  return syncGlobalConfig({
    ...state,
    teams,
    selectedTeamId: state.selectedTeamId ?? fallback,
    services: state.services.map((s) =>
      s.teamId && teams.some((t) => t.id === s.teamId) ? s : { ...s, teamId: fallback },
    ),
  });
}
