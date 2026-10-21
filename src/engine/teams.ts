import type { DashboardState, GlobalConfig, Team } from "./types";
import { DEFAULT_ANNUAL_SALARY, DEFAULT_CAPACITY_EFFICIENCY_FACTOR } from "./calculations";

export const ORGANIZATION_VIEW = "organization";
export const MIN_ONCALL_FTE = 4;

export const DEFAULT_TEAM_CONFIG: GlobalConfig = {
  fteCount: 5,
  weeklyHours: 40,
  capacityEfficiencyFactor: DEFAULT_CAPACITY_EFFICIENCY_FACTOR,
  hasInterruptShield: false,
  annualSalary: DEFAULT_ANNUAL_SALARY,
};

export function newTeamId(name: string, teams: Team[]): string {
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
export function aggregateTeamConfigs(teams: Team[]): GlobalConfig {
  const totalFte = teams.reduce((sum, t) => sum + t.config.fteCount, 0);
  if (!teams.length || totalFte <= 0) return { ...DEFAULT_TEAM_CONFIG };
  const weighted = (value: (c: GlobalConfig) => number, weight: (c: GlobalConfig) => number) => {
    const totalWeight = teams.reduce((sum, t) => sum + weight(t.config), 0);
    return totalWeight > 0
      ? teams.reduce((sum, t) => sum + value(t.config) * weight(t.config), 0) / totalWeight
      : 0;
  };
  const hours = (c: GlobalConfig) => c.fteCount;
  return {
    fteCount: totalFte,
    weeklyHours: weighted((c) => c.weeklyHours, hours),
    capacityEfficiencyFactor: weighted(
      (c) => c.capacityEfficiencyFactor ?? DEFAULT_CAPACITY_EFFICIENCY_FACTOR,
      (c) => c.fteCount * c.weeklyHours,
    ),
    annualSalary: Math.round(weighted((c) => c.annualSalary, hours)),
    hasInterruptShield: teams.some((t) => t.config.hasInterruptShield),
  };
}

/** Recompute `globalConfig` from the selected team (or the org aggregate). */
export function syncGlobalConfig(state: DashboardState): DashboardState {
  const { teams } = state;
  if (!teams?.length) return state;
  const selected = teams.find((team) => team.id === state.selectedTeamId);
  return {
    ...state,
    selectedTeamId: selected ? selected.id : ORGANIZATION_VIEW,
    globalConfig: selected ? { ...selected.config } : aggregateTeamConfigs(teams),
  };
}

/** Migrate legacy single-team state into a team list (idempotent). */
export function ensureTeams(state: DashboardState): DashboardState {
  if (state.teams?.length) {
    const fallback = state.teams[0].id;
    return syncGlobalConfig({
      ...state,
      services: state.services.map((s) =>
        s.teamId && state.teams!.some((t) => t.id === s.teamId) ? s : { ...s, teamId: fallback },
      ),
    });
  }
  const team: Team = { id: "team_platform_sre", name: "Platform SRE", config: { ...state.globalConfig } };
  return syncGlobalConfig({
    ...state,
    teams: [team],
    selectedTeamId: team.id,
    services: state.services.map((s) => ({ ...s, teamId: team.id })),
  });
}
