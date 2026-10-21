import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { snapshotsApi } from "../api/snapshots";
import type { SnapshotRange, SnapshotSummary } from "../api/snapshots";
import { useDashboard } from "../state/DashboardContext";

const pad = (n: number) => String(n).padStart(2, "0");

export function defaultSnapshotLabel(date = new Date()): string {
  return `Manual Snapshot — ${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : "Unexpected error");

export function CreateSnapshotModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string, label: string) => void;
}) {
  const { fullState, addAuditLog } = useDashboard();
  const [label, setLabel] = useState(() => defaultSnapshotLabel());
  const [isMilestone, setIsMilestone] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const trimmed = label.trim();
      const { id } = await snapshotsApi.createSnapshot(fullState, {
        trigger_type: isMilestone ? "milestone" : "manual",
        label: trimmed || undefined,
      });
      const verification = await snapshotsApi.verifySnapshot(id);
      if (!verification.verified) {
        throw new Error(`Snapshot ${id} was written but could not be verified in the database.`);
      }
      addAuditLog(`ACTION: SNAPSHOT_CREATED | ID: ${id} | Label: ${trimmed}`);
      onCreated(id, trimmed);
    } catch (err) {
      setError(errorMessage(err));
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="audit-log__overlay" onClick={isSubmitting ? undefined : onClose}>
      <section
        className="audit-log__dialog snapshot-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="snapshot-create-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <h2 id="snapshot-create-title">Take Snapshot</h2>
          <button type="button" onClick={onClose} disabled={isSubmitting} aria-label="Close snapshot dialog">×</button>
        </header>
        {error && <p role="alert" className="snapshot-dialog__error">{error}</p>}
        <label className="snapshot-dialog__field">
          Snapshot Label
          <input type="text" value={label} onChange={(event) => setLabel(event.target.value)} disabled={isSubmitting} />
        </label>
        <label className="snapshot-dialog__toggle">
          <input
            type="checkbox"
            checked={isMilestone}
            onChange={(event) => setIsMilestone(event.target.checked)}
            disabled={isSubmitting}
          />
          Mark as milestone
        </label>
        <footer>
          <button type="button" onClick={onClose} disabled={isSubmitting}>Cancel</button>
          <button type="button" onClick={submit} disabled={isSubmitting}>
            {isSubmitting ? "Creating…" : error ? "Retry" : "Create & Verify"}
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}

const RANGES: { id: SnapshotRange; label: string }[] = [
  { id: "30d", label: "30 Days" },
  { id: "90d", label: "90 Days" },
  { id: "180d", label: "180 Days" },
  { id: "1y", label: "1 Year" },
  { id: "all", label: "All" },
];

type RowStatus = "verified" | "checking" | "failed";

export function SnapshotHistoryModal({ onClose }: { onClose: () => void }) {
  const [range, setRange] = useState<SnapshotRange>("30d");
  const [snapshots, setSnapshots] = useState<SnapshotSummary[]>([]);
  const [statuses, setStatuses] = useState<Record<string, RowStatus>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    snapshotsApi
      .listSnapshots({ range })
      .then((rows) => {
        if (cancelled) return;
        setSnapshots(rows);
        setStatuses({});
      })
      .catch((err) => !cancelled && setError(errorMessage(err)))
      .finally(() => !cancelled && setIsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [range, reloadKey]);

  const reverify = useCallback(async (id: string) => {
    setStatuses((current) => ({ ...current, [id]: "checking" }));
    let status: RowStatus = "failed";
    try {
      status = (await snapshotsApi.verifySnapshot(id)).verified ? "verified" : "failed";
    } catch {
      status = "failed";
    }
    setStatuses((current) => ({ ...current, [id]: status }));
  }, []);

  const statusText = (id: string) => {
    const status = statuses[id] ?? "verified";
    return status === "verified" ? "Verified in SQLite" : status === "checking" ? "Verifying…" : "Verification failed";
  };

  return createPortal(
    <div className="audit-log__overlay" onClick={onClose}>
      <section
        className="audit-log__dialog snapshot-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="snapshot-history-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <h2 id="snapshot-history-title">Snapshot History</h2>
          <button type="button" onClick={onClose} aria-label="Close snapshot history">×</button>
        </header>
        <div className="snapshot-dialog__filters" role="group" aria-label="Time range">
          {RANGES.map(({ id, label }) => (
            <button key={id} type="button" aria-pressed={range === id} onClick={() => setRange(id)}>
              {label}
            </button>
          ))}
        </div>
        {error && (
          <p role="alert" className="snapshot-dialog__error">
            {error} <button type="button" onClick={() => setReloadKey((k) => k + 1)}>Retry</button>
          </p>
        )}
        {isLoading ? (
          <p>Loading snapshots…</p>
        ) : !error && snapshots.length === 0 ? (
          <p>No snapshots in this range.</p>
        ) : (
          !error && (
            <div className="snapshot-dialog__table">
              <table>
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Label</th>
                    <th>Trigger</th>
                    <th>Macro Load</th>
                    <th>Teams in Red Zone</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {snapshots.map((snapshot) => (
                    <tr key={snapshot.id}>
                      <td>{snapshot.createdAt}</td>
                      <td>{snapshot.label ?? "—"}</td>
                      <td>{snapshot.triggerType}</td>
                      <td>{(snapshot.operationalLoadPercentage * 100).toFixed(1)}%</td>
                      <td>{snapshot.teamsInRedZone}</td>
                      <td>{statusText(snapshot.id)}</td>
                      <td>
                        <button
                          type="button"
                          onClick={() => reverify(snapshot.id)}
                          disabled={statuses[snapshot.id] === "checking"}
                          aria-label={`Re-verify ${snapshot.label ?? snapshot.id}`}
                        >
                          Re-verify
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </section>
    </div>,
    document.body,
  );
}
