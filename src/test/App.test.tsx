import { describe, expect, it, beforeEach, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";
import { STORAGE_KEY } from "../state/localStorage";

function sidebarLink(name: string) {
  return within(screen.getByRole("complementary", { name: "Main navigation" })).getByRole("button", { name });
}

async function showServices(user: ReturnType<typeof userEvent.setup>) {
  await user.click(sidebarLink("Service Breakdown & Toil Analysis"));
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

  it("renders the streamlined SRE dashboard shell and switches from the mobile quick navigation", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(document.querySelector(".topbar")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "SRE Dashboard home" })).toHaveTextContent("SRE Dashboard");
    expect(screen.getByRole("combobox", { name: "Search telemetry" })).toHaveAttribute("placeholder", "Search anything...");
    expect(screen.queryByLabelText("Cluster")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/System status/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Pager/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/User profile/)).not.toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Main navigation" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Live audit log" })).toBeInTheDocument();
    expect(screen.getByText("LIVE AUDIT LOG")).toBeInTheDocument();

    const quickNavigation = screen.getByRole("navigation", { name: "Quick navigation" });
    expect(within(quickNavigation).getAllByRole("button").map((button) => button.textContent)).toEqual([
      "◫Executive Summary",
      "◷Team & Capacity",
      "⌁Service Breakdown",
    ]);
    await user.click(within(quickNavigation).getByRole("button", { name: "Service Breakdown" }));
    expect(within(quickNavigation).getByRole("button", { name: "Service Breakdown" })).toHaveAttribute("aria-current", "page");
    expect(sidebarLink("Service Breakdown & Toil Analysis")).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("region", { name: "Service Breakdown and Toil Analysis" })).toBeInTheDocument();
  });

  it("defaults to the executive summary with dynamic KPI cards and financial impact", () => {
    render(<App />);

    expect(screen.queryByRole("navigation", { name: "Dashboard sections" })).not.toBeInTheDocument();
    expect(screen.getByTestId("kpi-operational-load")).toBeInTheDocument();
    expect(screen.getByTestId("kpi-upskilling-value")).toHaveTextContent("$0/yr");
    expect(screen.getByTestId("kpi-operational-hours")).toHaveTextContent(/hrs toward operational work/);
    expect(screen.getByTestId("kpi-active-services")).toHaveTextContent("19/19 Active");
    expect(screen.getByTestId("kpi-prr-count")).toHaveTextContent("19 PRR approved · 0 deficient");
    expect(screen.getByTestId("kpi-slo-health")).toHaveTextContent("100.0%");
    expect(screen.getByTestId("kpi-slo-status")).toHaveTextContent("HEALTHY");
    expect(screen.getByTestId("hiring-cost-widget")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View Automation ROI Summary Report" })).toBeInTheDocument();
    expect(screen.queryByTestId("load-gauge")).not.toBeInTheDocument();
    expect(screen.queryByTestId("staffing-warning")).not.toBeInTheDocument();
  });

  it("updates the readiness and SLO KPIs from active service state", async () => {
    const user = userEvent.setup();
    render(<App />);
    await showServices(user);

    const database = await expandService(user, "databases");
    await user.click(within(database).getByLabelText("Databases PRR Approved"));
    await user.selectOptions(within(database).getByLabelText("Databases SLO Status"), "exhausted");

    await user.click(sidebarLink("Executive Summary"));

    expect(screen.getByTestId("kpi-prr-status")).toHaveTextContent("DEFICIENT");
    expect(screen.getByTestId("kpi-prr-count")).toHaveTextContent("18 PRR approved · 1 deficient");
    expect(screen.getByTestId("kpi-slo-health")).toHaveTextContent("94.7%");
    expect(screen.getByTestId("kpi-slo-status")).toHaveTextContent("CRITICAL");
    expect(screen.getByTestId("kpi-slo-counts")).toHaveTextContent("18 healthy · 0 at risk · 1 exhausted");
  });

  it("warns when the configured team has fewer than four engineers", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(sidebarLink("Team & Capacity Settings"));

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

  it("warns for a red-zone team in organization view even when pooled load is healthy", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        globalConfig: { fteCount: 4, weeklyHours: 40, annualSalary: 150000 },
        teams: [
          {
            id: "core",
            name: "Core SRE",
            fteCount: 4,
            weeklyHours: 40,
            effectiveCapacityPercentage: 0.8,
            annualSalaryBaseline: 150000,
          },
          {
            id: "platform",
            name: "Platform",
            fteCount: 20,
            weeklyHours: 40,
            effectiveCapacityPercentage: 0.8,
            annualSalaryBaseline: 150000,
          },
        ],
        selectedTeamId: "all",
        services: [
          {
            id: "critical-service",
            name: "Critical Service",
            deployHours: 0,
            maintenanceHours: 42,
            isActive: true,
            hasExpertise: true,
            isAutomated: false,
            prrApproved: true,
            sloStatus: "healthy",
            teamId: "core",
          },
        ],
      }),
    );
    render(<App />);

    expect(screen.getByTestId("red-zone-alert")).toHaveTextContent(
      "1 of 2 teams (Core SRE) has crossed the 50% capacity threshold",
    );
    expect(screen.queryByTestId("staffing-warning")).not.toBeInTheDocument();
  });

  it("allows the team to adjust its effective capacity factor", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(sidebarLink("Team & Capacity Settings"));

    const capacityInput = screen.getByLabelText("Effective Capacity (%)");
    fireEvent.change(capacityInput, { target: { value: "50" } });

    expect(capacityInput).toHaveValue("50");
    await user.click(sidebarLink("Service Breakdown & Toil Analysis"));
    expect(screen.getByTestId("capacity-segment-emergencyResponse").getAttribute("title")).toContain("10.0 hrs");
  });

  it("keeps team settings across tabs and synchronizes slider and editable FTE controls", async () => {
    const user = userEvent.setup();
    render(<App />);
    const initialLoad = screen.getByTestId("kpi-operational-load").textContent;

    await user.click(sidebarLink("Team & Capacity Settings"));
    const fteSlider = screen.getByLabelText("FTE Count slider");
    fireEvent.change(fteSlider, { target: { value: "8" } });
    expect(screen.getByLabelText("FTE Count")).toHaveValue(8);
    await user.click(sidebarLink("Executive Summary"));
    expect(screen.getByTestId("kpi-operational-load").textContent).not.toBe(initialLoad);

    await user.click(sidebarLink("Service Breakdown & Toil Analysis"));
    await user.click(sidebarLink("Team & Capacity Settings"));
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
    await user.click(sidebarLink("Team & Capacity Settings"));

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

  it("records configuration changes, limits the sidebar preview, and shows the full audit history", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(sidebarLink("Team & Capacity Settings"));

    const fteSlider = screen.getByLabelText("FTE Count slider");
    for (let fte = 6; fte <= 11; fte += 1) {
      fireEvent.change(fteSlider, { target: { value: String(fte) } });
    }
    await user.click(screen.getByRole("switch", { name: "Dedicated Interrupt Shield" }));
    await showServices(user);
    const backup = await expandService(user, "backup");
    await user.selectOptions(within(backup).getByLabelText("Backup SLO Status"), "warning");

    const audit = screen.getByRole("region", { name: "Live audit log" });
    const recentEntries = within(audit).getByRole("list", { name: "Recent configuration changes" });
    expect(within(recentEntries).getAllByRole("listitem")).toHaveLength(5);
    expect(recentEntries).toHaveTextContent("Toggled Dedicated Interrupt Shield: On");
    expect(recentEntries).toHaveTextContent("Updated Backup SLO to Degraded");
    expect(Array.from(recentEntries.querySelectorAll("time")).every((time) => /^\d{2}:\d{2}:\d{2}$/.test(time.textContent ?? ""))).toBe(true);

    await user.click(within(audit).getByRole("button", { name: "View Full Audit Log" }));
    const dialog = screen.getByRole("dialog", { name: "Full Audit Log" });
    const history = within(dialog).getByRole("list", { name: "Complete configuration change history" });
    expect(within(history).getAllByRole("listitem")).toHaveLength(8);
    expect(within(history).getAllByRole("listitem")[0]).toHaveTextContent("Updated FTE Count to 6");
    expect(history).toHaveTextContent("Updated Backup SLO to Degraded");

    await user.click(within(dialog).getByRole("button", { name: "Clear Audit Log" }));
    expect(history).toHaveTextContent("No configuration changes yet.");
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
    await user.click(sidebarLink("Executive Summary"));
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
    expect(screen.getByTestId("quadrant-low-criticality-high-toil")).toHaveClass("criticality-quadrant__cell--high-toil");
    expect(screen.getByTestId("quadrant-high-criticality-low-toil")).toHaveClass("criticality-quadrant__cell--low-toil");
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

    await user.click(sidebarLink("Executive Summary"));
    expect(screen.getByTestId("kpi-upskilling-hours")).toHaveTextContent(/\d+\.\d/);
    expect(screen.getByTestId("kpi-upskilling-value")).not.toHaveTextContent("$0/yr");
    expect(screen.getByRole("list", { name: "Services with expertise gaps" })).toHaveTextContent("Databases");
    const onboardingDetails = screen.getByText(/Internal onboarding \/ drill candidates/);
    await user.click(onboardingDetails);
    expect(onboardingDetails.parentElement).not.toHaveAttribute("open");
    await user.click(onboardingDetails);
    expect(onboardingDetails.parentElement).toHaveAttribute("open");
    expect(screen.getByRole("list", { name: "Services with expertise gaps" })).toHaveTextContent("Databases");

    await user.click(sidebarLink("Service Breakdown & Toil Analysis"));
    await expandService(user, "databases");
    await user.click(screen.getByLabelText("Databases Expertise"));

    await user.click(sidebarLink("Executive Summary"));
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

  it("shows service allocation fields and recalculates bucket shares when automation changes", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(sidebarLink("Team & Capacity Settings"));
    fireEvent.change(screen.getByLabelText("FTE Count slider"), { target: { value: "50" } });
    await showServices(user);

    const card = screen.getByTestId("service-card-backup");
    expect(screen.getByText("Service & ownership")).toBeInTheDocument();
    expect(screen.getByText("Toil load")).toBeInTheDocument();
    expect(screen.getByText("PRR compliance")).toBeInTheDocument();
    expect(screen.getByText("SLO status")).toBeInTheDocument();
    expect(screen.getByText("Automation")).toBeInTheDocument();
    expect(within(card).getByText("SRE Owned")).toBeInTheDocument();
    expect(within(card).getByText("Healthy · ≥20% remaining", { selector: ".slo-status-badge" })).toBeInTheDocument();
    expect(within(card).getByLabelText("Backup Automation")).not.toBeChecked();

    const innovationSegment = screen.getByTestId("capacity-segment-innovation");
    const initialWidth = innovationSegment.style.width;
    await user.click(within(card).getByLabelText("Backup Automation"));

    expect(innovationSegment.style.width).not.toBe(initialWidth);
    expect(within(card).getByLabelText("Backup Automation")).toBeChecked();
  });

  it("always displays lost cognitive overhead and reports shield recovery separately", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(sidebarLink("Team & Capacity Settings"));
    fireEvent.change(screen.getByLabelText("FTE Count slider"), { target: { value: "50" } });
    await showServices(user);

    expect(screen.getByTestId("cognitive-overhead")).toHaveTextContent("Lost cognitive overhead");
    expect(screen.getByTestId("cognitive-overhead")).not.toHaveTextContent("0.0 hrs");
    expect(screen.queryByTestId("recovered-hours")).not.toBeInTheDocument();

    await user.click(sidebarLink("Team & Capacity Settings"));
    await user.click(screen.getByRole("switch", { name: "Dedicated Interrupt Shield" }));
    await showServices(user);

    expect(screen.getByTestId("cognitive-overhead")).toHaveTextContent("0.0 hrs");
    expect(screen.getByTestId("recovered-hours")).toBeInTheDocument();
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

describe("Global search", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("fuzzy matches misspelled queries and supports keyboard navigation", async () => {
    const user = userEvent.setup();
    render(<App />);
    const input = screen.getByRole("combobox", { name: "Search telemetry" });

    await user.type(input, "salry");
    expect(screen.getByRole("option", { name: /Annual Salary Baseline/ })).toBeInTheDocument();
    await user.clear(input);
    await user.type(input, "opration");
    expect(within(screen.getByRole("listbox", { name: "Search results" })).getAllByRole("option")[0]).toHaveTextContent(/Operational Load/);
    await user.clear(input);
    await user.type(input, "maintnance");
    expect(screen.getByRole("option", { name: /Error Budget Buckets/ })).toBeInTheDocument();
    await user.clear(input);
    await user.type(input, "bakup");
    expect(screen.getByRole("option", { name: /Backup/ })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("jumps to a collapsed service card, expands it and highlights it", async () => {
    const user = userEvent.setup();
    const scrollIntoView = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoView;
    render(<App />);

    await user.type(screen.getByRole("combobox", { name: "Search telemetry" }), "backp{Enter}");

    const card = await screen.findByTestId("service-card-backup");
    await vi.waitFor(() => expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "center" }));
    expect(card).toHaveClass("search-highlight");
    expect(within(card).getByRole("button", { name: /hrs\/wk/ })).toHaveAttribute("aria-expanded", "true");
  });

  it("switches tabs when selecting an input on another tab", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByRole("combobox", { name: "Search telemetry" }), "salry");
    await user.click(screen.getByRole("option", { name: /Annual Salary Baseline/ }));
    await vi.waitFor(() => expect(document.getElementById("search-target-annual-salary")).toHaveClass("search-highlight"));
  });

  it("scopes the service matrix to the team chosen in the header view filter", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(sidebarLink("Team & Capacity Settings"));
    await user.click(screen.getByRole("button", { name: "Add Team" }));
    await user.type(screen.getByRole("textbox", { name: /team name/i }), "Payments");
    await user.click(screen.getByRole("button", { name: "Create Team" }));

    await showServices(user);
    expect(screen.getByTestId("team-view-filter")).toHaveValue("team_payments");
    expect(screen.getByText("Services (0/0 active for Payments)")).toBeInTheDocument();

    await user.selectOptions(screen.getByTestId("team-view-filter"), "all");
    expect(screen.getByText("Services (19/19 active)")).toBeInTheDocument();
  });
  it("creates, verifies and lists snapshots from the audit log", async () => {
    const user = userEvent.setup();
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? "GET"} ${url}`);
      const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
      if (url === "/api/snapshots" && init?.method === "POST") return json({ id: "snap-1" }, 201);
      if (url === "/api/snapshots/snap-1/verify") return json({ verified: true });
      return json({
        points: [{
          id: "snap-1", createdAt: "2026-01-01 10:00:00", triggerType: "manual", label: "Q1",
          operationalLoadPercentage: 0.375, contractedHours: 80, toilHours: 30, isRedZone: false,
          teamsInRedZone: 2, deficitHours: 0, hiringCost: 0,
        }],
      });
    }));
    try {
      render(<App />);
      await user.click(screen.getByRole("button", { name: "View Full Audit Log" }));
      await user.click(screen.getByRole("button", { name: "Take Snapshot" }));
      const dialog = screen.getByRole("dialog", { name: "Take Snapshot" });
      expect((within(dialog).getByLabelText("Snapshot Label") as HTMLInputElement).value).toMatch((/^Manual Snapshot — \d{4}-\d{2}-\d{2} \d{2}:\d{2}$/));
      await user.click(within(dialog).getByRole("button", { name: "Create & Verify" }));

      expect(await screen.findByRole("status")).toHaveTextContent("verified in database (ID: snap-1)");
      expect(calls).toEqual(["POST /api/snapshots", "GET /api/snapshots/snap-1/verify"]);
      expect(screen.getAllByText(/ACTION: SNAPSHOT_CREATED \| ID: snap-1/).length).toBeGreaterThan(0);

      await user.click(screen.getByRole("button", { name: "View Snapshots" }));
      const history = screen.getByRole("dialog", { name: "Snapshot History" });
      expect(await within(history).findByText("37.5%")).toBeInTheDocument();
      expect(within(history).getByText("Verified in SQLite")).toBeInTheDocument();
      await user.click(within(history).getByRole("button", { name: "90 Days" }));
      expect(calls).toContain("GET /api/snapshots?range=90d");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("keeps the snapshot form open with an error when the database is busy", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "busy" }), { status: 503 })));
    try {
      render(<App />);
      await user.click(screen.getByRole("button", { name: "View Full Audit Log" }));
      await user.click(screen.getByRole("button", { name: "Take Snapshot" }));
      const dialog = screen.getByRole("dialog", { name: "Take Snapshot" });
      await user.click(within(dialog).getByRole("button", { name: "Create & Verify" }));
      expect(await within(dialog).findByRole("alert")).toHaveTextContent("SQLITE_BUSY");
      expect(within(dialog).getByRole("button", { name: "Retry" })).toBeEnabled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
