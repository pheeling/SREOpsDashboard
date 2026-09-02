import type { Service } from "./types";

/**
 * Default Service Inventory seeded from the 20 services enumerated in the
 * design plan. Every service starts with no SME and no automation to
 * reflect the conservative "unconscious toil" starting point, except
 * baseHours/weight tuned by relative operational complexity.
 *
 * High-impact, systemically important services (Internal Networking,
 * Databases) carry a weight above 1 to reflect their outsized blast radius.
 */
export const DEFAULT_SERVICES: Service[] = [
  { id: "backup", name: "Backup", baseHours: 4, hasSME: false, isAutomated: false, weight: 1 },
  { id: "frontend_proxy", name: "Frontend Proxy", baseHours: 3, hasSME: false, isAutomated: false, weight: 1 },
  { id: "reverse_proxy", name: "Reverse Proxy", baseHours: 3, hasSME: false, isAutomated: false, weight: 1 },
  { id: "file_services", name: "File Services", baseHours: 4, hasSME: false, isAutomated: false, weight: 1 },
  { id: "web_service", name: "Web Service", baseHours: 5, hasSME: false, isAutomated: false, weight: 1 },
  { id: "file_transfer_service", name: "File Transfer Service", baseHours: 3, hasSME: false, isAutomated: false, weight: 1 },
  { id: "firewall", name: "Firewall", baseHours: 5, hasSME: false, isAutomated: false, weight: 1.25 },
  { id: "internal_networking", name: "Internal Networking", baseHours: 8, hasSME: false, isAutomated: false, weight: 1.5 },
  { id: "cicd", name: "CI/CD", baseHours: 6, hasSME: false, isAutomated: false, weight: 1 },
  { id: "routing", name: "Routing", baseHours: 4, hasSME: false, isAutomated: false, weight: 1.25 },
  { id: "email", name: "Email", baseHours: 3, hasSME: false, isAutomated: false, weight: 1 },
  { id: "productivity_suite", name: "Productivity Suite", baseHours: 2, hasSME: false, isAutomated: false, weight: 1 },
  { id: "chat", name: "Chat", baseHours: 2, hasSME: false, isAutomated: false, weight: 1 },
  { id: "telephone", name: "Telephone", baseHours: 2, hasSME: false, isAutomated: false, weight: 1 },
  { id: "printing", name: "Printing", baseHours: 2, hasSME: false, isAutomated: false, weight: 1 },
  { id: "edr", name: "Endpoint Detection Response (EDR)", baseHours: 4, hasSME: false, isAutomated: false, weight: 1 },
  { id: "antivirus", name: "Antivirus", baseHours: 3, hasSME: false, isAutomated: false, weight: 1 },
  { id: "vulnerability_management", name: "Vulnerability Management", baseHours: 5, hasSME: false, isAutomated: false, weight: 1 },
  { id: "computer", name: "Computer", baseHours: 4, hasSME: false, isAutomated: false, weight: 1 },
  { id: "databases", name: "Databases", baseHours: 10, hasSME: true, isAutomated: false, weight: 1.5 },
];
