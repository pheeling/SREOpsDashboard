import { Fragment, useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { OwnershipModel, SloStatus } from "../engine/types";
import { useDashboard } from "../state/DashboardContext";
import { ServiceCard } from "./ServiceCard";
import { getParetoToilRanking, getTotalRequiredHours } from "../engine/calculations";
import { CriticalityToilQuadrant } from "./CriticalityToilQuadrant";
import { getServiceQuadrantKey, type QuadrantKey } from "./serviceQuadrants";
import { ParetoToilPanel } from "./ParetoToilPanel";

interface ServiceMatrixProps {
  reveal?: { serviceId: string; nonce: number } | null;
}

export function ServiceMatrix({ reveal = null }: ServiceMatrixProps) {
  const { state, dispatch, selectedTeamName } = useDashboard();
  const [groupByTeam, setGroupByTeam] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState("");
  const [deployHours, setDeployHours] = useState("1");
  const [maintenanceHours, setMaintenanceHours] = useState("1");
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [sloFilter, setSloFilter] = useState<"all" | "exhausted" | "at-risk">("all");
  const [selectedQuadrantFilter, setSelectedQuadrantFilter] = useState<QuadrantKey | null>(null);
  const [expandedCardIds, setExpandedCardIds] = useState<Set<string>>(() => new Set());

  const revealServiceId = reveal?.serviceId;
  const revealNonce = reveal?.nonce;
  useEffect(() => {
    if (!revealServiceId) return;
    setSloFilter("all");
    setSelectedQuadrantFilter(null);
    setExpandedCardIds((current) => new Set(current).add(revealServiceId));
  }, [revealServiceId, revealNonce]);

  const toggleExpandedCard = (serviceId: string) => {
    setExpandedCardIds((current) => {
      const next = new Set(current);
      if (next.has(serviceId)) next.delete(serviceId);
      else next.add(serviceId);
      return next;
    });
  };

  const handleToggleActive = (serviceId: string) => dispatch({ type: "TOGGLE_ACTIVE", serviceId });
  const handleToggleExpertise = (serviceId: string) => dispatch({ type: "TOGGLE_EXPERTISE", serviceId });
  const handleToggleAutomation = (serviceId: string) => dispatch({ type: "TOGGLE_AUTOMATION", serviceId });
  const handleTogglePrr = (serviceId: string) => dispatch({ type: "TOGGLE_PRR_APPROVED", serviceId });
  const handleChangeWeight = (serviceId: string, weight: number) =>
    dispatch({ type: "UPDATE_SERVICE_WEIGHT", serviceId, weight });
  const handleChangeSloStatus = (serviceId: string, sloStatus: SloStatus) =>
    dispatch({ type: "SET_SLO_STATUS", serviceId, sloStatus });

  const handleChangeOwnership = (serviceId: string, ownershipModel: OwnershipModel) =>
    dispatch({ type: "SET_OWNERSHIP", serviceId, ownershipModel });
  const handleChangeTeam = (serviceId: string, teamId: string) =>
    dispatch({ type: "SET_SERVICE_TEAM", serviceId, teamId });
  const handleDelete = (serviceId: string) => dispatch({ type: "DELETE_SERVICE", serviceId });
  const handleDeleteAll = () => {
    if (window.confirm("Delete all services from the catalog?")) {
      dispatch({ type: "DELETE_ALL_SERVICES" });
    }
  };
  const handleRestoreDefaults = () => dispatch({ type: "RESTORE_DEFAULT_SERVICES" });

  const activeCount = state.services.filter((s) => s.isActive).length;
  const totalRequiredHours = getTotalRequiredHours(state.services);
  const topToilIds = new Set(
    getParetoToilRanking(state.services)
      .entries.filter((entry) => entry.isTopContributor)
      .map((entry) => entry.id),
  );
  const avgHoursPerService = activeCount > 0 ? totalRequiredHours / activeCount : 0;
  const filteredServices = state.services.filter((service) => {
    if (selectedQuadrantFilter && (!service.isActive || getServiceQuadrantKey(service) !== selectedQuadrantFilter)) {
      return false;
    }
    if (sloFilter === "all") return true;
    if (!service.isActive) return false;
    return sloFilter === "exhausted"
      ? service.sloStatus === "exhausted"
      : service.sloStatus === "warning" || service.sloStatus === "exhausted";
  });

  const teams = state.teams ?? [];
  const isOrganizationView = !selectedTeamName;
  const teamOrder = new Map(teams.map((team, index) => [team.id, index]));
  const visibleServices =
    isOrganizationView && groupByTeam
      ? [...filteredServices].sort(
          (a, b) => (teamOrder.get(a.teamId ?? "") ?? 0) - (teamOrder.get(b.teamId ?? "") ?? 0),
        )
      : filteredServices;
  const defaultTeamId = teams.some((team) => team.id === state.selectedTeamId) ? state.selectedTeamId! : (teams[0]?.id ?? "");
  const newTeamId = teams.some((team) => team.id === selectedTeamId) ? selectedTeamId : defaultTeamId;

  const handleAddCustomService = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim() || !newTeamId) return;
    dispatch({
      type: "ADD_CUSTOM_SERVICE",
      payload: {
        name: name.trim(),
        deployHours: Number(deployHours) || 0,
        maintenanceHours: Number(maintenanceHours) || 0,
        teamId: newTeamId,
      },
    });
    setName("");
    setDeployHours("1");
    setMaintenanceHours("1");
    setShowAddForm(false);
  };

  return (
    <section className="dashboard-card service-matrix" aria-label="Service Matrix">
      <div className="service-matrix__toolbar">
        <h2>
          Services ({activeCount}/{state.services.length} active{selectedTeamName && (state.teams?.length ?? 0) > 1 ? ` for ${selectedTeamName}` : ""})
        </h2>
        <p className="service-matrix__scaling-note" data-testid="service-scaling-note">
          {totalRequiredHours.toFixed(1)} required hrs/wk across {activeCount} active service
          {activeCount === 1 ? "" : "s"} (~{avgHoursPerService.toFixed(1)} hrs/wk each) — load grows linearly as
          services are added.
        </p>
        <button
          type="button"
          className="service-matrix__add-toggle"
          onClick={() => setShowAddForm((v) => !v)}
          data-testid="add-custom-service-toggle"
        >
          {showAddForm ? "Cancel" : "+ Add Custom Service"}
        </button>
        <button
          type="button"
          className="service-matrix__delete-all"
          onClick={handleDeleteAll}
          disabled={state.services.length === 0}
          data-testid="delete-all-services"
        >
          Delete All
        </button>
      </div>

      {showAddForm && (
        <form className="service-matrix__add-form" onSubmit={handleAddCustomService} data-testid="add-custom-service-form">
          <label>
            Service Name
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              aria-label="Custom Service Name"
            />
          </label>
          <label>
            Base Deployment Hours
            <input
              type="number"
              min={0}
              step="0.5"
              value={deployHours}
              onChange={(e) => setDeployHours(e.target.value)}
              aria-label="Custom Service Deployment Hours"
            />
          </label>
          <label>
            Base Maintenance Hours
            <input
              type="number"
              min={0}
              step="0.5"
              value={maintenanceHours}
              onChange={(e) => setMaintenanceHours(e.target.value)}
              aria-label="Custom Service Maintenance Hours"
            />
          </label>
          <label>
            Assigned Team
            <select
              value={newTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              required
              aria-label="Custom Service Assigned Team"
            >
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" data-testid="add-custom-service-submit">
            Add Service
          </button>
        </form>
      )}

      <label className="service-matrix__slo-filter">
        Filter by SLO Status
        <select
          value={sloFilter}
          onChange={(e) => setSloFilter(e.target.value as typeof sloFilter)}
          aria-label="Filter by SLO Status"
        >
          <option value="all">All</option>
          <option value="exhausted">Exhausted</option>
          <option value="at-risk">At Risk</option>
        </select>
      </label>

      {isOrganizationView && teams.length > 1 && (
        <label className="service-matrix__slo-filter">
          <input
            type="checkbox"
            checked={groupByTeam}
            onChange={(e) => setGroupByTeam(e.target.checked)}
            aria-label="Group services by team"
          />
          Group by team
        </label>
      )}

      <CriticalityToilQuadrant
        services={state.services}
        selectedQuadrantFilter={selectedQuadrantFilter}
        onSelectQuadrant={(quadrant) =>
          setSelectedQuadrantFilter((current) => (current === quadrant ? null : quadrant))
        }
      />
      <ParetoToilPanel />

      <div className="service-matrix__list-toolbar">
        <h3>Service Toil Allocation</h3>
        <button
          type="button"
          className={`service-matrix__all-filter ${selectedQuadrantFilter === null ? "service-matrix__all-filter--active" : ""}`}
          aria-pressed={selectedQuadrantFilter === null}
          onClick={() => setSelectedQuadrantFilter(null)}
        >
          All Services
        </button>
      </div>

      {state.services.length === 0 ? (
        <div className="service-matrix__empty" data-testid="services-empty-state">
          <p>No active services in catalog.</p>
          <button
            type="button"
            className="service-matrix__restore"
            onClick={handleRestoreDefaults}
            data-testid="restore-default-services"
          >
            Restore Default Services
          </button>
        </div>
      ) : (
        visibleServices.length === 0 ? (
          <p className="service-matrix__filtered-empty" data-testid="services-filter-empty">
            No services match the selected filters.
          </p>
        ) : (
          <div className="service-matrix__allocation">
            <div className="service-matrix__columns" aria-hidden="true">
              <span>Service &amp; ownership</span>
              <span>Toil load</span>
              <span>PRR compliance</span>
              <span>SLO status</span>
              <span>Automation</span>
            </div>
            <div className="service-matrix__grid">
              {visibleServices.map((service, index) => (
                <Fragment key={service.id}>
                  {isOrganizationView && groupByTeam && service.teamId !== visibleServices[index - 1]?.teamId && (
                    <h4 className="service-matrix__group-heading">
                      {teams.find((team) => team.id === service.teamId)?.name}
                    </h4>
                  )}
                <ServiceCard
                  service={service}
                  teams={teams}
                  isExpanded={expandedCardIds.has(service.id)}
                  onToggleExpanded={toggleExpandedCard}
                  isTopToilContributor={topToilIds.has(service.id)}
                  onToggleActive={handleToggleActive}
                  onToggleExpertise={handleToggleExpertise}
                  onToggleAutomation={handleToggleAutomation}
                  onTogglePrr={handleTogglePrr}
                  onChangeSloStatus={handleChangeSloStatus}
                  onChangeWeight={handleChangeWeight}
                  onChangeOwnership={handleChangeOwnership}
                  onChangeTeam={handleChangeTeam}
                  onDelete={handleDelete}
                />
                </Fragment>
              ))}
            </div>
          </div>
        )
      )}
    </section>
  );
}
