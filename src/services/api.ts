// ============================================================
// SolarOps AI — business operations API (demo/local backend)
// All mutations validate inputs, update related records,
// write activity logs, and persist via the store.
// ============================================================
import type {
  Customer, CustomerNote, EquipmentUnit, InstallationCrew, InstallationProject, InventoryItem,
  Quotation, QuotationAdditionalItem, ServiceTicket, SiteSurvey, SolarPackage, ChecklistItem,
  Payment, ProjectExpense, SubsidyApplication, TechnicianProfile,
} from "@/types";
import { mutate } from "./store";
import type { DemoDB } from "./settings";
import { getDB } from "./store";
import { uuid, nextNumber, todayISO, addMonths } from "@/lib/utils";
import {
  computeQuotationTotals, computeWarrantyDates,
} from "@/lib/calculations/finance";
import { DEFAULT_CHECKLIST } from "@/lib/labels";
import { registerStaffAccount } from "./auth";

export class OpError extends Error {}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new OpError(msg);
}

// ---------- small helpers over the db ----------
function getDb(): DemoDB {
  return getDB();
}

export function logActivity(
  type: string, message: string, entity_type: string, entity_id: string | null,
  customer_id: string | null = null, project_id: string | null = null, daysOffset = 0,
) {
  const d = new Date(Date.now() - daysOffset * 86400000).toISOString();
  mutate((db) => {
    db.activity_logs.unshift({
      id: uuid(), type, message, entity_type, entity_id, customer_id, project_id, created_at: d,
    });
  });
}

function mutateAndLog(
  fn: (db: DemoDB) => void,
  log?: { type: string; message: string; entity_type: string; entity_id: string | null; customer_id?: string | null; project_id?: string | null },
) {
  mutate(fn);
  if (log) logActivity(log.type, log.message, log.entity_type, log.entity_id, log.customer_id ?? null, log.project_id ?? null);
}

// ============================ CUSTOMERS ============================
export interface CustomerInput {
  full_name: string; phone: string; email: string; address: string; city: string;
  state: string; postal_code: string; customer_type: Customer["customer_type"];
  monthly_units: number; monthly_bill: number; lead_source: string; assigned_to: string;
  notes: string; lead_status: Customer["lead_status"];
}

export function createCustomer(input: CustomerInput): Customer {
  const db = getDb();
  const dup = db.customers.find(
    (c) => c.phone.replace(/\D/g, "") === input.phone.replace(/\D/g, "") && input.phone.trim() !== "",
  );
  assert(!dup, `A customer with phone ${input.phone} already exists (${dup?.full_name}).`);
  const now = new Date().toISOString();
  const customer: Customer = {
    id: uuid(),
    code: `CUST-${String(db.customers.length + 1).padStart(4, "0")}`,
    ...input,
    created_at: now, updated_at: now,
  };
  mutateAndLog(
    (db2) => { db2.customers.unshift(customer); },
    { type: "customer_created", message: `Customer created — ${customer.full_name}`, entity_type: "customer", entity_id: customer.id, customer_id: customer.id },
  );
  return customer;
}

export function updateCustomer(id: string, patch: Partial<CustomerInput> & { lead_status?: Customer["lead_status"] }) {
  const db = getDb();
  const c = db.customers.find((x) => x.id === id);
  assert(c, "Customer not found.");
  mutateAndLog(
    (db2) => {
      Object.assign(c, patch, { updated_at: new Date().toISOString() });
    },
    patch.lead_status
      ? { type: "lead_status_changed", message: `${c.full_name} lead status → ${patch.lead_status}`, entity_type: "customer", entity_id: id, customer_id: id }
      : undefined,
  );
}

export function deleteCustomer(id: string) {
  const db = getDb();
  const c = db.customers.find((x) => x.id === id);
  assert(c, "Customer not found.");
  const hasProject = db.installation_projects.some((p) => p.customer_id === id);
  assert(!hasProject, "Customer has installation projects and cannot be deleted.");
  mutateAndLog(
    (db2) => {
      db2.customers = db2.customers.filter((x) => x.id !== id);
      db2.customer_notes = db2.customer_notes.filter((n) => n.customer_id !== id);
    },
    { type: "customer_deleted", message: `Customer deleted — ${c.full_name}`, entity_type: "customer", entity_id: id },
  );
}

export function addCustomerNote(customerId: string, note: string, author = "Admin") {
  assert(note.trim(), "Note cannot be empty.");
  const n: CustomerNote = { id: uuid(), customer_id: customerId, note: note.trim(), author, created_at: new Date().toISOString() };
  mutate((db) => { db.customer_notes.unshift(n); });
}

// ============================ SURVEYS ============================
export interface SurveyInput {
  customer_id: string; survey_date: string; surveyor: string; property_type: string;
  roof_type: string; roof_area_sqm: number; installable_area_sqm: number; shading: string;
  monthly_units: number; monthly_bill: number; required_capacity_kw: number;
  grid_available: boolean; recommended_system_type: string; constraints: string; notes: string;
  status: SiteSurvey["status"]; photo_urls?: string[];
}

export function createSurvey(input: SurveyInput): SiteSurvey {
  const db = getDb();
  const cust = db.customers.find((c) => c.id === input.customer_id);
  assert(cust, "Select a valid customer.");
  assert(input.roof_area_sqm > 0, "Roof area must be greater than zero.");
  const s: SiteSurvey = {
    id: uuid(), code: `SRV-2026-${String(db.site_surveys.length + 1).padStart(4, "0")}`,
    ...input, photo_urls: input.photo_urls ?? [],
    created_at: new Date().toISOString(),
  };
  mutate((db2) => {
    db2.site_surveys.unshift(s);
    const c = db2.customers.find((x) => x.id === input.customer_id);
    if (c && c.lead_status === "new") {
      c.lead_status = "survey_scheduled";
      c.updated_at = new Date().toISOString();
    }
  });
  logActivity("survey_scheduled", `Site survey ${s.code} scheduled for ${cust!.full_name}`, "survey", s.id, cust!.id);
  return s;
}

