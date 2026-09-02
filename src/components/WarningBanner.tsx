import { useDashboard } from "../state/DashboardContext";
import { computeCapacityReport } from "../engine/calculations";

export function WarningBanner() {
  const { state } = useDashboard();
  const report = computeCapacityReport(state);

  if (!report.isRedZone) return null;

  return (
    <div className="warning-banner" role="alert" data-testid="red-zone-alert">
      ⚠ RED ZONE: Operational load has crossed the 50% capacity threshold — innovation is stalling and the team is
      losing control of the estate. Reduce toil (automate, drop services, or hire) to recover.
    </div>
  );
}
