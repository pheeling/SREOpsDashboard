import type { Service } from "../engine/types";
import { fuzzyScore } from "./fuzzy";

export type SearchTab = "summary" | "team" | "services";

export interface SearchEntry {
  id: string;
  label: string;
  category: "Input" | "KPI Panel" | "Section" | "Service";
  keywords: string;
  tab: SearchTab;
  targetId: string;
  serviceId?: string;
}

const STATIC_ENTRIES: SearchEntry[] = [
  { id: "fte-count", label: "FTE Count", category: "Input", keywords: "team headcount engineers configuration", tab: "team", targetId: "search-target-fte-count" },
  { id: "weekly-hours", label: "Weekly Hours per FTE", category: "Input", keywords: "hours week configuration", tab: "team", targetId: "search-target-weekly-hours" },
  { id: "effective-capacity", label: "Effective Capacity (%)", category: "Input", keywords: "capacity efficiency configuration", tab: "team", targetId: "search-target-effective-capacity" },
  { id: "annual-salary", label: "Annual Salary Baseline ($)", category: "Input", keywords: "salary cost pay configuration", tab: "team", targetId: "search-target-annual-salary" },
  { id: "interrupt-shield", label: "Dedicated Interrupt Shield", category: "Input", keywords: "toggle switch on-call interrupts", tab: "team", targetId: "search-target-interrupt-shield" },
  { id: "kpi-operational-load", label: "Operational Load & Toil Capacity", category: "KPI Panel", keywords: "kpi executive summary", tab: "summary", targetId: "search-target-kpi-operational-load" },
  { id: "kpi-automation-roi", label: "Automation ROI & Financial Impact", category: "KPI Panel", keywords: "kpi executive summary return on investment", tab: "summary", targetId: "search-target-kpi-automation-roi" },
  { id: "kpi-prr-governance", label: "PRR & Service Readiness", category: "KPI Panel", keywords: "kpi governance production readiness review", tab: "summary", targetId: "search-target-kpi-prr-governance" },
  { id: "kpi-slo-health", label: "SLO Health & Error Budget", category: "KPI Panel", keywords: "kpi service level objective", tab: "summary", targetId: "search-target-kpi-slo-health" },
  { id: "load-gauge", label: "Operational Load Gauge", category: "Section", keywords: "innovation capacity red zone", tab: "services", targetId: "search-target-load-gauge" },
  { id: "error-budget-buckets", label: "Error Budget Buckets", category: "Section", keywords: "maintenance innovation toil capacity chart", tab: "services", targetId: "search-target-error-budget-buckets" },
  { id: "criticality-matrix", label: "Criticality vs. Toil Matrix", category: "Section", keywords: "quadrant priority", tab: "services", targetId: "search-target-criticality-matrix" },
  { id: "upskilling-dividend", label: "Internal Upskilling Dividend", category: "Section", keywords: "hiring cost external headcount financial", tab: "summary", targetId: "search-target-upskilling-dividend" },
];

export function buildSearchIndex(services: Service[]): SearchEntry[] {
  const serviceEntries: SearchEntry[] = services.map((service) => ({
    id: `service-${service.id}`,
    label: service.name,
    category: "Service",
    keywords: `service ${service.id.replaceAll("_", " ")}`,
    tab: "services",
    targetId: `search-target-service-${service.id}`,
    serviceId: service.id,
  }));
  return [...STATIC_ENTRIES, ...serviceEntries];
}

export function searchEntries(entries: SearchEntry[], query: string, limit = 8): SearchEntry[] {
  const scored: { entry: SearchEntry; score: number }[] = [];
  for (const entry of entries) {
    const labelScore = fuzzyScore(query, entry.label);
    const keywordScore = fuzzyScore(query, `${entry.label} ${entry.keywords}`);
    const score = labelScore ?? (keywordScore === null ? null : keywordScore + 1);
    if (score !== null) scored.push({ entry, score });
  }
  return scored
    .sort((a, b) => a.score - b.score || a.entry.label.localeCompare(b.entry.label))
    .slice(0, limit)
    .map(({ entry }) => entry);
}