export function updateSurvey(id: string, patch: Partial<SurveyInput>) {
  const db = getDb();
  const s = db.site_surveys.find((x) => x.id === id);
  assert(s, "Survey not found.");
  mutate((db2) => { Object.assign(s, patch); });
}

export function completeSurvey(id: string) {
  const db = getDb();
  const s = db.site_surveys.find((x) => x.id === id);
  assert(s, "Survey not found.");
  assert(s.installable_area_sqm > 0 || s.status === "cancelled", "Installable area must be recorded before completing.");
  s.status = "completed";
  const cust = db.customers.find((c) => c.id === s.customer_id);
  if (cust && !["won", "lost"].includes(cust.lead_status)) cust.lead_status = "survey_completed";
  logActivity("survey_completed", `Site survey completed for ${cust?.full_name ?? "customer"}`, "survey", s.id, cust?.id ?? null);
}

// ============================ PACKAGES ============================
export interface PackageInput extends Omit<SolarPackage, "id"> {}

export function createPackage(input: PackageInput) {
  assert(input.name.trim(), "Package name required.");
  assert(input.capacity_kw > 0 && input.capacity_kw <= 5, "Capacity must be 1–5 kW.");
  const p: SolarPackage = { id: uuid(), ...input };
  mutate((db) => { db.solar_packages.unshift(p); });
  return p;
}

export function updatePackage(id: string, patch: Partial<PackageInput>) {
  const db = getDb();
  const p = db.solar_packages.find((x) => x.id === id);
  assert(p, "Package not found.");
  mutate((db2) => { Object.assign(p, patch); });
}

// ============================ QUOTATIONS ============================
export interface QuotationInput {
  customer_id: string; survey_id: string | null; package_id: string;
  additional_items: QuotationAdditionalItem[]; discount: number; subsidy_estimate: number;
  installation_cost_override?: number | null; valid_until: string; terms: string;
}

export function createQuotation(input: QuotationInput): Quotation {
  const db = getDb();
  const cust = db.customers.find((c) => c.id === input.customer_id);
  assert(cust, "Select a valid customer.");
  const pkg = db.solar_packages.find((p) => p.id === input.package_id);
  assert(pkg && pkg.is_active, "Select an active package.");
  const items = input.additional_items.filter((i) => i.description.trim() && Number(i.amount) >= 0);
  const t = computeQuotationTotals({
    equipment_cost: pkg.equipment_cost,
    installation_cost: input.installation_cost_override ?? pkg.installation_cost,
    additional_items: items,
    tax_percent: pkg.tax_percent,
    discount: input.discount,
    subsidy_estimate: input.subsidy_estimate,
  });
  const now = new Date().toISOString();
  const q: Quotation = {
    id: uuid(),
    number: nextNumber("QT", db.quotations.map((x) => x.number)),
    customer_id: cust.id, survey_id: input.survey_id, package_id: pkg.id,
    package_name: pkg.name, capacity_kw: pkg.capacity_kw, system_type: pkg.system_type,
    panel_wattage: pkg.panel_wattage, panel_count: pkg.panel_count,
    inverter_spec: pkg.inverter_spec, battery_spec: pkg.battery_spec,
    equipment_cost: pkg.equipment_cost,
    installation_cost: input.installation_cost_override ?? pkg.installation_cost,
    tax_percent: pkg.tax_percent, additional_items: items,
    discount: input.discount, subsidy_estimate: input.subsidy_estimate,
    subtotal: t.subtotal, tax_amount: t.tax_amount, total: t.total,
    valid_until: input.valid_until || addMonthsISO(todayISO(), 1),
    terms: input.terms || DEFAULT_QUOTATION_TERMS,
    status: "draft", created_at: now, updated_at: now,
  };
  mutate((db2) => { db2.quotations.unshift(q); });
  logActivity("quotation_created", `Quotation ${q.number} created (draft)`, "quotation", q.id, cust.id);
  updateCustomerLead(cust.id, "quotation_sent");
  return q;
}

function addMonthsISO(dISO: string, m: number) {
  const d = new Date(dISO);
  d.setMonth(d.getMonth() + m);
  return d.toISOString().slice(0, 10);
}

export const DEFAULT_QUOTATION_TERMS =
  "1. Package prices in this catalogue are demonstration prices and are fully editable by administrators.\n" +
  "2. Subsidy is only an estimate; eligibility and approval are decided exclusively by the government scheme. SunPower Solutions does not guarantee subsidy approval.\n" +
  "3. 50% booking advance required to confirm the order.\n" +
  "4. Net metering application and approvals are subject to local DISCOM rules.\n" +
  "5. Warranty as per manufacturer terms on registered serial-numbered equipment.";

export function updateQuotationDetails(id: string, patch: {
  additional_items?: QuotationAdditionalItem[]; discount?: number; subsidy_estimate?: number;
  installation_cost?: number; valid_until?: string; terms?: string;
}) {
  const db = getDb();
  const q = db.quotations.find((x) => x.id === id);
  assert(q, "Quotation not found.");
  assert(["draft", "generated"].includes(q.status), "Only Draft/Generated quotations can be edited.");
  const items = (patch.additional_items ?? q.additional_items).filter(
    (i) => i.description.trim() && Number(i.amount) >= 0,
  );
  const t = computeQuotationTotals({
    equipment_cost: q.equipment_cost,
    installation_cost: patch.installation_cost ?? q.installation_cost,
    additional_items: items,
    tax_percent: q.tax_percent,
    discount: patch.discount ?? q.discount,
    subsidy_estimate: patch.subsidy_estimate ?? q.subsidy_estimate,
  });
  mutate((db2) => {
    if (patch.additional_items) q.additional_items = items;
    if (patch.discount !== undefined) q.discount = patch.discount;
    if (patch.subsidy_estimate !== undefined) q.subsidy_estimate = patch.subsidy_estimate;
    if (patch.installation_cost !== undefined) q.installation_cost = patch.installation_cost;
    if (patch.valid_until) q.valid_until = patch.valid_until;
    if (patch.terms) q.terms = patch.terms;
    q.subtotal = t.subtotal; q.tax_amount = t.tax_amount; q.total = t.total;
    q.updated_at = new Date().toISOString();
  });
}

