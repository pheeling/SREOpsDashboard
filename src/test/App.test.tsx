import { describe, expect, it, beforeEach, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";
import { STORAGE_KEY } from "../state/localStorage";

async function showServices(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Service Breakdown & Toil Analysis" }));
}

async function expandService(user: ReturnType<typeof userEvent.setup>, serviceId: string) {
  const card = screen.getByTestId(`service-card-${serviceId}`);
  await user.click(within(card).getByRole("button", { name: new RegExp(serviceId.replaceAll("_", " "), "i") }));
  return card;
}

describe("App", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders the Obsidian telemetry shell and switches from the mobile quick navigation", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(document.querySelector(".topbar")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Obsidian Telemetry home" })).toBeInTheDocument();
    expect(screen.getByLabelText("Cluster")).toHaveValue("production-us-east-1");
    expect(screen.getByLabelText("System status: 99.992% SLO")).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Main navigation" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Telemetry live feed" })).toBeInTheDocument();

    const quickNavigation = screen.getByRole("navigation", { name: "Quick navigation" });
    await user.click(within(quickNavigation).getByRole("button", { name: "Topology" }));
    expect(within(quickNavigation).getByRole("button", { name: "Topology" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("region", { name: "Service Breakdown and Toil Analysis" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Pager On" }));
    expect(screen.getByRole("button", { name: "Pager Off" })).toHaveAttribute("aria-pressed", "false");
  });

  it("defaults to the executive summary with dynamic KPI cards and financial impact", () => {
    render(<App />);

    expect(screen.getByRole("navigation", { name: "Dashboard sections" })).toBeInTheDocument();
    expect(screen.getByTestId("kpi-operational-load")).toBeInTheDocument();
    expect(screen.getByTestId("kpi-upskilling-value")).toHaveTextContent("$0/yr");
    expect(screen.getByTestId("kpi-headcount")).toHaveTextContent(/\d+ External Hires Required/);
    expect(screen.getByTestId("hiring-cost-widget")).toBeInTheDocument();
    expect(screen.queryByTestId("load-gauge")).not.toBeInTheDocument();
    expect(screen.queryByTestId("staffing-warning")).not.toBeInTheDocument();
  });

  it("warns when the configured team has fewer than four engineers", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Team & Capacity Settings" }));

    const fteInput = screen.getByLabelText("FTE Count");
    await user.clear(fteInput);
    await user.type(fteInput, "3");

    expect(screen.getByTestId("staffing-warning")).toHaveTextContent(
      "Warning: An SRE team with fewer than 4 engineers cannot sustain a healthy 24/7 on-call rotation without severe burnout, regardless of service volume.",
    );

    await user.clear(fteInput);
    await user.type(fteInput, "4");
    expect(screen.queryByTestId("staffing-warning")).not.toBeInTheDocument();
  });

  it("allows the team to adjust its effective capacity factor", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Team & Capacity Settings" }));

    const capacityInput = screen.getByLabelText("Effective Capacity (%)");
    fireEvent.change(capacityInput, { target: { value: "50" } });

    expect(capacityInput).toHaveValue("50");
    await user.click(screen.getByRole("button", { name: "Service Breakdown & Toil Analysis" }));
    expect(screen.getByTestId("capacity-segment-emergencyResponse").getAttribute("title")).toContain("10.0 hrs");
  });

  it("keeps team settings across tabs and synchronizes slider and editable FTE controls", async () => {
    const user = userEvent.setup();
    render(<App />);
    const initialLoad = screen.getByTestId("kpi-operational-load").textContent;

    await user.click(screen.getByRole("button", { name: "Team & Capacity Settings" }));
    const fteSlider = screen.getByLabelText("FTE Count slider");
    fireEvent.change(fteSlider, { target: { value: "8" } });
    expect(screen.getByLabelText("FTE Count")).toHaveValue(8);
    await user.click(screen.getByRole("button", { name: "Executive Summary" }));
    expect(screen.getByTestId("kpi-operational-load").textContent).not.toBe(initialLoad);

    await user.click(screen.getByRole("button", { name: "Service Breakdown & Toil Analysis" }));
    await user.click(screen.getByRole("button", { name: "Team & Capacity Settings" }));
    expect(screen.getByLabelText("FTE Count")).toHaveValue(8);
    expect(screen.getByRole("switch", { name: "Dedicated Interrupt Shield" })).toHaveAttribute("aria-checked", "false");
  });

  it("filters services by clicking a criticality/toil quadrant and clears the filter", async () => {
    const user = userEvent.setup();
    render(<App />);
    await showServices(user);

    const backupCard = screen.getByTestId("service-card-backup");
    expect(within(backupCard).getByRole("button")).toHaveAttribute("aria-expanded", "false");
    expect(backupCard.querySelector(".service-card__details")).toHaveAttribute("aria-hidden", "true");

    await user.click(screen.getByRole("button", { name: /Low criticality · High toil/ }));
    expect(screen.getByTestId("service-card-backup")).toBeInTheDocument();
    expect(screen.queryByTestId("service-card-databases")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "All Services" }));
    expect(screen.getByTestId("service-card-databases")).toBeInTheDocument();

    await expandService(user, "backup");
    expect(within(backupCard).getByLabelText("Backup Automation")).toBeInTheDocument();
  });

  it("formats salary as currency and updates the interrupt shield state", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Team & Capacity Settings" }));

    const salary = screen.getByLabelText("Annual Salary Baseline ($)");
    await user.clear(salary);
    await user.type(salary, "125000");
    await user.tab();
    expect(salary).toHaveValue("$125,000");

    const shield = screen.getByRole("switch", { name: "Dedicated Interrupt Shield" });
    await user.click(shield);
    expect(shield).toHaveAttribute("aria-checked", "true");
    expect(shield).toHaveTextContent("Enabled");
  });

  it("toggling automation for a service reduces its required hours", async () => {
    const user = userEvent.setup();
    render(<App />);
    await showServices(user);

    const card = await expandService(user, "databases");
    const badge = card.querySelector(".service-card__badge");
    const before = badge?.textContent;

    await user.click(within(card).getByLabelText("Databases Automation"));

    const after = card.querySelector(".service-card__badge")?.textContent;
    expect(after).not.toBe(before);
  });

  it("toggling expertise off increases that service's displayed required hours by 25%", async () => {
    const user = userEvent.setup();
    render(<App />);
    await showServices(user);

    const card = await expandService(user, "databases");
    const badge = card.querySelector(".service-card__badge");
    const before = Number(badge?.textContent?.match(/[\d.]+/)?.[0]);

    await user.click(within(card).getByLabelText("Databases Expertise"));

    const after = Number(badge?.textContent?.match(/[\d.]+/)?.[0]);
    expect(after).toBeCloseTo(before * 1.25);
  });

  it("shows PRR status and applies the maintenance surcharge when approval is toggled off", async () => {
    const user = userEvent.setup();
    render(<App />);
    await showServices(user);

    const card = await expandService(user, "databases");
    expect(card.querySelector(".service-card__prr-badge")).toHaveTextContent("PRR Approved");
    expect(within(card).getByText("240.00 hrs/wk")).toBeInTheDocument();

    await user.click(within(card).getByLabelText("Databases PRR Approved"));

    expect(card.querySelector(".service-card__prr-badge")).toHaveTextContent("PRR Deficient");
    expect(within(card).getByText("256.00 hrs/wk")).toBeInTheDocument();
  });

  it("updates SLO status and prioritizes exhausted high-criticality, high-toil services", async () => {
    const user = userEvent.setup();
    render(<App />);
    await showServices(user);

    const card = await expandService(user, "databases");
    await user.selectOptions(within(card).getByLabelText("Databases SLO Status"), "exhausted");

    expect(card).toHaveClass("service-card--slo-exhausted");
    const highCriticalityHighToil = within(screen.getByTestId("criticality-quadrant")).getByRole("region", {
      name: "High criticality · High toil",
    });
    expect(within(highCriticalityHighToil).getByTestId("critical-reliability-deficit")).toHaveTextContent(
      "Critical Reliability Deficit: Feature Freeze Recommended",
    );
    expect(within(highCriticalityHighToil).getByText("Databases").closest("li")).toHaveClass(
      "criticality-quadrant__service--exhausted",
    );
    expect(
      JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}").services.find(
        (service: { id: string }) => service.id === "databases",
      ).sloStatus,
    ).toBe("exhausted");
  });

  it("filters active services by exhausted and at-risk SLO statuses", async () => {
    const user = userEvent.setup();
    render(<App />);
    await showServices(user);

    const database = await expandService(user, "databases");
    await user.selectOptions(within(database).getByLabelText("Databases SLO Status"), "exhausted");
    const firewall = await expandService(user, "firewall");
    await user.selectOptions(within(firewall).getByLabelText("Firewall SLO Status"), "warning");
    const filter = screen.getByLabelText("Filter by SLO Status");

    await user.selectOptions(filter, "exhausted");
    expect(screen.getByTestId("service-card-databases")).toBeInTheDocument();
    expect(screen.queryByTestId("service-card-firewall")).not.toBeInTheDocument();
    expect(screen.queryByTestId("service-card-printing")).not.toBeInTheDocument();

    await user.selectOptions(filter, "at-risk");
    expect(screen.getByTestId("service-card-databases")).toBeInTheDocument();
    expect(screen.getByTestId("service-card-firewall")).toBeInTheDocument();
    expect(screen.queryByTestId("service-card-printing")).not.toBeInTheDocument();
  });

  it("shows SLO health in the Automation ROI Summary Report", async () => {
    const user = userEvent.setup();
    render(<App />);

    await showServices(user);
    const database = await expandService(user, "databases");
    await user.selectOptions(within(database).getByLabelText("Databases SLO Status"), "warning");
    await user.click(screen.getByRole("button", { name: "Executive Summary" }));
    await user.click(screen.getByTestId("toggle-summary-report"));

    expect(screen.getByRole("columnheader", { name: "SLO Status" })).toBeInTheDocument();
    const databaseRow = screen.getByRole("row", { name: /Databases/ });
    expect(within(databaseRow).getByText("Warning")).toHaveClass("slo-status-badge--warning");
  });

  it("treats services in older saved dashboards as PRR approved", async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        globalConfig: { fteCount: 1, weeklyHours: 40, annualSalary: 150000 },
        services: [
          {
            id: "legacy",
            name: "Legacy Service",
            deployHours: 1,
            maintenanceHours: 1,
            isActive: true,
            hasExpertise: true,
            isAutomated: false,
          },
        ],
      }),
    );
    render(<App />);

    const user = userEvent.setup();
    await showServices(user);
    const card = screen.getByTestId("service-card-legacy");
    await expandService(user, "legacy");
    expect(within(card).getByLabelText("Legacy Service PRR Approved")).toBeChecked();
    expect(card.querySelector(".service-card__prr-badge")).toHaveTextContent("PRR Approved");
    expect(within(card).getByLabelText("Legacy Service SLO Status")).toHaveValue("healthy");
  });

  it("maps active services into the criticality/toil quadrants and flags low-criticality high-toil work", async () => {
    const user = userEvent.setup();
    render(<App />);
    await showServices(user);

    const quadrant = screen.getByTestId("criticality-quadrant");
    const reviewCell = within(quadrant).getByRole("region", { name: "Low criticality · High toil" });
    expect(within(reviewCell).getByText(/Candidates for Deprecation, SaaS Replacement, or Immediate Dev Handback/)).toBeInTheDocument();
    expect(within(reviewCell).getByText(/Backup/)).toBeInTheDocument();
    expect(within(quadrant).getByRole("region", { name: "High criticality · High toil" })).toHaveTextContent("Databases");
  });

  it("updates the internal upskilling dividend when a service's expertise changes", async () => {
    const user = userEvent.setup();
    render(<App />);

    await showServices(user);
    const card = screen.getByTestId("service-card-databases");
    await expandService(user, "databases");
    const expertiseToggle = within(card).getByLabelText("Databases Expertise");
    expect(screen.queryByTestId("upskilling-hours")).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Services with expertise gaps" })).not.toBeInTheDocument();

    await user.click(expertiseToggle);

    await user.click(screen.getByRole("button", { name: "Executive Summary" }));
    expect(screen.getByTestId("kpi-upskilling-hours")).toHaveTextContent(/\d+\.\d/);
    expect(screen.getByTestId("kpi-upskilling-value")).not.toHaveTextContent("$0/yr");
    expect(screen.getByRole("list", { name: "Services with expertise gaps" })).toHaveTextContent("Databases");

    await user.click(screen.getByRole("button", { name: "Service Breakdown & Toil Analysis" }));
    await expandService(user, "databases");
    await user.click(screen.getByLabelText("Databases Expertise"));

    await user.click(screen.getByRole("button", { name: "Executive Summary" }));
    expect(screen.queryByRole("list", { name: "Services with expertise gaps" })).not.toBeInTheDocument();
    expect(screen.getByText("No active services have an expertise gap to address.")).toBeInTheDocument();
  });

  it("deactivating a service shows 0 hrs and mutes the card", async () => {
    const user = userEvent.setup();
    render(<App />);
    await showServices(user);

    const card = await expandService(user, "databases");
    await user.click(within(card).getByLabelText("Databases Active"));

    expect(within(card).getByText(/0\.00 hrs\/wk/)).toBeInTheDocument();
  });

  it("allows adding a custom service via the Add Custom Service form", async () => {
    const user = userEvent.setup();
    render(<App />);

    await showServices(user);
    await user.click(screen.getByTestId("add-custom-service-toggle"));
    await user.type(screen.getByLabelText("Custom Service Name"), "Message Queue");
    await user.click(screen.getByTestId("add-custom-service-submit"));

    expect(screen.getByTestId("service-card-custom_message_queue")).toBeInTheDocument();
    expect(screen.getByText(/Services \(20\/20 active\)/)).toBeInTheDocument();
  });

  it("shows the Automation ROI Summary Report when toggled", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByTestId("toggle-summary-report"));

    expect(screen.getByTestId("summary-report")).toBeInTheDocument();
    expect(
      screen.getByText(/Engineering time spent building automation.*belongs in New Features \/ Innovation & Toil Reduction/),
    ).toBeInTheDocument();
  });

  it("distinguishes routine operations from engineering toil reduction in capacity buckets", async () => {
    const user = userEvent.setup();
    render(<App />);
    await showServices(user);

    expect(screen.getByText("Routine Operations & Maintenance Toil")).toBeInTheDocument();
    expect(screen.getByText("New Features / Innovation & Toil Reduction")).toBeInTheDocument();
  });

  it("deletes a single service, delete-all empties the catalog, and defaults can be restored", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<App />);
    await showServices(user);

    await expandService(user, "printing");
    await user.click(screen.getByLabelText("Delete Printing"));
    expect(screen.queryByTestId("service-card-printing")).not.toBeInTheDocument();
    expect(screen.getByText(/Services \(18\/18 active\)/)).toBeInTheDocument();

    await user.click(screen.getByTestId("delete-all-services"));
    expect(screen.getByTestId("services-empty-state")).toBeInTheDocument();
    expect(screen.getByText("No active services in catalog.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Restore Default Services" }));
    expect(screen.getByText(/Services \(19\/19 active\)/)).toBeInTheDocument();
  });
});

describe("Pareto toil & stabilization sprint", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("badges top 3 services and keeps the sprint in preview until applied", async () => {
    const user = userEvent.setup();
    render(<App />);
    await showServices(user);

    for (const serviceId of ["databases", "internal_networking", "firewall"]) {
      await expandService(user, serviceId);
    }
    expect(screen.getAllByText("Top Toil Contributor")).toHaveLength(3);
    expect(screen.getByTestId("pareto-toil-summary")).toHaveTextContent(/Top 3 drivers account for/);

    const before = screen.getByTestId("service-scaling-note").textContent;
    await user.click(screen.getByTestId("model-stabilization-sprint"));
    expect(screen.getByTestId("scenario-load")).toBeInTheDocument();
    expect(screen.getByTestId("service-scaling-note").textContent).toBe(before);

    await user.click(screen.getByTestId("apply-stabilization-sprint"));
    expect(screen.getByTestId("service-scaling-note").textContent).not.toBe(before);
    expect(screen.queryByTestId("stabilization-scenario")).not.toBeInTheDocument();
  });
});
