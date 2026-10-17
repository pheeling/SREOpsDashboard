import type { Service } from "../engine/types";
import { getBaseHours, getRequiredHours } from "../engine/calculations";

interface ServiceCardProps {
  service: Service;
  isTopToilContributor?: boolean;
  onToggleActive: (id: string) => void;
  onToggleExpertise: (id: string) => void;
  onToggleAutomation: (id: string) => void;
  onChangeWeight: (id: string, weight: number) => void;
  onDelete: (id: string) => void;
}

export function ServiceCard({
  service,
  isTopToilContributor = false,
  onToggleActive,
  onToggleExpertise,
  onToggleAutomation,
  onChangeWeight,
  onDelete,
}: ServiceCardProps) {
  const requiredHours = getRequiredHours(service);
  const baseHours = getBaseHours(service);
  const weight = service.weight ?? 1;

  return (
    <div
      className={`service-card ${service.isActive ? "service-card--active" : "service-card--inactive"}`}
      data-testid={`service-card-${service.id}`}
    >
      <button
        type="button"
        className="service-card__delete"
        onClick={() => onDelete(service.id)}
        aria-label={`Delete ${service.name}`}
        title={`Delete ${service.name}`}
      >
        ×
      </button>
      <div className="service-card__header">
        <label className="service-card__activate">
          <input
            type="checkbox"
            checked={service.isActive}
            onChange={() => onToggleActive(service.id)}
            aria-label={`${service.name} Active`}
          />
          <h3 className="service-card__name">{service.name}</h3>
        </label>
        <span className={`service-card__badge ${service.isActive ? "service-card__badge--active" : ""}`}>
          {service.isActive ? requiredHours.toFixed(2) : "0.00"} hrs/wk
        </span>
      </div>

      {isTopToilContributor && (
        <p className="service-card__top-toil" data-testid={`top-toil-badge-${service.id}`}>
          Top Toil Contributor
        </p>
      )}

      {!service.isActive && <p className="service-card__muted-note">Inactive — 0 hrs contributed</p>}

      <p className="service-card__base-hours">Base: {baseHours.toFixed(1)} hrs/wk</p>

      <div className="service-card__toggles">
        <label className={`service-card__toggle ${service.isAutomated ? "service-card__toggle--on" : ""}`}>
          <input
            type="checkbox"
            checked={service.isAutomated}
            disabled={!service.isActive}
            onChange={() => onToggleAutomation(service.id)}
            aria-label={`${service.name} Automation`}
          />
          Automated
        </label>
        <label className={`service-card__toggle ${service.hasExpertise ? "service-card__toggle--on" : ""}`}>
          <input
            type="checkbox"
            checked={service.hasExpertise}
            disabled={!service.isActive}
            onChange={() => onToggleExpertise(service.id)}
            aria-label={`${service.name} Expertise`}
          />
          Expertise
        </label>
      </div>

      <label className="service-card__weight">
        Criticality Weight
        <input
          type="number"
          min={0.5}
          max={3}
          step={0.1}
          value={weight}
          disabled={!service.isActive}
          onChange={(e) => onChangeWeight(service.id, Number(e.target.value))}
          aria-label={`${service.name} Criticality Weight`}
        />
      </label>
    </div>
  );
}
