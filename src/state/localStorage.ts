import { DEFAULT_TEAMS, type DashboardState, type Service, type Team } from "../engine/types";

export const STORAGE_KEY = "sre-ops-dashboard:state";

export function loadState(): DashboardState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.globalConfig || !Array.isArray(parsed.services)) {
      return null;
    }
    const teams: Team[] =
      Array.isArray(parsed.teams) && parsed.teams.length > 0
        ? parsed.teams
        : DEFAULT_TEAMS.map((team) => ({ ...team }));
    return {
      ...parsed,
      teams,
      services: parsed.services.map((service: Service) => ({
        ...service,
        teamId: teams.some((team) => team.id === service.teamId) ? service.teamId : teams[0].id,
        prrApproved: service.prrApproved !== false,
        sloStatus: service.sloStatus ?? "healthy",
      })),
    } as DashboardState;
  } catch {
    return null;
  }
}

export function saveState(state: DashboardState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore write failures (e.g. private browsing / storage quota).
  }
}
