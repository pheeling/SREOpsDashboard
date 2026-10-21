import { computeScopedReport, getRequiredHours } from "../engine/calculations";
import type { DashboardState } from "../engine/types";

export type SnapshotRange = "30d" | "90d" | "180d" | "1y" | "all";
export type SnapshotTrigger = "manual" | "scheduled" | "milestone";

export interface SnapshotSummary {
  id: string;
  createdAt: string;
  triggerType: SnapshotTrigger;
  label: string | null;
  /** Load as a 0..1 ratio. */
  operationalLoadPercentage: number;
  contractedHours: number;
  toilHours: number;
  teamsInRedZone: number;
  deficitHours: number;
  hiringCost: number;
}

export interface CreateSnapshotPayload {
  trigger_type: "manual" | "milestone";
  label?: string;
}

export interface ListSnapshotsParams {
  range?: SnapshotRange;
  teamId?: string;
  limit?: number;
}

export interface SnapshotVerification {
  verified: boolean;
  snapshotId?: string;
  createdAt?: string;
  recordsPersisted?: { teams: number; services: number };
  error?: string;
}

const REQUEST_TIMEOUT_MS = 10_000;

export class SnapshotApiError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
    this.name = "SnapshotApiError";
  }
}

async function request(input: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new SnapshotApiError("Request timed out. Please retry.");
    }
    throw new SnapshotApiError("Network error: unable to reach the snapshot service.");
  } finally {
    clearTimeout(timer);
  }
}

async function failure(res: Response, action: string): Promise<SnapshotApiError> {
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  const detail = body?.error ?? res.statusText;
  const message =
    res.status === 503 ? `Database is busy (SQLITE_BUSY). Please retry in a moment.` : `Failed to ${action}: ${detail}`;
  return new SnapshotApiError(message, res.status);
}

/** Builds the `POST /api/snapshots` body from the full (all-team) dashboard state. */
export function buildSnapshotBody(state: DashboardState, payload: CreateSnapshotPayload) {
  const report = computeScopedReport({ ...state, selectedTeamId: "all" }, "all");
  const operationalHours = report.teamReports.reduce((sum, { report: r }) => sum + r.operationalLoadHours, 0);
  return {
    triggerType: payload.trigger_type,
    label: payload.label || null,
    metrics: {
      totalContractedHours: report.totalContractedHours,
      totalOperationalHours: operationalHours,
      macroLoadPercentage: report.totalContractedHours > 0 ? operationalHours / report.totalContractedHours : 0,
      teamsInRedZone: report.teamsInRedZone,
      unhedgedDeficitHours: report.deficitHours,
      totalHiringCost: report.hiringShortfall,
    },
    teams: report.teamReports.map(({ team, report: r }) => ({
      teamId: team.id,
      teamName: team.name,
      fteCount: team.fteCount,
      weeklyHours: team.weeklyHours,
      effectiveCapacityPercentage: team.effectiveCapacityPercentage,
      annualSalaryBaseline: team.annualSalaryBaseline,
      contractedHours: team.fteCount * team.weeklyHours,
      operationalHours: r.operationalLoadHours,
      loadPercentage: r.operationalLoadRatio,
      isRedZone: r.isRedZone,
      deficitHours: r.deficitHours,
      hiringCost: r.hiringCost,
    })),
    services: state.services.map((service) => ({
      serviceId: service.id,
      teamId: service.teamId ?? report.teamReports[0]?.team.id ?? "default-team",
      name: service.name,
      deployHours: service.deployHours,
      maintenanceHours: service.maintenanceHours,
      criticalityWeight: service.weight ?? 1,
      isAutomated: service.isAutomated,
      hasExpertise: service.hasExpertise,
      ownershipModel: service.ownershipModel ?? "sre_full",
      prrApproved: service.prrApproved,
      sloStatus: service.sloStatus,
      isActive: service.isActive,
      requiredHours: getRequiredHours(service),
    })),
  };
}

interface ListPoint {
  id: string;
  createdAt: string;
  triggerType: SnapshotTrigger;
  label: string | null;
  operationalLoadPercentage: number;
  contractedHours: number;
  toilHours: number;
  isRedZone: boolean;
  teamsInRedZone?: number;
  deficitHours: number;
  hiringCost: number;
}

export const snapshotsApi = {
  async listSnapshots(params: ListSnapshotsParams = {}): Promise<SnapshotSummary[]> {
    const query = new URLSearchParams({ range: params.range ?? "30d" });
    if (params.teamId) query.set("teamId", params.teamId);
    const res = await request(`/api/snapshots?${query}`);
    if (!res.ok) throw await failure(res, "fetch snapshots");
    const data = (await res.json()) as { points: ListPoint[] };
    const summaries = data.points
      .map<SnapshotSummary>((p) => ({
        id: p.id,
        createdAt: p.createdAt,
        triggerType: p.triggerType,
        label: p.label,
        operationalLoadPercentage: p.operationalLoadPercentage,
        contractedHours: p.contractedHours,
        toilHours: p.toilHours,
        teamsInRedZone: p.teamsInRedZone ?? (p.isRedZone ? 1 : 0),
        deficitHours: p.deficitHours,
        hiringCost: p.hiringCost,
      }))
      .reverse();
    return params.limit ? summaries.slice(0, params.limit) : summaries;
  },

  async createSnapshot(state: DashboardState, payload: CreateSnapshotPayload): Promise<{ id: string }> {
    const res = await request("/api/snapshots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildSnapshotBody(state, payload)),
    });
    if (!res.ok) throw await failure(res, "create snapshot");
    return (await res.json()) as { id: string };
  },

  /** Confirms the snapshot and its relational rows are committed to SQLite. */
  async verifySnapshot(snapshotId: string): Promise<SnapshotVerification> {
    const res = await request(`/api/snapshots/${encodeURIComponent(snapshotId)}/verify`);
    if (res.status === 404) return { verified: false, error: "Snapshot not found" };
    if (!res.ok) throw await failure(res, "verify snapshot");
    const data = (await res.json()) as SnapshotVerification;
    return { ...data, verified: Boolean(data.verified) };
  },
};
