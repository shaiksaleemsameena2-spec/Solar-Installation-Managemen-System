import { describe, it, expect } from "vitest";
import {
  computeQuotationTotals,
  computeProjectFinance,
  computeWarrantyDates,
  canReserve,
  recommendCapacity,
  estimateAnnualSavings,
} from "./finance";

describe("quotation totals", () => {
  it("computes standard quotation", () => {
    const t = computeQuotationTotals({
      equipment_cost: 150000,
      installation_cost: 20000,
      additional_items: [{ description: "Elevated structure", amount: 10000 }],
      tax_percent: 12,
      discount: 5000,
      subsidy_estimate: 30000,
    });
    expect(t.subtotal).toBe(180000);
    expect(t.tax_amount).toBe(21000); // (180000-5000)*12%
    expect(t.total).toBe(166000); // 180000 - 5000 + 21000 - 30000
  });

  it("never produces negative total", () => {
    const t = computeQuotationTotals({
      equipment_cost: 100,
      installation_cost: 100,
      additional_items: [],
      tax_percent: 18,
      discount: 500,
      subsidy_estimate: 9999,
    });
    expect(t.total).toBe(0);
  });

  it("caps subsidy at payable amount", () => {
    const t = computeQuotationTotals({
      equipment_cost: 1000,
      installation_cost: 0,
      additional_items: [],
      tax_percent: 0,
      discount: 0,
      subsidy_estimate: 5000,
    });
    expect(t.total).toBe(0);
    expect(t.subsidy_estimate).toBe(5000);
  });
});

describe("project finance", () => {
  const base = {
    contract_value: 200000,
    payments: [],
    expenses: [],
  };
  it("counts only paid payments as collected", () => {
    const f = computeProjectFinance({
      ...base,
      payments: [
        { amount: 50000, status: "paid" },
        { amount: 50000, status: "pending" },
        { amount: 20000, status: "failed" },
      ],
    });
    expect(f.collected).toBe(50000);
    expect(f.pending).toBe(70000);
    expect(f.outstanding).toBe(150000);
  });
  it("refunds reduce collected", () => {
    const f = computeProjectFinance({
      ...base,
      payments: [
        { amount: 60000, status: "paid" },
        { amount: 10000, status: "refunded" },
      ],
    });
    expect(f.collected).toBe(50000);
    expect(f.outstanding).toBe(150000);
  });
  it("computes profit and margin", () => {
    const f = computeProjectFinance({
      ...base,
      expenses: [{ amount: 80000 }, { amount: 20000 }],
    });
    expect(f.expenses_total).toBe(100000);
    expect(f.estimated_profit).toBe(100000);
    expect(f.margin_percent).toBe(50);
  });
  it("no overcounting from overpayment on outstanding", () => {
    const f = computeProjectFinance({
      ...base,
      payments: [{ amount: 250000, status: "paid" }],
    });
    expect(f.outstanding).toBe(0);
    expect(f.collected).toBe(250000);
  });
});

describe("warranty", () => {
  it("adds months correctly", () => {
    const w = computeWarrantyDates("2026-03-15", 300);
    expect(w.start_date).toBe("2026-03-15");
    expect(w.end_date.startsWith("2051")).toBe(true);
  });
});

describe("inventory rules", () => {
  it("prevents over-reservation", () => {
    expect(canReserve({ available_qty: 5 }, 6)).toBe(false);
    expect(canReserve({ available_qty: 5 }, 0)).toBe(false);
    expect(canReserve({ available_qty: 5 }, 5)).toBe(true);
  });
});

describe("recommendation & savings", () => {
  it("recommends within 1-5 kW", () => {
    expect(recommendCapacity(120)).toBe(1);
    expect(recommendCapacity(5000)).toBe(5);
  });
  it("estimates savings with assumptions", () => {
    const s = estimateAnnualSavings({
      capacity_kw: 3,
      monthly_units: 360,
      assumptions: { grid_rate_per_unit: 8, daily_sun_hours: 4.5, performance_ratio: 0.8 },
    });
    expect(s.annual_savings).toBeGreaterThan(0);
  });
});
