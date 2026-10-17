# SREOpsDashboard

Shows on a dashboard the operational load of infrastructure and helps make informed decisions on to build or to buy services.

## SRE Infrastructure Complexity & Operational Capacity Calculator

A React + TypeScript dashboard that quantifies operational toil across a service inventory and helps
leadership decide between paying down toil, throttling feature work, or hiring. It is a practical,
"operational view" companion to the ideas in Google's
[Site Reliability Engineering book — Preface](https://sre.google/sre-book/preface/): every hour spent
on toil (repetitive, manual, non-value-adding operational work) is an hour not spent on innovation, and
once toil consumes too much of a team's capacity the organization loses the ability to execute, operate,
or improve its systems.

### Core concepts

- **Required Hours** — for each active service: `(deployHours + maintenanceHours) / (isAutomated ? 3 : 1) * weight`.
  - Automation applies the **"1/3 Automation Rule"** (an SRE Book–inspired assumption): automating a
    service's deployment/maintenance toil divides its required hours by 3.
  - **Criticality weight** (`weight`, default `1`) scales required hours for high-blast-radius services —
    e.g. Databases (`2`), Internal Networking / Firewall (`1.5`), EDR (`1.3`) — so that a misconfigured
    database costs the operations team more effort than a misconfigured printer. Adjustable per service
    in the Service Matrix (`Criticality Weight` field).
  - Inactive services contribute `0` hours.
- **Technical Expertise multiplier** — if a team lacks in-house expertise (`hasExpertise = false`) for an
  active service, that service's required hours increase by `25%` to model the learning curve of operating
  something the team doesn't understand yet. This increases workload without reducing contracted FTE
  availability.
- **Capacity Budget** — available hours (`fteCount * weeklyHours`) are allocated across six buckets:
  - **Routine Operations & Maintenance Toil** — sum of all active services' Required Hours (linear in
    the number of services).
  - **Emergency Response & Troubleshooting** — fixed `10%` of raw available hours, reserved for
    unplanned incidents.
  - **Testing & User Scaling** — fixed `5%` of effective capacity hours, reserved for growth/load prep.
  - **Security & Compliance Patching** — fixed `8%` of effective capacity hours, reserved for CVE
    remediation, audits, and policy upkeep.
  - **On-Call & Monitoring** — fixed `7%` of effective capacity hours, reserved for alert triage, dashboards,
    and SLO tracking.
  - **New Features / Innovation & Toil Reduction** — engineering capacity for feature work, automation,
    CI/CD improvements, and self-healing tooling; whatever effective capacity remains after the five
    operational buckets above (never negative). Time invested in this engineering work is not operational
    overhead.
- **Red Zone** — when `Routine Operations + Emergency Response + Testing/Scaling + Security/Compliance +
  On-Call/Monitoring` exceeds **50%** of effective available capacity, the Load Gauge enters the
  Red Zone: the SRE-mandated ceiling on operational work, below which meaningful innovation can still
  happen. Crossing it signals an "Operational Death Spiral" — the team is losing control of the estate.
- **Hiring Cost Estimator** — `max(0, Operational_Hours - 0.5 * Available_Hours) / (0.5 * weeklyHours) * annualSalary`.
  Hiring is triggered as soon as operational load crosses the 50% Red Zone; each new SRE is assumed to
  put 50% of their hours toward toil (the other 50% stays for engineering), restoring a sustainable
  50% operational balance. At or below 50% load the cost is `$0`.
- **Automation ROI Summary Report** — a printable view showing the annualized dollar savings of
  automating each remaining manual service.
- **On-Call Staffing Guardrail** — warns when fewer than four engineers are configured, as a team of that size
  cannot sustain a healthy 24/7 on-call rotation.

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
