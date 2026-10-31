// ============================================================
// Demo database — seeded, persisted in localStorage. Data is
// fictional and clearly labeled as demo data in the UI.
// ============================================================
import type {
  ActivityLog, ChecklistItem, Customer, CustomerAcceptance, CustomerNote, EquipmentUnit,
  InstallationCrew, InstallationPhoto, InstallationProject, InventoryItem, InventoryTransaction,
  Payment, ProjectExpense, Quotation, ServiceTicket, ServiceTicketNote,
  SiteSurvey, SolarPackage, SubsidyApplication, TechnicianProfile, Warranty,
} from "@/types";
import { computeQuotationTotals } from "@/lib/calculations/finance";
import { addMonths } from "@/lib/utils";
import type { DemoDB, DemoSettings } from "./settings";

function iso(daysFromToday: number) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  return d.toISOString();
}
function isoDate(daysFromToday: number) {
  return iso(daysFromToday).slice(0, 10);
}

function svgPhoto(title: string, color: string) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='640' height='420'><rect width='640' height='420' fill='${color}'/><rect x='80' y='100' width='480' height='230' rx='8' fill='#0f172a' opacity='0.85'/><g stroke='#ffffff' stroke-width='3' fill='none' opacity='0.85'><rect x='100' y='120' width='216' height='160'/><line x1='208' y1='120' x2='208' y2='280'/><line x1='100' y1='200' x2='316' y2='200'/><rect x='340' y='120' width='216' height='160'/><line x1='448' y1='120' x2='448' y2='280'/><line x1='340' y1='200' x2='556' y2='200'/></g><text x='320' y='375' font-family='sans-serif' font-size='22' fill='white' text-anchor='middle'>${title}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function buildSeedDB(): { db: DemoDB; activity: number } {
  const activity_logs: ActivityLog[] = [];
  let seq = 0;
  const addActivity = (
    days: number, type: string, message: string, entity_type: string,
    entity_id: string | null, customer_id: string | null = null, project_id: string | null = null,
  ) => {
    activity_logs.push({
      id: `act-${String(++seq).padStart(3, "0")}`, type, message, entity_type,
      entity_id, customer_id, project_id, created_at: iso(-days),
    });
  };

  // ----- Customers -----
  const mk = (
    id: string, n: number, full_name: string, phone: string, email: string, city_: string,
    type: Customer["customer_type"], lead: Customer["lead_status"], source: string, days: number,
    monthly_units: number, monthly_bill: number, assigned: string,
  ): Customer => ({
    id, code: `CUST-${String(n).padStart(4, "0")}`, full_name, phone, email,
    address: `${full_name.split(" ")[0]}, ${city_}`, city: city_, state: "Telangana",
    postal_code: `5000${10 + n}`, customer_type: type, monthly_units, monthly_bill,
    lead_source: source, assigned_to: assigned, notes: "", lead_status: lead,
    created_at: iso(days), updated_at: iso(days),
  });

  const customers: Customer[] = [
    mk("cust-01", 1, "Ramesh Gupta", "+91 90001 11223", "ramesh.gupta@example.com", "Banjara Hills", "residential", "won", "Referral", 45, 360, 2880, "Sales Executive — Alicia Dsouza"),
    mk("cust-02", 2, "Sunita Reddy", "+91 90001 22334", "sunita.reddy@example.com", "Kukatpally", "residential", "won", "Google Ads", 80, 240, 1920, "Sales Executive — Alicia Dsouza"),
    mk("cust-03", 3, "Mohammed Irfan", "+91 90001 33445", "irfan.m@example.com", "Gachibowli", "residential", "won", "Website", 12, 520, 4160, "Sales Executive — Rahul Menon"),
    mk("cust-04", 4, "Kavya Nair", "+91 90001 44556", "kavya.nair@example.com", "Madhapur", "residential", "survey_scheduled", "Exhibition", 6, 300, 2400, "Sales Executive — Rahul Menon"),
    mk("cust-05", 5, "Rajesh Kumar Sharma", "+91 90001 55667", "rajesh.sharma@example.com", "Hitec City (Office)", "commercial", "negotiation", "Cold Call", 20, 2400, 19200, "Sales Executive — Alicia Dsouza"),
    mk("cust-06", 6, "Priya Desai", "+91 90001 66778", "priya.desai@example.com", "Manikonda", "residential", "new", "Social Media", 2, 180, 1440, "Sales Executive — Rahul Menon"),
    mk("cust-07", 7, "Anil Verma", "+91 90001 77889", "anil.verma@example.com", "Jubilee Hills", "commercial", "won", "Referral", 25, 900, 7200, "Sales Executive — Alicia Dsouza"),
    mk("cust-08", 8, "Lakshmi Prasanna", "+91 90001 88990", "lakshmi.p@example.com", "Amberpet", "residential", "quotation_sent", "Walk-in", 9, 200, 1600, "Sales Executive — Rahul Menon"),
    mk("cust-09", 9, "Farhan Ali", "+91 90001 99001", "farhan.ali@example.com", "Tolichowki", "residential", "contacted", "Website", 5, 150, 1200, "Sales Executive — Alicia Dsouza"),
    mk("cust-10", 10, "Venkat Rao Textiles", "+91 90001 10112", "venkat@venkatra@example.com", "Uppal", "commercial", "survey_scheduled", "Referral", 7, 1800, 14400, "Sales Executive — Rahul Menon"),
    mk("cust-11", 11, "Geetha Krishnan", "+91 90001 11223", "geetha.k@example.com", "Sainikpuri", "residential", "new", "Google Ads", 1, 220, 1760, "Sales Executive — Rahul Menon"),
    mk("cust-12", 12, "Sudheer Babu", "+91 90001 12324", "sudheer.babu@example.com", "LB Nagar", "residential", "lost", "Exhibition", 35, 260, 2080, "Sales Executive — Alicia Dsouza"),
  ];

  // ----- Packages (demo prices; editable by admins) -----
  const pkg = (
    id: string, name: string, kw: number, type: SolarPackage["system_type"], eq: number,
    inst: number, addl: number, tax: number, desc: string, battery = "",
  ): SolarPackage => ({
    id, name, capacity_kw: kw, system_type: type, panel_wattage: 550,
    panel_count: Math.max(2, Math.round((kw * 1000) / 550)),
    inverter_spec: type === "on_grid" ? `${kw} kW On-grid string inverter, MPPT, Wi-Fi monitoring` : `${kw} kW Off-grid inverter with MPPT charge controller`,
    battery_spec: battery || "—", equipment_cost: eq, installation_cost: inst,
    additional_cost: addl, tax_percent: tax, description: desc, is_active: true,
  });

  const solar_packages: SolarPackage[] = [
    pkg("pkg-1kw-ong", "SunStart 1 kW On-Grid", 1, "on_grid", 62000, 12000, 2000, 12, "Entry-level rooftop system for small homes. (Demo price — editable)"),
    pkg("pkg-2kw-ong", "SunHome 2 kW On-Grid", 2, "on_grid", 118000, 18000, 3500, 12, "Popular residential system for 2-3 BHK. (Demo price — editable)"),
    pkg("pkg-3kw-ong", "SunHome Plus 3 kW On-Grid", 3, "on_grid", 172000, 22000, 5000, 12, "For medium homes with 300-450 units/month. (Demo price — editable)"),
    pkg("pkg-5kw-ong", "SunMax 5 kW On-Grid", 5, "on_grid", 278000, 30000, 8000, 12, "Large homes & light commercial rooftops. (Demo price — editable)"),
    pkg("pkg-2kw-off", "SunOffice 2 kW Off-Grid", 2, "off_grid", 156000, 20000, 4000, 12, "Backup-focused system with lithium battery. (Demo price — editable)", "2.5 kWh LiFePO4 battery with 5-year warranty"),
    pkg("pkg-5kw-off", "SunFactory 5 kW Off-Grid", 5, "off_grid", 396000, 34000, 9000, 12, "Frequent power-cut areas; full-day backup. (Demo price — editable)", "7.5 kWh LiFePO4 battery with 5-year warranty"),
  ];

  // ----- Surveys -----
  const surveys: SiteSurvey[] = [
    { id: "survey-01", code: "SRV-2026-0001", customer_id: "cust-01", survey_date: isoDate(-40), surveyor: "Kiran Babu (Surveyor)", property_type: "Independent house", roof_type: "RCC concrete", roof_area_sqm: 90, installable_area_sqm: 26, shading: "Minimal (some morning shadow)", monthly_units: 360, monthly_bill: 2880, required_capacity_kw: 3, grid_available: true, recommended_system_type: "on_grid", constraints: "South-facing roof, good sun", notes: "Customer wants fast ROI.", status: "completed", photo_urls: [svgPhoto("Roof view — south face", "#e2e8f0"), svgPhoto("Shadow pattern at 10 AM", "#dbeafe")], created_at: iso(-45) },
    { id: "survey-02", code: "SRV-2026-0002", customer_id: "cust-02", survey_date: isoDate(-78), surveyor: "Kiran Babu (Surveyor)", property_type: "Independent house", roof_type: "Sheet roof", roof_area_sqm: 70, installable_area_sqm: 18, shading: "Moderate afternoon", monthly_units: 240, monthly_bill: 1920, required_capacity_kw: 2, grid_available: true, recommended_system_type: "on_grid", constraints: "Elevated structure recommended", notes: "Sheet roof needs structural check.", status: "completed", photo_urls: [svgPhoto("Sheet roof structure", "#e2e8f0")], created_at: iso(-80) },
    { id: "survey-03", code: "SRV-2026-0003", customer_id: "cust-03", survey_date: isoDate(-9), surveyor: "Deepak Rao (Surveyor)", property_type: "Independent house", roof_type: "RCC concrete", roof_area_sqm: 130, installable_area_sqm: 30, shading: "None", monthly_units: 520, monthly_bill: 4160, required_capacity_kw: 4, grid_available: true, recommended_system_type: "on_grid", constraints: "", notes: "Rooftop is clean, ideal placement.", status: "completed", photo_urls: [svgPhoto("Clean RCC roof", "#e2e8f0")], created_at: iso(-14) },
    { id: "survey-04", code: "SRV-2026-0004", customer_id: "cust-07", survey_date: isoDate(-18), surveyor: "Deepak Rao (Surveyor)", property_type: "Clinic building", roof_type: "RCC concrete", roof_area_sqm: 160, installable_area_sqm: 42, shading: "Low", monthly_units: 900, monthly_bill: 7200, required_capacity_kw: 5, grid_available: true, recommended_system_type: "on_grid", constraints: "Daytime-heavy load, good for solar", notes: "Commercial meter existing.", status: "completed", photo_urls: [], created_at: iso(-24) },
    { id: "survey-05", code: "SRV-2026-0005", customer_id: "cust-04", survey_date: isoDate(3), surveyor: "Kiran Babu (Surveyor)", property_type: "Apartment (own rooftop rights)", roof_type: "RCC concrete", roof_area_sqm: 60, installable_area_sqm: 0, shading: "Unknown", monthly_units: 300, monthly_bill: 2400, required_capacity_kw: 3, grid_available: true, recommended_system_type: "on_grid", constraints: "", notes: "Waiting for society approval.", status: "scheduled", photo_urls: [], created_at: iso(-6) },
    { id: "survey-06", code: "SRV-2026-0006", customer_id: "cust-10", survey_date: isoDate(5), surveyor: "Deepak Rao (Surveyor)", property_type: "Industrial shed", roof_type: "Metal sheet", roof_area_sqm: 800, installable_area_sqm: 0, shading: "TBD", monthly_units: 1800, monthly_bill: 14400, required_capacity_kw: 5, grid_available: true, recommended_system_type: "on_grid", constraints: "Load-bearing check needed", notes: "First visit for assessment.", status: "scheduled", photo_urls: [], created_at: iso(-7) },
  ];

  // ----- Quotations -----
  const mkQuotation = (
    n: string, customer_id: string, survey_id: string | null, p: SolarPackage,
    additional_items: { description: string; amount: number }[], discount: number,
    subsidy_estimate: number, valid_until: string, status: Quotation["status"], days: number,
  ): Quotation => {
    const t = computeQuotationTotals({
      equipment_cost: p.equipment_cost, installation_cost: p.installation_cost,
      additional_items, tax_percent: p.tax_percent, discount, subsidy_estimate,
    });
    return {
      id: `qt-${n.toLowerCase()}`, number: n, customer_id, survey_id, package_id: p.id,
      package_name: p.name, capacity_kw: p.capacity_kw, system_type: p.system_type,
      panel_wattage: p.panel_wattage, panel_count: p.panel_count, inverter_spec: p.inverter_spec,
      battery_spec: p.battery_spec, equipment_cost: p.equipment_cost,
      installation_cost: p.installation_cost, tax_percent: p.tax_percent,
      additional_items, discount, subsidy_estimate, subtotal: t.subtotal,
      tax_amount: t.tax_amount, total: t.total, valid_until, terms:
        "1. Package prices in this catalogue are demonstration prices and are fully editable by administrators.\n" +
        "2. Subsidy is only an estimate; eligibility and approval are decided exclusively by the government scheme. SunPower Solutions does not guarantee subsidy approval.\n" +
        "3. 50% booking advance required to confirm the order.\n" +
        "4. Net metering application and approvals are subject to local DISCOM rules.\n" +
        "5. Warranty as per manufacturer terms on registered serial-numbered equipment.",
      status, created_at: iso(days), updated_at: iso(days),
    };
  };

  const quotations: Quotation[] = [
    mkQuotation("QT-2026-0001", "cust-01", "survey-01", solar_packages[2], [{ description: "Elevated structure for terrace access", amount: 4500 }], 3000, 39000, isoDate(30), "accepted", -38),
    mkQuotation("QT-2026-0002", "cust-02", "survey-02", solar_packages[1], [{ description: "Elevated structure (sheet roof)", amount: 6000 }], 2000, 36000, isoDate(30), "accepted", -74),
    mkQuotation("QT-2026-0003", "cust-03", "survey-03", solar_packages[3], [], 8000, 78000, isoDate(25), "accepted", -7),
    mkQuotation("QT-2026-0004", "cust-07", "survey-04", solar_packages[3], [{ description: "Industrial-grade AC DB upgrade", amount: 7500 }], 10000, 0, isoDate(20), "accepted", -14),
    mkQuotation("QT-2026-0005", "cust-08", null, solar_packages[1], [], 0, 36000, isoDate(18), "sent", -3),
    mkQuotation("QT-2026-0006", "cust-05", null, solar_packages[3], [{ description: "HT panel modification support", amount: 15000 }], 12000, 0, isoDate(15), "sent", -2),
    mkQuotation("QT-2026-0007", "cust-12", null, solar_packages[1], [], 0, 36000, isoDate(-20), "rejected", -30),
    mkQuotation("QT-2026-0008", "cust-10", "survey-06", solar_packages[3], [], 0, 0, isoDate(15), "draft", 0),
  ];

  // ----- Inventory -----
  const inv_items: InventoryItem[] = [
    { id: "inv-p500", sku: "SP-PNL-500", name: "Solar Panel 500W Mono PERC", category: "solar_panel", manufacturer: "Waaree", model: "WS-500", unit: "units", purchase_cost: 9800, selling_price: 11000, available_qty: 14, reserved_qty: 0, reorder_level: 5, supplier: "Waaree Solar (North)", warranty_months: 300, is_active: true },
    { id: "inv-inv5", sku: "SP-INV-5KW", name: "On-Grid Inverter 5 kW", category: "inverter", manufacturer: "Delta", model: "D5-STR", unit: "units", purchase_cost: 42000, selling_price: 48000, available_qty: 1, reserved_qty: 0, reorder_level: 1, supplier: "Delta Electronics (IN)", warranty_months: 60, is_active: true },
    { id: "inv-inv3", sku: "SP-INV-3KW", name: "On-Grid Inverter 3 kW", category: "inverter", manufacturer: "Delta", model: "D3-STR", unit: "units", purchase_cost: 31000, selling_price: 35000, available_qty: 1, reserved_qty: 0, reorder_level: 2, supplier: "Delta Electronics (IN)", warranty_months: 60, is_active: true },
    { id: "inv-bat", sku: "SP-BAT-2.5", name: "LiFePO4 Battery 2.5 kWh", category: "battery", manufacturer: "Exgard", model: "EX-2500", unit: "units", purchase_cost: 38000, selling_price: 44000, available_qty: 4, reserved_qty: 0, reorder_level: 2, supplier: "Exgard Energy", warranty_months: 60, is_active: true },
    { id: "inv-mnt", sku: "SP-MNT-RCC", name: "Mounting Structure Set (RCC)", category: "mounting", manufacturer: "SunMount", model: "SM-RCC-STD", unit: "sets", purchase_cost: 6500, selling_price: 7500, available_qty: 9, reserved_qty: 0, reorder_level: 3, supplier: "SunMount Fabricators", warranty_months: 60, is_active: true },
    { id: "inv-cable", sku: "SP-CAB-DC4", name: "DC Solar Cable 4 sqmm (100m roll)", category: "cable", manufacturer: "Polycab", model: "PC-DC4", unit: "rolls", purchase_cost: 3200, selling_price: 3600, available_qty: 7, reserved_qty: 0, reorder_level: 2, supplier: "Polycab Dealer", warranty_months: 12, is_active: true },
    { id: "inv-mc4", sku: "SP-CON-MC4", name: "MC4 Connector Pair", category: "connector", manufacturer: "Staubli", model: "MC4-EVO2", unit: "pairs", purchase_cost: 180, selling_price: 240, available_qty: 60, reserved_qty: 0, reorder_level: 20, supplier: "Staubli (IN)", warranty_months: 12, is_active: true },
    { id: "inv-spd", sku: "SP-PRT-SPD", name: "DC Surge Protection Device", category: "protection", manufacturer: "Schneider", model: "iPRD40", unit: "units", purchase_cost: 2400, selling_price: 2900, available_qty: 5, reserved_qty: 0, reorder_level: 2, supplier: "Schneider Electric", warranty_months: 24, is_active: true },
    { id: "inv-earth", sku: "SP-OTH-EARTH", name: "Earthing Kit (copper rod + chemical)", category: "protection", manufacturer: "Gmax", model: "GM-EK1", unit: "kits", purchase_cost: 2800, selling_price: 3400, available_qty: 8, reserved_qty: 0, reorder_level: 2, supplier: "Gmax Electro", warranty_months: 60, is_active: true },
    { id: "inv-dongle", sku: "SP-OTH-DONGLE", name: "Wi-Fi Monitoring Dongle", category: "other", manufacturer: "Delta", model: "WD-01", unit: "units", purchase_cost: 2200, selling_price: 2600, available_qty: 2, reserved_qty: 0, reorder_level: 2, supplier: "Delta Electronics (IN)", warranty_months: 24, is_active: true },
  ];

  // ----- Projects -----
  const projects: InstallationProject[] = [
    { id: "prj-0001", number: "PRJ-2026-0001", customer_id: "cust-01", quotation_id: "qt-qt-2026-0001", package_name: "SunHome Plus 3 kW On-Grid", capacity_kw: 3, installation_type: "RCC Rooftop (Elevated)", address: "Road No. 12, Banjara Hills, Hyderabad", manager: "Installation Manager — Sunil Khanna", crew_id: "crew-1", scheduled_start: isoDate(-30), scheduled_end: isoDate(-29), actual_completion: isoDate(-24), status: "completed", planned_cost: 174000, actual_cost: 120700, contract_value: quotations[0].total, notes: "Completed on time.", equipment_status: "dispatched", accepted_at: isoDate(-26), created_at: iso(-38) },
    { id: "prj-0002", number: "PRJ-2026-0002", customer_id: "cust-02", quotation_id: "qt-qt-2026-0002", package_name: "SunHome 2 kW On-Grid", capacity_kw: 2, installation_type: "Sheet Roof (Elevated)", address: "Phase 9, Kukatpally, Hyderabad", manager: "Installation Manager — Sunil Khanna", crew_id: "crew-1", scheduled_start: isoDate(-70), scheduled_end: isoDate(-69), actual_completion: isoDate(-62), status: "completed", planned_cost: 121500, actual_cost: 100500, contract_value: quotations[1].total, notes: "Elevated structure took extra day.", equipment_status: "dispatched", accepted_at: isoDate(-66), created_at: iso(-74) },
    { id: "prj-0003", number: "PRJ-2026-0003", customer_id: "cust-07", quotation_id: "qt-qt-2026-0004", package_name: "SunMax 5 kW On-Grid", capacity_kw: 5, installation_type: "Clinic RCC Rooftop", address: "Road No. 36, Jubilee Hills, Hyderabad", manager: "Installation Manager — Sunil Khanna", crew_id: "crew-2", scheduled_start: isoDate(-1), scheduled_end: isoDate(1), actual_completion: null, status: "quality_inspection", planned_cost: 306500, actual_cost: 44300, contract_value: quotations[3].total, notes: "Inspection pending; AC DB upgrade done.", equipment_status: "dispatched", accepted_at: isoDate(-12), created_at: iso(-14) },
    { id: "prj-0004", number: "PRJ-2026-0004", customer_id: "cust-03", quotation_id: "qt-qt-2026-0003", package_name: "SunMax 5 kW On-Grid", capacity_kw: 5, installation_type: "RCC Rooftop (Elevated)", address: "Survey 120, Gachibowli, Hyderabad", manager: "Installation Manager — Sunil Khanna", crew_id: null, scheduled_start: null, scheduled_end: null, actual_completion: null, status: "awaiting_stock", planned_cost: 300000, actual_cost: 0, contract_value: quotations[2].total, notes: "", equipment_status: "pending", accepted_at: isoDate(-5), created_at: iso(-7) },
  ];

  // ----- Equipment units (serial-numbered) -----
  const equipment_units: EquipmentUnit[] = [];
  let sn = 2450;
  const addUnit = (
    item: InventoryItem, status: EquipmentUnit["status"], project_id: string | null,
    dispatched: string | null = null, installed: string | null = null,
  ): EquipmentUnit => {
    const serial = `${item.sku}-${sn++}`;
    const u: EquipmentUnit = {
      id: `eq-${serial.toLowerCase()}`, item_id: item.id, item_name: item.name,
      serial_number: serial, purchase_ref: `PO-2026-0${(sn % 9) + 1}`, status, project_id,
      dispatched_at: dispatched, installed_at: installed, notes: "", created_at: iso(-120),
    };
    equipment_units.push(u);
    return u;
  };
  const prj1Panels = Array.from({ length: 6 }, () => addUnit(inv_items[0], "installed", "prj-0001", isoDate(-31), isoDate(-29)));
  const prj1Inverter = addUnit(inv_items[2], "installed", "prj-0001", isoDate(-31), isoDate(-29));
  const prj2Panels = Array.from({ length: 4 }, () => addUnit(inv_items[0], "installed", "prj-0002", isoDate(-71), isoDate(-69)));
  const prj2Inverter = addUnit(inv_items[1], "installed", "prj-0002", isoDate(-71), isoDate(-69));
  const prj3Panels = Array.from({ length: 10 }, () => addUnit(inv_items[0], "dispatched", "prj-0003", isoDate(-2), null));
  const prj3Inverter = addUnit(inv_items[1], "dispatched", "prj-0003", isoDate(-2), null);
  void prj3Panels; void prj3Inverter;
  for (let i = 0; i < 5; i++) addUnit(inv_items[0], "in_stock", null);
  addUnit(inv_items[2], "in_stock", null);
  addUnit(inv_items[2], "defective", null).notes = "Failed self-test at QC bench; supplier RMA raised.";
  addUnit(inv_items[3], "in_stock", null);
  // reserved counts = dispatched units (on-hand accounting: available excludes them)
  inv_items[0].reserved_qty = equipment_units.filter((u) => u.item_id === inv_items[0].id && u.status === "dispatched").length;
  inv_items[1].reserved_qty = equipment_units.filter((u) => u.item_id === inv_items[1].id && u.status === "dispatched").length;
  inv_items[2].reserved_qty = equipment_units.filter((u) => u.item_id === inv_items[2].id && u.status === "dispatched").length;

  // ----- Inventory transactions -----
  const inventory_transactions: InventoryTransaction[] = [
    { id: "itx-1", item_id: inv_items[0].id, item_name: inv_items[0].name, type: "receipt", qty: 25, reference: "PO-2026-04", note: "Panel batch received", by: "Inventory Manager", created_at: iso(-90) },
    { id: "itx-2", item_id: inv_items[2].id, item_name: inv_items[2].name, type: "receipt", qty: 2, reference: "PO-2026-05", note: "3 kW inverter batch", by: "Inventory Manager", created_at: iso(-85) },
    { id: "itx-3", item_id: inv_items[0].id, item_name: inv_items[0].name, type: "dispatch", qty: equipment_units.filter((u) => u.item_id === inv_items[0].id && u.status === "dispatched").length, reference: "PRJ-2026-0001 / 0002 / 0003", note: "Dispatched to projects", by: "Inventory Manager", created_at: iso(-1) },
    { id: "itx-4", item_id: inv_items[1].id, item_name: inv_items[1].name, type: "dispatch", qty: 1, reference: "PRJ-2026-0003", note: "5 kW inverter", by: "Inventory Manager", created_at: iso(-1) },
  ];

  // ----- Crews -----
  const installation_crews: InstallationCrew[] = [
    { id: "crew-1", name: "Alpha Crew — Hyderabad West", leader: "Prakash Naik", members: ["Prakash Naik", "Srinivas T", "Manoj Y"], phone: "+91 98010 10001", skills: ["RCC roofs", "On-grid", "Elevated structures"], availability: "available" },
    { id: "crew-2", name: "Beta Crew — Commercial", leader: "Iqbal Ahmed", members: ["Iqbal Ahmed", "Ravi K", "Sanjay M", "Teja P"], phone: "+91 98010 20002", skills: ["Commercial", "HT panels", "Metal sheet roofs"], availability: "busy" },
    { id: "crew-3", name: "Gamma Crew — Off-grid & Battery", leader: "Kumar Swamy", members: ["Kumar Swamy", "Devineni R"], phone: "+91 98010 30003", skills: ["Off-grid", "Battery systems"], availability: "available" },
  ];

  // ----- Checklist -----
  const CHECK = [
    "Site preparation completed", "Mounting structure installed", "Solar panels installed",
    "Inverter installed", "Electrical connections inspected", "Earthing checked",
    "Safety inspection completed", "System startup completed", "Customer demonstration completed",
    "Final quality inspection completed",
  ];
  const checklist_items: ChecklistItem[] = [];
  const addChecklist = (project_id: string, doneCount: number) => {
    CHECK.forEach((d, i) => {
      checklist_items.push({
        id: `chk-${project_id}-${i}`, project_id, sequence: i + 1, description: d,
        completed: i < doneCount, completed_by: i < doneCount ? "Prakash Naik (Leader)" : "",
        completed_at: i < doneCount ? iso(-25 + i) : null, notes: "",
      });
    });
  };
  addChecklist("prj-0001", 10);
  addChecklist("prj-0002", 10);
  addChecklist("prj-0003", 8); // final quality inspection pending
  addChecklist("prj-0004", 0);

  // ----- Photos & acceptance -----
  const installation_photos: InstallationPhoto[] = [
    { id: "ph-1", project_id: "prj-0001", caption: "Completed 3 kW array front view", data_url: svgPhoto("3 kW Array — front", "#dcfce7"), uploaded_by: "Prakash Naik", uploaded_at: iso(-28) },
    { id: "ph-2", project_id: "prj-0001", caption: "Inverter + AC DB wiring", data_url: svgPhoto("Inverter wiring", "#d1fae5"), uploaded_by: "Prakash Naik", uploaded_at: iso(-28) },
    { id: "ph-3", project_id: "prj-0002", caption: "Elevated structure on sheet roof", data_url: svgPhoto("Elevated structure", "#d1fae5"), uploaded_by: "Prakash Naik", uploaded_at: iso(-64) },
  ];
  const customer_acceptances: CustomerAcceptance[] = [
    { id: "acc-1", project_id: "prj-0001", customer_name: "Ramesh Gupta", accepted_at: iso(-26), signature_data: null },
    { id: "acc-2", project_id: "prj-0002", customer_name: "Sunita Reddy", accepted_at: iso(-62), signature_data: null },
  ];

  // ----- Warranties -----
  const warranties: Warranty[] = [];
  const addWarranty = (
    code: string, project_id: string, customer_id: string, u: EquipmentUnit | null,
    product_name: string, serial: string, type: string, startISO: string, months: number,
    status: Warranty["status"], terms: string,
  ) => {
    const start = startISO.slice(0, 10);
    const end = addMonths(start, months);
    warranties.push({
      id: `w-${code.toLowerCase()}`, code, customer_id, project_id,
      equipment_unit_id: u ? u.id : null, product_name, serial_number: serial,
      warranty_type: type, start_date: start, end_date: end, duration_months: months,
      terms, status: end < isoDate(0) && status === "active" ? "expired" : status,
      created_at: startISO,
    });
  };
  addWarranty("WRT-2026-0001", "prj-0001", "cust-01", prj1Panels[0], "Solar Panel 500W Mono PERC (6 units)", `${prj1Panels[0].serial_number} … +5 more`, "Product — Panels", isoDate(-29), 300, "active", "Manufacturer product warranty per registered serial. Certificate generated by SolarOps AI application; not a manufacturer registration.");
  addWarranty("WRT-2026-0002", "prj-0001", "cust-01", prj1Inverter, "On-Grid Inverter 3 kW", prj1Inverter.serial_number, "Product — Inverter", isoDate(-29), 60, "active", "Manufacturer product warranty per registered serial. Application-generated certificate.");
  addWarranty("WRT-2026-0003", "prj-0002", "cust-02", prj2Panels[0], "Solar Panel 500W Mono PERC (4 units)", `${prj2Panels[0].serial_number} … +3 more`, "Product — Panels", isoDate(-69), 300, "active", "Manufacturer product warranty per registered serials. Application-generated certificate.");
  addWarranty("WRT-2026-0004", "prj-0002", "cust-02", null, "Workmanship Warranty — Installation", "—", "Workmanship", isoDate(-75), 3, "active", "Installation workmanship covered by SunPower Solutions (demo). Certificate expires within 2 weeks for demo.");

  // ----- Payments -----
  const payments: Payment[] = [
    { id: "pay-1", number: "PAY-2026-0001", customer_id: "cust-01", project_id: "prj-0001", quotation_id: "qt-qt-2026-0001", amount: 78750, payment_date: isoDate(-37), method: "Bank Transfer (NEFT/RTGS)", txn_ref: "NEFT883120", stage: "booking_advance", status: "paid", notes: "50% booking advance", created_at: iso(-37) },
    { id: "pay-2", number: "PAY-2026-0002", customer_id: "cust-01", project_id: "prj-0001", quotation_id: "qt-qt-2026-0001", amount: 78750, payment_date: isoDate(-22), method: "UPI", txn_ref: "UPI4492013", stage: "final", status: "paid", notes: "On completion", created_at: iso(-22) },
    { id: "pay-3", number: "PAY-2026-0003", customer_id: "cust-02", project_id: "prj-0002", quotation_id: "qt-qt-2026-0002", amount: 76275, payment_date: isoDate(-72), method: "Bank Transfer (NEFT/RTGS)", txn_ref: "NEFT223311", stage: "booking_advance", status: "paid", notes: "50% advance", created_at: iso(-72) },
    { id: "pay-4", number: "PAY-2026-0004", customer_id: "cust-07", project_id: "prj-0003", quotation_id: "qt-qt-2026-0004", amount: 127550, payment_date: isoDate(-12), method: "UPI", txn_ref: "UPI778912", stage: "booking_advance", status: "paid", notes: "Advance on acceptance", created_at: iso(-12) },
    { id: "pay-5", number: "PAY-2026-0005", customer_id: "cust-07", project_id: "prj-0003", quotation_id: "qt-qt-2026-0004", amount: 127550, payment_date: null, method: "UPI", txn_ref: "", stage: "installation_milestone", status: "pending", notes: "Due post workmanship inspection", created_at: iso(-12) },
    { id: "pay-6", number: "PAY-2026-0006", customer_id: "cust-03", project_id: "prj-0004", quotation_id: "qt-qt-2026-0003", amount: 120500, payment_date: null, method: "Bank Transfer (NEFT/RTGS)", txn_ref: "", stage: "booking_advance", status: "pending", notes: "Advance requested", created_at: iso(-5) },
  ];

  // ----- Expenses -----
  const project_expenses: ProjectExpense[] = [
    { id: "exp-1", project_id: "prj-0001", category: "Installation Labor", amount: 18000, expense_date: isoDate(-29), vendor: "Alpha Crew — contract", notes: "3-day job", created_at: iso(-29) },
    { id: "exp-2", project_id: "prj-0001", category: "Transportation", amount: 4200, expense_date: isoDate(-31), vendor: "Sai Transport", notes: "", created_at: iso(-31) },
    { id: "exp-3", project_id: "prj-0001", category: "Electrical Works", amount: 6500, expense_date: isoDate(-28), vendor: "Ravi Electrician", notes: "AC DB + earthing", created_at: iso(-28) },
    { id: "exp-4", project_id: "prj-0001", category: "Equipment Purchase", amount: 92000, expense_date: isoDate(-33), vendor: "Internal stock transfer (cost basis)", notes: "6 panels + 1 inverter at cost", created_at: iso(-33) },
    { id: "exp-5", project_id: "prj-0002", category: "Installation Labor", amount: 15500, expense_date: isoDate(-69), vendor: "Alpha Crew — contract", notes: "", created_at: iso(-69) },
    { id: "exp-6", project_id: "prj-0002", category: "Structural Works", amount: 9000, expense_date: isoDate(-70), vendor: "SunMount Fabricators", notes: "Elevated structure build", created_at: iso(-70) },
    { id: "exp-7", project_id: "prj-0003", category: "Installation Labor", amount: 26000, expense_date: isoDate(-1), vendor: "Beta Crew — contract", notes: "Commercial install", created_at: iso(-1) },
    { id: "exp-8", project_id: "prj-0003", category: "Transportation", amount: 6800, expense_date: isoDate(-2), vendor: "Sai Transport", notes: "Crane support", created_at: iso(-2) },
    { id: "exp-9", project_id: "prj-0003", category: "Electrical Works", amount: 11500, expense_date: isoDate(0), vendor: "Ravi Electrician", notes: "AC DB upgrade", created_at: isoDate(0) },
  ];

  // ----- Subsidies -----
  const subsidy_applications: SubsidyApplication[] = [
    { id: "sub-1", customer_id: "cust-01", project_id: "prj-0001", program_name: "PM Surya Ghar: Muft Bijli Yojana (assumption — verify current rules)", estimated_amount: 39000, requested_amount: 39000, application_ref: "PSG-2026-118842", application_date: isoDate(-25), status: "approved", approval_date: isoDate(-8), approved_amount: 39000, received_amount: 0, notes: "Estimates are editable assumptions — approval decided by the scheme.", created_at: iso(-26) },
    { id: "sub-2", customer_id: "cust-02", project_id: "prj-0002", program_name: "PM Surya Ghar: Muft Bijli Yojana (assumption — verify current rules)", estimated_amount: 36000, requested_amount: 36000, application_ref: "PSG-2026-100211", application_date: isoDate(-60), status: "approved", approval_date: isoDate(-20), approved_amount: 36000, received_amount: 36000, notes: "Received via DISCOM node (demo).", created_at: iso(-61) },
    { id: "sub-3", customer_id: "cust-03", project_id: "prj-0004", program_name: "PM Surya Ghar: Muft Bijli Yojana (assumption — verify current rules)", estimated_amount: 78000, requested_amount: 0, application_ref: "", application_date: null, status: "submitted", approval_date: null, approved_amount: 0, received_amount: 0, notes: "Documents uploaded on national portal (demo).", created_at: iso(-4) },
  ];

  // ----- Service tickets -----
  const prj2InverterUnit = prj2Inverter;
  const service_tickets: ServiceTicket[] = [
    { id: "tkt-1", number: "SRV-2026-0001", customer_id: "cust-01", project_id: "prj-0001", equipment_unit_id: prj1Inverter.id, serial_number: prj1Inverter.serial_number, issue_category: "Inverter Fault", description: "Inverter shows Error E03 in late afternoon; production drops to zero.", priority: "high", status: "in_progress", assigned_technician: "Mahesh K. (Demo Technician)", assignment_status: null, appointment_time: null, resolution_notes: "", estimated_cost: 0, actual_cost: 0, resolution_date: null, created_by: "Service Technician", created_at: iso(-3), updated_at: iso(0) },
    { id: "tkt-2", number: "SRV-2026-0002", customer_id: "cust-02", project_id: "prj-0002", equipment_unit_id: null, serial_number: "", issue_category: "Cleaning Request", description: "Dust accumulation after construction nearby.", priority: "low", status: "resolved", assigned_technician: "Mahesh K. (Demo Technician)", assignment_status: null, appointment_time: null, resolution_notes: "Cleaned all panels; output recovered to normal.", estimated_cost: 800, actual_cost: 800, resolution_date: isoDate(-10), created_by: "Service Technician", created_at: iso(-16), updated_at: iso(-10) },
    { id: "tkt-3", number: "SRV-2026-0003", customer_id: "cust-01", project_id: "prj-0001", equipment_unit_id: null, serial_number: "", issue_category: "Monitoring/App", description: "Mobile app disconnected since Monday; website shows plant offline.", priority: "medium", status: "open", assigned_technician: "", assignment_status: null, appointment_time: null, resolution_notes: "", estimated_cost: 0, actual_cost: 0, resolution_date: null, created_by: "Customer Portal (demo)", created_at: iso(-1), updated_at: iso(0) },
    { id: "tkt-4", number: "SRV-2026-0004", customer_id: "cust-07", project_id: "prj-0003", equipment_unit_id: null, serial_number: "", issue_category: "Wiring/Electrical", description: "AC DB upgrade part pending installation by vendor.", priority: "medium", status: "waiting_parts", assigned_technician: "Iqbal Ahmed", assignment_status: null, appointment_time: null, resolution_notes: "", estimated_cost: 3500, actual_cost: 0, resolution_date: null, created_by: "Installation Manager", created_at: iso(-4), updated_at: iso(-2) },
    { id: "tkt-5", number: "SRV-2026-0005", customer_id: "cust-02", project_id: "prj-0002", equipment_unit_id: prj2InverterUnit?.id ?? null, serial_number: prj2InverterUnit?.serial_number ?? "", issue_category: "Performance Issue", description: "Morning generation looks lower than neighbours' same-size systems.", priority: "medium", status: "assigned", assigned_technician: "Ramesh Yadav (Demo Technician)", assignment_status: "awaiting_confirmation", appointment_time: isoDate(2) + " 10:30", resolution_notes: "", estimated_cost: 0, actual_cost: 0, resolution_date: null, created_by: "Customer Portal (demo)", created_at: iso(-1), updated_at: iso(0) },
  ];
  const service_ticket_notes: ServiceTicketNote[] = [
    { id: "tn-1", ticket_id: "tkt-1", note: "Technician visited; suspects AC-side derating. Monitoring dongle logs pulled.", author: "Mahesh K.", created_at: iso(-2) },
    { id: "tn-2", ticket_id: "tkt-2", note: "Cleaning completed.", author: "Mahesh K.", created_at: iso(-10) },
  ];

  // ----- Activity -----
  addActivity(45, "customer_created", "Customer created — Ramesh Gupta", "customer", "cust-01", "cust-01");
  addActivity(40, "survey_completed", "Site survey completed for Ramesh Gupta", "survey", "survey-01", "cust-01");
  addActivity(38, "quotation_generated", "Quotation QT-2026-0001 generated", "quotation", "qt-qt-2026-0001", "cust-01", "prj-0001");
  addActivity(36, "quotation_accepted", "Quotation QT-2026-0001 accepted by customer", "quotation", "qt-qt-2026-0001", "cust-01", "prj-0001");
  addActivity(36, "project_created", "Installation project PRJ-2026-0001 created", "project", "prj-0001", "cust-01", "prj-0001");
  addActivity(31, "equipment_reserved", "Equipment reserved & dispatched for PRJ-2026-0001", "project", "prj-0001", "cust-01", "prj-0001");
  addActivity(26, "installation_accepted", "Customer acceptance recorded — PRJ-2026-0001", "project", "prj-0001", "cust-01", "prj-0001");
  addActivity(24, "installation_completed", "Installation completed — PRJ-2026-0001", "project", "prj-0001", "cust-01", "prj-0001");
  addActivity(24, "warranty_activated", "2 warranties activated for PRJ-2026-0001", "warranty", null, "cust-01", "prj-0001");
  addActivity(22, "payment_recorded", "Final payment collected for PRJ-2026-0001", "payment", "pay-2", "cust-01", "prj-0001");
  addActivity(3, "service_ticket_opened", "Service ticket SRV-2026-0001 opened (Inverter Fault)", "ticket", "tkt-1", "cust-01", "prj-0001");
  addActivity(1, "service_ticket_opened", "Service ticket SRV-2026-0003 opened via customer portal", "ticket", "tkt-3", "cust-01", "prj-0001");

  // ----- Technicians (fictional, demo) -----
  const technicians: TechnicianProfile[] = [
    { id: "tech-1", name: "Mahesh K.", photo_color: "#15803d", phone: "+91 98990 00001", specializations: ["Inverter Specialist", "Grid-Tie Expert"], experience_years: 7, location_name: "Banjara Hills, Hyderabad", lat: 17.4126, lng: 78.4392, service_areas: ["Banjara Hills", "Jubilee Hills", "Khairatabad"], max_radius_km: 15, working_hours: "Mon–Sat 9:00–18:00", availability: "available", rating: 4.8, completed_jobs: 212, is_demo: true, is_active: true },
    { id: "tech-2", name: "Ramesh Yadav", photo_color: "#0e7490", phone: "+91 98990 00002", specializations: ["Performance Analysis", "Cleaning & Maintenance"], experience_years: 4, location_name: "Kukatpally, Hyderabad", lat: 17.4849, lng: 78.4137, service_areas: ["Kukatpally", "KPHB", "Miyapur"], max_radius_km: 12, working_hours: "Mon–Sun 8:00–17:00", availability: "busy", rating: 4.5, completed_jobs: 143, is_demo: true, is_active: true },
    { id: "tech-3", name: "Farzana S.", photo_color: "#a21caf", phone: "+91 98990 00003", specializations: ["Electrical Works", "Battery Systems"], experience_years: 5, location_name: "Gachibowli, Hyderabad", lat: 17.4401, lng: 78.345, service_areas: ["Gachibowli", "Madhapur", "Hitec City"], max_radius_km: 18, working_hours: "Mon–Sat 9:30–18:30", availability: "available", rating: 4.9, completed_jobs: 187, is_demo: true, is_active: true },
    { id: "tech-4", name: "Naveen Chandra", photo_color: "#b45309", phone: "+91 98990 00004", specializations: ["Structural/Roofing", "Elevated Structures"], experience_years: 8, location_name: "Malakpet, Hyderabad", lat: 17.3711, lng: 78.5106, service_areas: ["Uppal", "LB Nagar", "Amberpet"], max_radius_km: 10, working_hours: "Mon–Fri 8:30–18:00", availability: "available", rating: 4.6, completed_jobs: 255, is_demo: true, is_active: true },
    { id: "tech-5", name: "Sohail Ahmed", photo_color: "#1d4ed8", phone: "+91 98990 00005", specializations: ["Off-grid", "Monitoring/App"], experience_years: 3, location_name: "Uppal, Hyderabad", lat: 17.46, lng: 78.52, service_areas: ["Uppal", "Nacharam", "Sainikpuri"], max_radius_km: 14, working_hours: "Sat–Thu 9:00–18:00", availability: "off_duty", rating: 4.2, completed_jobs: 68, is_demo: true, is_active: true },
    { id: "tech-6", name: "Devi Prasad", photo_color: "#166534", phone: "+91 98990 00006", specializations: ["Inverter Specialist", "Electrical Works"], experience_years: 6, location_name: "LB Nagar, Hyderabad", lat: 17.3457, lng: 78.5522, service_areas: ["LB Nagar", "Vanasthalipuram", "Hayathnagar"], max_radius_km: 16, working_hours: "Mon–Sat 9:00–19:00", availability: "on_leave", rating: 4.7, completed_jobs: 176, is_demo: true, is_active: false },
  ];

  const settings: DemoSettings = {
    org_name: "SunPower Solutions",
    demo_location_name: "Hyderabad, Telangana",
    demo_lat: 17.385,
    demo_lng: 78.4867,
    savings: {
      grid_rate_per_unit: 8,
      daily_sun_hours: 4.5,
      performance_ratio: 0.8,
      export_tariff_per_unit: 3,
      annual_degradation_percent: 0.5,
    },
  };

  return {
    db: {
      customers,
      customer_notes: [
        { id: "cn-1", customer_id: "cust-01", note: "Referred by Mr. Suresh. Wants net metering application support.", author: "Sales Executive — Alicia Dsouza", created_at: iso(-44) },
        { id: "cn-2", customer_id: "cust-05", note: "Needs ROI deck before negotiation call on Friday.", author: "Sales Executive — Alicia Dsouza", created_at: iso(-2) },
      ],
      site_surveys: surveys,
      solar_packages,
      quotations,
      inventory_items: inv_items,
      inventory_transactions,
      equipment_units,
      installation_crews,
      installation_projects: projects,
      checklist_items,
      installation_photos,
      customer_acceptances,
      warranties,
      service_tickets,
      service_ticket_notes,
      payments,
      project_expenses,
      subsidy_applications,
      activity_logs,
      technicians,
      settings,
    },
    activity: seq,
  };
}
