import { useMemo, useState } from "react";
import { CheckCircle2, Circle, Zap, FileText, ShieldCheck, Wallet, Landmark, Wrench, Flag, Printer, Sparkles } from "lucide-react";
import { Card, CardHeader, Badge, Button, Input, Textarea, Label, Select, Modal, FieldError, StatTile, EmptyState, DemoPill } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useDB, api, resetDemoDB } from "@/services";
import { useSession } from "@/hooks/useSession";
import { computeCustomerJourney, PORTAL_TRACK_STAGES, type PortalStageKey } from "./shell";
import { printWarrantyCertificate } from "@/lib/certificate";
import { formatINR, formatDate, formatDateTime } from "@/lib/utils";
import { PAYMENT_STAGE, SUBSIDY_STATUS, TICKET_STATUS, ISSUE_CATEGORIES, WARRANTY_STATUS } from "@/lib/labels";
import { estimateAnnualSavings } from "@/lib/calculations/finance";
import { cn } from "@/lib/utils";
import { AnimatedSolarSky } from "@/components/AnimatedSolarSky";

export default function PortalHome() {
  const session = useSession();
  const db = useDB();
  const [ticketModal, setTicketModal] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [showRooftopSky, setShowRooftopSky] = useState(true);
  if (!session?.customerId) return null;
  const cid = session.customerId;
  const customer = db.customers.find((c) => c.id === cid);
  if (!customer) return null;

  const journey = computeCustomerJourney(db, cid);
  const quote = db.quotations.filter((q) => q.customer_id === cid).find((q) => q.status === "accepted") ?? db.quotations.filter((q) => q.customer_id === cid)[0];
  const projects = db.installation_projects.filter((p) => p.customer_id === cid);
  const project = projects[0];
  const activeProject = project?.status !== "cancelled" ? project : undefined;
  const units = activeProject ? db.equipment_units.filter((u) => u.project_id === activeProject.id) : [];
  const warranties = db.warranties.filter((w) => w.customer_id === cid);
  const payments = db.payments.filter((p) => p.customer_id === cid);
  const tickets = db.service_tickets.filter((t) => t.customer_id === cid);
  const subsidies = db.subsidy_applications.filter((s) => s.customer_id === cid);
  const collected = payments.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0);
  const outstanding = Math.max(0, (quote?.status === "accepted" ? quote.total : 0) - collected);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Hello, {customer.full_name.split(" ")[0]} 👋</h1>
          <p className="text-[13px] text-slate-500">
            {activeProject ? `${activeProject.package_name} · ${activeProject.capacity_kw} kW ${activeProject.installation_type}` : "Your solar journey"} — {customer.city}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowRooftopSky(!showRooftopSky)}>
            {showRooftopSky ? "Hide rooftop sky" : "Show rooftop sky"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setResetConfirm(true)}>Reset demo data</Button>
          <Button size="sm" onClick={() => setTicketModal(true)}><Wrench className="h-3.5 w-3.5" /> New service request</Button>
        </div>
      </div>

      {/* Live Animated Solar Rooftop Banner */}
      {showRooftopSky && (
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/90 shadow-md">
          <AnimatedSolarSky className="h-64 sm:h-80 w-full" showControls={true} autoPlay={true}>
            <div className="absolute bottom-4 left-4 z-20 rounded-xl bg-slate-950/75 p-3.5 text-white backdrop-blur-md border border-white/20 max-w-sm shadow-xl">
              <div className="flex items-center gap-1.5 text-amber-300 font-bold text-xs uppercase tracking-wider">
                <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                <span>Live Rooftop PV Installation</span>
              </div>
              <p className="text-sm font-semibold text-slate-100 mt-1">
                {activeProject ? `${activeProject.package_name} (${activeProject.capacity_kw} kW)` : "Residential Rooftop PV Array"}
              </p>
              <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">
                Simulating continuous sunlight capture, dynamic sun elevation, and bird flock paths over your panels.
              </p>
            </div>
          </AnimatedSolarSky>
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="System capacity" value={activeProject ? `${activeProject.capacity_kw} kW` : "—"} sub={quote ? quote.system_type === "on_grid" ? "On-grid" : "Off-grid" : ""} icon={Zap} />
        <StatTile label="Paid so far" value={formatINR(collected)} sub={`Outstanding ${formatINR(outstanding)}`} icon={Wallet} tone={outstanding > 0 ? "warn" : "good"} />
        <StatTile label="Warranties" value={warranties.filter((w) => w.status === "active").length} sub={`${warranties.length} total records`} icon={ShieldCheck} tone="good" />
        <StatTile label="Service tickets" value={tickets.filter((t) => ["open", "assigned", "in_progress", "waiting_parts"].includes(t.status)).length} sub={`${tickets.length} lifetime`} icon={Wrench} tone={tickets.some((t) => t.status === "open") ? "warn" : "default"} />
      </div>

      {/* Tracker */}
      <Card>
        <CardHeader title="Installation tracker" subtitle="Stages update automatically from actual records — nothing is marked done until it happened." />
        <div className="px-4 py-5">
          <ol className="flex flex-col gap-0 md:flex-row md:items-start">
            {PORTAL_TRACK_STAGES.map((stage, i) => {
              const j = journey[stage.key as PortalStageKey];
              const isLast = i === PORTAL_TRACK_STAGES.length - 1;
              return (
                <li key={stage.key} className={cn("relative flex gap-3 pb-6 md:flex-1 md:flex-col md:pb-0", !isLast && "md:pr-3")}>
                  {!isLast && (
                    <div className={cn("absolute left-[11px] top-5 h-full w-px md:left-auto md:top-[11px] md:h-px md:w-full md:translate-x-6", j.done ? "bg-brand-400" : "bg-slate-200")} />
                  )}
                  <div className="z-10 shrink-0">
                    {j.done ? (
                      <CheckCircle2 className="h-6 w-6 text-brand-600" />
                    ) : (
                      <Circle className="h-6 w-6 text-slate-300" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className={cn("text-[13px] font-semibold", j.done ? "text-slate-800" : "text-slate-400")}>{stage.label}</p>
                    <p className="text-[11px] leading-snug text-slate-400">{j.detail || "—"}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Quotation transparency */}
        <Card>
          <CardHeader title="Quotation" subtitle={quote ? `${quote.number} · ${quote.package_name}` : "No quotation yet"} action={quote && <>
            <Badge status={quote.status} />
          </>} />
          {quote ? (
            <div className="px-4 py-4 text-[13px]">
              <div className="mb-3 rounded-lg bg-slate-50 p-3 text-[12px] leading-relaxed text-slate-600">
                {quote.capacity_kw} kW {quote.system_type === "on_grid" ? "On-grid" : "Off-grid"} · {quote.panel_count} × {quote.panel_wattage}W panels · {quote.inverter_spec}
                {quote.battery_spec !== "—" && ` · ${quote.battery_spec}`}
              </div>
              <div className="space-y-1.5">
                <Line l="Equipment & components" v={formatINR(quote.equipment_cost)} />
                <Line l="Installation charges" v={formatINR(quote.installation_cost)} />
                {quote.additional_items.map((a, i) => <Line key={i} l={`Additional: ${a.description}`} v={formatINR(a.amount)} />)}
                <Line l="Subtotal" v={formatINR(quote.subtotal)} strong />
                {!!quote.discount && <Line l="Discount" v={"- " + formatINR(quote.discount)} />}
                <Line l={`GST (${quote.tax_percent}%)`} v={formatINR(quote.tax_amount)} />
                {!!quote.subsidy_estimate && <Line l="Estimated subsidy (assumption)" v={"- " + formatINR(quote.subsidy_estimate)} />}
                <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2.5 text-sm font-bold text-slate-900">
                  <span>Total</span>
                  <span>{formatINR(quote.total)}</span>
                </div>
              </div>
              <p className="mt-3 text-[11px] text-slate-400">Valid until {formatDate(quote.valid_until)} · original quotation is preserved; only staff can change financials.</p>
            </div>
          ) : <EmptyState icon={FileText} title="No quotation yet" subtitle="Once your site survey is complete, our team prepares a quotation." />}
        </Card>

        {/* Equipment & warranty */}
        <Card>
          <CardHeader title="Equipment & warranty" subtitle="Serial numbers registered against your system" />
          <div className="px-4 py-4">
            {units.length ? (
              <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                {units.map((u) => (
                  <div key={u.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 text-[12px]">
                    <div>
                      <p className="font-semibold text-slate-700">{u.item_name}</p>
                      <p className="font-mono text-[11px] text-slate-400">{u.serial_number}</p>
                    </div>
                    <Badge status={u.status} />
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={ShieldCheck} title="No equipment allocated yet" subtitle="Serial numbers appear here once equipment is reserved and dispatched for your project." />
            )}
            {warranties.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Warranty records</p>
                {warranties.map((w) => (
                  <div key={w.id} className="rounded-lg border border-slate-200 px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[12.5px] font-semibold text-slate-700">{w.warranty_type} · {w.product_name}</p>
                      <Badge status={w.status} label={WARRANTY_STATUS[w.status]} />
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
                      <span>{formatDate(w.start_date)} → {formatDate(w.end_date)}</span>
                      <button className="inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline" onClick={() => printWarrantyCertificate(w, db.customers.find((c) => c.id === w.customer_id))}>
                        <Printer className="h-3 w-3" /> Certificate
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Payments */}
        <Card>
          <CardHeader title="Payments" subtitle={quote ? `Contract value ${formatINR(quote.total)}` : ""} />
          <div className="px-4 py-4">
            {payments.length ? (
              <Table>
                <thead>
                  <tr><th>Stage</th><th>Amount</th><th>Date</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {payments.sort(sortByDate).map((p) => (
                    <tr key={p.id}>
                      <td className="py-2.5 pr-3 text-[12px]">{PAYMENT_STAGE[p.stage]}</td>
                      <td>{formatINR(p.amount)}</td>
                      <td>{p.payment_date ? formatDate(p.payment_date) : "—"}</td>
                      <td><Badge status={p.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : <EmptyState icon={Wallet} title="No payments recorded" />}
            <div className="mt-3 flex items-center justify-between rounded-lg bg-brand-50 px-3 py-2 text-[12.5px] font-semibold text-brand-800">
              <span>Outstanding balance</span>
              <span>{formatINR(outstanding)}</span>
            </div>
          </div>
        </Card>

        {/* Subsidies */}
        <Card>
          <CardHeader title="Subsidy applications" subtitle="Estimated / requested / approved / received are tracked separately" />
          <div className="px-4 py-4">
            {subsidies.length ? subsidies.map((s) => (
              <div key={s.id} className="mb-2 rounded-lg border border-slate-200 px-3 py-2.5 text-[12.5px]">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-slate-700">{s.program_name}</p>
                  <Badge status={s.status} label={SUBSIDY_STATUS[s.status]} />
                </div>
                <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 text-[11.5px] text-slate-500 sm:grid-cols-4">
                  <span>Estimated: <b className="text-slate-700">{formatINR(s.estimated_amount)}</b></span>
                  <span>Requested: <b className="text-slate-700">{formatINR(s.requested_amount)}</b></span>
                  <span>Approved: <b className="text-slate-700">{formatINR(s.approved_amount)}</b></span>
                  <span>Received: <b className="text-slate-700">{formatINR(s.received_amount)}</b></span>
                </div>
                <p className="mt-1 text-[11px] text-slate-400">Approval is decided by the government scheme — not guaranteed by SunPower Solutions.</p>
              </div>
            )) : <EmptyState icon={Landmark} title="No subsidy applications" subtitle="Subsidy applications appear here once submitted on your behalf." />}
          </div>
        </Card>

        {/*tickets */}
        <Card className="lg:col-span-2">
          <CardHeader title="Service requests" subtitle="Track complaints and technician assignments" action={<Button size="sm" onClick={() => setTicketModal(true)}>New request</Button>} />
          <div className="px-4 py-4">
            {tickets.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-400">
                      <th className="py-2 pr-3 font-semibold">Ticket</th><th className="py-2 pr-3 font-semibold">Issue</th><th className="py-2 pr-3 font-semibold">Technician</th><th className="py-2 pr-3 font-semibold">Status</th><th className="py-2 pr-3 font-semibold">Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.map((t) => (
                      <tr key={t.id} className="border-b border-slate-100">
                        <td className="py-2.5 pr-3 font-mono text-[12px] font-semibold text-slate-700">{t.number}</td>
                        <td className="max-w-[280px] py-2.5 pr-3"><p className="truncate font-medium text-slate-700">{t.issue_category}</p><p className="truncate text-[11.5px] text-slate-400">{t.description}</p>{t.resolution_notes && <p className="mt-0.5 text-[11px] text-emerald-700">✓ {t.resolution_notes}</p>}</td>
                        <td className="py-2.5 pr-3 text-[12px]">{t.assigned_technician || "—"}
                          {t.assignment_status && <div className="mt-0.5"><Badge status={t.assignment_status} /></div>}
                        </td>
                        <td className="py-2.5 pr-3"><Badge status={t.status} label={TICKET_STATUS[t.status]} /></td>
                        <td className="py-2.5 pr-3 text-[12px] text-slate-400">{formatDateTime(t.updated_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <EmptyState icon={Wrench} title="No service requests" subtitle="Raise a request any time — your warranty covers registered equipment." />}
          </div>
        </Card>

        {/* Savings estimator */}
        <Card className="lg:col-span-2">
          <CardHeader title="Savings estimator" subtitle="Clearly labeled estimate using editable assumptions — not measured generation" action={<DemoPill />} />
          <SavingsEstimator capacityKw={activeProject?.capacity_kw ?? quote?.capacity_kw ?? 3} monthlyUnits={customer.monthly_units} />
        </Card>
      </div>

      <TicketModal open={ticketModal} onClose={() => setTicketModal(false)} customerId={cid} projectId={activeProject?.id ?? null} units={units} />
      <Modal open={resetConfirm} onClose={() => setResetConfirm(false)} title="Reset demo data?" width="max-w-sm">
        <p className="text-[13px] text-slate-600">This restores the seeded demo dataset. Useful before a presentation.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setResetConfirm(false)}>Cancel</Button>
          <Button variant="danger" onClick={() => { resetDemoDB(); setResetConfirm(false); }}>Reset</Button>
        </div>
      </Modal>
    </div>
  );
}

const sortByDate = (a: { payment_date: string | null }, b: { payment_date: string | null }) =>
  (b.payment_date ?? "").localeCompare(a.payment_date ?? "");

function Line({ l, v, strong }: { l: string; v: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={cn("text-slate-500", strong && "font-semibold text-slate-700")}>{l}</span>
      <span className={cn("text-slate-700", strong && "font-semibold")}>{v}</span>
    </div>
  );
}

function Table({ children }: { children: React.ReactNode }) {
  return <table className="w-full text-left text-[12.5px]">{children}</table>;
}

// ---------- Savings ----------
function SavingsEstimator({ capacityKw, monthlyUnits }: { capacityKw: number; monthlyUnits: number }) {
  const db = useDB();
  const [bill, setBill] = useState(String(Math.round(monthlyUnits * db.settings.savings.grid_rate_per_unit) || 2880));
  const cfg = db.settings.savings;
  const units = useMemo(() => Math.round(Number(bill) / cfg.grid_rate_per_unit) || monthlyUnits, [bill, cfg, monthlyUnits]);
  const est = estimateAnnualSavings({ capacity_kw: capacityKw, monthly_units: units, assumptions: cfg });
  return (
    <div className="grid gap-4 px-4 py-4 md:grid-cols-[280px_1fr]">
      <div className="space-y-3">
        <div>
          <Label>Monthly electricity bill (₹)</Label>
          <Input type="number" value={bill} min={0} onChange={(e) => setBill(e.target.value)} />
        </div>
        <p className="text-[11.5px] text-slate-500">
          Assumptions (editable in staff Settings): {cfg.daily_sun_hours} sun-hours/day · {Math.round(cfg.performance_ratio * 100)}% performance ratio · ₹{cfg.grid_rate_per_unit}/unit grid rate.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-brand-50 p-4">
          <p className="text-[11px] font-semibold uppercase text-brand-700">Est. annual generation</p>
          <p className="mt-1 text-xl font-bold text-brand-900">{est.annual_generation_kwh.toLocaleString("en-IN")} kWh</p>
          <p className="mt-0.5 text-[11px] text-brand-700/70">{capacityKw} kW system</p>
        </div>
        <div className="rounded-xl bg-slate-100 p-4">
          <p className="text-[11px] font-semibold uppercase text-slate-500">Units offset / year</p>
          <p className="mt-1 text-xl font-bold text-slate-800">{est.annual_units_offset.toLocaleString("en-IN")}</p>
          <p className="mt-0.5 text-[11px] text-slate-400">approx. {Math.round(est.annual_units_offset / 12)} units/month</p>
        </div>
        <div className="rounded-xl bg-lime-100 p-4">
          <p className="text-[11px] font-semibold uppercase text-lime-800">Est. annual savings</p>
          <p className="mt-1 text-xl font-bold text-lime-900">{formatINR(est.annual_savings)}</p>
          <p className="mt-0.5 text-[11px] text-lime-800/70">≈ {formatINR(Math.round(est.annual_savings / 12))}/month</p>
        </div>
      </div>
      <p className="text-[11px] text-slate-400 md:col-span-2">
        <Flag className="mr-1 inline h-3 w-3" /> This is a mathematical estimate only — actual savings depend on weather, generation and tariffs. SolarOps AI does not access live generation data.
      </p>
    </div>
  );
}

// ---------- Ticket modal ----------
const emptyTicket = { issue_category: ISSUE_CATEGORIES[0], description: "", equipment: "none" };

function TicketModal({ open, onClose, customerId, projectId, units }: {
  open: boolean; onClose: () => void; customerId: string; projectId: string | null;
  units: { id: string; item_name: string; serial_number: string }[];
}) {
  const [form, setForm] = useState(emptyTicket);
  const [err, setErr] = useState("");
  const toast = useToast();
  const save = () => {
    if (form.description.trim().length < 10) return setErr("Describe the issue in at least 10 characters.");
    const SERIAL = form.equipment === "none" ? "" : form.equipment;
    const unit = units.find((u) => u.serial_number === SERIAL) ?? null;
    api.createTicket({
      customer_id: customerId, project_id: projectId,
      equipment_unit_id: unit?.id ?? null, serial_number: unit?.serial_number ?? "",
      issue_category: form.issue_category, description: form.description,
      priority: "medium", created_by: "Customer Portal (demo)",
    });
    toast.success("Service request submitted", `Ticket created. Our service team will contact you.`);
    setForm(emptyTicket); setErr(""); onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="New service request">
      <div className="space-y-3.5">
        <div>
          <Label required>Issue category</Label>
          <Select value={form.issue_category} onChange={(e) => setForm({ ...form, issue_category: e.target.value })}>
            {ISSUE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </Select>
        </div>
        <div>
          <Label>Equipment (if known)</Label>
          <Select value={form.equipment} onChange={(e) => setForm({ ...form, equipment: e.target.value })}>
            <option value="none">Not sure / general issue</option>
            {units.map((u) => <option key={u.id} value={u.serial_number}>{u.item_name} — {u.serial_number}</option>)}
          </Select>
        </div>
        <div>
          <Label required>Describe the problem</Label>
          <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What happened? When did it start?" />
          <FieldError message={err} />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save}>Submit request</Button>
        </div>
      </div>
    </Modal>
  );
}
