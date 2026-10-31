import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Search, Plus, Send, CheckCircle2, XCircle, Lock, RotateCcw, Printer } from "lucide-react";
import { Card, PageHeader, Button, Input, Select, Modal, Label, Table, Th, Td, Badge, FieldError, EmptyState, Textarea } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useDB, api } from "@/services";
import type { QuotationAdditionalItem } from "@/types";
import { QUOTATION_STATUS } from "@/lib/labels";
import { formatINR, formatDate, todayISO, addMonths } from "@/lib/utils";
import { computeQuotationTotals } from "@/lib/calculations/finance";
import { aiQuotationSummary } from "@/lib/ai";
import { printQuotation } from "@/lib/certificate";

export default function QuotationsPage() {
  const db = useDB();
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const presetCustomer = params.get("customer") ?? "";
  const [q, setQ] = useState("");
  const [statusF, setStatusF] = useState("all");
  const [creating, setCreating] = useState(Boolean(params.get("customer")));

  const rows = useMemo(() => db.quotations
    .filter((x) => (statusF === "all" ? true : x.status === statusF))
    .filter((x) => {
      const term = q.toLowerCase();
      const cust = db.customers.find((c) => c.id === x.customer_id)?.full_name ?? "";
      return !term || x.number.toLowerCase().includes(term) || cust.toLowerCase().includes(term);
    }), [db.quotations, db.customers, q, statusF]);

  return (
    <div className="space-y-5">
      <PageHeader title="Quotations" subtitle={`${db.quotations.filter((x) => x.status === "sent").length} sent · ${db.quotations.filter((x) => x.status === "accepted").length} accepted · all totals computed by validated logic`}>
        <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New quotation</Button>
      </PageHeader>

      <div className="flex flex-wrap gap-2">
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input className="pl-8" placeholder="Search number or customer…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select className="w-40" value={statusF} onChange={(e) => setStatusF(e.target.value)}>
          <option value="all">All statuses</option>
          {Object.entries(QUOTATION_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
      </div>

      <Card>
        {rows.length ? (
          <Table>
            <thead><tr><Th>Number</Th><Th>Customer</Th><Th>Package</Th><Th>Amount</Th><Th>Valid until</Th><Th>Status</Th><Th className="text-right">Actions</Th></tr></thead>
            <tbody>
              {rows.map((x) => {
                const cust = db.customers.find((c) => c.id === x.customer_id);
                const proj = db.installation_projects.find((p) => p.quotation_id === x.id && p.status !== "cancelled");
                return (
                  <tr key={x.id} className="hover:bg-slate-50/60">
                    <Td><Link to={`/quotations/${x.id}`} className="font-semibold text-brand-700 hover:underline">{x.number}</Link></Td>
                    <Td>{cust?.full_name}<p className="text-[11px] text-slate-400">{cust?.city}</p></Td>
                    <Td><p>{x.capacity_kw} kW {x.system_type === "on_grid" ? "On-Grid" : "Off-Grid"}</p><p className="text-[11px] text-slate-400">{x.package_name}</p></Td>
                    <Td className="font-semibold">{formatINR(x.total)}</Td>
                    <Td className="text-[12px]">{formatDate(x.valid_until)}</Td>
                    <Td><Badge status={x.status} />{proj && <p className="mt-0.5 text-[10.5px] text-emerald-600">→ {proj.number}</p>}</Td>
                    <Td>
                      <QuotationQuickActions id={x.id} />
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <EmptyState icon={dtypeof()} title="No quotations" subtitle="Create one from a completed survey or directly for a customer."
            action={<Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New quotation</Button>} />
        )}
      </Card>

      {creating && <CreateQuotationModal presetCustomer={presetCustomer} onClose={() => { setCreating(false); navigate("/quotations"); }} />}
    </div>
  );
}

const dtypeof = () => Plus;

function QuotationQuickActions({ id }: { id: string }) {
  const db = useDB();
  const toast = useToast();
  const navigate = useNavigate();
  const qq = db.quotations.find((x) => x.id === id);
  if (!qq) return null;
  const cust = db.customers.find((c) => c.id === qq.customer_id);
  const act = (a: Parameters<typeof api.quotationAction>[1]) => {
    try {
      api.quotationAction(id, a);
      toast.success(`Quotation ${a === "send" ? "sent" : a === "accept" ? "accepted" : a + "ed"}`);
    } catch (e) { toast.error("Action failed", e instanceof Error ? e.message : String(e)); }
  };
  return (
    <div className="flex justify-end gap-1">
      <Button size="sm" variant="ghost" title="Print / PDF" onClick={() => printQuotation(qq, cust, db.settings.org_name)}><Printer className="h-3.5 w-3.5" /></Button>
      {["draft", "generated"].includes(qq.status) && <Button size="sm" variant="secondary" onClick={() => act("send")}><Send className="h-3.5 w-3.5" /> Send</Button>}
      {["sent", "generated"].includes(qq.status) && (
        <>
          <Button size="sm" variant="accent" onClick={() => act("accept")}><CheckCircle2 className="h-3.5 w-3.5" /> Accept</Button>
          <Button size="sm" variant="ghost" onClick={() => act("reject")}><XCircle className="h-3.5 w-3.5 text-rose-500" /></Button>
        </>
      )}
      {["rejected", "expired"].includes(qq.status) && <Button size="sm" variant="ghost" title="Reopen as draft" onClick={() => act("reopen")}><RotateCcw className="h-3.5 w-3.5" /></Button>}
      {qq.status === "accepted" && <Lock className="mt-2 h-3.5 w-3.5 text-slate-300" />}
      {qq.status === "accepted" && <Button size="sm" onClick={() => {
        const proj = api.convertQuotationToProject(id);
        navigate(`/installations/${proj.id}`);
        return proj;
      }}>Convert → Project</Button>}
    </div>
  );
}

function CreateQuotationModal({ presetCustomer, onClose }: { presetCustomer?: string; onClose: () => void }) {
  const db = useDB();
  const toast = useToast();
  const [customerId, setCustomerId] = useState(presetCustomer || db.customers[0]?.id || "");
  const surveys = db.site_surveys.filter((s) => s.customer_id === customerId && s.status === "completed");
  const [surveyId, setSurveyId] = useState(surveys[0]?.id ?? "");
  const [pkgId, setPkgId] = useState(db.solar_packages[0]?.id ?? "");
  const pkg = db.solar_packages.find((p) => p.id === pkgId);
  const survey = db.site_surveys.find((s) => s.id === surveyId);
  const [additional, setAdditional] = useState<QuotationAdditionalItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [subsidy, setSubsidy] = useState(0);
  const [installationCost, setInstallationCost] = useState<number | null>(null);
  const [validUntil, setValidUntil] = useState(addMonths(todayISO(), 1));
  const [terms, setTerms] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [aiBusy, setAiBusy] = useState(false);
  const [aiText, setAiText] = useState("");
  const [aiSource, setAiSource] = useState<"live" | "fallback" | null>(null);

  // live preview totals via the same engine
  const totals = useMemo(() => {
    if (!pkg) return null;
    return computeQuotationTotals({
      equipment_cost: pkg.equipment_cost,
      installation_cost: installationCost ?? pkg.installation_cost,
      additional_items: additional, tax_percent: pkg.tax_percent,
      discount, subsidy_estimate: subsidy,
    });
  }, [pkg, additional, discount, subsidy, installationCost]);

  const askAI = async () => {
    if (!pkg) return;
    setAiBusy(true);
    try {
      const out = await aiQuotationSummary({
        number: "QT (draft)", package_name: pkg.name, capacity_kw: pkg.capacity_kw, system_type: pkg.system_type,
        panel_wattage: pkg.panel_wattage, panel_count: pkg.panel_count, total: totals?.total ?? 0,
        additional_items: additional,
      }, survey ?? null);
      setAiText(out.summary);
      setAiSource(out.source);
      if (out.missingInfo.length) toast.info("AI assistant flagged missing info", out.missingInfo.join(" · "));
    } finally { setAiBusy(false); }
  };

  const save = () => {
    const errs: Record<string, string> = {};
    if (!customerId) errs.customer_id = "Select a customer";
    if (!pkg) errs.package_id = "Select a package";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      const qt = api.createQuotation({
        customer_id: customerId, survey_id: surveyId || null, package_id: pkgId,
        additional_items: additional, discount, subsidy_estimate: subsidy,
        installation_cost_override: installationCost, valid_until: validUntil, terms: terms || "",
      });
      toast.success("Quotation created (draft)", `${qt.number} · ${formatINR(qt.total)}`);
      onClose();
    } catch (e) { toast.error("Create failed", e instanceof Error ? e.message : String(e)); }
  };

  return (
    <Modal open onClose={onClose} title="New quotation" width="max-w-2xl">
      <div className="grid gap-3.5 sm:grid-cols-2">
        <FG label="Customer" required err={errors.customer_id} className="sm:col-span-2">
          <Select value={customerId} onChange={(e) => { setCustomerId(e.target.value); setSurveyId(""); }}>
            {db.customers.map((c) => <option key={c.id} value={c.id}>{c.full_name} · {c.city}</option>)}
          </Select>
        </FG>
        <FG label="Site survey (recommended from completed surveys)" className="sm:col-span-2">
          <Select value={surveyId} onChange={(e) => setSurveyId(e.target.value)}>
            <option value="">No survey linked</option>
            {surveys.map((s) => <option key={s.id} value={s.id}>{s.code} · {s.roof_type} · {s.required_capacity_kw} kW</option>)}
          </Select>
        </FG>
        <FG label="Package" required err={errors.package_id} className="sm:col-span-2">
          <Select value={pkgId} onChange={(e) => setPkgId(e.target.value)}>
            {db.solar_packages.filter((p) => p.is_active).map((p) => (
              <option key={p.id} value={p.id}>{p.name} · {p.capacity_kw} kW · demo price {formatINR(p.equipment_cost)}</option>
            ))}
          </Select>
        </FG>
        <FG label="Installed cost override (optional, ₹)" hint="Leave blank to use package installation charges">
          <Input type="number" value={installationCost ?? ""} onChange={(e) => setInstallationCost(e.target.value === "" ? null : Number(e.target.value))} />
        </FG>
        <FG label="Valid until" required>
          <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
        </FG>
      </div>

      {/* Additional items */}
      <div className="mt-3">
        <Label>Additional line items (optional)</Label>
        {additional.map((a, i) => (
          <div key={i} className="mb-1.5 flex gap-2">
            <Input placeholder="Description" value={a.description} onChange={(e) => setAdditional(additional.map((x, xi) => xi === i ? { ...x, description: e.target.value } : x))} />
            <Input type="number" className="w-32" value={a.amount} onChange={(e) => setAdditional(additional.map((x, xi) => xi === i ? { ...x, amount: Number(e.target.value) } : x))} />
            <Button variant="ghost" size="sm" onClick={() => setAdditional(additional.filter((_, xi) => xi !== i))}>✕</Button>
          </div>
        ))}
        <Button size="sm" variant="outline" onClick={() => setAdditional([...additional, { description: "", amount: 0 }])}>
          <Plus className="h-3.5 w-3.5" /> Add line item
        </Button>
      </div>

      <div className="mt-3 grid gap-3.5 sm:grid-cols-2">
        <FG label="Discount (₹)">
          <Input type="number" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} />
        </FG>
        <FG label="Estimated subsidy (₹)" hint="Editable assumption — never auto-promised">
          <Input type="number" value={subsidy} onChange={(e) => setSubsidy(Number(e.target.value))} />
        </FG>
      </div>

      {/* Totals preview */}
      {totals && pkg && (
        <div className="mt-4 rounded-xl bg-slate-50 p-3.5 text-[13px]">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Computed by application logic (package catalogue + items + GST − discount − subsidy)</p>
          <div className="space-y-1">
            <TotLine l={`Equipment (${pkg.panel_count} × ${pkg.panel_wattage}W + inverter + BOS)`} v={formatINR(pkg.equipment_cost)} />
            <TotLine l="Installation charges" v={formatINR(installationCost ?? pkg.installation_cost)} />
            {additional.filter((a) => a.description).map((a, i) => <TotLine key={i} l={a.description} v={formatINR(a.amount)} />)}
            <TotLine l="Subtotal" v={formatINR(totals.subtotal)} strong />
            {!!discount && <TotLine l="Discount" v={"− " + formatINR(discount)} />}
            <TotLine l={`GST @ ${pkg.tax_percent}%`} v={formatINR(totals.tax_amount)} />
            {!!subsidy && <TotLine l="Estimated subsidy" v={"− " + formatINR(totals.subsidy_estimate)} />}
            <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-bold text-slate-900">
              <span>Total payable</span><span>{formatINR(totals.total)}</span>
            </div>
          </div>
        </div>
      )}

      <div className="mt-3">
        <Label>Terms & conditions (optional — defaults shown on the document)</Label>
        <Textarea value={terms} onChange={(e) => setTerms(e.target.value)} className="min-h-[70px]" placeholder='Leave empty to use standard demo terms' />
      </div>

      {/* AI assistant */}
      <div className="mt-3 rounded-xl border border-brand-200 bg-brand-50/60 p-3.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[12.5px] font-semibold text-brand-900">AI quotation assistant (draft text only)</p>
          <Button size="sm" variant="secondary" onClick={askAI} disabled={aiBusy || !pkg}>
            {aiBusy ? "Generating…" : "Generate summary"}
          </Button>
        </div>
        {aiText && (
          <div className="mt-2.5">
            <p className="whitespace-pre-line rounded-lg bg-white p-3 text-[12.5px] leading-relaxed text-slate-600">{aiText}</p>
            {aiSource === "fallback" && <p className="mt-1 text-[10.5px] text-amber-700">Rule-based offline generation (no AI key configured). Requires staff review before sending.</p>}
            {aiSource === "live" && <p className="mt-1 text-[10.5px] text-emerald-700">Generated by AI via server proxy. Requires staff review before sending.</p>}
          </div>
        )}
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={save}>Create draft quotation</Button>
      </div>
    </Modal>
  );
}

function TotLine({ l, v, strong }: { l: string; v: string; strong?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className={strong ? "font-semibold text-slate-700" : "text-slate-500"}>{l}</span>
      <span className="text-slate-700">{v}</span>
    </div>
  );
}

function FG({ label, children, err, required, className, hint }: { label: string; children: React.ReactNode; err?: string; required?: boolean; className?: string; hint?: string }) {
  return (
    <div className={className}>
      <Label required={required}>{label}</Label>
      {children}
      {hint && <p className="mt-0.5 text-[10.5px] text-slate-400">{hint}</p>}
      <FieldError message={err} />
    </div>
  );
}
