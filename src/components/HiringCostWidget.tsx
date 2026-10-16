import { useDashboard } from "../state/DashboardContext";
import { computeCapacityReport } from "../engine/calculations";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function HiringCostWidget() {
  const { state } = useDashboard();
  const report = computeCapacityReport(state);

  return (
    <section className="dashboard-card hiring-cost-widget" aria-label="Financial Impact: External Hiring Costs" data-testid="hiring-cost-widget">
      <h2>Financial Impact: External Hiring Costs</h2>
      {report.hiringCost > 0 ? (
        <p className="hiring-cost-widget__amount" data-testid="hiring-cost-amount">
          {currencyFormatter.format(report.hiringCost)}/yr in external hiring costs to restore a sustainable 50% operational balance:{" "}
          {report.operationalLoadHours.toFixed(1)} operational hours against {report.effectiveAvailableHours.toFixed(1)}{" "}
          effective available hours. Each hire absorbs toil with 50% of their time, reserving 50% for engineering.
        </p>
      ) : (
        <p className="hiring-cost-widget__amount" data-testid="hiring-cost-amount">
          No external hiring required — operational load is within the 50% limit.
        </p>
      )}
    </section>
  );
}
