import { useEffect, useState } from "react";
import { DashboardProvider, useDashboard } from "./state/DashboardContext";
import type { AuditLogEntry } from "./state/DashboardContext";
import { GlobalConfigPanel } from "./components/GlobalConfigPanel";
import { LoadGauge } from "./components/LoadGauge";
import { HiringCostWidget } from "./components/HiringCostWidget";
import { HandbackSimulator } from "./components/HandbackSimulator";
import { ServiceMatrix } from "./components/ServiceMatrix";
import { SummaryReport } from "./components/SummaryReport";
import { CapacityBucketsChart } from "./components/CapacityBucketsChart";
import { WarningBanner } from "./components/WarningBanner";
import { SearchBar } from "./components/SearchBar";
import type { SearchEntry } from "./search/searchIndex";
import { calculateUpskillingDividend, computeCapacityReport } from "./engine/calculations";
import "./App.css";

type DashboardTab = "summary" | "team" | "services";

const dashboardTabs: { id: DashboardTab; label: string; shortLabel: string; icon: string }[] = [
  { id: "summary", label: "Executive Summary", shortLabel: "Executive Summary", icon: "◫" },
  { id: "team", label: "Team & Capacity Settings", shortLabel: "Team & Capacity", icon: "◷" },
  { id: "services", label: "Service Breakdown & Toil Analysis", shortLabel: "Service Breakdown", icon: "⌁" },
];

