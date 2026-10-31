import { useState } from "react";
import { Zap, ShieldCheck, MapPin, Star, ArrowRight, CheckCircle2, AlertCircle, Wrench, Calendar, Phone, LogIn } from "lucide-react";
import { formatINR } from "@/lib/utils";
import { estimateAnnualSavings, recommendCapacity } from "@/lib/calculations/finance";
import { executeSubmitEnquiry, executeRequestSurvey, executeCreateTicket } from "@/services/solarBotService";

// ==========================================
// 1. Interactive Savings Calculator Card
// ==========================================
export function CalculatorCard({
  defaultBill = 3000,
  onRequestSurvey,
}: {
  defaultBill?: number;
  onRequestSurvey: (details: { bill: number; capacityKw: number; savings: number }) => void;
}) {
  const [bill, setBill] = useState<number>(defaultBill);
  const [roofAreaSqFt, setRoofAreaSqFt] = useState<number>(250);
  const [systemType, setSystemType] = useState<"on_grid" | "off_grid">("on_grid");

  // Calculations
  const unitsPerMonth = Math.round(bill / 8);
  const recommendedKw = recommendCapacity(unitsPerMonth);
  const assumptions = { grid_rate_per_unit: 8, daily_sun_hours: 4.5, performance_ratio: 0.8 };
  const savings = estimateAnnualSavings({ capacity_kw: recommendedKw, monthly_units: unitsPerMonth, assumptions });

  // Subsidies (PM Surya Ghar)
  const subsidyAmount = recommendedKw >= 3 ? 78000 : recommendedKw === 2 ? 60000 : 30000;
  const estimatedCost = recommendedKw * 65000 + 15000;
  const netPayable = Math.max(0, estimatedCost - subsidyAmount);
  const paybackYears = (netPayable / Math.max(1, savings.annual_savings)).toFixed(1);

  return (
    <div className="mt-2.5 rounded-xl border border-emerald-500/30 bg-slate-900/90 p-4 text-white shadow-lg backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-amber-400" /> Conversational Savings Calculator
        </span>
        <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
          PM Surya Ghar Eligible
        </span>
      </div>

      {/* Input Sliders */}
      <div className="mt-3 space-y-3">
        <div>
          <div className="flex justify-between text-xs text-slate-300">
            <span>Average Monthly Bill:</span>
            <span className="font-bold text-amber-300">{formatINR(bill)}/mo</span>
          </div>
          <input
            type="range"
            min="1000"
            max="15000"
            step="500"
            value={bill}
            onChange={(e) => setBill(Number(e.target.value))}
            className="mt-1 h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-700 accent-emerald-400"
          />
        </div>

        <div>
          <div className="flex justify-between text-xs text-slate-300">
            <span>Approx. Roof Space:</span>
            <span className="font-bold text-slate-200">{roofAreaSqFt} sq.ft</span>
          </div>
          <input
            type="range"
            min="100"
            max="1200"
            step="50"
            value={roofAreaSqFt}
            onChange={(e) => setRoofAreaSqFt(Number(e.target.value))}
            className="mt-1 h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-700 accent-emerald-400"
          />
        </div>
      </div>

      {/* Results Grid */}
      <div className="mt-3.5 grid grid-cols-2 gap-2 rounded-lg bg-slate-950/60 p-2.5 border border-white/5 text-[11px]">
        <div>
          <p className="text-slate-400">Recommended Size:</p>
          <p className="text-sm font-bold text-emerald-300">{recommendedKw} kW System</p>
        </div>
        <div>
          <p className="text-slate-400">Monthly Generation:</p>
          <p className="text-sm font-bold text-slate-200">~{Math.round(savings.annual_generation_kwh / 12)} kWh</p>
        </div>
        <div>
          <p className="text-slate-400">Annual Savings:</p>
          <p className="text-sm font-bold text-amber-300">{formatINR(savings.annual_savings)}/yr</p>
        </div>
        <div>
          <p className="text-slate-400">Govt Subsidy:</p>
          <p className="text-sm font-bold text-emerald-400">Up to {formatINR(subsidyAmount)}</p>
        </div>
        <div className="col-span-2 border-t border-white/10 pt-1.5 flex justify-between items-center">
          <span className="text-slate-400">Estimated Payback Period:</span>
          <span className="font-bold text-amber-300">~{paybackYears} Years</span>
        </div>
      </div>

      <p className="mt-2 text-[10px] text-slate-400 leading-snug">
        *Assumptions: ~4.5 peak sun hours/day, 80% performance ratio, ₹8/kWh tariff. Exact generation depends on orientation and shading.
      </p>

      {/* Action Button */}
      <button
        type="button"
        onClick={() => onRequestSurvey({ bill, capacityKw: recommendedKw, savings: savings.annual_savings })}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 py-2 text-xs font-bold text-white transition active:scale-98 cursor-pointer shadow-md"
      >
        <span>Request Professional Site Survey</span>
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ==========================================
// 2. Verified Technicians Card
// ==========================================
export function TechnicianListCard({
  technicians,
  onBookTechnician,
}: {
  technicians: any[];
  onBookTechnician: (tech: any) => void;
}) {
  return (
    <div className="mt-2.5 space-y-2">
      {technicians.map((tech) => (
        <div
          key={tech.id}
          className="flex items-start justify-between rounded-xl border border-slate-700 bg-slate-900/90 p-3 text-white shadow-sm backdrop-blur-md"
        >
          <div className="flex items-start gap-2.5">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white shadow-inner"
              style={{ backgroundColor: tech.photo_color || "#059669" }}
            >
              {tech.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-bold text-slate-100">{tech.name}</p>
                <span className="flex items-center gap-0.5 text-[10px] text-amber-300">
                  <Star className="h-2.5 w-2.5 fill-amber-300 text-amber-300" />
                  {tech.rating}
                </span>
              </div>
              <p className="text-[11px] text-emerald-300">{tech.specializations.join(" · ")}</p>
              <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-400">
                <span className="flex items-center gap-0.5">
                  <MapPin className="h-2.5 w-2.5" /> {tech.location_name.split(",")[0]}
                </span>
                <span>•</span>
                <span>{tech.experience_years} yrs exp</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onBookTechnician(tech)}
            className="shrink-0 rounded-lg bg-emerald-600/80 hover:bg-emerald-500 px-2.5 py-1.5 text-[10.5px] font-semibold text-white transition active:scale-95 cursor-pointer"
          >
            Book Visit
          </button>
        </div>
      ))}
      <p className="text-[10px] text-slate-400 text-center italic">
        Verified SunPower Solutions Field Engineers · Hyderabad Region
      </p>
    </div>
  );
}

// ==========================================
// 3. Interactive Workflow Confirmation Card
// ==========================================
export function ConfirmationCard({
  title,
  fields,
  onConfirm,
  onCancel,
}: {
  title: string;
  fields: { label: string; value: string }[];
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);

  return (
    <div className="mt-2.5 rounded-xl border border-amber-500/30 bg-slate-900/95 p-3.5 text-white shadow-xl backdrop-blur-md">
      <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300 border-b border-white/10 pb-2">
        <AlertCircle className="h-4 w-4 text-amber-400" />
        <span>Please Confirm Your Request</span>
      </div>
      <p className="mt-2 text-xs font-semibold text-slate-200">{title}</p>
      <div className="mt-2 space-y-1 rounded-lg bg-slate-950/70 p-2.5 text-[11.5px] border border-white/5">
        {fields.map((f, i) => (
          <div key={i} className="flex justify-between">
            <span className="text-slate-400">{f.label}:</span>
            <span className="font-medium text-slate-200">{f.value}</span>
          </div>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="flex-1 rounded-lg border border-slate-700 bg-white/5 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/10 transition"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={async () => {
            setSubmitting(true);
            await onConfirm();
            setSubmitting(false);
          }}
          className="flex-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 py-1.5 text-xs font-bold text-white transition active:scale-95 shadow-md flex items-center justify-center gap-1"
        >
          {submitting ? "Submitting…" : "Confirm & Submit"}
        </button>
      </div>
    </div>
  );
}

// ==========================================
// 4. Authentication Required Card
// ==========================================
export function AuthRequiredCard({
  reason = "access confidential records",
  onNavigateLogin,
}: {
  reason?: string;
  onNavigateLogin: () => void;
}) {
  return (
    <div className="mt-2.5 rounded-xl border border-amber-500/30 bg-slate-900/95 p-3.5 text-white shadow-lg backdrop-blur-md">
      <div className="flex items-center gap-2 text-amber-300 font-bold text-xs">
        <ShieldCheck className="h-4 w-4 text-amber-400" />
        <span>Customer Authentication Required</span>
      </div>
      <p className="mt-2 text-xs text-slate-300 leading-relaxed">
        To protect your privacy, SolarBot requires you to be logged into your SunPower customer account to {reason}.
      </p>
      <button
        type="button"
        onClick={onNavigateLogin}
        className="mt-3 flex items-center justify-center gap-1.5 w-full rounded-lg bg-brand-700 hover:bg-brand-600 py-2 text-xs font-bold text-white transition active:scale-95 shadow-md"
      >
        <LogIn className="h-3.5 w-3.5" />
        <span>Sign In to Customer Portal</span>
      </button>
    </div>
  );
}