export type QuotationLifecycleAction = "generate" | "send" | "accept" | "reject" | "mark_expired" | "reopen";

export function quotationAction(id: string, action: QuotationLifecycleAction) {
  const db = getDb();
  const q = db.quotations.find((x) => x.id === id);
  assert(q, "Quotation not found.");
  const cust = db.customers.find((c) => c.id === q.customer_id);
  const transitions: Record<QuotationLifecycleAction, [Quotation["status"], Quotation["status"][]]> = {
    generate: ["generated", ["draft"]],
    send: ["sent", ["generated", "draft"]],
    accept: ["accepted", ["sent", "generated"]],
    reject: ["rejected", ["sent", "generated", "draft"]],
    mark_expired: ["expired", ["sent", "generated", "draft"]],
    reopen: ["draft", ["rejected", "expired"]],
  };
  const [to, from] = transitions[action];
  assert(from.includes(q.status), `Cannot ${action} a quotation in "${q.status}" status.`);
  const prev = q.status;
  mutate((db2) => {
    q.status = to;
    q.updated_at = new Date().toISOString();
  });
  const custId = q.customer_id;
  if (action === "send") updateLeadStatusFor(custId, "quotation_sent");
  if (action === "accept") updateLeadStatusFor(custId, "won");
  logActivity(
    { generate: "quotation_generated", send: "quotation_sent", accept: "quotation_accepted", reject: "quotation_rejected", mark_expired: "quotation_expired", reopen: "quotation_reopened" }[action],
    `Quotation ${q.number} ${action === "send" ? "sent" : action === "accept" ? "accepted" : action === "reject" ? "rejected" : action + "ed"} (was ${prev})`,
    "quotation", q.id, custId,
  );
  return to;
}

function updateLeadStatusFor(customerId: string, status: Customer["lead_status"]) {
  mutate((db) => {
    const c = db.customers.find((x) => x.id === customerId);
    if (c && !["won", "lost"].includes(c.lead_status)) {
      c.lead_status = status;
      c.updated_at = new Date().toISOString();
    }
  });
}

function updateCustomerLead(customerId: string, status: Customer["lead_status"]) {
  updateLeadStatusFor(customerId, status);
}

// ==================== QUOTATION → PROJECT ====================
export function convertQuotationToProject(quotationId: string): InstallationProject {
  const db = getDb();
  const q = db.quotations.find((x) => x.id === quotationId);
  assert(q, "Quotation not found.");
  assert(q.status === "accepted", "Only accepted quotations can be converted to projects.");
  const existing = db.installation_projects.find((p) => p.quotation_id === q.id && p.status !== "cancelled");
  if (existing) return existing; // idempotent: exactly one project per quotation
  const cust = db.customers.find((c) => c.id === q.customer_id);
  assert(cust, "Customer missing for quotation.");
  const survey = q.survey_id ? db.site_surveys.find((s) => s.id === q.survey_id) : null;
  const p: InstallationProject = {
    id: uuid(),
    number: nextNumber("PRJ", db.installation_projects.map((x) => x.number)),
    customer_id: cust.id, quotation_id: q.id, package_name: q.package_name,
    capacity_kw: q.capacity_kw,
    installation_type: survey ? `${survey.roof_type} rooftop` : "Rooftop",
    address: `${cust.address}, ${cust.city}`,
    manager: "Installation Manager — Sunil Khanna", crew_id: null,
    scheduled_start: null, scheduled_end: null, actual_completion: null,
    status: "awaiting_stock", planned_cost: q.equipment_cost, actual_cost: 0,
    contract_value: q.total, notes: "Created from accepted quotation " + q.number,
    equipment_status: "pending", accepted_at: q.updated_at,
    created_at: new Date().toISOString(),
  };
  // seed the standard checklist
  const items: ChecklistItem[] = DEFAULT_CHECKLIST.map((d, i) => ({
    id: uuid(), project_id: p.id, sequence: i + 1, description: d,
    completed: false, completed_by: "", completed_at: null, notes: "",
  }));
  // staged payment plan (configurable; amounts as 50% / 50% placeholders)
  const payments: Payment[] = [
    {
      id: uuid(), number: nextNumber("PAY", db.payments.map((x) => x.number)),
      customer_id: cust.id, project_id: p.id, quotation_id: q.id,
      amount: Math.round(q.total * 0.5), payment_date: null,
      method: "Bank Transfer (NEFT/RTGS)", txn_ref: "", stage: "booking_advance",
      status: "pending", notes: "Booking advance (50%) — default staged plan",
      created_at: new Date().toISOString(),
    },
    {
      id: uuid(), number: nextNumber("PAY", [...db.payments.map((x) => x.number)]),
      customer_id: cust.id, project_id: p.id, quotation_id: q.id,
      amount: q.total - Math.round(q.total * 0.5), payment_date: null,
      method: "Bank Transfer (NEFT/RTGS)", txn_ref: "", stage: "final",
      status: "pending", notes: "Final payment — due on completion",
      created_at: new Date().toISOString(),
    },
  ];
  mutate((db2) => {
    db2.installation_projects.unshift(p);
    db2.checklist_items.push(...items);
    db2.payments.unshift(...payments);
  });
  logActivity("project_created", `Project ${p.number} created from ${q.number}`, "project", p.id, cust.id, p.id);
  return p;
}

// ============================ INVENTORY ============================
export function createInventoryItem(input: Omit<InventoryItem, "id">) {
  const db = getDb();
  assert(input.sku.trim(), "SKU required.");
  assert(!db.inventory_items.some((i) => i.sku.toLowerCase() === input.sku.trim().toLowerCase()), "SKU already exists.");
  assert(Number(input.available_qty) >= 0, "Quantity cannot be negative.");
  const item: InventoryItem = { id: uuid(), ...input, sku: input.sku.trim() };
  mutate((db2) => { db2.inventory_items.push(item); });
  return item;
}

export function updateInventoryItem(id: string, patch: Partial<Omit<InventoryItem, "id">>) {
  const db = getDb();
  const it = db.inventory_items.find((x) => x.id === id);
  assert(it, "Item not found.");
  mutate((db2) => { Object.assign(it, patch); });
}

