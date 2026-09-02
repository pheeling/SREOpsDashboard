import type { Service } from "../engine/types";
import { getRequiredHours } from "../engine/calculations";

interface ServiceCardProps {
  service: Service;
  onToggleSME: (id: string) => void;
  onToggleAutomation: (id: string) => void;
}

export function ServiceCard({ service, onToggleSME, onToggleAutomation }: ServiceCardProps) {
  const requiredHours = getRequiredHours(service);

  return (
    <div className="service-card" data-testid={`service-card-${service.id}`}>
      <h3 className="service-card__name">{service.name}</h3>
      <p className="service-card__hours">{requiredHours.toFixed(2)} hrs/wk</p>
      <label className="service-card__toggle">
        <input
          type="checkbox"
          checked={service.hasSME}
          onChange={() => onToggleSME(service.id)}
          aria-label={`${service.name} SME`}
        />
        SME
      </label>
      <label className="service-card__toggle">
        <input
          type="checkbox"
          checked={service.isAutomated}
          onChange={() => onToggleAutomation(service.id)}
          aria-label={`${service.name} Automation`}
        />
        Automation
      </label>
    </div>
  );
}
