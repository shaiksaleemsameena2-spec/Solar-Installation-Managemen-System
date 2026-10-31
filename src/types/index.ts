// ============================================================
// SolarOps AI — domain types
// ============================================================

export type Role = "admin" | "sales" | "inventory" | "installation" | "service" | "customer";

export interface Profile {
  id: string;
  name: string;
  email: string;
  role: Role;
}

// ---------- Customers & Leads ----------
export type LeadStatus =
  | "new" | "contacted" | "survey_scheduled" | "survey_completed"
  | "quotation_sent" | "negotiation" | "won" | "lost";
export type CustomerType = "residential" | "commercial";

export interface Customer {
  id: string;
  code: string;
  full_name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  postal_code: string;
  customer_type: CustomerType;
  monthly_units: number;
  monthly_bill: number;
  lead_source: string;
  assigned_to: string;
  notes: string;
  lead_status: LeadStatus;
  created_at: string;
  updated_at: string;
}

export interface CustomerNote {
  id: string;
  customer_id: string;
  note: string;
  author: string;
  created_at: string;
}

// ---------- Site Surveys ----------
export type SurveyStatus = "scheduled" | "in_progress" | "completed" | "cancelled";

export interface SiteSurvey {
  id: string;
  code: string;
  customer_id: string;
  survey_date: string;
  surveyor: string;
  property_type: string;
  roof_type: string;
  roof_area_sqm: number;
  installable_area_sqm: number;
  shading: string;
  monthly_units: number;
  monthly_bill: number;
  required_capacity_kw: number;
  grid_available: boolean;
  recommended_system_type: string;
  constraints: string;
  notes: string;
  status: SurveyStatus;
  photo_urls: string[];
  created_at: string;
}

// ---------- Packages & Quotations ----------
export type SystemType = "on_grid" | "off_grid";

export interface SolarPackage {
  id: string;
  name: string;
  capacity_kw: number;
  system_type: SystemType;
  panel_wattage: number;
  panel_count: number;
  inverter_spec: string;
  battery_spec: string;
  equipment_cost: number;
  installation_cost: number;
  additional_cost: number;
  tax_percent: number;
  description: string;
  is_active: boolean;
}

export type QuotationStatus = "draft" | "generated" | "sent" | "accepted" | "rejected" | "expired";

export interface QuotationAdditionalItem {
  description: string;
  amount: number;
}

export interface Quotation {
  id: string;
  number: string;
  customer_id: string;
  survey_id: string | null;
  package_id: string;
  // snapshot of package at quotation time
  package_name: string;
  capacity_kw: number;
  system_type: SystemType;
  panel_wattage: number;
  panel_count: number;
  inverter_spec: string;
  battery_spec: string;
  equipment_cost: number;
  installation_cost: number;
  tax_percent: number;
  additional_items: QuotationAdditionalItem[];
  discount: number;
  subsidy_estimate: number;
  subtotal: number;
  tax_amount: number;
  total: number;
  valid_until: string;
  terms: string;
  status: QuotationStatus;
  created_at: string;
  updated_at: string;
}

// ---------- Inventory ----------
export type InventoryCategory =
  | "solar_panel" | "inverter" | "battery" | "mounting" | "cable"
  | "connector" | "protection" | "other";

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: InventoryCategory;
  manufacturer: string;
  model: string;
  unit: string;
  purchase_cost: number;
  selling_price: number;
  available_qty: number;
  reserved_qty: number;
  reorder_level: number;
  supplier: string;
  warranty_months: number;
  is_active: boolean;
}

export interface InventoryTransaction {
  id: string;
  item_id: string;
  item_name: string;
  type: "receipt" | "adjustment" | "reserve" | "release" | "dispatch" | "install";
  qty: number;
  reference: string;
  note: string;
  by: string;
  created_at: string;
}

export type EquipmentStatus =
  | "in_stock" | "reserved" | "dispatched" | "installed" | "returned" | "defective";

export interface EquipmentUnit {
  id: string;
  item_id: string;
  item_name: string;
  serial_number: string;
  purchase_ref: string;
  status: EquipmentStatus;
  project_id: string | null;
  dispatched_at: string | null;
  installed_at: string | null;
  notes: string;
  created_at: string;
}

// ---------- Crews & Projects ----------
export type CrewAvailability = "available" | "busy" | "off_duty" | "on_leave";

export interface InstallationCrew {
  id: string;
  name: string;
  leader: string;
  members: string[];
  phone: string;
  skills: string[];
  availability: CrewAvailability;
}

export type ProjectStatus =
  | "awaiting_stock" | "ready_to_schedule" | "scheduled"
  | "in_progress" | "quality_inspection" | "completed" | "cancelled";

