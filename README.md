# SREOpsDashboard

SREOpsDashboard is a React and TypeScript application for estimating the weekly operational workload of an infrastructure service catalog. It helps teams compare that workload with their staffing capacity, review modeled hiring costs, and identify possible automation savings.

## Run the application

Install the dependencies and start the local development server:

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. To create and locally preview a production build, run:

```bash
npm run build
npm run preview
```

## Use the dashboard

1. **Set team assumptions** in Team Configuration: FTE count, weekly hours per FTE, effective capacity percentage, and annual salary baseline. The initial values are 5 FTE, 40 hours per week, 80% effective capacity, and $150,000 annual salary.
2. **Review the Service Matrix.** It starts with 19 active example services. Set each service's deployment and maintenance estimates in hours per week; these are added to calculate its base workload.
3. **Adjust service assumptions.** Deactivate services that are not in scope, toggle Automated where toil has been automated, toggle Expertise off when the team lacks in-house expertise, and change Criticality Weight to reflect the service's blast radius.
4. **Manage the catalog.** Add a custom service with a name and weekly deployment and maintenance estimates, delete individual services, or use Delete All to clear the catalog. Restore Default Services repopulates the standard catalog; it does not reset Team Configuration.
5. **Review the results.** The dashboard shows capacity buckets, operational load, modeled hiring cost, and warnings. Use View Automation ROI Summary Report to compare modeled weekly hours saved and annualized savings for active services that are not yet automated.

Changes are saved automatically in this browser's local storage and remain after reloading the page. They are local to the browser and device; clearing this site's browser data resets the dashboard to its initial values.

## How the model works

- **Service workload:** for an active service, `required hours = ((deployment hours + (maintenance hours × PRR multiplier)) / automation divisor) × criticality weight × expertise multiplier`. The PRR multiplier is 1.2 when PRR Approved is off and 1 otherwise; it affects maintenance hours only. The automation divisor is 3 when Automated is on and 1 otherwise. The expertise multiplier is 1.25 when Expertise is off and 1 otherwise. Inactive services contribute 0 hours. A service with no weight uses a weight of 1.
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