export function stockReceipt(itemId: string, qty: number, reference: string, note: string, by = "Inventory Manager") {
  assert(qty > 0, "Quantity must be positive.");
  const db = getDb();
  const it = db.inventory_items.find((x) => x.id === itemId);
  assert(it, "Item not found.");
  mutate((db2) => {
    it.available_qty += qty;
    db2.inventory_transactions.unshift({
      id: uuid(), item_id: it.id, item_name: it.name, type: "receipt", qty,
      reference: reference.trim() || "—", note, by, created_at: new Date().toISOString(),
    });
  });
}

export function stockAdjustment(itemId: string, delta: number, note: string, by = "Inventory Manager") {
  const db = getDb();
  const it = db.inventory_items.find((x) => x.id === itemId);
  assert(it, "Item not found.");
  assert(it.available_qty + delta >= 0, "Adjustment would make stock negative.");
  mutate((db2) => {
    it.available_qty += delta;
    db2.inventory_transactions.unshift({
      id: uuid(), item_id: it.id, item_name: it.name, type: "adjustment", qty: delta,
      reference: "Manual adjustment", note, by, created_at: new Date().toISOString(),
    });
  });
}

// ==================== EQUIPMENT SERIALS ====================
export function addEquipmentUnit(input: { item_id: string; serial_number: string; purchase_ref: string; notes: string }) {
  const db = getDb();
  const it = db.inventory_items.find((x) => x.id === input.item_id);
  assert(it, "Select an inventory item.");
  const sn = input.serial_number.trim();
  assert(sn.length >= 3, "Serial number must be at least 3 characters.");
  assert(!db.equipment_units.some((u) => u.serial_number.toLowerCase() === sn.toLowerCase()), `Serial number "${sn}" is already registered.`);
  const u: EquipmentUnit = {
    id: uuid(), item_id: it.id, item_name: it.name, serial_number: sn,
    purchase_ref: input.purchase_ref.trim() || "—", status: "in_stock", project_id: null,
    dispatched_at: null, installed_at: null, notes: input.notes, created_at: new Date().toISOString(),
  };
  mutate((db2) => { db2.equipment_units.push(u); });
  return u;
}

export function reserveEquipment(itemId: string, qty: number, projectId: string) {
  const db = getDb();
  const it = db.inventory_items.find((x) => x.id === itemId);
  assert(it, "Item not found.");
  const proj = db.installation_projects.find((p) => p.id === projectId);
  assert(proj, "Project not found.");
  assert(qty > 0, "Quantity must be positive.");
  const inStock = db.equipment_units.filter((u) => u.item_id === itemId && u.status === "in_stock");
  const loose = it.available_qty - inStock.length; // bulk stock without serials
  if (inStock.length >= qty) {
    const chosen = inStock.slice(0, qty);
    mutate((db2) => {
      chosen.forEach((u) => { u.status = "reserved"; u.project_id = projectId; });
      it.reserved_qty += qty;
      it.available_qty -= qty;
      db2.inventory_transactions.unshift({
        id: uuid(), item_id: it.id, item_name: it.name, type: "reserve", qty,
        reference: proj.number, note: "Serial-numbered units reserved", by: "Inventory Manager",
        created_at: new Date().toISOString(),
      });
      proj.equipment_status = proj.equipment_status === "pending" ? "reserved" : proj.equipment_status;
    });
  } else if (loose >= qty) {
    mutate((db2) => {
      it.available_qty -= qty;
      it.reserved_qty += qty;
      db2.inventory_transactions.unshift({
        id: uuid(), item_id: it.id, item_name: it.name, type: "reserve", qty,
        reference: proj.number, note: "Bulk stock reserved", by: "Inventory Manager",
        created_at: new Date().toISOString(),
      });
      proj.equipment_status = proj.equipment_status === "pending" ? "reserved" : proj.equipment_status;
    });
  } else {
    throw new OpError(
      `Insufficient stock for ${it.name}: requested ${qty}, in-stock serial units ${inStock.length}, bulk available ${Math.max(0, loose)}.`,
    );
  }
  logActivity("equipment_reserved", `Reserved ${qty} × ${it.name} for ${proj.number}`, "project", projectId, proj.customer_id, projectId);
}

export function releaseReservation(itemId: string, qty: number, projectId: string) {
  const db = getDb();
  const it = db.inventory_items.find((x) => x.id === itemId);
  assert(it, "Item not found.");
  const proj = db.installation_projects.find((p) => p.id === projectId);
  assert(proj, "Project not found.");
  const units = db.equipment_units.filter((u) => u.item_id === itemId && u.status === "reserved" && u.project_id === projectId);
  const fromUnits = Math.min(units.length, qty);
  const fromBulk = qty - fromUnits;
  mutate((db2) => {
    units.slice(0, fromUnits).forEach((u) => { u.status = "in_stock"; u.project_id = null; });
    it.reserved_qty = Math.max(0, it.reserved_qty - qty);
    it.available_qty += fromBulk;
    db2.inventory_transactions.unshift({
      id: uuid(), item_id: it.id, item_name: it.name, type: "release", qty,
      reference: proj.number, note: "Reservation released", by: "Inventory Manager",
      created_at: new Date().toISOString(),
    });
  });
}

export function dispatchEquipment(projectId: string) {
  const db = getDb();
  const proj = db.installation_projects.find((p) => p.id === projectId);
  assert(proj, "Project not found.");
  const units = db.equipment_units.filter((u) => u.project_id === projectId && u.status === "reserved");
  assert(units.length > 0, "No reserved serial-numbered units to dispatch for this project.");
  const now = new Date().toISOString();
  mutate((db2) => {
    units.forEach((u) => {
      u.status = "dispatched";
      u.dispatched_at = now;
      const it = db2.inventory_items.find((x) => x.id === u.item_id);
      if (it) it.reserved_qty = Math.max(0, it.reserved_qty - 1);
    });
    proj.equipment_status = "dispatched";
  });
  logActivity("equipment_dispatched", `${units.length} equipment units dispatched for ${proj.number}`, "project", projectId, proj.customer_id, projectId);
}

