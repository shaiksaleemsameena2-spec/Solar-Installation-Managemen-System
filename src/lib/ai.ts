// ============================================================
// AI assistants.
// In production these call OpenAI through a server-side proxy
// (see supabase/functions/ai-proxy). API key is never exposed.
// If the proxy/key is unavailable we fall back to a deterministic,
// rule-based generator — clearly labeled as rule-based, never as
// a real model call. Rules use approved domain guidance only.
// ============================================================
import { formatINR } from "@/lib/utils";

export const AI_SOURCE_LABEL = {
  live: "AI-generated via secure server proxy (OpenAI)",
  fallback: "Rule-based guidance (offline) — no live AI call",
} as const;

const openaiConfigured = Boolean(import.meta.env.VITE_OPENAI_PROXY_URL);

async function tryLiveAI(prompt: string, system: string): Promise<string | null> {
  if (!openaiConfigured) return null;
  try {
    const res = await fetch(import.meta.env.VITE_OPENAI_PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, system }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.text === "string" ? data.text : null;
  } catch {
    return null;
  }
}

// ---------- Quotation assistant ----------
export interface QuotationAIResult {
  summary: string;
  missingInfo: string[];
  optionalComponents: string[];
  notes: string;
  source: "live" | "fallback";
}

type SurveyLike = {
  roof_type?: string; shading?: string; installable_area_sqm?: number;
  monthly_units?: number; constraints?: string; property_type?: string;
  required_capacity_kw?: number;
};

export async function aiQuotationSummary(
  q: { number: string; package_name: string; capacity_kw: number; system_type: string; panel_wattage: number; panel_count: number; total: number; additional_items: { description: string; amount: number }[] },
  survey: SurveyLike | null,
): Promise<QuotationAIResult> {
  const system = "You are a solar quotation drafting assistant for SunPower Solutions. Use ONLY supplied facts; never invent prices, availability, or subsidy eligibility. Return plain text.";
  const prompt = JSON.stringify({ quotation: q, survey });
  const live = await tryLiveAI(prompt, system);
  if (live) return { ...fallbackQuotationText(q, survey), summary: live, source: "live" };
  return fallbackQuotationText(q, survey);
}

function fallbackQuotationText(q: { number: string; package_name: string; capacity_kw: number; system_type: string; panel_wattage: number; panel_count: number; total: number; additional_items: { description: string; amount: number }[] }, survey: SurveyLike | null): QuotationAIResult {
  const lines: string[] = [];
  lines.push(`Quotation ${q.number} proposes a ${q.capacity_kw} kW ${q.system_type === "on_grid" ? "On-Grid" : "Off-Grid"} solar package (${q.package_name}) at a total of ${formatINR(q.total)}.`);
  lines.push(`The package includes ${q.panel_count} × ${q.panel_wattage}W panels with the specified inverter and mounting hardware, installed by SunPower Solutions crews under a 50% advance payment schedule.`);
  if (survey) {
    lines.push(`The recommendation follows the site survey: ${survey.roof_type ?? "unspecified"} roof, ${survey.installable_area_sqm ?? "?"} m² available, ${survey.shading?.toLowerCase().includes("none") ? "no significant shading" : `shading noted ("${survey.shading}")`}, and ~${survey.monthly_units ?? "?"} units/month of current consumption.`);
  } else {
    lines.push("No completed survey is linked; figures rely on the customer's self-reported consumption. Link a completed survey before sending.");
  }
  if (q.additional_items.length) {
    lines.push(`Addedon items: ${q.additional_items.map((a) => `${a.description} (${formatINR(a.amount)})`).join(", ")}.`);
  }
  return {
    summary: lines.join("\n"),
    missingInfo: dedupe([
      !survey && "Link a completed site survey (roof type, installable area, shading).",
      !survey?.shading && "Record shading condition at survey.",
      !survey?.monthly_units && "Confirm monthly electricity consumption from a recent bill.",
      !survey?.constraints && "Capture access/structural constraints (lift availability, roof age, cable runs).",
    ] as (string | false | undefined)[]),
    optionalComponents: [
      "Wi-Fi monitoring dongle for app-based generation tracking",
      "Elevated structure for roof access / rainwater use",
      "Surge protection upgrade if the area has lightning activity",
      ...(q.system_type === "off_grid" ? [] : ["Battery backup add-on for essential-loads support during outages"]),
    ],
    notes: `All amounts are computed by validated application logic (package catalogue + itemised additions + GST − discount − subsidy estimate); the estimate of subsidy is an editable assumption, not eligibility.`,
    source: "fallback",
  };
}

const dedupe = (x: (string | false | undefined)[]) =>
  [...new Set(x.map((s) => (typeof s === "string" ? s.trim() : "")).filter(Boolean))] as string[];

// ---------- Service assistant ----------
export interface ServiceAIResult {
  summary: string;
  causes: string[];
  safeChecks: string[];
  nextSteps: string[];
  escalation: string | null;
  source: "live" | "fallback";
}

export async function aiServiceGuidance(input: { issue_category: string; description: string; equipment: string; serial: string; customer_note?: string }): Promise<ServiceAIResult> {
  const system = "You are a solar service-triage assistant. You cannot inspect equipment. Prioritise customer safety; for battery, wiring, fire or electrical hazards recommend stopping and contacting a qualified technician. Return plain text.";
  const live = await tryLiveAI(JSON.stringify(input), system);
  if (live) return { ...fallbackServiceText(input), summary: live, source: "live" };
  return fallbackServiceText(input);
}

