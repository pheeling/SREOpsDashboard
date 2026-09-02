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
    <section className="hiring-cost-widget" aria-label="Financial Impact: External Hiring Costs" data-testid="hiring-cost-widget">
      <h2>Financial Impact: External Hiring Costs</h2>
      {report.hiringCost > 0 ? (
        <p className="hiring-cost-widget__amount" data-testid="hiring-cost-amount">
          {currencyFormatter.format(report.hiringCost)}/yr in external hiring costs to close the gap between{" "}
          {report.totalRequiredHours.toFixed(1)} required hours and {report.effectiveAvailableHours.toFixed(1)}{" "}
          effective available hours.
        </p>
      ) : (
        <p className="hiring-cost-widget__amount" data-testid="hiring-cost-amount">
          No external hiring required — current internal headcount covers required operational hours.
        </p>
      )}
    </section>
  );
}