export interface InstallationProject {
  id: string;
  number: string;
  customer_id: string;
  quotation_id: string;
  package_name: string;
  capacity_kw: number;
  installation_type: string;
  address: string;
  manager: string;
  crew_id: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  actual_completion: string | null;
  status: ProjectStatus;
  planned_cost: number;
  actual_cost: number;
  contract_value: number;
  notes: string;
  equipment_status: "pending" | "reserved" | "dispatched";
  accepted_at: string | null;
  created_at: string;
}

export interface ChecklistItem {
  id: string;
  project_id: string;
  sequence: number;
  description: string;
  completed: boolean;
  completed_by: string;
  completed_at: string | null;
  notes: string;
}

export interface InstallationPhoto {
  id: string;
  project_id: string;
  caption: string;
  data_url: string;
  uploaded_by: string;
  uploaded_at: string;
}

export interface CustomerAcceptance {
  id: string;
  project_id: string;
  customer_name: string;
  accepted_at: string;
  signature_data: string | null;
}

// ---------- Warranties ----------
export type WarrantyStatus = "pending_activation" | "active" | "expired" | "claimed" | "voided";

export interface Warranty {
  id: string;
  code: string;
  customer_id: string;
  project_id: string;
  equipment_unit_id: string | null;
  product_name: string;
  serial_number: string;
  warranty_type: string;
  start_date: string;
  end_date: string;
  duration_months: number;
  terms: string;
  status: WarrantyStatus;
  created_at: string;
}

// ---------- Service Center ----------
export type TicketStatus = "open" | "assigned" | "in_progress" | "waiting_parts" | "resolved" | "closed";
export type TicketPriority = "low" | "medium" | "high" | "critical";
export type AssignmentStatus =
  | "requested" | "awaiting_confirmation" | "confirmed" | "in_progress" | "completed" | "cancelled";

export interface ServiceTicket {
  id: string;
  number: string;
  customer_id: string;
  project_id: string | null;
  equipment_unit_id: string | null;
  serial_number: string;
  issue_category: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  assigned_technician: string;
  assignment_status: AssignmentStatus | null;
  appointment_time: string | null;
  resolution_notes: string;
  estimated_cost: number;
  actual_cost: number;
  resolution_date: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ServiceTicketNote {
  id: string;
  ticket_id: string;
  note: string;
  author: string;
  created_at: string;
}

// ---------- Finance ----------
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";
export type PaymentStage = "booking_advance" | "equipment_dispatch" | "installation_milestone" | "final";

export interface Payment {
  id: string;
  number: string;
  customer_id: string;
  project_id: string | null;
  quotation_id: string | null;
  amount: number;
  payment_date: string | null;
  method: string;
  txn_ref: string;
  stage: PaymentStage;
  status: PaymentStatus;
  notes: string;
  created_at: string;
}

export interface ProjectExpense {
  id: string;
  project_id: string;
  category: string;
  amount: number;
  expense_date: string;
  vendor: string;
  notes: string;
  created_at: string;
}

// ---------- Subsidies ----------
export type SubsidyStatus =
  | "not_started" | "draft" | "submitted" | "under_review" | "approved" | "rejected" | "paid";

export interface SubsidyApplication {
  id: string;
  customer_id: string;
  project_id: string | null;
  program_name: string;
  estimated_amount: number;
  requested_amount: number;
  application_ref: string;
  application_date: string | null;
  status: SubsidyStatus;
  approval_date: string | null;
  approved_amount: number;
  received_amount: number;
  notes: string;
  created_at: string;
}

// ---------- Activity ----------
export interface ActivityLog {
  id: string;
  type: string;
  message: string;
  entity_type: string;
  entity_id: string | null;
  customer_id: string | null;
  project_id: string | null;
  created_at: string;
}

// ---------- Technician locator (customer-facing) ----------
export type TechnicianAvailability = "available" | "busy" | "off_duty" | "on_leave";

export interface TechnicianProfile {
  id: string;
  name: string;
  photo_color: string;
  phone: string;
  specializations: string[];
  experience_years: number;
  location_name: string;
  lat: number;
  lng: number;
  service_areas: string[];
  max_radius_km: number;
  working_hours: string;
  availability: TechnicianAvailability;
  rating: number;
  completed_jobs: number;
  is_demo: true;
  is_active: boolean;
}

// ---------- Savings estimator assumptions ----------
export interface SavingsAssumptions {
  grid_rate_per_unit: number;
  daily_sun_hours: number;
  performance_ratio: number;
  export_tariff_per_unit: number;
  annual_degradation_percent: number;
}
