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
- **Capacity Budget** — contracted hours are `fteCount * weeklyHours`. Effective capacity is
  `FTE × weeklyHours × effectiveCapacityPercentage`; the four fixed reserves below are calculated
  against effective capacity hours:
  - **Routine Operations & Maintenance Toil** — sum of all active services' Required Hours (linear in
    the number of services).
  - **Emergency Response & Troubleshooting** — fixed `10%` of effective capacity hours, reserved for
    unplanned incidents.
  - **Testing & User Scaling** — fixed `5%` of effective capacity hours, reserved for growth/load prep.
  - **Security & Compliance Patching** — fixed `8%` of effective capacity hours, reserved for CVE
    remediation, audits, and policy upkeep.
  - **On-Call & Monitoring** — fixed `7%` of effective capacity hours, reserved for alert triage, dashboards,
    and SLO tracking.
  - **New Features / Innovation & Toil Reduction** — engineering capacity for feature work, automation,
    CI/CD improvements, and self-healing tooling; whatever contracted capacity remains after the five
    operational buckets above (never negative). Time invested in this engineering work is not operational
    overhead.
- **Red Zone** — when `Routine Operations + Emergency Response + Testing/Scaling + Security/Compliance +
  On-Call/Monitoring` exceeds **50%** of contracted weekly hours, the Load Gauge enters the
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

1. **Review Executive Summary.** The default tab shows operational load, upskilling value, and a headcount recommendation alongside the hiring-versus-upskilling financial comparison. Use View Automation ROI Summary Report for service-level automation savings.
2. **Set team assumptions** in Team & Capacity Settings. Adjust the FTE count, weekly hours, effective capacity, and salary; toggle the interrupt shield. The initial values are 5 FTE, 40 hours per week, 80% effective capacity, and $150,000 annual salary.
3. **Review Service Breakdown & Toil Analysis.** It starts with 19 active example services. Click a Criticality vs. Toil quadrant to filter the service list, or choose All Services to clear the quadrant filter. Service cards are collapsed by default; expand a card to edit its service settings.
4. **Adjust service assumptions.** In an expanded card, deactivate services that are not in scope, toggle Automated where toil has been automated, toggle Expertise off when the team lacks in-house expertise, change Ownership to reflect who carries the toil, and change Criticality Weight to reflect blast radius. Toggle PRR Approved when readiness requirements are not met.
5. **Manage the catalog.** Add a custom service with a name and weekly deployment and maintenance estimates, delete individual services from their expanded card, or use Delete All to clear the catalog. Restore Default Services repopulates the standard catalog; it does not reset Team Configuration.
6. **Review the analysis.** The service tab shows capacity buckets, operational load, and warnings; team settings and service assumptions remain available when switching tabs.

## Grounding Estimates in Operational Telemetry

Use the preceding 90 days of observability, ticketing, and deployment data to calibrate the weekly
deployment and maintenance hours in the Service Matrix. Sum the attributable hands-on effort and divide
by 13 weeks to get a weekly estimate; deduplicate repeated alerts and tickets, and separate elapsed
pipeline time from time engineers actively spend on the work.

- **Incident & Triage Workload:** From PagerDuty, Opsgenie, or VictorOps, review total alert counts,
  mean time to acknowledge (MTTA), and mean time to resolve (MTTR). Use alert volume and MTTA to
  understand triage demand, and MTTR plus incident records to estimate investigation and remediation
  effort for weekly maintenance hours. Do not treat every alert as a separate incident.
- **Routine Maintenance Workload:** In Jira, Linear, or ServiceNow, sample weekly ticket velocity for
  repetitive categories such as access requests, certificate renewals, capacity expansions, and schema
  updates. Estimate hands-on time per ticket from a representative sample, multiply by the weekly ticket
  count, and use that total to calibrate maintenance hours.
- **Deployment Overhead:** From GitHub Actions, GitLab CI, or ArgoCD, review CI/CD pipeline run times,
  failed-deploy remediations, and manual release-verification hours. Use the weekly hands-on time for
  release checks and recovery to calibrate deployment hours; pipeline duration alone is not engineering
  effort.

## Running an SRE Capacity Review

### 4-Step SRE Capacity Review Playbook

1. **Baseline Calibration (30 min):** Filter out unmanaged services that are outside the team's scope.
   Calibrate weekly deployment and maintenance hours against incident and ticket data, and toggle
   **Expertise** off for systems without internal documentation or runbooks.
2. **Quadrant Review & Triage (20 min):** Inspect the *Low Criticality / High Toil* quadrant. Identify
   immediate candidates for developer handback (`ownershipModel = 'dev_owned'`) or service deprecation.
3. **Red Zone Deficit & Scenario Modeling (20 min):** If the Operational Load Gauge exceeds 50%, review
   the exact deficit hours. Toggle automation flags on the top toil drivers and review the
   *Automation ROI Summary Report*.
4. **Executive Alignment (15 min):** Build a leadership business case showing how non-hiring levers —
   handbacks, upskilling, and automation sprints — clear the Red Zone without adding external headcount.

Changes are saved automatically in this browser's local storage and remain after reloading the page. They are local to the browser and device; clearing this site's browser data resets the dashboard to its initial values.

## How the model works

- **Service workload:** for an active service, `required hours = ((deployment hours + (maintenance hours × PRR multiplier)) / automation divisor) × criticality weight × expertise multiplier × ownership multiplier`. The PRR multiplier is 1.2 when PRR Approved is off and 1 otherwise; it affects maintenance hours only. The automation divisor is 3 when Automated is on and 1 otherwise. The expertise multiplier is 1.25 when Expertise is off and 1 otherwise. The ownership multiplier is 1 for SRE Full, 0.5 for Shared, and 0.1 for Dev Owned. Inactive services contribute 0 hours. A service with no weight uses a weight of 1.
- **PRR readiness:** services default to PRR Approved. The service cards expose the readiness status and toggle; older saved dashboards without this field are treated as approved.
- **Criticality vs. toil:** the Service Matrix groups active services into four quadrants using criticality weight (low ≤ 1.0, high > 1.0) and required weekly hours (low ≤ 5, high > 5). Low-criticality, high-toil services are flagged for deprecation, SaaS replacement, or developer handback review.
- **Team hours:** contracted weekly hours are `FTE count × weekly hours per FTE`. Effective capacity percentage defaults to 80%, and effective capacity hours are `FTE × weeklyHours × effectiveCapacityPercentage`. All four fixed reserves are calculated from effective capacity hours: Emergency Response is 10%, Testing & User Scaling 5%, Security & Compliance 8%, and On-Call & Monitoring 7%.
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

## Server persistence (SQLite)

`node server/index.js` (`npm start`) serves the built app and a SQLite-backed API at `$DB_DIR/sreops.db` (default `/app/data` in Docker; mount it as a persistent volume in Coolify).

- `GET/PUT /api/state` – latest live state (`teams`, `services`, `globalConfig`).
- `POST /api/snapshots` – record a snapshot (`triggerType`, `label`, `metrics`, `teams`, `services`, all pre-calculated by the client).
- `GET /api/snapshots?range=30d|90d|180d|1y&teamId=...` – trend points (load %, toil hours, error-budget compliance).

Snapshots older than 365 days are pruned daily; a weekly scheduled snapshot reuses the last submitted payload.
