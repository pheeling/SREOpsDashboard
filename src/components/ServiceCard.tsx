import type { OwnershipModel, Service, SloStatus, Team } from "../engine/types";
import { OWNERSHIP_LABELS, getBaseHours, getOwnershipModel, getRequiredHours } from "../engine/calculations";

interface ServiceCardProps {
  service: Service;
  isExpanded: boolean;
  isTopToilContributor?: boolean;
  onToggleExpanded: (id: string) => void;
  onToggleActive: (id: string) => void;
  onToggleExpertise: (id: string) => void;
  onToggleAutomation: (id: string) => void;
  onTogglePrr: (id: string) => void;
  onChangeSloStatus: (id: string, sloStatus: SloStatus) => void;
  onChangeWeight: (id: string, weight: number) => void;
  onChangeOwnership: (id: string, ownershipModel: OwnershipModel) => void;
  onDelete: (id: string) => void;
  teams?: Team[];
  onChangeTeam?: (id: string, teamId: string) => void;
  showTeam?: boolean;
}

export function ServiceCard({
  service,
  isExpanded,
  isTopToilContributor = false,
  onToggleExpanded,
  onToggleActive,
  onToggleExpertise,
  onToggleAutomation,
  onTogglePrr,
  onChangeSloStatus,
  onChangeWeight,
  onChangeOwnership,
  onDelete,
  teams = [],
  onChangeTeam,
  showTeam = false,
}: ServiceCardProps) {
  const teamName = showTeam ? teams.find((team) => team.id === service.teamId)?.name : undefined;
  const requiredHours = getRequiredHours(service);
  const baseHours = getBaseHours(service);
  const weight = service.weight ?? 1;
  const detailsId = `service-details-${service.id}`;
  const ownershipModel = getOwnershipModel(service);
  const ownershipLabel = ownershipModel === "sre_full" ? "SRE Owned" : OWNERSHIP_LABELS[ownershipModel];
  const sloStatusLabel =
    service.sloStatus === "healthy"
      ? "Healthy · ≥20% remaining"
      : service.sloStatus === "warning"
        ? "Warning · <20% remaining"
        : "Exhausted · depleted";

  return (
    <article
      className={`service-card ${service.isActive ? "service-card--active" : "service-card--inactive"} ${service.sloStatus === "exhausted" ? "service-card--slo-exhausted" : ""} ${isExpanded ? "service-card--expanded" : ""}`}
      data-testid={`service-card-${service.id}`}
      id={`search-target-service-${service.id}`}
    >
      <div className="service-card__overview">
        <button
          type="button"
          className="service-card__summary"
          aria-expanded={isExpanded}
          aria-controls={detailsId}
          onClick={() => onToggleExpanded(service.id)}
        >
          <span className="service-card__summary-main">
            <span className="service-card__name">{service.name}</span>
            <span className="service-card__ownership">{ownershipLabel}</span>
            {teamName && <span className="service-card__team">{teamName}</span>}
            <span className="service-card__expand-indicator" aria-hidden="true">{isExpanded ? "−" : "+"}</span>
          </span>
          <span className="service-card__hours">
            <span className={`service-card__badge ${service.isActive ? "service-card__badge--active" : ""}`}>
              {service.isActive ? requiredHours.toFixed(2) : "0.00"} hrs/wk
            </span>
          </span>
          <span className="service-card__summary-prr">
            <span className={`service-card__prr-badge ${service.prrApproved ? "service-card__prr-badge--approved" : "service-card__prr-badge--deficient"}`}>
              PRR {service.prrApproved ? "Approved" : "Deficient"}
            </span>
          </span>
          <span className="service-card__summary-slo">
            <span className={`slo-status-badge slo-status-badge--${service.sloStatus}`}>{sloStatusLabel}</span>
          </span>
        </button>
        <label className={`service-card__automation ${service.isAutomated ? "service-card__automation--on" : ""}`}>
          <input
            type="checkbox"
            checked={service.isAutomated}
            disabled={!service.isActive}
            onChange={() => onToggleAutomation(service.id)}
            aria-label={`${service.name} Automation`}
          />
          Automated
        </label>
      </div>

      <div
        id={detailsId}
        className="service-card__details"
        aria-hidden={!isExpanded}
        inert={!isExpanded}
      >
        <div className="service-card__details-inner">
          <div className="service-card__details-toolbar">
            <label className="service-card__activate">
              <input
                type="checkbox"
                checked={service.isActive}
                onChange={() => onToggleActive(service.id)}
                aria-label={`${service.name} Active`}
              />
              Active
            </label>
            <button
              type="button"
              className="service-card__delete"
              onClick={() => onDelete(service.id)}
              aria-label={`Delete ${service.name}`}
              title={`Delete ${service.name}`}
            >
              Delete
            </button>
          </div>

          <label className={`service-card__slo-status service-card__slo-status--${service.sloStatus}`}>
            SLO Status
            <select
              value={service.sloStatus}
              onChange={(e) => onChangeSloStatus(service.id, e.target.value as SloStatus)}
              aria-label={`${service.name} SLO Status`}
            >
              <option value="healthy">Healthy · ≥20% remaining</option>
              <option value="warning">Warning · &lt;20% remaining</option>
              <option value="exhausted">Exhausted · depleted/freeze active</option>
            </select>
          </label>
          {isTopToilContributor && (
            <p className="service-card__top-toil" data-testid={`top-toil-badge-${service.id}`}>
              Top Toil Contributor
            </p>
          )}

          {!service.isActive && <p className="service-card__muted-note">Inactive — 0 hrs contributed</p>}

          <p className="service-card__base-hours">Base: {baseHours.toFixed(1)} hrs/wk</p>

          <div className="service-card__toggles">
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
            <label className={`service-card__toggle ${service.prrApproved ? "service-card__toggle--on" : ""}`}>
              <input
                type="checkbox"
                checked={service.prrApproved}
                onChange={() => onTogglePrr(service.id)}
                aria-label={`${service.name} PRR Approved`}
              />
              PRR Approved
            </label>
          </div>

          <label className="service-card__weight">
            Ownership
            <select
              value={getOwnershipModel(service)}
              disabled={!service.isActive}
              onChange={(e) => onChangeOwnership(service.id, e.target.value as OwnershipModel)}
              aria-label={`${service.name} Ownership`}
            >
              {(Object.keys(OWNERSHIP_LABELS) as OwnershipModel[]).map((model) => (
                <option key={model} value={model}>
                  {OWNERSHIP_LABELS[model]}
                </option>
              ))}
            </select>
          </label>

          {teams.length > 1 && onChangeTeam && (
            <label className="service-card__weight">
              Team
              <select
                value={service.teamId}
                onChange={(e) => onChangeTeam(service.id, e.target.value)}
                aria-label={`${service.name} Team`}
              >
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </label>
          )}

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
      </div>
    </article>
  );
}
