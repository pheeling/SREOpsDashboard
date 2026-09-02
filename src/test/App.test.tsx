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
    expect(screen.getByText(/Service Matrix \(20 services\)/)).toBeInTheDocument();
  });

  it("toggling automation for a service reduces its required hours", async () => {
    const user = userEvent.setup();
    render(<App />);

    const card = screen.getByTestId("service-card-databases");
    const before = within(card).getByText(/hrs\/wk/).textContent;

    await user.click(within(card).getByLabelText("Databases Automation"));

    const after = within(card).getByText(/hrs\/wk/).textContent;
    expect(after).not.toBe(before);
  });

  it("shows the Automation ROI Summary Report when toggled", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByTestId("toggle-summary-report"));

    expect(screen.getByTestId("summary-report")).toBeInTheDocument();
  });
});
