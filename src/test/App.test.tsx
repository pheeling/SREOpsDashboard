import { describe, expect, it, beforeEach, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";

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
