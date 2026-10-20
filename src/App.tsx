import { useEffect, useState } from "react";
import { DashboardProvider, useDashboard } from "./state/DashboardContext";
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
type QuickTab = "overview" | "incidents" | "topology" | "slo-costs";

const dashboardTabForQuickTab: Record<QuickTab, DashboardTab> = {
  overview: "summary",
  incidents: "services",
  topology: "services",
  "slo-costs": "team",
};

const quickTabs: { id: QuickTab; label: string; icon: string }[] = [
  { id: "overview", label: "Overview", icon: "◫" },
  { id: "incidents", label: "Incidents", icon: "!" },
  { id: "topology", label: "Topology", icon: "◎" },
  { id: "slo-costs", label: "SLO/Costs", icon: "⌁" },
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
  const [activeTab, setActiveTab] = useState<DashboardTab>("summary");
  const [activeQuickTab, setActiveQuickTab] = useState<QuickTab>("overview");
  const [showSummaryReport, setShowSummaryReport] = useState(false);
  const [pagerEnabled, setPagerEnabled] = useState(true);
  const [jump, setJump] = useState<{ targetId: string; serviceId?: string; nonce: number } | null>(null);

  const handleSearchSelect = (entry: SearchEntry) => {
    setActiveTab(entry.tab);
    setActiveQuickTab(entry.tab === "summary" ? "overview" : entry.tab === "team" ? "slo-costs" : "incidents");
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
    setActiveQuickTab(tab === "summary" ? "overview" : tab === "team" ? "slo-costs" : "incidents");
    setShowSummaryReport(false);
  };

  const selectQuickTab = (tab: QuickTab) => {
    setActiveQuickTab(tab);
    setActiveTab(dashboardTabForQuickTab[tab]);
    setShowSummaryReport(false);
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="Obsidian Telemetry home">
          <span className="brand__mark" aria-hidden="true">◈</span>
          <span className="brand__name">OBSIDIAN <span>TELEMETRY</span></span>
        </a>
        <div className="topbar__cluster">
          <span className="topbar__eyebrow">CLUSTER</span>
          <select aria-label="Cluster">
            <option>production-us-east-1</option>
            <option>staging-us-east-1</option>
          </select>
        </div>
        <SearchBar onSelect={handleSearchSelect} />
        <div className="topbar__health" aria-label="System status: 99.992% SLO">
          <span className="status-dot" />
          <span className="topbar__health-label">SYSTEM STATUS</span>
          <strong>99.992% <span>SLO</span></strong>
        </div>
        <button
          className={`pager-toggle ${pagerEnabled ? "pager-toggle--on" : ""}`}
          type="button"
          aria-pressed={pagerEnabled}
          onClick={() => setPagerEnabled(!pagerEnabled)}
        >
          <span className="pager-toggle__dot" />
          Pager {pagerEnabled ? "On" : "Off"}
        </button>
        <button className="profile-button" type="button" aria-label="User profile: Alex Morgan">
          <span className="profile-button__avatar">AM</span>
          <span className="profile-button__name">Alex Morgan</span>
          <span aria-hidden="true">⌄</span>
        </button>
        <div className="mobile-health" aria-label="Cluster health 99.982% SLO">
          <span className="status-dot" />99.982% <span>SLO</span>
        </div>
        <button className="mobile-alerts" type="button" aria-label="2 active alerts">
          ♧<span>2</span>
        </button>
        <span className="mobile-avatar" aria-label="Alex Morgan">AM</span>
      </header>

      <div className="app-layout">
        <aside className="sidebar" aria-label="Main navigation">
          <div className="sidebar__navigation">
            <details open>
              <summary>WORKSPACE</summary>
              <button type="button" className={activeTab === "summary" ? "sidebar__link sidebar__link--active" : "sidebar__link"} onClick={() => selectTab("summary")}><span>◫</span> Overview</button>
              <button type="button" className={activeTab === "services" ? "sidebar__link sidebar__link--active" : "sidebar__link"} onClick={() => selectTab("services")}><span>⌁</span> Service health</button>
            </details>
            <details open>
              <summary>OBSERVABILITY</summary>
              <button type="button" className="sidebar__link" onClick={() => selectTab("services")}><span>◎</span> Topology</button>
              <button type="button" className="sidebar__link" onClick={() => selectTab("services")}><span>⌁</span> SLO &amp; error budgets</button>
              <button type="button" className="sidebar__link" onClick={() => selectTab("services")}><span>◉</span> Incidents <span className="sidebar__count">2</span></button>
            </details>
            <details open>
              <summary>MANAGEMENT</summary>
              <button type="button" className={activeTab === "team" ? "sidebar__link sidebar__link--active" : "sidebar__link"} onClick={() => selectTab("team")}><span>◷</span> Capacity &amp; costs</button>
            </details>
          </div>
          <section className="live-feed" aria-label="Telemetry live feed">
            <h2><span className="status-dot" /> LIVE TELEMETRY</h2>
            <p><span className="live-feed__time">14:32:08</span> All systems operational</p>
            <p><span className="live-feed__time">14:31:52</span> Deployment completed</p>
            <p><span className="live-feed__time">14:30:11</span> SLO check passed</p>
          </section>
        </aside>

        <main className="dashboard">
      <header className="dashboard__header">
        <h1>SRE Infrastructure Complexity &amp; Operational Capacity Calculator</h1>
        <p>Quantify operational toil and keep it under the 50% SRE capacity threshold.</p>
      </header>

      <nav className="dashboard-tabs" aria-label="Dashboard sections">
        {(
          [
            ["summary", "Executive Summary"],
            ["team", "Team & Capacity Settings"],
            ["services", "Service Breakdown & Toil Analysis"],
          ] as const
        ).map(([tab, label]) => (
          <button
            key={tab}
            type="button"
            className={`dashboard-tabs__tab ${activeTab === tab ? "dashboard-tabs__tab--active" : ""}`}
            aria-current={activeTab === tab ? "page" : undefined}
            onClick={() => selectTab(tab)}
          >
            {label}
          </button>
        ))}
      </nav>

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
        {quickTabs.map(({ id, label, icon }) => (
          <button
            key={id}
            type="button"
            className={activeQuickTab === id ? "mobile-nav__item mobile-nav__item--active" : "mobile-nav__item"}
            aria-current={activeQuickTab === id ? "page" : undefined}
            onClick={() => selectQuickTab(id)}
          >
            <span className="mobile-nav__icon" aria-hidden="true">{icon}</span>
            <span>{label}</span>
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
