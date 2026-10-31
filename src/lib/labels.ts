// Central label/status meta for badges and dropdowns
export const LEAD_STATUS: Record<string, string> = {
  new: "New", contacted: "Contacted", survey_scheduled: "Site Survey Scheduled",
  survey_completed: "Survey Completed", quotation_sent: "Quotation Sent",
  negotiation: "Negotiation", won: "Won", lost: "Lost",
};

export const SURVEY_STATUS: Record<string, string> = {
  scheduled: "Scheduled", in_progress: "In Progress", completed: "Completed", cancelled: "Cancelled",
};

export const QUOTATION_STATUS: Record<string, string> = {
  draft: "Draft", generated: "Generated", sent: "Sent", accepted: "Accepted",
  rejected: "Rejected", expired: "Expired",
};

export const PROJECT_STATUS: Record<string, string> = {
  awaiting_stock: "Awaiting Stock", ready_to_schedule: "Ready to Schedule", scheduled: "Scheduled",
  in_progress: "In Progress", quality_inspection: "Quality Inspection", completed: "Completed",
  cancelled: "Cancelled",
};

export const EQUIPMENT_STATUS: Record<string, string> = {
  in_stock: "In Stock", reserved: "Reserved", dispatched: "Dispatched",
  installed: "Installed", returned: "Returned", defective: "Defective",
};

export const TICKET_STATUS: Record<string, string> = {
  open: "Open", assigned: "Assigned", in_progress: "In Progress",
  waiting_parts: "Waiting for Parts", resolved: "Resolved", closed: "Closed",
};

export const PRIORITY: Record<string, string> = {
  low: "Low", medium: "Medium", high: "High", critical: "Critical",
};

export const PAYMENT_STATUS: Record<string, string> = {
  pending: "Pending", paid: "Paid", failed: "Failed", refunded: "Refunded",
};

export const PAYMENT_STAGE: Record<string, string> = {
  booking_advance: "Booking Advance", equipment_dispatch: "Equipment Dispatch",
  installation_milestone: "Installation Milestone", final: "Final Payment",
};

export const SUBSIDY_STATUS: Record<string, string> = {
  not_started: "Not Started", draft: "Draft", submitted: "Submitted", under_review: "Under Review",
  approved: "Approved", rejected: "Rejected", paid: "Paid",
};

export const WARRANTY_STATUS: Record<string, string> = {
  pending_activation: "Pending Activation", active: "Active", expired: "Expired",
  claimed: "Claimed", voided: "Voided",
};

export const INVENTORY_CATEGORY: Record<string, string> = {
  solar_panel: "Solar Panel", inverter: "Inverter", battery: "Battery", mounting: "Mounting Structure",
  cable: "Cable", connector: "Connector", protection: "Electrical Protection", other: "Other",
};

export const CUSTOMER_TYPE: Record<string, string> = {
  residential: "Residential", commercial: "Commercial",
};

export const SYSTEM_TYPE: Record<string, string> = {
  on_grid: "On-Grid", off_grid: "Off-Grid",
};

export const CREW_AVAILABILITY: Record<string, string> = {
  available: "Available", busy: "Busy", off_duty: "Off Duty", on_leave: "On Leave",
};

export const ASSIGNMENT_STATUS: Record<string, string> = {
  requested: "Requested", awaiting_confirmation: "Awaiting Confirmation", confirmed: "Confirmed",
  in_progress: "In Progress", completed: "Completed", cancelled: "Cancelled",
};

export const TECH_AVAILABILITY: Record<string, string> = {
  available: "Available", busy: "Busy", off_duty: "Off Duty", on_leave: "On Leave",
};

export const LEAD_SOURCES = ["Walk-in", "Referral", "Google Ads", "Website", "Exhibition", "Cold Call", "Social Media"];

export const ISSUE_CATEGORIES = [
  "Performance Issue", "Inverter Fault", "Panel Damage", "Wiring/Electrical",
  "Battery Issue", "Monitoring/App", "Cleaning Request", "Other",
];

