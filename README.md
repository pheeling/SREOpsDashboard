# SREOpsDashboard

Shows on a dashboard the operational load of infrastructure and helps make informed decisions on to build or to buy services.

## SRE Infrastructure Complexity & Operational Capacity Calculator

A React + TypeScript dashboard that quantifies operational toil across a service inventory and helps
leadership decide between paying down toil, throttling feature work, or hiring.

### Core concepts

- **Required Hours** — for each service: `baseHours * (hasSME ? 1 : 1.25) * weight / (isAutomated ? 3 : 1)`.
  - Missing Subject Matter Expertise (SME) applies a `1.25x` "cognitive tax" penalty.
  - Automation applies the "1/3 Automation Rule", dividing required hours by 3.
  - High-impact services (e.g. Databases, Internal Networking) carry a `weight` above 1.
- **Capacity Budget** — available hours (`fteCount * weeklyHours`) are allocated across seven buckets:
  Innovation, Scaling, Maintenance, Eliminating Toil, Monitoring, Emergency Response, and Testing.
- **Red Zone** — when `Eliminating Toil + Maintenance + Emergency Response` exceeds 50% of available
  capacity, the Load Gauge enters the Red Zone, signalling an "Operational Death Spiral".
- **Hiring Cost Estimator** — `((Required_Hours - Available_Hours) / weeklyHours) * annualSalary`.
- **Automation ROI Summary Report** — a printable view showing the annualized dollar savings of
  automating each remaining manual service.

State is normalized (`globalConfig` + `services[]`), persisted to `LocalStorage`, and driven by a
reducer so UI changes cascade instantly through the capacity engine.

### Development

```bash
npm install
npm run dev      # start the Vite dev server
npm run build    # type-check and build for production
npm test         # run the Vitest suite
npm run lint     # run oxlint
```
