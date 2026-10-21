import type { DashboardState, Service, TeamConfig } from "../engine/types";
import { syncGlobalConfig } from "../engine/teams";
import { DEFAULT_TEAM_ID, globalConfigToTeam } from "../engine/calculations";

export const STORAGE_KEY = "sre-ops-dashboard:state";

export function loadState(): DashboardState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.globalConfig || !Array.isArray(parsed.services)) {
      return null;
    }
    const migrated = migrateState(parsed);
    return migrated ? syncGlobalConfig(migrated) : null;
  } catch {
    return null;
  }
}

/**
 * Upgrades legacy single-team saved state to the multi-team schema: wraps the
 * legacy config into a default team, assigns unowned services to it, and
 * defaults the scope to 'all'. Returns null for unusable input.
 */
export function migrateState(parsed: unknown): DashboardState | null {
  const raw = parsed as Partial<DashboardState> | null;
  if (!raw || !raw.globalConfig || !Array.isArray(raw.services)) return null;

  const teams: TeamConfig[] =
    Array.isArray(raw.teams) && raw.teams.length > 0 ? raw.teams : [globalConfigToTeam(raw.globalConfig)];
  const fallbackTeamId = teams[0].id ?? DEFAULT_TEAM_ID;
  const selectedTeamId =
    raw.selectedTeamId === "all" || teams.some((team) => team.id === raw.selectedTeamId)
      ? (raw.selectedTeamId as string)
      : "all";

  return {
    ...raw,
    teams,
    selectedTeamId,
    services: raw.services.map((service: Service) => ({
      ...service,
      teamId: service.teamId ?? fallbackTeamId,
      prrApproved: service.prrApproved !== false,
      sloStatus: service.sloStatus ?? "healthy",
    })),
  } as DashboardState;
}

export function saveState(state: DashboardState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore write failures (e.g. private browsing / storage quota).
  }
}
