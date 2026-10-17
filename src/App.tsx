import { useState } from "react";
import { DashboardProvider } from "./state/DashboardContext";
import { GlobalConfigPanel } from "./components/GlobalConfigPanel";
import { LoadGauge } from "./components/LoadGauge";
import { HiringCostWidget } from "./components/HiringCostWidget";
import { HandbackSimulator } from "./components/HandbackSimulator";
import { ServiceMatrix } from "./components/ServiceMatrix";
import { SummaryReport } from "./components/SummaryReport";
import { CapacityBucketsChart } from "./components/CapacityBucketsChart";
import { WarningBanner } from "./components/WarningBanner";
import "./App.css";

function App() {
  const [showSummaryReport, setShowSummaryReport] = useState(false);

  return (
    <DashboardProvider>
      <main className="dashboard">
        <header className="dashboard__header">
          <h1>SRE Infrastructure Complexity &amp; Operational Capacity Calculator</h1>
          <p>Quantify operational toil and keep it under the 50% SRE capacity threshold.</p>
          <button type="button" onClick={() => setShowSummaryReport((v) => !v)} data-testid="toggle-summary-report">
            {showSummaryReport ? "Back to Dashboard" : "View Automation ROI Summary Report"}
          </button>
        </header>

        {showSummaryReport ? (
          <SummaryReport />
        ) : (
          <>
            <GlobalConfigPanel />
            <WarningBanner />
            <div className="dashboard__grid">
              <CapacityBucketsChart />
              <HiringCostWidget />
              <LoadGauge />
              <HandbackSimulator />
              <ServiceMatrix />
            </div>
          </>
        )}
      </main>
    </DashboardProvider>
  );
}

export default App;
