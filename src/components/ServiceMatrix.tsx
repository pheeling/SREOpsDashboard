import { useDashboard } from "../state/DashboardContext";
import { ServiceCard } from "./ServiceCard";

export function ServiceMatrix() {
  const { state, dispatch } = useDashboard();

  const handleToggleSME = (serviceId: string) => dispatch({ type: "TOGGLE_SME", serviceId });
  const handleToggleAutomation = (serviceId: string) => dispatch({ type: "TOGGLE_AUTOMATION", serviceId });

  return (
    <section className="service-matrix" aria-label="Service Matrix">
      <h2>Service Matrix ({state.services.length} services)</h2>
      <div className="service-matrix__grid">
        {state.services.map((service) => (
          <ServiceCard
            key={service.id}
            service={service}
            onToggleSME={handleToggleSME}
            onToggleAutomation={handleToggleAutomation}
          />
        ))}
      </div>
    </section>
  );
}
