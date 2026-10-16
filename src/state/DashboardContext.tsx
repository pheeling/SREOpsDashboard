import { createContext, useContext, useEffect, useMemo, useReducer } from "react";
import type { Dispatch, ReactNode } from "react";
import type { DashboardState } from "../engine/types";
import { cloneDefaultServices } from "../engine/seedServices";
import { DEFAULT_ANNUAL_SALARY } from "../engine/calculations";
import { dashboardReducer, type DashboardAction } from "./dashboardReducer";
import { loadState, saveState } from "./localStorage";

export const INITIAL_STATE: DashboardState = {
  globalConfig: {
    fteCount: 5,
    weeklyHours: 40,
    annualSalary: DEFAULT_ANNUAL_SALARY,
  },
  services: cloneDefaultServices(),
};

interface DashboardContextValue {
  state: DashboardState;
  dispatch: Dispatch<DashboardAction>;
}

const DashboardContext = createContext<DashboardContextValue | undefined>(undefined);

function init(): DashboardState {
  return loadState() ?? INITIAL_STATE;
}

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(dashboardReducer, undefined, init);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const value = useMemo(() => ({ state, dispatch }), [state]);

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboard(): DashboardContextValue {
  const ctx = useContext(DashboardContext);
  if (!ctx) {
    throw new Error("useDashboard must be used within a DashboardProvider");
  }
  return ctx;
}
