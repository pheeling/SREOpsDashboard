import { useDashboard } from "../state/DashboardContext";
import { calculateUpskillingDividend, computeCapacityReport } from "../engine/calculations";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function HiringCostWidget() {
  const { state } = useDashboard();
  const report = computeCapacityReport(state);
  const dividend = calculateUpskillingDividend(state.services, state.globalConfig);

  return (
    <section className="dashboard-card hiring-cost-widget" aria-label="Financial Impact: Hiring vs Internal Upskilling" data-testid="hiring-cost-widget">
      <h2>Financial Impact: Hiring vs Internal Upskilling</h2>
      <div className="hiring-cost-widget__comparison">
        <div>
          <h3>Option A: External Headcount</h3>
          <p className="hiring-cost-widget__amount" data-testid="hiring-cost-amount">
            {report.hiringCost > 0
              ? `${currencyFormatter.format(report.hiringCost)}/yr in external hiring costs to restore a sustainable 50% operational balance.`
              : "No external hiring required — operational load is within the 50% limit."}
          </p>
          <p>
            {report.operationalLoadHours.toFixed(1)} operational hours against {report.effectiveAvailableHours.toFixed(1)} effective
            available hours. Each hire absorbs toil with 50% of their time, reserving 50% for engineering.
          </p>
        </div>
        <div>
          <h3>Option B: Internal Upskilling Dividend</h3>
          <p className="hiring-cost-widget__amount" data-testid="upskilling-dividend-amount">
            {currencyFormatter.format(dividend.annualizedValue)}/yr in annualized value
          </p>
          {dividend.affectedServices.length > 0 ? (
            <>
              <p>
                Investing in structured onboarding drills (e.g., Wheel of Misfortune) across these {dividend.affectedServices.length}{" "}
                {dividend.affectedServices.length === 1 ? "service" : "services"} recovers{" "}
                <span data-testid="upskilling-hours">{dividend.hoursRecoveredPerWeek.toFixed(1)}</span> hrs/wk internally, saving{" "}
                {currencyFormatter.format(dividend.annualizedValue)}/yr without hiring.
              </p>
              <ul className="hiring-cost-widget__services" aria-label="Services with expertise gaps">
                {dividend.affectedServices.map((serviceName, index) => (
                  <li key={`${serviceName}-${index}`}>{serviceName}</li>
                ))}
              </ul>
            </>
          ) : (
            <p>No active services have an expertise gap to address.</p>
          )}
        </div>
      </div>
    </section>
  );
}
