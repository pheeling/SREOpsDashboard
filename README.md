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
Open the local URL printed by Vite. To create and locally preview a production build, run:

```bash
npm run build
npm run preview
```

## Use the dashboard

1. **Set team assumptions** in Team Configuration: FTE count, weekly hours per FTE, effective capacity percentage, and annual salary baseline. The initial values are 5 FTE, 40 hours per week, 80% effective capacity, and $150,000 annual salary.
2. **Review the Service Matrix.** It starts with 19 active example services. Set each service's deployment and maintenance estimates in hours per week; these are added to calculate its base workload.
3. **Adjust service assumptions.** Deactivate services that are not in scope, toggle Automated where toil has been automated, toggle Expertise off when the team lacks in-house expertise, change Ownership to reflect who carries the toil, and change Criticality Weight to reflect blast radius. Toggle PRR Approved when readiness requirements are not met.
4. **Manage the catalog.** Add a custom service with a name and weekly deployment and maintenance estimates, delete individual services, or use Delete All to clear the catalog. Restore Default Services repopulates the standard catalog; it does not reset Team Configuration.
5. **Review the results.** The dashboard shows capacity buckets, operational load, modeled hiring cost, and warnings. Use View Automation ROI Summary Report to compare modeled weekly hours saved and annualized savings for active services that are not yet automated.

Changes are saved automatically in this browser's local storage and remain after reloading the page. They are local to the browser and device; clearing this site's browser data resets the dashboard to its initial values.

## How the model works

- **Service workload:** for an active service, `required hours = ((deployment hours + (maintenance hours × PRR multiplier)) / automation divisor) × criticality weight × expertise multiplier × ownership multiplier`. The PRR multiplier is 1.2 when PRR Approved is off and 1 otherwise; it affects maintenance hours only. The automation divisor is 3 when Automated is on and 1 otherwise. The expertise multiplier is 1.25 when Expertise is off and 1 otherwise. The ownership multiplier is 1 for SRE Full, 0.5 for Shared, and 0.1 for Dev Owned. Inactive services contribute 0 hours. A service with no weight uses a weight of 1.
- **PRR readiness:** services default to PRR Approved. The service cards expose the readiness status and toggle; older saved dashboards without this field are treated as approved.
- **Criticality vs. toil:** the Service Matrix groups active services into four quadrants using criticality weight (low ≤ 1.0, high > 1.0) and required weekly hours (low ≤ 5, high > 5). Low-criticality, high-toil services are flagged for deprecation, SaaS replacement, or developer handback review.
- **Team hours:** contracted weekly hours are `FTE count × weekly hours per FTE`. Effective capacity percentage defaults to 80%. The application uses effective capacity to calculate fixed reserves: Emergency Response is 10%, Testing & User Scaling 5%, Security & Compliance 8%, and On-Call & Monitoring 7%.
- **Capacity buckets:** Routine Operations is the sum of service required hours. Innovation & Toil Reduction is the remaining contracted hours after routine operations and the four fixed reserves, with a minimum of zero.
- **Operational load and Red Zone:** operational load is routine operations plus the four reserves. The gauge compares this load with contracted weekly team hours. It enters the Red Zone when the ratio is **greater than 50%**; exactly 50% is not in the Red Zone. The effective-capacity setting affects the size of the reserves, not this gauge's denominator.
- **Hiring estimate:** when operational load exceeds 50% of contracted weekly team hours, the estimate models the additional annual salary needed to cover the excess, assuming each additional FTE spends 50% of their weekly hours on operations. It is a planning estimate, not a hiring recommendation.
- **Automation ROI report:** for each active manual service, the report estimates the hours saved by applying the model's 1/3 automation rule and converts those hours to annual dollars using the configured salary baseline and weekly hours per FTE.
- **Staffing warning:** the dashboard warns when fewer than four engineers are configured, independent of the calculated service workload.

These values are planning assumptions, not measured forecasts. In particular, treat service hour entries as weekly estimates, and adjust the example catalog, team capacity, salary, and criticality weights to reflect your environment.

## Development checks

```bash
npm test       # run the Vitest suite
npm run lint   # run oxlint
npm run build  # type-check and build for production
```

## Project layout

- `src/components/` contains the dashboard panels and service controls.
- `src/engine/` contains the capacity calculations, seeded service catalog, types, and calculation tests.
- `src/state/` contains dashboard state management and local-storage persistence.
