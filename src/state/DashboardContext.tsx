import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from "react";
import type { Dispatch, ReactNode } from "react";
import type { DashboardState, GlobalConfig } from "../engine/types";
import { cloneDefaultServices } from "../engine/seedServices";
import { DEFAULT_ANNUAL_SALARY, getOwnershipModel, OWNERSHIP_LABELS } from "../engine/calculations";
import { dashboardReducer, type DashboardAction } from "./dashboardReducer";
import { ensureTeams } from "../engine/teams";
import { loadState, saveState } from "./localStorage";

export interface AuditLogEntry {
  id: number;
  timestamp: string;
  message: string;
}

export const INITIAL_STATE: DashboardState = ensureTeams({
  globalConfig: {
    fteCount: 5,
    weeklyHours: 40,
    capacityEfficiencyFactor: 0.8,
    hasInterruptShield: false,
    annualSalary: DEFAULT_ANNUAL_SALARY,
  },
  services: cloneDefaultServices(),
});

interface DashboardContextValue {
  state: DashboardState;
  dispatch: Dispatch<DashboardAction>;
  auditLogs: AuditLogEntry[];
  clearAuditLogs: () => void;
}

const DashboardContext = createContext<DashboardContextValue | undefined>(undefined);

const sloLabels = { healthy: "Healthy", warning: "Degraded", exhausted: "Exhausted" };

function getAuditMessages(state: DashboardState, action: DashboardAction): string[] {
  const service = "serviceId" in action
    ? state.services.find((item) => item.id === action.serviceId)
    : undefined;
  const name = service?.name ?? ("serviceId" in action ? action.serviceId : "");
  const toggleMessage = (label: string, value: boolean) => `Toggled ${name} ${label}: ${value ? "On" : "Off"}`;

  switch (action.type) {
    case "TOGGLE_ACTIVE":
      return service ? [`Toggled ${name} Active: ${service.isActive ? "Off" : "On"}`] : [];
    case "TOGGLE_EXPERTISE":
      return service ? [toggleMessage("Expertise", !service.hasExpertise)] : [];
    case "TOGGLE_AUTOMATION":
      return service ? [toggleMessage("Automation", !service.isAutomated)] : [];
    case "TOGGLE_PRR_APPROVED":
      return service ? [toggleMessage("PRR Approved", !service.prrApproved)] : [];
    case "SET_SLO_STATUS":
      return service && service.sloStatus !== action.sloStatus
        ? [`Updated ${name} SLO to ${sloLabels[action.sloStatus]}`]
        : [];
    case "UPDATE_SERVICE_WEIGHT": {
      const weight = Number.isFinite(action.weight) && action.weight > 0 ? action.weight : 1;
      return service && (service.weight ?? 1) !== weight
        ? [`Updated ${name} Criticality Weight to ${weight}`]
        : [];
    }
    case "APPLY_STABILIZATION_SPRINT":
      return service ? [`Applied stabilization sprint to ${name}`] : [];
    case "SET_OWNERSHIP":
      return service && getOwnershipModel(service) !== action.ownershipModel
        ? [`Updated ${name} Ownership to ${OWNERSHIP_LABELS[action.ownershipModel]}`]
        : [];
    case "ADD_CUSTOM_SERVICE":
      return [`Added service ${action.payload.name.trim() || "Custom Service"}`];
    case "DELETE_SERVICE":
      return service ? [`Deleted service ${name}`] : [];
    case "DELETE_ALL_SERVICES":
      return state.services.length ? ["Deleted all services"] : [];
    case "RESTORE_DEFAULT_SERVICES":
      return ["Restored default services"];
    case "UPDATE_GLOBAL_CONFIG":
      return getGlobalConfigAuditMessages(state.globalConfig, action.payload);
    case "ADD_TEAM":
      return [`Added team ${action.name.trim() || "New Team"}`];
    case "RENAME_TEAM": {
      const team = state.teams?.find((t) => t.id === action.teamId);
      const next = action.name.trim();
      return team && next && team.name !== next ? [`Renamed team ${team.name} to ${next}`] : [];
    }
    case "DELETE_TEAM": {
      const team = state.teams?.find((t) => t.id === action.teamId);
      return team && (state.teams?.length ?? 0) > 1 ? [`Deleted team ${team.name}`] : [];
    }
    case "RESET":
      return ["Reset dashboard configuration"];
    default:
      return [];
  }
}

function getGlobalConfigAuditMessages(
  config: GlobalConfig,
  updates: Partial<GlobalConfig>,
): string[] {
  const labels: Partial<Record<keyof GlobalConfig, string>> = {
    fteCount: "FTE Count",
    weeklyHours: "Weekly Hours per FTE",
    capacityEfficiencyFactor: "Effective Capacity",
    annualSalary: "Annual Salary Baseline",
  };

  return (Object.keys(updates) as (keyof GlobalConfig)[])
    .filter((key) => config[key] !== updates[key])
    .map((key) => {
      const value = updates[key];
      if (key === "hasInterruptShield") {
        return `Toggled Dedicated Interrupt Shield: ${value ? "On" : "Off"}`;
      }
      if (key === "capacityEfficiencyFactor") {
        return `Updated Effective Capacity to ${Number(value) * 100}%`;
      }
      if (key === "annualSalary") {
        return `Updated Annual Salary Baseline to ${new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        }).format(Number(value))}`;
      }
      return `Updated ${labels[key]} to ${value}`;
    });
}

function formatTimestamp(date: Date): string {
  return [date.getHours(), date.getMinutes(), date.getSeconds()]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

function init(): DashboardState {
  return loadState() ?? INITIAL_STATE;
}

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [state, reducerDispatch] = useReducer(dashboardReducer, undefined, init);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const stateRef = useRef(state);
  const nextLogId = useRef(0);

  const dispatch = useCallback<Dispatch<DashboardAction>>((action) => {
    const currentState = stateRef.current;
    const messages = getAuditMessages(currentState, action);
    stateRef.current = dashboardReducer(currentState, action);
    reducerDispatch(action);
    if (messages.length) {
      const timestamp = formatTimestamp(new Date());
      setAuditLogs((entries) => [
        ...entries,
        ...messages.map((message) => ({ id: nextLogId.current++, timestamp, message })),
      ]);
    }
  }, []);
  const clearAuditLogs = useCallback(() => setAuditLogs([]), []);

  useLayoutEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const value = useMemo(() => ({ state, dispatch, auditLogs, clearAuditLogs }), [state, dispatch, auditLogs, clearAuditLogs]);

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboard(): DashboardContextValue {
  const ctx = useContext(DashboardContext);
  if (!ctx) {
    throw new Error("useDashboard must be used within a DashboardProvider");
  }
  return ctx;
}
