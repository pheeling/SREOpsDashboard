import { describe, expect, it, beforeEach } from "vitest";
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
  });
});
