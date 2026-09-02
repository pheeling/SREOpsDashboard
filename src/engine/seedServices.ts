import type { Service } from "./types";

/**
 * Default Service Inventory seeded from the 20 standard infrastructure
 * services enumerated in the design plan. Every service starts active, with
 * no expertise and no automation, to reflect the conservative "unconscious
 * toil" starting point.
 */
export const DEFAULT_SERVICES: Service[] = [
  { id: "backup", name: "Backup", deployHours: 3, maintenanceHours: 2, isActive: true, hasExpertise: false, isAutomated: false },
  { id: "frontend_proxy", name: "Frontend Proxy", deployHours: 2, maintenanceHours: 2, isActive: true, hasExpertise: false, isAutomated: false },
  { id: "reverse_proxy", name: "Reverse Proxy", deployHours: 2, maintenanceHours: 2, isActive: true, hasExpertise: false, isAutomated: false },
  { id: "file_services", name: "File Services", deployHours: 2, maintenanceHours: 3, isActive: true, hasExpertise: false, isAutomated: false },
  { id: "web_service", name: "Web Service", deployHours: 3, maintenanceHours: 3, isActive: true, hasExpertise: false, isAutomated: false },
  { id: "file_transfer_service", name: "File Transfer Service", deployHours: 2, maintenanceHours: 2, isActive: true, hasExpertise: false, isAutomated: false },
  { id: "firewall", name: "Firewall", deployHours: 3, maintenanceHours: 3, isActive: true, hasExpertise: false, isAutomated: false },
  { id: "internal_networking", name: "Internal Networking", deployHours: 4, maintenanceHours: 5, isActive: true, hasExpertise: false, isAutomated: false },
  { id: "cicd", name: "CI/CD", deployHours: 4, maintenanceHours: 3, isActive: true, hasExpertise: false, isAutomated: false },
  { id: "routing", name: "Routing", deployHours: 2, maintenanceHours: 2, isActive: true, hasExpertise: false, isAutomated: false },
  { id: "email", name: "Email", deployHours: 2, maintenanceHours: 2, isActive: true, hasExpertise: false, isAutomated: false },
  { id: "productivity_suite", name: "Productivity Suite", deployHours: 1, maintenanceHours: 1, isActive: true, hasExpertise: false, isAutomated: false },
  { id: "chat", name: "Chat", deployHours: 1, maintenanceHours: 1, isActive: true, hasExpertise: false, isAutomated: false },
  { id: "telephone", name: "Telephone", deployHours: 1, maintenanceHours: 1, isActive: true, hasExpertise: false, isAutomated: false },
  { id: "printing", name: "Printing", deployHours: 1, maintenanceHours: 1, isActive: true, hasExpertise: false, isAutomated: false },
  { id: "edr", name: "Endpoint Detection Response (EDR)", deployHours: 2, maintenanceHours: 2, isActive: true, hasExpertise: false, isAutomated: false },
  { id: "antivirus", name: "Antivirus", deployHours: 1, maintenanceHours: 2, isActive: true, hasExpertise: false, isAutomated: false },
  { id: "vulnerability_management", name: "Vulnerability Management", deployHours: 3, maintenanceHours: 2, isActive: true, hasExpertise: false, isAutomated: false },
  { id: "databases", name: "Databases", deployHours: 5, maintenanceHours: 5, isActive: true, hasExpertise: true, isAutomated: false },
];