export function markUnitInstalled(unitId: string) {
  const db = getDb();
  const u = db.equipment_units.find((x) => x.id === unitId);
  assert(u, "Equipment unit not found.");
  assert(["dispatched", "reserved", "in_stock"].includes(u.status), `Unit is ${u.status} and cannot be marked installed.`);
  mutate((db2) => {
    u.status = "installed";
    u.installed_at = new Date().toISOString();
  });
}

// ============================ CREWS ============================
export function createCrew(input: Omit<InstallationCrew, "id">) {
  assert(input.name.trim(), "Crew name required.");
  mutate((db) => { db.installation_crews.push({ id: uuid(), ...input }); });
}

export function updateCrew(id: string, patch: Partial<Omit<InstallationCrew, "id">>) {
  const db = getDb();
  const c = db.installation_crews.find((x) => x.id === id);
  assert(c, "Crew not found.");
  mutate((db2) => { Object.assign(c, patch); });
}

// ============================ PROJECTS ============================
export function assignCrew(projectId: string, crewId: string) {
  const db = getDb();
  const proj = db.installation_projects.find((p) => p.id === projectId);
  assert(proj, "Project not found.");
  const crew = db.installation_crews.find((c) => c.id === crewId);
  assert(crew, "Crew not found.");
  mutate((db2) => { proj.crew_id = crewId; });
  if (crew.availability !== "available") {
    // warning surfaced by caller; action still allowed with explicit confirmation
  }
  logActivity("crew_assigned", `${crew.name} assigned to ${proj.number}`, "project", projectId, proj.customer_id, projectId);
}

export function scheduleProject(projectId: string, start: string, end: string) {
  const db = getDb();
  const proj = db.installation_projects.find((p) => p.id === projectId);
  assert(proj, "Project not found.");
  assert(start && end, "Both dates are required.");
  assert(new Date(end) >= new Date(start), "Completion date must be after start date.");
  mutate((db2) => {
    proj.scheduled_start = start;
    proj.scheduled_end = end;
    if (["awaiting_stock", "ready_to_schedule"].includes(proj.status)) proj.status = "scheduled";
  });
  logActivity("installation_scheduled", `${proj.number} scheduled ${start} → ${end}`, "project", projectId, proj.customer_id, projectId);
}

export function setProjectStatus(projectId: string, status: InstallationProject["status"]) {
  const db = getDb();
  const proj = db.installation_projects.find((p) => p.id === projectId);
  assert(proj, "Project not found.");
  mutate((db2) => { proj.status = status; });
  const msg: Record<string, string> = {
    in_progress: "Installation started",
    quality_inspection: "Quality inspection started",
    cancelled: "Project cancelled",
    ready_to_schedule: "Project ready to schedule",
  };
  if (msg[status]) logActivity(msg[status], msg[status] + ` — ${proj.number}`, "project", projectId, proj.customer_id, projectId);
}

export function completeChecklistItem(itemId: string, by: string, note = "") {
  const db = getDb();
  const it = db.checklist_items.find((x) => x.id === itemId);
  assert(it, "Checklist item not found.");
  mutate((db2) => {
    it.completed = true;
    it.completed_by = by || "Installation Team";
    it.completed_at = new Date().toISOString();
    if (note) it.notes = note;
  });
  const proj = db.installation_projects.find((p) => p.id === it.project_id);
  if (proj) {
    const all = db.checklist_items.filter((x) => x.project_id === proj.id);
    const done = all.filter((x) => x.completed).length;
    logActivity("checklist_item_completed", `Checklist ${done}/${all.length} — ${proj.number}`, "project", proj.id, proj.customer_id, proj.id);
  }
}

export function uncheckChecklistItem(itemId: string) {
  const db = getDb();
  const it = db.checklist_items.find((x) => x.id === itemId);
  assert(it, "Checklist item not found.");
  mutate(() => {
    it.completed = false;
    it.completed_by = "";
    it.completed_at = null;
  });
}

export function addInstallationPhoto(projectId: string, caption: string, data_url: string, uploaded_by = "Installation Team") {
  assert(data_url.startsWith("data:image"), "Photo must be an image.");
  const db = getDb();
  mutate((db2) => {
    db2.installation_photos.push({
      id: uuid(), project_id: projectId, caption: caption || "Installation photo",
      data_url, uploaded_by, uploaded_at: new Date().toISOString(),
    });
  });
}

export function removeInstallationPhoto(photoId: string) {
  mutate((db) => { db.installation_photos = db.installation_photos.filter((p) => p.id !== photoId); });
}

export function recordAcceptance(projectId: string, customer_name: string, signature_data: string | null) {
  const db = getDb();
  const proj = db.installation_projects.find((p) => p.id === projectId);
  assert(proj, "Project not found.");
  assert(customer_name.trim(), "Customer name is required.");
  const existing = db.customer_acceptances.find((a) => a.project_id === projectId);
  assert(!existing || !existing.customer_name, "Acceptance already recorded for this project."); // never overwrite a recorded acceptance silently
  mutate((db2) => {
    if (existing) existing.customer_name = customer_name; else
      db2.customer_acceptances.push({
        id: uuid(), project_id: projectId, customer_name, accepted_at: new Date().toISOString(),
        signature_data,
      });
    proj.accepted_at = new Date().toISOString();
  });
  logActivity("installation_accepted", `Customer acceptance recorded — ${proj.number} (typed name stored; not a verified digital signature)`, "project", projectId, proj.customer_id, projectId);
}

export interface ProjectCompletionCheck {
  ok: boolean;
  blockers: string[];
}

export function checkProjectComplete(projectId: string): ProjectCompletionCheck {
  const db = getDb();
  const items = db.checklist_items.filter((x) => x.project_id === projectId);
  const blockers: string[] = [];
  if (items.length === 0) blockers.push("No checklist items exist for this project.");
  const pending = items.filter((x) => !x.completed);
  if (pending.length > 0) blockers.push(`${pending.length} checklist item(s) incomplete: ${pending.map((p) => p.description).slice(0, 3).join(", ")}${pending.length > 3 ? "…" : ""}`);
  const acc = db.customer_acceptances.find((a) => a.project_id === projectId);
  if (!acc) blockers.push("Customer acceptance not recorded.");
  return { ok: blockers.length === 0, blockers };
}

