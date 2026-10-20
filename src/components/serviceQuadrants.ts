import type { Service } from "../engine/types";
import { getRequiredHours, getServiceWeight } from "../engine/calculations";

export type QuadrantKey =
  | "low-criticality-high-toil"
  | "high-criticality-high-toil"
  | "low-criticality-low-toil"
  | "high-criticality-low-toil";

export function getServiceQuadrantKey(service: Service): QuadrantKey {
  const highCriticality = getServiceWeight(service) > 1;
  const highToil = getRequiredHours(service) > 5;
  if (highCriticality) return highToil ? "high-criticality-high-toil" : "high-criticality-low-toil";
  return highToil ? "low-criticality-high-toil" : "low-criticality-low-toil";
}
