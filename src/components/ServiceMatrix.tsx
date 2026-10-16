import { useState } from "react";
import type { FormEvent } from "react";
import { useDashboard } from "../state/DashboardContext";
import { ServiceCard } from "./ServiceCard";
import { getTotalRequiredHours } from "../engine/calculations";

export function ServiceMatrix() {
  const { state, dispatch } = useDashboard();
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState("");
  const [deployHours, setDeployHours] = useState("1");
  const [maintenanceHours, setMaintenanceHours] = useState("1");

  const handleToggleActive = (serviceId: string) => dispatch({ type: "TOGGLE_ACTIVE", serviceId });
  const handleToggleExpertise = (serviceId: string) => dispatch({ type: "TOGGLE_EXPERTISE", serviceId });
  const handleToggleAutomation = (serviceId: string) => dispatch({ type: "TOGGLE_AUTOMATION", serviceId });
  const handleChangeWeight = (serviceId: string, weight: number) =>
    dispatch({ type: "UPDATE_SERVICE_WEIGHT", serviceId, weight });

  const handleDelete = (serviceId: string) => dispatch({ type: "DELETE_SERVICE", serviceId });
  const handleDeleteAll = () => {
    if (window.confirm("Delete all services from the catalog?")) {
      dispatch({ type: "DELETE_ALL_SERVICES" });
    }
  };
  const handleRestoreDefaults = () => dispatch({ type: "RESTORE_DEFAULT_SERVICES" });

  const activeCount = state.services.filter((s) => s.isActive).length;
  const totalRequiredHours = getTotalRequiredHours(state.services);
  const avgHoursPerService = activeCount > 0 ? totalRequiredHours / activeCount : 0;

  const handleAddCustomService = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) return;
    dispatch({
      type: "ADD_CUSTOM_SERVICE",
      payload: {
        name: name.trim(),
        deployHours: Number(deployHours) || 0,
        maintenanceHours: Number(maintenanceHours) || 0,
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
          Services ({activeCount}/{state.services.length} active)
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
          <button type="submit" data-testid="add-custom-service-submit">
            Add Service
          </button>
        </form>
      )}

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
        <div className="service-matrix__grid">
          {state.services.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              onToggleActive={handleToggleActive}
              onToggleExpertise={handleToggleExpertise}
              onToggleAutomation={handleToggleAutomation}
              onChangeWeight={handleChangeWeight}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </section>
  );
}