export const EXPENSE_CATEGORIES = [
  "Equipment Purchase", "Installation Labor", "Transportation", "Electrical Works",
  "Structural Works", "Permits & Fees", "Tools & Consumables", "Other",
];

export const PAYMENT_METHODS = ["Cash", "Bank Transfer (NEFT/RTGS)", "UPI", "Cheque", "Card", "Razorpay (simulated)"];

// Badge color classes by domain
export const badgeClass: Record<string, string> = {
  // greens = positive
  new: "bg-blue-100 text-blue-700", contacted: "bg-indigo-100 text-indigo-700",
  survey_scheduled: "bg-amber-100 text-amber-700", survey_completed: "bg-emerald-100 text-emerald-700",
  quotation_sent: "bg-violet-100 text-violet-700", negotiation: "bg-orange-100 text-orange-700",
  won: "bg-emerald-100 text-emerald-700", lost: "bg-rose-100 text-rose-700",
  draft: "bg-slate-200 text-slate-700", generated: "bg-blue-100 text-blue-700",
  sent: "bg-violet-100 text-violet-700", accepted: "bg-emerald-100 text-emerald-700",
  rejected: "bg-rose-100 text-rose-700", expired: "bg-slate-200 text-slate-600",
  awaiting_stock: "bg-amber-100 text-amber-700", ready_to_schedule: "bg-sky-100 text-sky-700",
  scheduled: "bg-indigo-100 text-indigo-700", in_progress: "bg-blue-100 text-blue-700",
  quality_inspection: "bg-violet-100 text-violet-700", completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-rose-100 text-rose-700",
  in_stock: "bg-emerald-100 text-emerald-700", reserved: "bg-amber-100 text-amber-700",
  dispatched: "bg-blue-100 text-blue-700", installed: "bg-emerald-100 text-emerald-700",
  returned: "bg-orange-100 text-orange-700", defective: "bg-rose-100 text-rose-700",
  open: "bg-rose-100 text-rose-700", assigned: "bg-indigo-100 text-indigo-700",
  waiting_parts: "bg-amber-100 text-amber-700", resolved: "bg-emerald-100 text-emerald-700",
  closed: "bg-slate-200 text-slate-600",
  low: "bg-slate-200 text-slate-700", medium: "bg-blue-100 text-blue-700",
  high: "bg-orange-100 text-orange-700", critical: "bg-rose-100 text-rose-700",
  pending: "bg-amber-100 text-amber-700", paid: "bg-emerald-100 text-emerald-700",
  failed: "bg-rose-100 text-rose-700", refunded: "bg-slate-200 text-slate-600",
  not_started: "bg-slate-200 text-slate-600", submitted: "bg-blue-100 text-blue-700",
  under_review: "bg-amber-100 text-amber-700", approved: "bg-emerald-100 text-emerald-700",
  active: "bg-emerald-100 text-emerald-700", expiry_soon: "bg-amber-100 text-amber-700",
  pending_activation: "bg-slate-200 text-slate-600", claimed: "bg-orange-100 text-orange-700",
  voided: "bg-rose-100 text-rose-700",
  available: "bg-emerald-100 text-emerald-700", busy: "bg-amber-100 text-amber-700",
  off_duty: "bg-slate-200 text-slate-600", on_leave: "bg-slate-200 text-slate-600",
  requested: "bg-blue-100 text-blue-700", awaiting_confirmation: "bg-amber-100 text-amber-700",
  confirmed: "bg-emerald-100 text-emerald-700",
  receipt: "bg-emerald-100 text-emerald-700", reserve: "bg-amber-100 text-amber-700",
  release: "bg-slate-200 text-slate-600", adjustment: "bg-blue-100 text-blue-700",
  dispatch: "bg-indigo-100 text-indigo-700", install: "bg-emerald-100 text-emerald-700",
};

export const DEFAULT_CHECKLIST = [
  "Site preparation completed",
  "Mounting structure installed",
  "Solar panels installed",
  "Inverter installed",
  "Electrical connections inspected",
  "Earthing checked",
  "Safety inspection completed",
  "System startup completed",
  "Customer demonstration completed",
  "Final quality inspection completed",
];
