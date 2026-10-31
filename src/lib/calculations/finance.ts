import type { Quotation, QuotationAdditionalItem } from "@/types";

// ============================================================
// Financial & business calculations. Pure functions, unit-tested.
// The AI assistant NEVER computes these values.
// ============================================================

export interface QuotationTotals {
  subtotal: number;
  tax_amount: number;
  discount: number;
  subsidy_estimate: number;
  total: number;
}

/**
 * Compute quotation totals.
 * subtotal = equipment + installation + additional items  (equipment cost is tax-exclusive)
 * tax applies on (equipment + installation + additional items - discount)
 * total = taxable_base + tax - subsidy_estimate (subsidy reduces customer payable)
 */
export function computeQuotationTotals(input: {
  equipment_cost: number;
  installation_cost: number;
  additional_items: QuotationAdditionalItem[];
  tax_percent: number;
  discount: number;
  subsidy_estimate: number;
}): QuotationTotals {
  const additionalTotal = input.additional_items.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const gross = round2(input.equipment_cost + input.installation_cost + additionalTotal);
  const discount = clampMin0(input.discount);
  const taxableBase = round2(Math.max(0, gross - discount));
  const tax_percent = clampMin0(input.tax_percent);
  const tax_amount = round2((taxableBase * tax_percent) / 100);
  const subsidy = clampMin0(input.subsidy_estimate);
  const total = round2(Math.max(0, taxableBase + tax_amount - Math.min(subsidy, taxableBase + tax_amount)));
  return { subtotal: gross, tax_amount, discount, subsidy_estimate: subsidy, total };
}

export function recalcQuotation(q: {
  equipment_cost: number;
  installation_cost: number;
  additional_items: QuotationAdditionalItem[];
  tax_percent: number;
  discount: number;
  subsidy_estimate: number;
}): QuotationTotals {
  return computeQuotationTotals(q);
}

// ---------- Project finance ----------
export interface ProjectFinance {
  contract_value: number;
  collected: number;
  pending: number;
  outstanding: number;
  expenses_total: number;
  estimated_profit: number;
  margin_percent: number;
}

/**
 * Accounting rule (documented):
 * - contract_value = accepted quotation total (allocated 100% to the project at creation)
 * - collected = sum of payments with status "paid" only
 * - outstanding = contract_value - collected + refunded re-charge (refunds subtract from collected)
 * - expenses = all recorded project expenses
 * - estimated_profit = contract_value - expenses_total
 */
export function computeProjectFinance(args: {
  contract_value: number;
  payments: { amount: number; status: string }[];
  expenses: { amount: number }[];
}): ProjectFinance {
  let collected = 0;
  let pending = 0;
  for (const p of args.payments) {
    const amt = Number(p.amount) || 0;
    if (p.status === "paid") collected += amt;
    else if (p.status === "pending" || p.status === "failed") pending += amt;
    else if (p.status === "refunded") collected -= amt;
  }
  collected = round2(collected);
  const expenses_total = round2(args.expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0));
  const outstanding = round2(Math.max(0, args.contract_value - collected));
  const estimated_profit = round2(args.contract_value - expenses_total);
  const margin_percent =
    args.contract_value > 0
      ? round2((estimated_profit / args.contract_value) * 100)
      : 0;
  return {
    contract_value: round2(args.contract_value),
    collected,
    pending: round2(pending),
    outstanding,
    expenses_total,
    estimated_profit,
    margin_percent,
  };
}

// ---------- Warranty ----------
export function computeWarrantyDates(startISO: string, durationMonths: number) {
  const start = new Date(startISO);
  const end = new Date(start);
  end.setMonth(end.getMonth() + (durationMonths || 0));
  return { start_date: start.toISOString().slice(0, 10), end_date: end.toISOString().slice(0, 10) };
}

// ---------- Inventory ----------
export function isLowStock(item: { available_qty: number; reorder_level: number }) {
  return item.available_qty <= item.reorder_level;
}

export function stockValue(items: { available_qty: number; purchase_cost: number }[]) {
  return round2(items.reduce((s, i) => s + i.available_qty * i.purchase_cost, 0));
}

export function canReserve(item: { available_qty: number }, qty: number) {
  return item.available_qty >= qty && qty > 0;
}

// ---------- Package recommendation from survey ----------
export function recommendCapacity(monthlyUnits: number) {
  // ~4 kWh generated per kW per day in India (assumption, editable in Settings)
  const dailyUnits = monthlyUnits / 30;
  const kw = dailyUnits / 4;
  return Math.max(1, Math.min(5, Math.round(kw)));
}

// ---------- Savings estimator ----------
export function estimateAnnualSavings(args: {
  capacity_kw: number;
  monthly_units: number;
  assumptions: { grid_rate_per_unit: number; daily_sun_hours: number; performance_ratio: number };
}) {
  const annualGeneration = args.capacity_kw * args.assumptions.daily_sun_hours * 365 * args.assumptions.performance_ratio;
  const unitsOffset = Math.min(args.monthly_units * 12, annualGeneration);
  return {
    annual_generation_kwh: Math.round(annualGeneration),
    annual_units_offset: Math.round(unitsOffset),
    annual_savings: round2(unitsOffset * args.assumptions.grid_rate_per_unit),
  };
}

// ---------- helpers ----------
export function round2(v: number) {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}
function clampMin0(v: number) {
  return Math.max(0, Number(v) || 0);
}