function fallbackServiceText(input: { issue_category: string; description: string; equipment: string; serial?: string }): ServiceAIResult {
  const desc = input.description.toLowerCase();
  const cat = input.issue_category.toLowerCase();
  const fireRisk = desc.includes("burn") || desc.includes("smoke") || desc.includes("fire") || desc.includes("spark");
  const battery = cat.includes("battery");
  const wiring = cat.includes("wiring") || cat.includes("electrical");
  const performance = cat.includes("performance") || cat.includes("monitoring");
  const inverter = cat.includes("inverter");

  const causes: string[] = [];
  if (inverter) causes.push("Inverter error state (grid-side trip, derating at high temperature, or internal fault)");
  if (inverter || fireRisk) causes.push("Error code specific to the inverter brand — retrieve the code shown on panel/app before the visit");
  if (performance) causes.push("Monitoring connectivity issue (Wi-Fi dongle offline) vs genuine generation drop");
  if (performance) causes.push("Soiling/shading: recent construction, dust, new shadow from trees or aerials");
  if (battery) causes.push("Battery BMS protection state: over-current / temperature cutoff, or aged cell capacity");
  if (wiring) causes.push("Loose termination or junction-box lug overheating");
  if (fireRisk) causes.push("Arcing at DC connector / damaged insulation — treat as a safety incident");

  const safeChecks: string[] = [
    "Photograph the inverter/monitor app error screen and note the exact code",
    "Note whether the issue is constant or time-of-day (e.g., only during peak heat)",
    "Confirm no visible damage to panels (glass cracks, burn marks) from ground level",
  ];
  if (battery) safeChecks.push("Do NOT open the battery enclosure; check only the external indicator LED and record its state");
  if (wiring || fireRisk) safeChecks.push("Do NOT touch any wiring, connectors, or the AC/DC isolators — stop here");

  const nextSteps: string[] = [
    "Technician visit to verify error history in monitoring portal before any replacement",
    ...(inverter ? ["Swap-to-spare only after error log confirms inverter fault (unit is under warranty via serial record)"] : []),
    ...(performance ? ["Generation-vs-weather comparison for the last 7 days to rule out seasonal drop"] : []),
    ...(battery ? ["BMS event-log readout with manufacturer tooling"] : []),
    ...(wiring || fireRisk ? ["Qualified electrician with thermal imaging for isolated connector inspection"] : []),
  ];
  void wiring;
  void battery;
  const escalation = fireRisk || battery
    ? "SAFETY: stop electrical/battery work immediately; isolate at roof level only if it is safe and clearly labelled, and request a qualified technician. Do not attempt DIY diagnosis."
    : wiring
      ? "Use an authorised electrician for any wiring work — no customer-side repairs."
      : null;

  return {
    summary: `Reported “${input.issue_category}” on ${input.equipment} (serial ${input.serial || "n/a"}). Key detail from the customer: “${input.description}”. This guidance is rule-based and does NOT constitute an inspection or diagnosis.`,
    causes: causes.length ? causes : ["General equipment behaviour requiring on-site verification"],
    safeChecks: safeChecks,
    nextSteps,
    escalation,
    source: "fallback",
  };
}

// ---------- Business insights ----------
export interface BusinessInsight {
  title: string;
  insight: string;
  severity: "info" | "warn" | "critical";
}

export async function aiBusinessInsights(
  facts: { leads: [string, number][]; lowStock: string[]; outstandingProjects: [string, string, number][]; openTickets: [string, string][] },
): Promise<{ items: BusinessInsight[]; source: "live" | "fallback" }> {
  const system = "You are an analytics assistant for an solar installation company. Comment ONLY on the JSON facts provided. Be concrete and short.";
  const live = await tryLiveAI(JSON.stringify(facts), system);
  if (live) {
    return {
      items: [{ title: "AI summary", insight: live, severity: "info" }],
      source: "live",
    };
  }
  const [largestStageRaw] = facts.leads.filter(([stage]) => stage !== "won").sort((a, b) => b[1] - a[1]) as [[string, number]];
  const largestStage = largestStageRaw
    ? `Lead backlog: the stage “${largestStageRaw[0].replaceAll("_", " ")}” holds ${largestStageRaw[1]} leads. Advise the sales executive team to act on stale leads in this stage before adding new pipeline.`
    : "No lead backlog data.";
  const stockInsight = facts.lowStock.length
    ? `Inventory: ${facts.lowStock.slice(0, 3).join(", ")}${facts.lowStock.length > 3 ? ` (+${facts.lowStock.length - 3} more)` : ""} are at or below reorder level. Raise purchase orders before they block new project reservations.`
    : "Inventory: nothing is at/below reorder level.";
  const outstanding = facts.outstandingProjects.slice(0, 3);
  const outstandingInsight = outstanding.length
    ? `Collections: ${outstanding.map(([n, c, v]) => `${n} (${c}, ${formatINR(v)})`).join(", ")}` + `${facts.outstandingProjects.length > 3 ? ` and ${facts.outstandingProjects.length - 3} more` : ""} have outstanding balances — send payment reminders and confirm the pending booking-advance payments.`
    : "Collections: no outstanding project balances 🎉";
  const ticketsInsight = facts.openTickets.length
    ? `Service: ${facts.openTickets.length} open/assigned tickets need attention${facts.openTickets.length ? `: ${facts.openTickets.map((t) => t[0]).slice(0, 3).join(", ")}` : ""}.`
    : "Service: no tickets pending.";
  const items: BusinessInsight[] = [
    { title: "Pipeline & conversion", insight: largestStage, severity: "info" },
    { title: "Inventory", insight: stockInsight, severity: facts.lowStock.length ? "warn" : "info" },
    { title: "Collections", insight: outstandingInsight, severity: outstanding.length ? "warn" : "info" },
    { title: "Service desk", insight: ticketsInsight, severity: facts.openTickets.length ? "info" : "info" },
  ];
  return { items, source: "fallback" };
}