export function completeProject(projectId: string): ProjectCompletionCheck {
  const check = checkProjectComplete(projectId);
  assert(check.ok, check.blockers.join(" "));
  const db = getDb();
  const proj = db.installation_projects.find((p) => p.id === projectId);
  assert(proj, "Project not found.");
  mutate((db2) => {
    proj.status = "completed";
    proj.actual_completion = todayISO();
  });
  logActivity("installation_completed", `Installation completed — ${proj.number}`, "project", projectId, proj.customer_id, projectId);
  return check;
}

// ==================== WARRANTIES ====================
export function activateWarranties(projectId: string): { created: number; message: string } {
  const db = getDb();
  const proj = db.installation_projects.find((p) => p.id === projectId);
  assert(proj, "Project not found.");
  assert(proj.status === "completed", "Warranties can be activated only after installation is completed.");
  const installed = db.equipment_units.filter((u) => u.project_id === projectId && u.status === "installed");
  if (installed.length === 0) {
    return { created: 0, message: "No installed serial-numbered equipment for this project." };
  }
  let created = 0;
  const startISO = proj.actual_completion || todayISO();
  mutate((db2) => {
    // group by inventory item
    const byItem = new Map<string, EquipmentUnit[]>();
    installed.forEach((u) => {
      const arr = byItem.get(u.item_id) ?? [];
      arr.push(u);
      byItem.set(u.item_id, arr);
    });
    byItem.forEach((units, itemId) => {
      const item = db2.inventory_items.find((x) => x.id === itemId);
      const months = item?.warranty_months ?? 12;
      // idempotent: skip if a warranty already exists for this project + product
      const already = db2.warranties.some(
        (w) => w.project_id === projectId && w.product_name === `${item?.name} (${units.length} units)`,
      );
      if (already) return;
      const wStart = new Date(startISO);
      const w = {
        id: uuid(),
        code: nextNumber("WRT", db2.warranties.map((x) => x.code)),
        customer_id: proj.customer_id, project_id: projectId,
        equipment_unit_id: units[0].id,
        product_name: `${item?.name ?? "Equipment"} (${units.length} units)`,
        serial_number: units.length === 1 ? units[0].serial_number : `${units[0].serial_number} … +${units.length - 1} more`,
        warranty_type: item?.category === "solar_panel" ? "Product — Panels" : item?.category === "inverter" ? "Product — Inverter" : item?.category === "battery" ? "Product — Battery" : "Product",
        ...(() => {
          const dts = computeWarrantyDates(wStart.toISOString().slice(0, 10), months);
          return { start_date: dts.start_date, end_date: dts.end_date };
        })(),
        duration_months: months,
        terms: "Manufacturer product warranty registered against serial numbers tracked by SunPower. Application-generated certificate — SunPower Solutions is not the manufacturer.",
        status: "active" as const,
        created_at: new Date().toISOString(),
      };
      db2.warranties.unshift(w);
      created++;
    });
  });
  if (created > 0) {
    logActivity("warranty_activated", `${created} warranty record(s) activated for ${proj.number}`, "warranty", null, proj.customer_id, projectId);
  }
  return {
    created,
    message: created === 0 ? "Warranties were already activated for this project (duplicate prevention)." : `${created} warranty record(s) activated.`,
  };
}

// ==================== SERVICE CENTER ====================
export interface TicketInput {
  customer_id: string; project_id: string | null; equipment_unit_id: string | null;
  serial_number: string; issue_category: string; description: string;
  priority: ServiceTicket["priority"]; assigned_technician?: string; appointment_time?: string | null;
  created_by?: string; assignment_status?: ServiceTicket["assignment_status"];
}

export function createTicket(input: TicketInput): ServiceTicket {
  const db = getDb();
  const cust = db.customers.find((c) => c.id === input.customer_id);
  assert(cust, "Select a valid customer.");
  assert(input.description.trim().length >= 10, "Describe the issue in at least 10 characters.");
  const now = new Date().toISOString();
  const t: ServiceTicket = {
    id: uuid(), number: nextNumber("SRV", db.service_tickets.map((x) => x.number)),
    customer_id: cust.id, project_id: input.project_id,
    equipment_unit_id: input.equipment_unit_id, serial_number: input.serial_number,
    issue_category: input.issue_category, description: input.description.trim(),
    priority: input.priority,
    status: input.assigned_technician ? "assigned" : "open",
    assigned_technician: input.assigned_technician ?? "",
    assignment_status: input.assigned_technician ? "awaiting_confirmation" : (input.assignment_status ?? null),
    appointment_time: input.appointment_time ?? null,
    resolution_notes: "", estimated_cost: 0, actual_cost: 0, resolution_date: null,
    created_by: input.created_by ?? "Service Technician",
    created_at: now, updated_at: now,
  };
  mutate((db2) => { db2.service_tickets.unshift(t); });
  logActivity("service_ticket_opened", `Ticket ${t.number} opened (${t.issue_category})${input.created_by?.includes("Portal") ? " via customer portal" : ""}`, "ticket", t.id, cust.id, t.project_id);
  return t;
}

export function updateTicket(id: string, patch: Partial<Omit<ServiceTicket, "id" | "number" | "created_at">>) {
  const db = getDb();
  const t = db.service_tickets.find((x) => x.id === id);
  assert(t, "Ticket not found.");
  mutate((db2) => {
    Object.assign(t, patch, { updated_at: new Date().toISOString() });
    if (patch.status === "resolved" && !t.resolution_date) t.resolution_date = new Date().toISOString().slice(0, 10);
  });
}

export function assignTicketTechnician(id: string, technician: string) {
  updateTicket(id, { assigned_technician: technician, status: "assigned", assignment_status: "awaiting_confirmation" });
  logActivity("ticket_assigned", `Ticket assigned to ${technician}`, "ticket", id);
}

