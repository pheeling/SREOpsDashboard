import type { Service } from "../engine/types";
import { getRequiredHours, getServiceWeight } from "../engine/calculations";

interface CriticalityToilQuadrantProps {
  services: Service[];
}

const quadrants = [
  { key: "low-criticality-high-toil", title: "Low criticality · High toil", highCriticality: false, highToil: true },
  { key: "high-criticality-high-toil", title: "High criticality · High toil", highCriticality: true, highToil: true },
  { key: "low-criticality-low-toil", title: "Low criticality · Low toil", highCriticality: false, highToil: false },
  { key: "high-criticality-low-toil", title: "High criticality · Low toil", highCriticality: true, highToil: false },
];

export function CriticalityToilQuadrant({ services }: CriticalityToilQuadrantProps) {
  const activeServices = services.filter((service) => service.isActive);

  return (
    <section className="criticality-quadrant" aria-label="Criticality vs. Toil" data-testid="criticality-quadrant">
      <h3>Criticality vs. Toil</h3>
      <p className="criticality-quadrant__axes">
        Blast radius: Low ≤ 1.0, High &gt; 1.0 · Weekly required hours: Low ≤ 5, High &gt; 5
      </p>
      <div className="criticality-quadrant__grid">
        {quadrants.map((quadrant) => {
          const matches = activeServices.filter((service) => {
            const highCriticality = getServiceWeight(service) > 1;
            const highToil = getRequiredHours(service) > 5;
            return highCriticality === quadrant.highCriticality && highToil === quadrant.highToil;
          });
          const hasReliabilityDeficit =
            quadrant.key === "high-criticality-high-toil" &&
            matches.some((service) => service.sloStatus === "exhausted");

          return (
            <section
              key={quadrant.key}
              className={`criticality-quadrant__cell ${quadrant.key === "low-criticality-high-toil" ? "criticality-quadrant__cell--review" : ""} ${hasReliabilityDeficit ? "criticality-quadrant__cell--reliability-deficit" : ""}`}
              aria-label={quadrant.title}
            >
              <h4>{quadrant.title}</h4>
              {quadrant.key === "low-criticality-high-toil" && (
                <p className="criticality-quadrant__advisory">
                  Candidates for Deprecation, SaaS Replacement, or Immediate Dev Handback
                </p>
              )}
              {hasReliabilityDeficit && (
                <p className="criticality-quadrant__reliability-warning" data-testid="critical-reliability-deficit">
                  Critical Reliability Deficit: Feature Freeze Recommended
                </p>
              )}
              {matches.length > 0 ? (
                <ul>
                  {matches.map((service) => (
                    <li
                      key={service.id}
                      className={hasReliabilityDeficit && service.sloStatus === "exhausted" ? "criticality-quadrant__service--exhausted" : ""}
                    >
                      {service.name} <span>{getRequiredHours(service).toFixed(1)} hrs/wk</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="criticality-quadrant__empty">No active services</p>
              )}
            </section>
          );
        })}
      </div>
    </section>
  );
}
