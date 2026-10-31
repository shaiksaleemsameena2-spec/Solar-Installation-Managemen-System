import type { SavingsAssumptions } from "@/types";
import type {
  ActivityLog, ChecklistItem, Customer, CustomerAcceptance, CustomerNote, EquipmentUnit,
  InstallationCrew, InstallationPhoto, InstallationProject, InventoryItem, InventoryTransaction,
  Payment, ProjectExpense, Quotation, ServiceTicket, ServiceTicketNote, SiteSurvey, SolarPackage,
  SubsidyApplication, TechnicianProfile, Warranty,
} from "@/types";

export interface DemoSettings {
  org_name: string;
  demo_location_name: string;
  demo_lat: number;
  demo_lng: number;
  savings: SavingsAssumptions;
}

// Full demo database shape (persisted in localStorage; 1:1 with supabase/migrations/0001_schema.sql tables)
export interface DemoDB {
  customers: Customer[];
  customer_notes: CustomerNote[];
  site_surveys: SiteSurvey[];
  solar_packages: SolarPackage[];
  quotations: Quotation[];
  inventory_items: InventoryItem[];
  inventory_transactions: InventoryTransaction[];
  equipment_units: EquipmentUnit[];
  installation_crews: InstallationCrew[];
  installation_projects: InstallationProject[];
  checklist_items: ChecklistItem[];
  installation_photos: InstallationPhoto[];
  customer_acceptances: CustomerAcceptance[];
  warranties: Warranty[];
  service_tickets: ServiceTicket[];
  service_ticket_notes: ServiceTicketNote[];
  payments: Payment[];
  project_expenses: ProjectExpense[];
  subsidy_applications: SubsidyApplication[];
  activity_logs: ActivityLog[];
  technicians: TechnicianProfile[];
  settings: DemoSettings;
}