/**
 * Manager directly assigns staff to a customer service ticket.
 * Directly assigns staff without sending any confirmation/acceptance request to staff.
 */
export function directAssignTicketStaff(id: string, staffName: string, appointmentTime?: string | null) {
  const db = getDb();
  const t = db.service_tickets.find((x) => x.id === id);
  assert(t, "Ticket not found.");
  assert(staffName.trim(), "Select a staff member to assign.");
  mutate((db2) => {
    t.assigned_technician = staffName.trim();
    t.status = "assigned";
    t.assignment_status = "assigned";
    if (appointmentTime) t.appointment_time = appointmentTime;
    t.updated_at = new Date().toISOString();
  });
  logActivity("ticket_assigned", `Manager directly assigned ticket ${t.number} to staff member ${staffName.trim()}`, "ticket", id, t.customer_id, t.project_id);
}

export function ticketConfirmAssignment(id: string, accept: boolean) {
  const db = getDb();
  const t = db.service_tickets.find((x) => x.id === id);
  assert(t, "Ticket not found.");
  mutate((db2) => {
    t.assignment_status = accept ? "confirmed" : "cancelled";
    t.status = accept ? "assigned" : "open";
    if (!accept) t.assigned_technician = "";
    t.updated_at = new Date().toISOString();
  });
}

export function resolveTicket(id: string, resolution_notes: string, actual_cost: number) {
  const db = getDb();
  const t = db.service_tickets.find((x) => x.id === id);
  assert(t, "Ticket not found.");
  assert(resolution_notes.trim().length >= 5, "Add resolution notes (min 5 characters).");
  mutate((db2) => {
    t.resolution_notes = resolution_notes;
    t.actual_cost = actual_cost;
    t.status = "resolved";
    t.resolution_date = todayISO();
    t.updated_at = new Date().toISOString();
    if (t.assignment_status === "confirmed") t.assignment_status = "completed";
  });
  logActivity("service_ticket_resolved", `Ticket ${t.number} resolved`, "ticket", id, t.customer_id, t.project_id);
}

export function addTicketNote(ticketId: string, note: string, author = "Staff") {
  assert(note.trim(), "Note cannot be empty.");
  mutate((db) => {
    db.service_ticket_notes.unshift({ id: uuid(), ticket_id: ticketId, note: note.trim(), author, created_at: new Date().toISOString() });
  });
}

// ==================== FINANCE ====================
export function recordPayment(input: {
  customer_id: string; project_id: string | null; quotation_id: string | null;
  amount: number; payment_date: string | null; method: string; txn_ref: string;
  stage: Payment["stage"]; status: Payment["status"]; notes: string;
}) {
  const db = getDb();
  assert(Number(input.amount) > 0, "Amount must be greater than zero.");
  // idempotency: same project + amount + txn_ref(non-empty) must not duplicate
  if (input.txn_ref.trim()) {
    const dup = db.payments.find(
      (p) => p.txn_ref === input.txn_ref.trim() && p.project_id === input.project_id && p.amount === Number(input.amount),
    );
    assert(!dup, `A payment with reference ${input.txn_ref} is already recorded (duplicate prevention).`);
  }
  const now = new Date().toISOString();
  const pay: Payment = {
    id: uuid(), number: nextNumber("PAY", db.payments.map((x) => x.number)),
    customer_id: input.customer_id, project_id: input.project_id, quotation_id: input.quotation_id,
    amount: Number(input.amount),
    payment_date: input.status === "paid" ? (input.payment_date || todayISO()) : input.payment_date,
    method: input.method, txn_ref: input.txn_ref.trim(), stage: input.stage,
    status: input.status, notes: input.notes, created_at: now,
  };
  mutate((db2) => { db2.payments.unshift(pay); });
  logActivity("payment_recorded", `${input.status === "paid" ? "Payment" : "Payment request"} recorded — ₹${input.amount.toLocaleString("en-IN")}`, "payment", pay.id, input.customer_id, input.project_id);
  return pay;
}

export function updatePaymentStatus(paymentId: string, status: Payment["status"]) {
  const db = getDb();
  const p = db.payments.find((x) => x.id === paymentId);
  assert(p, "Payment not found.");
  mutate((db2) => {
    p.status = status;
    if (status === "paid" && !p.payment_date) p.payment_date = todayISO();
  });
  if (status === "paid") {
    logActivity("payment_recorded", `Payment ${p.number} marked paid — ₹${p.amount.toLocaleString("en-IN")}`, "payment", p.id, p.customer_id, p.project_id);
  }
}

export function deletePayment(paymentId: string) {
  mutate((db) => { db.payments = db.payments.filter((p) => p.id !== paymentId); });
}

export function addExpense(input: {
  project_id: string; category: string; amount: number; expense_date: string;
  vendor: string; notes: string;
}) {
  const db = getDb();
  const proj = db.installation_projects.find((p) => p.id === input.project_id);
  assert(proj, "Project not found.");
  assert(Number(input.amount) > 0, "Amount must be greater than zero.");
  const e: ProjectExpense = { id: uuid(), ...input, amount: Number(input.amount), created_at: new Date().toISOString() };
  mutate((db2) => {
    db2.project_expenses.push(e);
    if (proj.status !== "cancelled") proj.actual_cost += 0; // actual cost derived from expenses live
  });
  return e;
}

export function deleteExpense(expenseId: string) {
  mutate((db) => { db.project_expenses = db.project_expenses.filter((e) => e.id !== expenseId); });
}

// ==================== SUBSIDIES ====================
export function saveSubsidy(input: {
  id?: string; customer_id: string; project_id: string | null; program_name: string;
  estimated_amount: number; requested_amount: number; application_ref: string;
  application_date: string | null; status: SubsidyApplication["status"];
  approval_date: string | null; approved_amount: number; received_amount: number; notes: string;
}) {
  const db = getDb();
  assert(input.customer_id, "Select a customer.");
  if (input.id) {
    const s = db.subsidy_applications.find((x) => x.id === input.id);
    assert(s, "Subsidy application not found.");
    mutate((db2) => { Object.assign(s, input); });
    return s;
  }
  const s: SubsidyApplication = { id: uuid(), ...input, created_at: new Date().toISOString() };
  mutate((db2) => { db2.subsidy_applications.unshift(s); });
  return s;
}

