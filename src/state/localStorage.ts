import type { DashboardState, Service } from "../engine/types";

export const STORAGE_KEY = "sre-ops-dashboard:state";

export function migrateState(value: unknown): DashboardState | null {
  if (!value || typeof value !== "object") return null;
  const parsed = value as Record<string, unknown>;
  if (!Array.isArray(parsed.services)) return null;

  const legacyConfig = parsed.globalConfig ?? parsed.teamConfig;
  const legacyTeam =
    legacyConfig && typeof legacyConfig === "object"
      ? (legacyConfig as Record<string, unknown>)
      : null;
  const teams = Array.isArray(parsed.teams)
    ? parsed.teams
    : legacyTeam
      ? [{
          id: "default-team",
          name: "Core SRE",
          fteCount: legacyTeam.fteCount,
          weeklyHours: legacyTeam.weeklyHours,
          effectiveCapacityPercentage:
            legacyTeam.effectiveCapacityPercentage ??
            legacyTeam.capacityEfficiencyFactor ??
            0.8,
          annualSalaryBaseline:
            legacyTeam.annualSalaryBaseline ??
            legacyTeam.annualSalary ??
            150_000,
          ...(legacyTeam.hasInterruptShield === undefined
            ? {}
            : { hasInterruptShield: legacyTeam.hasInterruptShield }),
        }]
      : null;
  if (!teams?.length) return null;
  if (
    teams.some(
      (team) =>
        !team ||
        typeof team !== "object" ||
        typeof (team as Record<string, unknown>).id !== "string" ||
        !(team as Record<string, unknown>).id ||
        typeof (team as Record<string, unknown>).name !== "string",
    ) ||
    parsed.services.some((service) => !service || typeof service !== "object" || Array.isArray(service))
  ) {
    return null;
  }

  const defaultTeamId = String((teams[0] as Record<string, unknown>).id ?? "default-team");
  const teamIds = new Set(teams.map((team) => String((team as Record<string, unknown>).id)));
  const services = parsed.services.map((service: Service) => ({
    ...service,
    teamId: service.teamId && teamIds.has(service.teamId) ? service.teamId : defaultTeamId,
    prrApproved: service.prrApproved !== false,
    sloStatus: service.sloStatus ?? "healthy",
  }));
  const requestedTeamId = parsed.selectedTeamId;

  return {
    teams: teams as DashboardState["teams"],
    services,
    selectedTeamId:
      requestedTeamId === "all" ||
      (typeof requestedTeamId === "string" && teamIds.has(requestedTeamId))
        ? requestedTeamId
        : "all",
  };
}

export function loadState(): DashboardState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return migrateState(JSON.parse(raw));
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
