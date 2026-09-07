import type { Service } from "./types";

/**
 * Default Service Inventory seeded from the 19 standard infrastructure
 * services enumerated in the design plan. Every service starts active, with
 * team expertise and no automation. High-blast-radius services (Databases,
 * Internal Networking, Firewall, EDR) are seeded with a criticality
 * `weight` above 1 (see `getServiceWeight`); all others default to 1.
 */
export const DEFAULT_SERVICES: Service[] = [
  { id: "backup", name: "Backup", deployHours: 30, maintenanceHours: 15, isActive: true, hasExpertise: true, isAutomated: false },
  { id: "frontend_proxy", name: "Frontend Proxy", deployHours: 20, maintenanceHours: 8, isActive: true, hasExpertise: true, isAutomated: false },
  { id: "reverse_proxy", name: "Reverse Proxy", deployHours: 15, maintenanceHours: 6, isActive: true, hasExpertise: true, isAutomated: false },
  { id: "file_services", name: "File Services", deployHours: 20, maintenanceHours: 10, isActive: true, hasExpertise: true, isAutomated: false },
  { id: "web_service", name: "Web Service", deployHours: 25, maintenanceHours: 12, isActive: true, hasExpertise: true, isAutomated: false },
  { id: "file_transfer_service", name: "File Transfer Service", deployHours: 15, maintenanceHours: 8, isActive: true, hasExpertise: true, isAutomated: false },
  { id: "firewall", name: "Firewall", deployHours: 40, maintenanceHours: 20, isActive: true, hasExpertise: true, isAutomated: false, weight: 1.5 },
  { id: "internal_networking", name: "Internal Networking", deployHours: 50, maintenanceHours: 25, isActive: true, hasExpertise: true, isAutomated: false, weight: 1.5 },
  { id: "cicd", name: "CI/CD", deployHours: 60, maintenanceHours: 30, isActive: true, hasExpertise: true, isAutomated: false },
  { id: "routing", name: "Routing", deployHours: 30, maintenanceHours: 15, isActive: true, hasExpertise: true, isAutomated: false },
  { id: "email", name: "Email", deployHours: 35, maintenanceHours: 15, isActive: true, hasExpertise: true, isAutomated: false },
  { id: "productivity_suite", name: "Productivity Suite", deployHours: 40, maintenanceHours: 10, isActive: true, hasExpertise: true, isAutomated: false },
  { id: "chat", name: "Chat", deployHours: 20, maintenanceHours: 10, isActive: true, hasExpertise: true, isAutomated: false },
  { id: "telephone", name: "Telephone", deployHours: 30, maintenanceHours: 12, isActive: true, hasExpertise: true, isAutomated: false },
  { id: "printing", name: "Printing", deployHours: 15, maintenanceHours: 10, isActive: true, hasExpertise: true, isAutomated: false },
  { id: "edr", name: "Endpoint Detection Response (EDR)", deployHours: 45, maintenanceHours: 20, isActive: true, hasExpertise: true, isAutomated: false, weight: 1.3 },
  { id: "antivirus", name: "Antivirus", deployHours: 20, maintenanceHours: 8, isActive: true, hasExpertise: true, isAutomated: false },
  { id: "vulnerability_management", name: "Vulnerability Management", deployHours: 40, maintenanceHours: 25, isActive: true, hasExpertise: true, isAutomated: false },
  { id: "databases", name: "Databases", deployHours: 80, maintenanceHours: 40, isActive: true, hasExpertise: true, isAutomated: false, weight: 2 },
];
