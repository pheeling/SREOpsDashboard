import { useState } from "react";
import { DashboardProvider, useDashboard } from "./state/DashboardContext";
import { GlobalConfigPanel } from "./components/GlobalConfigPanel";
import { LoadGauge } from "./components/LoadGauge";
import { HiringCostWidget } from "./components/HiringCostWidget";
import { HandbackSimulator } from "./components/HandbackSimulator";
import { ServiceMatrix } from "./components/ServiceMatrix";
import { SummaryReport } from "./components/SummaryReport";
import { CapacityBucketsChart } from "./components/CapacityBucketsChart";
import { WarningBanner } from "./components/WarningBanner";
import { calculateUpskillingDividend, computeCapacityReport } from "./engine/calculations";
import "./App.css";

type DashboardTab = "summary" | "team" | "services";

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
      <article className="dashboard-card executive-kpi">
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
      <article className="dashboard-card executive-kpi">
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
      <article className="dashboard-card executive-kpi">
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
      <article className="dashboard-card executive-kpi">
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
  const [showSummaryReport, setShowSummaryReport] = useState(false);

  const selectTab = (tab: DashboardTab) => {
    setActiveTab(tab);
    setShowSummaryReport(false);
  };

  return (
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
          <ServiceMatrix />
        </section>
      )}
    </main>
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
