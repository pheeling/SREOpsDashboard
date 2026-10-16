import { useDashboard } from "../state/DashboardContext";
import { getAutomationRoiDollars, getAutomationRoiHours } from "../engine/calculations";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function SummaryReport() {
  const { state } = useDashboard();
  const { globalConfig, services } = state;

  const manualServices = services.filter((s) => s.isActive && !s.isAutomated);
  const totalRoiDollars = manualServices.reduce(
    (sum, service) => sum + getAutomationRoiDollars(service, globalConfig),
    0,
  );

  return (
    <section className="dashboard-card summary-report" aria-label="Automation ROI Summary Report" data-testid="summary-report">
      <h2>Automation ROI Summary Report</h2>
      <p>
        Industry research shows 40–90% of a system&apos;s total cost is incurred after initial release. The table
        below quantifies the annualized dollar impact of automating each remaining manual service.
      </p>
      <table>
        <thead>
          <tr>
            <th>Service</th>
            <th>Hours Saved/wk</th>
            <th>Annualized Savings</th>
          </tr>
        </thead>
        <tbody>
          {manualServices.map((service) => (
            <tr key={service.id}>
              <td>{service.name}</td>
              <td>{getAutomationRoiHours(service).toFixed(2)}</td>
              <td>{currencyFormatter.format(getAutomationRoiDollars(service, globalConfig))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="summary-report__total" data-testid="summary-report-total">
        Total ROI of Automation: {currencyFormatter.format(totalRoiDollars)}/yr
      </p>
    </section>
  );
}