const HIGHLIGHT_CLASS = "search-highlight";
const HIGHLIGHT_DURATION_MS = 1800;
const JUMP_RETRY_MS = 50;
const JUMP_MAX_ATTEMPTS = 20;

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function AuditLog({
  entries,
  onClear,
}: {
  entries: AuditLogEntry[];
  onClear: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const compactEntries = [...entries].slice(-5).reverse();

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const exportLogs = () => {
    const blob = new Blob([JSON.stringify(entries, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "sre-audit-log.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  const renderEntries = (logs: AuditLogEntry[]) =>
    logs.length ? (
      logs.map((entry) => (
        <li key={entry.id}>
          <time className="audit-log__time">{entry.timestamp}</time>
          <span>{entry.message}</span>
        </li>
      ))
    ) : (
      <li className="audit-log__empty">No configuration changes yet.</li>
    );

  return (
    <>
      <section className="audit-log" aria-label="Live audit log">
        <h2><span className="status-dot" /> LIVE AUDIT LOG</h2>
        <ol aria-label="Recent configuration changes">{renderEntries(compactEntries)}</ol>
        <button type="button" className="audit-log__view" onClick={() => setIsOpen(true)}>
          View Full Audit Log
        </button>
      </section>
      {isOpen && (
        <div className="audit-log__overlay" onClick={() => setIsOpen(false)}>
          <section
            className="audit-log__dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="audit-log-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <h2 id="audit-log-title">Full Audit Log</h2>
              <button type="button" onClick={() => setIsOpen(false)} aria-label="Close audit log">×</button>
            </header>
            <ol aria-label="Complete configuration change history">{renderEntries(entries)}</ol>
            <footer>
              <button type="button" onClick={exportLogs}>Export Audit Log</button>
              <button type="button" onClick={onClear} disabled={entries.length === 0}>Clear Audit Log</button>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}

function ExecutiveKpis({ onViewRoiReport }: { onViewRoiReport: () => void }) {
  const { state } = useDashboard();
  const report = computeCapacityReport(state);
  const dividend = calculateUpskillingDividend(state.services, state.globalConfig);
  const operationalLoad = report.operationalLoadRatio * 100;
  const activeServices = state.services.filter((service) => service.isActive);
  const approvedServices = activeServices.filter((service) => service.prrApproved);
  const healthyServices = activeServices.filter((service) => service.sloStatus === "healthy");
  const warningServices = activeServices.filter((service) => service.sloStatus === "warning");
  const exhaustedServices = activeServices.filter((service) => service.sloStatus === "exhausted");
  const healthyPercent = activeServices.length
    ? (healthyServices.length / activeServices.length) * 100
    : null;
  const loadStatus =
    operationalLoad > 50
      ? { label: "Approaching Limit", tone: "warning" }
      : { label: "Healthy / Within Limit", tone: "healthy" };
  const prrStatus =
    activeServices.length === 0
      ? { label: "No Active Services", tone: "warning" }
      : approvedServices.length === activeServices.length
        ? { label: "PRR Compliant", tone: "healthy" }
        : approvedServices.length === 0
          ? { label: "CRITICAL", tone: "critical" }
          : { label: "DEFICIENT", tone: "warning" };
  const sloStatus =
    activeServices.length === 0
      ? { label: "No Active Services", tone: "warning" }
      : exhaustedServices.length > 0
        ? { label: "CRITICAL", tone: "critical" }
        : warningServices.length > 0
          ? { label: "AT RISK", tone: "warning" }
          : { label: "HEALTHY", tone: "healthy" };
  const loadProgress = Math.min(100, Math.max(0, (operationalLoad / 50) * 100));

  return (
    <section className="executive-kpis" aria-label="Executive summary metrics">
      <article className="dashboard-card executive-kpi" id="search-target-kpi-operational-load">
        <h2>Operational Load &amp; Toil Capacity</h2>
        <p className="executive-kpi__metric" data-testid="kpi-operational-load">
          {operationalLoad.toFixed(0)}%
        </p>
        <span className={`executive-kpi__status executive-kpi__status--${loadStatus.tone}`}>
          {loadStatus.label}
        </span>
        <p className="executive-kpi__detail" data-testid="kpi-operational-hours">
          {report.operationalLoadHours.toFixed(1)} / {report.effectiveAvailableHours.toFixed(1)} hrs toward operational work
        </p>
        <div
          className={`executive-kpi__meter executive-kpi__meter--${loadStatus.tone}`}
          role="progressbar"
          aria-label="Operational load against the 50% SRE threshold"
          aria-valuemin={0}
          aria-valuemax={50}
          aria-valuenow={Math.min(50, operationalLoad)}
          data-testid="kpi-operational-meter"
        >
          <span style={{ width: `${loadProgress}%` }} />
          <i aria-hidden="true" />
        </div>
        <p className="executive-kpi__caption">50% sustainable SRE capacity threshold</p>
      </article>
      <article className="dashboard-card executive-kpi" id="search-target-kpi-automation-roi">
        <h2>Automation ROI &amp; Financial Impact</h2>
        <p className="executive-kpi__metric" data-testid="kpi-upskilling-value">
          {currencyFormatter.format(dividend.annualizedValue)}/yr
        </p>
        <span className="executive-kpi__status executive-kpi__status--healthy">Upskilling Dividend</span>
        <p className="executive-kpi__detail" data-testid="kpi-upskilling-hours">
          {dividend.hoursRecoveredPerWeek.toFixed(1)} hrs/wk recovered internally
        </p>
        <button
          type="button"
          className="executive-kpi__action"
          onClick={onViewRoiReport}
          data-testid="toggle-summary-report"
        >
          View Automation ROI Summary Report
        </button>
      </article>
      <article className="dashboard-card executive-kpi" id="search-target-kpi-prr-governance">
        <h2>PRR &amp; Service Readiness</h2>
        <p className="executive-kpi__metric" data-testid="kpi-active-services">
          {activeServices.length}/{state.services.length} Active
        </p>
        <span className={`executive-kpi__status executive-kpi__status--${prrStatus.tone}`} data-testid="kpi-prr-status">
          {prrStatus.label}
        </span>
        <p className="executive-kpi__detail" data-testid="kpi-prr-count">
          {approvedServices.length} PRR approved · {activeServices.length - approvedServices.length} deficient
        </p>
      </article>
      <article className="dashboard-card executive-kpi" id="search-target-kpi-slo-health">
        <h2>SLO Health &amp; Error Budget</h2>
        <p className="executive-kpi__metric" data-testid="kpi-slo-health">
          {healthyPercent === null ? "N/A" : `${healthyPercent.toFixed(1)}%`}
        </p>
        <span className={`executive-kpi__status executive-kpi__status--${sloStatus.tone}`} data-testid="kpi-slo-status">
          {sloStatus.label}
        </span>
        <p className="executive-kpi__detail" data-testid="kpi-slo-counts">
          {healthyServices.length} healthy · {warningServices.length} at risk · {exhaustedServices.length} exhausted
        </p>
        <div
          className="executive-kpi__meter executive-kpi__meter--health"
          role="progressbar"
          aria-label="Percentage of active services with healthy SLO status"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={healthyPercent ?? 0}
          data-testid="kpi-slo-meter"
        >
          <span style={{ width: `${healthyPercent ?? 0}%` }} />
        </div>
        <p className="executive-kpi__caption">Active services with healthy SLO status</p>
      </article>
    </section>
  );
}

function DashboardContent() {
  const { auditLogs, clearAuditLogs } = useDashboard();
  const [activeTab, setActiveTab] = useState<DashboardTab>("summary");
  const [showSummaryReport, setShowSummaryReport] = useState(false);
  const [jump, setJump] = useState<{ targetId: string; serviceId?: string; nonce: number } | null>(null);

  const handleSearchSelect = (entry: SearchEntry) => {
    setActiveTab(entry.tab);
    setShowSummaryReport(false);
    setJump((current) => ({ targetId: entry.targetId, serviceId: entry.serviceId, nonce: (current?.nonce ?? 0) + 1 }));
  };

  useEffect(() => {
    if (!jump) return;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout>;
    let highlighted: HTMLElement | null = null;
    const run = () => {
      const target = document.getElementById(jump.targetId);
      if (!target) {
        attempts += 1;
        if (attempts < JUMP_MAX_ATTEMPTS) timer = setTimeout(run, JUMP_RETRY_MS);
        return;
      }
      target.scrollIntoView?.({ behavior: "smooth", block: "center" });
      target.classList.remove(HIGHLIGHT_CLASS);
      void target.offsetWidth;
      target.classList.add(HIGHLIGHT_CLASS);
      highlighted = target;
      timer = setTimeout(() => target.classList.remove(HIGHLIGHT_CLASS), HIGHLIGHT_DURATION_MS);
    };
    timer = setTimeout(run, 0);
    return () => {
      clearTimeout(timer);
      highlighted?.classList.remove(HIGHLIGHT_CLASS);
    };
  }, [jump]);

  const selectTab = (tab: DashboardTab) => {
    setActiveTab(tab);
    setShowSummaryReport(false);
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="SRE Dashboard home">
          <span className="brand__mark" aria-hidden="true">◈</span>
          <span className="brand__name">SRE Dashboard</span>
        </a>
        <SearchBar onSelect={handleSearchSelect} />
      </header>

      <div className="app-layout">
        <aside className="sidebar" aria-label="Main navigation">
          <div className="sidebar__navigation">
            {dashboardTabs.map(({ id, label, icon }) => (
              <button
                key={id}
                type="button"
                className={activeTab === id ? "sidebar__link sidebar__link--active" : "sidebar__link"}
                aria-current={activeTab === id ? "page" : undefined}
                onClick={() => selectTab(id)}
              >
                <span aria-hidden="true">{icon}</span> {label}
              </button>
            ))}
          </div>
          <AuditLog entries={auditLogs} onClear={clearAuditLogs} />
        </aside>

        <main className="dashboard">
      <header className="dashboard__header">
        <h1>SRE Infrastructure Complexity &amp; Operational Capacity Calculator</h1>
        <p>Quantify operational toil and keep it under the 50% SRE capacity threshold.</p>
      </header>

      <WarningBanner />

      {activeTab === "summary" && (
        showSummaryReport ? (
          <section className="dashboard-view" aria-label="Executive Summary">
            <button type="button" onClick={() => setShowSummaryReport(false)} data-testid="toggle-summary-report">
              Back to Executive Summary
            </button>
            <SummaryReport />
          </section>
        ) : (
          <section className="dashboard-view" aria-label="Executive Summary">
            <ExecutiveKpis onViewRoiReport={() => setShowSummaryReport(true)} />
            <HiringCostWidget />
          </section>
        )
      )}

      {activeTab === "team" && (
        <section className="dashboard-view" aria-label="Team and Capacity Settings">
          <GlobalConfigPanel />
        </section>
      )}

      {activeTab === "services" && (
        <section className="dashboard-view dashboard__grid" aria-label="Service Breakdown and Toil Analysis">
          <CapacityBucketsChart />
          <LoadGauge />
          <HandbackSimulator />
          <ServiceMatrix reveal={jump?.serviceId ? { serviceId: jump.serviceId, nonce: jump.nonce } : null} />
        </section>
      )}
        </main>
      </div>

      <nav className="mobile-nav" aria-label="Quick navigation">
        {dashboardTabs.map(({ id, shortLabel, icon }) => (
          <button
            key={id}
            type="button"
            className={activeTab === id ? "mobile-nav__item mobile-nav__item--active" : "mobile-nav__item"}
            aria-current={activeTab === id ? "page" : undefined}
            onClick={() => selectTab(id)}
          >
            <span className="mobile-nav__icon" aria-hidden="true">{icon}</span>
            <span>{shortLabel}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

function App() {
  return (
    <DashboardProvider>
      <DashboardContent />
    </DashboardProvider>
  );
}

export default App;
