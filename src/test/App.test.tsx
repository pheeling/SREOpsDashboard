import { describe, expect, it, beforeEach, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";
import { STORAGE_KEY } from "../state/localStorage";

describe("App", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders the dashboard with the load gauge, hiring cost widget and service matrix", () => {
    render(<App />);

    expect(screen.getByTestId("load-gauge")).toBeInTheDocument();
    expect(screen.getByTestId("hiring-cost-widget")).toBeInTheDocument();
    expect(screen.getByText(/Services \(19\/19 active\)/)).toBeInTheDocument();
    expect(screen.getByLabelText("Effective Capacity (%)")).toHaveValue(80);
    expect(screen.queryByTestId("staffing-warning")).not.toBeInTheDocument();
  });

  it("warns when the configured team has fewer than four engineers", async () => {
    const user = userEvent.setup();
    render(<App />);

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

    const capacityInput = screen.getByLabelText("Effective Capacity (%)");
    await user.clear(capacityInput);
    await user.type(capacityInput, "50");

    expect(capacityInput).toHaveValue(50);
    expect(screen.getByTestId("capacity-segment-emergencyResponse").getAttribute("title")).toContain("10.0 hrs");
  });

  it("toggling automation for a service reduces its required hours", async () => {
    const user = userEvent.setup();
    render(<App />);

    const card = screen.getByTestId("service-card-databases");
    const badge = card.querySelector(".service-card__badge");
    const before = badge?.textContent;

    await user.click(within(card).getByLabelText("Databases Automation"));

    const after = card.querySelector(".service-card__badge")?.textContent;
    expect(after).not.toBe(before);
  });

  it("toggling expertise off increases that service's displayed required hours by 25%", async () => {
    const user = userEvent.setup();
    render(<App />);

    const card = screen.getByTestId("service-card-databases");
    const badge = card.querySelector(".service-card__badge");
    const before = Number(badge?.textContent?.match(/[\d.]+/)?.[0]);

    await user.click(within(card).getByLabelText("Databases Expertise"));

    const after = Number(badge?.textContent?.match(/[\d.]+/)?.[0]);
    expect(after).toBeCloseTo(before * 1.25);
  });

  it("shows PRR status and applies the maintenance surcharge when approval is toggled off", async () => {
    const user = userEvent.setup();
    render(<App />);

    const card = screen.getByTestId("service-card-databases");
    expect(card.querySelector(".service-card__prr-badge")).toHaveTextContent("PRR Approved");
    expect(within(card).getByText("240.00 hrs/wk")).toBeInTheDocument();

    await user.click(within(card).getByLabelText("Databases PRR Approved"));

    expect(card.querySelector(".service-card__prr-badge")).toHaveTextContent("PRR Deficient");
    expect(within(card).getByText("256.00 hrs/wk")).toBeInTheDocument();
  });

  it("treats services in older saved dashboards as PRR approved", () => {
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

    const card = screen.getByTestId("service-card-legacy");
    expect(within(card).getByLabelText("Legacy Service PRR Approved")).toBeChecked();
    expect(card.querySelector(".service-card__prr-badge")).toHaveTextContent("PRR Approved");
  });

  it("maps active services into the criticality/toil quadrants and flags low-criticality high-toil work", () => {
    render(<App />);

    const quadrant = screen.getByTestId("criticality-quadrant");
    const reviewCell = within(quadrant).getByRole("region", { name: "Low criticality · High toil" });
    expect(within(reviewCell).getByText(/Candidates for Deprecation, SaaS Replacement, or Immediate Dev Handback/)).toBeInTheDocument();
    expect(within(reviewCell).getByText(/Backup/)).toBeInTheDocument();
    expect(within(quadrant).getByRole("region", { name: "High criticality · High toil" })).toHaveTextContent("Databases");
  });

  it("updates the internal upskilling dividend when a service's expertise changes", async () => {
    const user = userEvent.setup();
    render(<App />);

    const card = screen.getByTestId("service-card-databases");
    const expertiseToggle = within(card).getByLabelText("Databases Expertise");
    expect(screen.queryByTestId("upskilling-hours")).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Services with expertise gaps" })).not.toBeInTheDocument();

    await user.click(expertiseToggle);

    expect(screen.getByTestId("upskilling-hours")).toHaveTextContent(/\d+\.\d/);
    expect(screen.getByRole("list", { name: "Services with expertise gaps" })).toHaveTextContent("Databases");

    await user.click(expertiseToggle);

    expect(screen.queryByRole("list", { name: "Services with expertise gaps" })).not.toBeInTheDocument();
    expect(screen.getByText("No active services have an expertise gap to address.")).toBeInTheDocument();
  });

  it("deactivating a service shows 0 hrs and mutes the card", async () => {
    const user = userEvent.setup();
    render(<App />);

    const card = screen.getByTestId("service-card-databases");
    await user.click(within(card).getByLabelText("Databases Active"));

    expect(within(card).getByText(/0\.00 hrs\/wk/)).toBeInTheDocument();
  });

  it("allows adding a custom service via the Add Custom Service form", async () => {
    const user = userEvent.setup();
    render(<App />);

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

  it("distinguishes routine operations from engineering toil reduction in capacity buckets", () => {
    render(<App />);

    expect(screen.getByText("Routine Operations & Maintenance Toil")).toBeInTheDocument();
    expect(screen.getByText("New Features / Innovation & Toil Reduction")).toBeInTheDocument();
  });

  it("deletes a single service, delete-all empties the catalog, and defaults can be restored", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<App />);

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
