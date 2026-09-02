import type { DashboardState } from "../engine/types";

export const STORAGE_KEY = "sre-ops-dashboard:state";

export function loadState(): DashboardState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.globalConfig || !Array.isArray(parsed.services)) {
      return null;
    }
    return parsed as DashboardState;
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
