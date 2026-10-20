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

function ExecutiveKpis() {
  const { state } = useDashboard();
  const report = computeCapacityReport(state);
  const dividend = calculateUpskillingDividend(state.services, state.globalConfig);
  const operationalLoad = report.operationalLoadRatio * 100;
  const loadStatus =
    operationalLoad > 60
      ? { label: "Critical", tone: "critical" }
      : operationalLoad > 50
        ? { label: "Approaching Limit", tone: "warning" }
        : { label: "Healthy / Within Limit", tone: "healthy" };
  const hireCount =
    report.deficitHours > 0 && state.globalConfig.weeklyHours > 0
      ? Math.ceil(report.deficitHours / (state.globalConfig.weeklyHours * 0.5))
      : 0;

  return (
    <section className="executive-kpis" aria-label="Executive summary metrics">
      <article className="dashboard-card executive-kpi">
        <h2>Operational Load</h2>
        <p className="executive-kpi__metric" data-testid="kpi-operational-load">
          {operationalLoad.toFixed(0)}%
        </p>
        <span className={`executive-kpi__status executive-kpi__status--${loadStatus.tone}`}>
          {loadStatus.label}
        </span>
      </article>
      <article className="dashboard-card executive-kpi">
        <h2>Upskilling Savings</h2>
        <p className="executive-kpi__metric" data-testid="kpi-upskilling-value">
          {currencyFormatter.format(dividend.annualizedValue)}/yr
        </p>
        <p data-testid="kpi-upskilling-hours">{dividend.hoursRecoveredPerWeek.toFixed(1)} hrs/wk recovered</p>
      </article>
      <article className="dashboard-card executive-kpi">
        <h2>Headcount Recommendation</h2>
        <p className="executive-kpi__metric" data-testid="kpi-headcount">
          {hireCount} {hireCount === 1 ? "External Hire" : "External Hires"} Required
        </p>
        <p>
          {report.isRedZone
            ? "Operational load exceeds the sustainable 50% capacity threshold."
            : "Operational load is within the sustainable 50% capacity threshold."}
        </p>
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
            <ExecutiveKpis />
            <HiringCostWidget />
            <button
              type="button"
              className="dashboard__report-cta"
              onClick={() => setShowSummaryReport(true)}
              data-testid="toggle-summary-report"
            >
              View Automation ROI Summary Report
            </button>
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
