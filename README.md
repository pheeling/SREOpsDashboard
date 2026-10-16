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
- **Technical Expertise penalty** — if a team lacks in-house expertise (`hasExpertise = false`) for an
  active service, `20%` (1/5) of *that service's own* required hours is subtracted from total FTE
  availability, modeling the "learning curve" cost of operating something the team doesn't understand yet.
  This is scoped per-service (not a single global cut) so that gaps in niche services don't
  disproportionately punish teams that are strong everywhere else.
- **Capacity Budget** — effective capacity hours (`fteCount * weeklyHours * capacityEfficiencyFactor`, default `0.8`) account for non-project overhead before allocations; the expertise penalty is then subtracted from availability. Effective capacity is allocated across six buckets:
  - **Maintenance & Eliminating Toil** — sum of all active services' Required Hours (linear in the
    number of services).
  - **Emergency Response & Troubleshooting** — fixed `10%` of effective capacity hours, reserved for
    unplanned incidents.
  - **Testing & User Scaling** — fixed `5%` of effective capacity hours, reserved for growth/load prep.
  - **Security & Compliance Patching** — fixed `8%` of effective capacity hours, reserved for CVE
    remediation, audits, and policy upkeep.
  - **On-Call & Monitoring** — fixed `7%` of effective capacity hours, reserved for alert triage, dashboards,
    and SLO tracking.
  - **New Features / Innovation** — whatever effective capacity remains after the five buckets above
    (never negative).
- **Red Zone** — when `Maintenance + Emergency Response + Testing/Scaling + Security/Compliance +
  On-Call/Monitoring` exceeds **50%** of effective available capacity, the Load Gauge enters the
  Red Zone: the SRE-mandated ceiling on operational work, below which meaningful innovation can still
  happen. Crossing it signals an "Operational Death Spiral" — the team is losing control of the estate.
- **Hiring Cost Estimator** — `((Required_Hours - Available_Hours) / weeklyHours) * annualSalary`. The
  tool assumes a company prefers to grow its own staff; whenever required hours exceed effective
  availability, the shortfall is expressed as an annualized *external hiring cost* instead.
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