// ==================== TECHNICIANS ====================
export function updateWarrantyStatus(warrantyId: string, status: import("@/types").WarrantyStatus) {
  const db = getDb();
  const w = db.warranties.find((x) => x.id === warrantyId);
  assert(w, "Warranty not found.");
  mutate(() => { w.status = status; });
  logActivity("warranty_status_changed", `${w.code} status → ${status}`, "warranty", warrantyId, w.customer_id, w.project_id);
}

export function updateTechnician(id: string, patch: Partial<Omit<TechnicianProfile, "id">>) {
  const db = getDb();
  const t = db.technicians.find((x) => x.id === id);
  assert(t, "Technician profile not found.");
  mutate(() => { Object.assign(t, patch); });
}

/**
 * Manager adds a new staff member with email and password login credentials
 */
export function createTechnician(input: {
  name: string;
  email?: string;
  password?: string;
  phone: string;
  specializations: string[];
  experience_years?: number;
  location_name: string;
  lat: number;
  lng: number;
  service_areas?: string[];
  working_hours?: string;
  availability?: TechnicianProfile["availability"];
  rating?: number;
}): TechnicianProfile {
  const db = getDb();
  assert(input.name.trim().length >= 2, "Staff member name must be at least 2 characters.");
  assert(input.phone.trim().length >= 7, "Valid contact phone number is required.");
  assert(input.location_name.trim(), "Base location name is required.");

  const emailNorm = input.email?.trim().toLowerCase() || `${input.name.trim().toLowerCase().replace(/\s+/g, ".")}@solarops.com`;
  const pwd = input.password?.trim() || "demo1234";

  // Register user account in auth system so staff can immediately log in from home page
  try {
    registerStaffAccount({
      name: input.name.trim(),
      email: emailNorm,
      password: pwd,
      phone: input.phone.trim(),
      city: input.location_name.trim(),
    });
  } catch (err: any) {
    console.warn("Staff account registration note:", err.message);
  }

  const colors = ["#15803d", "#0e7490", "#a21caf", "#b45309", "#1d4ed8", "#047857"];
  const photo_color = colors[db.technicians.length % colors.length];

  const newTech: TechnicianProfile = {
    id: "tech-" + Date.now().toString().slice(-5),
    name: input.name.trim(),
    email: emailNorm,
    photo_color,
    phone: input.phone.trim(),
    specializations: input.specializations?.length ? input.specializations : ["Inverter Specialist", "Solar PV Rooftop"],
    experience_years: Number(input.experience_years) || 3,
    location_name: input.location_name.trim(),
    lat: Number(input.lat) || 17.385,
    lng: Number(input.lng) || 78.4867,
    service_areas: input.service_areas?.length ? input.service_areas : [input.location_name.trim()],
    max_radius_km: 25,
    working_hours: input.working_hours || "Mon–Sat 9:00–18:00",
    availability: input.availability || "available",
    rating: input.rating || 4.8,
    completed_jobs: 0,
    is_demo: true,
    is_active: true,
  };

  mutate((db2) => {
    db2.technicians.push(newTech);
  });
  logActivity("staff_added", `Manager added staff member: ${newTech.name} (${newTech.email})`, "technician", newTech.id);
  return newTech;
}

/**
 * Manager removes a staff member
 */
export function deleteTechnician(id: string): void {
  const db = getDb();
  const tech = db.technicians.find((t) => t.id === id);
  assert(tech, "Staff member not found.");
  mutate((db2) => {
    db2.technicians = db2.technicians.filter((t) => t.id !== id);
    // Unassign open tickets and return to manager queue
    db2.service_tickets.forEach((t) => {
      if (t.assigned_technician === tech.name && ["open", "assigned"].includes(t.status)) {
        t.assigned_technician = "";
        t.status = "open";
        t.assignment_status = "awaiting_manager";
      }
    });
  });
  logActivity("staff_removed", `Manager removed staff member: ${tech.name}`, "technician", id);
}

/**
 * Manager updates the geographical location of a staff member
 */
export function updateTechnicianLocation(id: string, lat: number, lng: number, location_name?: string): void {
  const db = getDb();
  const tech = db.technicians.find((t) => t.id === id);
  assert(tech, "Staff member not found.");
  assert(!isNaN(lat) && !isNaN(lng), "Invalid latitude/longitude coordinates.");
  mutate(() => {
    tech.lat = Number(lat);
    tech.lng = Number(lng);
    if (location_name?.trim()) tech.location_name = location_name.trim();
  });
  logActivity("staff_location_updated", `Manager updated location for ${tech.name} → ${location_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`}`, "technician", id);
}

// ==================== SETTINGS ====================
export function updateSettings(patch: Partial<DemoDB["settings"]>) {
  mutate((db) => { Object.assign(db.settings, patch); });
}

// ==================== misc lookups used by UI ====================
export function getCustomerName(db: DemoDB, id: string) {
  return db.customers.find((c) => c.id === id)?.full_name ?? "Unknown customer";
}

export function requestServiceAssignment(input: {
  customer_id: string; project_id: string | null; equipment_unit_id: string | null;
  serial_number: string; description: string; issue_category: string;
  technician_id: string; appointment_time: string; technician_name: string;
}): ServiceTicket {
  const db = getDb();
  const tech = db.technicians.find((t) => t.id === input.technician_id);
  assert(tech, "Technician not available.");
  assert(tech.is_active, "Technician is not accepting requests.");
  const ticket = createTicket({
    customer_id: input.customer_id, project_id: input.project_id,
    equipment_unit_id: input.equipment_unit_id, serial_number: input.serial_number,
    issue_category: input.issue_category, description: input.description,
    priority: "medium",
    assigned_technician: tech.name,
    appointment_time: input.appointment_time || null,
    created_by: "Customer Portal (demo)",
  });
  // mark as requested via locator
  mutate((db2) => {
    const t = db2.service_tickets.find((x) => x.id === ticket.id);
    if (t) t.assignment_status = "requested";
  });
  return ticket;
}
