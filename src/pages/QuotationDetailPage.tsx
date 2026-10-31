import { useState } from "react";
import { useParams, useNavigate } from "react-router";
import { ArrowLeft, Send, CheckCircle2, XCircle, RotateCcw, Printer, Sparkles, Lock, ShieldCheck, Trash2 } from "lucide-react";
import { Card, CardHeader, Badge, Button, Table, Th, Td, EmptyState, Modal, ConfirmDialog, Label, Input, Textarea } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useDB, api } from "@/services";
import { QUOTATION_STATUS } from "@/lib/labels";
import { formatINR, formatDate, formatDateTime } from "@/lib/utils";
import { computeQuotationTotals } from "@/lib/calculations/finance";
import { aiQuotationSummary, AI_SOURCE_LABEL } from "@/lib/ai";
import { printQuotation } from "@/lib/certificate";

export default function QuotationDetailPage() {
  const { id } = useParams();
  const db = useDB();
  const q = db.quotations.find((x) => x.id === id);
  const navigate = useNavigate();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiResult, setAiResult] = useState<Awaited<ReturnType<typeof aiQuotationSummary>> | null>(null);
  const [convertConfirm, setConvertConfirm] = useState(false);

  if (!q) {
    return (
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate("/quotations")}><ArrowLeft className="h-4 w-4" /> Quotations</Button>
        <EmptyState icon={ArrowLeft} title="Quotation not found" />
      </div>
    );
  }
  const customer = db.customers.find((c) => c.id === q.customer_id);
  const survey = q.survey_id ? db.site_surveys.find((s) => s.id === q.survey_id) : null;
  const project = db.installation_projects.find((p) => p.quotation_id === q.id && p.status !== "cancelled");
  const editable = ["draft", "generated"].includes(q.status);

  const askAI = async () => {
    setAiBusy(true);
    try {
      const out = await aiQuotationSummary({
        number: q.number, package_name: q.package_name, capacity_kw: q.capacity_kw,
        system_type: q.system_type, panel_wattage: q.panel_wattage, panel_count: q.panel_count,
        total: q.total, additional_items: q.additional_items,
      }, survey ? {
        roof_type: survey.roof_type, shading: survey.shading, installable_area_sqm: survey.installable_area_sqm,
        monthly_units: survey.monthly_units, constraints: survey.constraints, property_type: survey.property_type,
        required_capacity_kw: survey.required_capacity_kw,
      } : null);
      setAiResult(out);
    } finally { setAiBusy(false); }
  };

  const act = (a: "generate" | "send" | "accept" | "reject" | "mark_expired" | "reopen") => {
    try {
      api.quotationAction(q.id, a);
      toast.success(`Quotation ${a} successful`.replace("generate successful", "marked as generated").replace("send successful", "sent").replace("accept successful", "accepted").replace("reject successful", "rejected").replace("mark_expired successful", "marked expired").replace("reopen successful", "reopened as draft"));
      if (a === "accept") toast.info("Next step", 'Use "Convert → Project" to create the installation.');
    } catch (e) { toast.error("Action failed", e instanceof Error ? e.message : String(e)); }
  };

  const convert = () => {
    try {
      const proj = api.convertQuotationToProject(q.id);
      toast.success(`Project ${proj.number} ready`, "Exactly one project per accepted quotation (duplicates prevented).");
      setConvertConfirm(false);
      navigate(`/installations/${proj.id}`);
    } catch (e) { toast.error("Conversion failed", e instanceof Error ? e.message : String(e)); }
  };

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" onClick={() => navigate("/quotations")}><ArrowLeft className="h-4 w-4" /> Quotations</Button>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-900">{q.number}</h1>
            <Badge status={q.status} label={QUOTATION_STATUS[q.status]} />
          </div>
          <p className="mt-0.5 text-[13px] text-slate-500">
            For {customer?.full_name} · {q.package_name} · {q.capacity_kw} kW {q.system_type === "on_grid" ? "On-Grid" : "Off-Grid"}
            {survey && <> · from survey {survey.code}</>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => printQuotation(q, customer, db.settings.org_name)}>
            <Printer className="h-3.5 w-3.5" /> Print / PDF
          </Button>
          <Button size="sm" variant="outline" onClick={askAI} disabled={aiBusy}>
            <Sparkles className="h-3.5 w-3.5" /> {aiBusy ? "Generating…" : "AI summary"}
          </Button>
          {editable ? (
            <>
              <Button size="sm" variant="secondary" onClick={() => act("send")}><Send className="h-3.5 w-3.5" /> Send to customer</Button>
              <Button size="sm" variant="ghost" onClick={() => act("reject")}><XCircle className="h-3.5 w-3.5 text-rose-500" /> Reject</Button>
            </>
          ) : q.status === "sent" ? (
            <>
              <Button size="sm" variant="accent" onClick={() => act("accept")}><CheckCircle2 className="h-3.5 w-3.5" /> Accept (demo)</Button>
              <Button size="sm" variant="ghost" onClick={() => act("reject")}><XCircle className="h-3.5 w-3.5 text-rose-500" /> Reject</Button>
            </>
          ) : ["rejected", "expired"].includes(q.status) ? (
            <Button size="sm" variant="outline" onClick={() => act("reopen")}><RotateCcw className="h-3.5 w-3.5" /> Reopen as draft</Button>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-400"><Lock className="h-3 w-3" /> accepted — frozen</span>
          )}
        </div>
      </div>

      {/* AI panel */}
      {aiResult && (
        <Card className="border-brand-200 bg-brand-50/50">
          <CardHeader title="AI quotation assistant"
            subtitle={aiResult.source === "live" ? AI_SOURCE_LABEL.live : AI_SOURCE_LABEL.fallback}
            action={<Button size="sm" variant="ghost" onClick={() => setAiResult(null)}><XCircle className="h-3.5 w-3.5" /></Button>} />
          <div className="grid gap-4 px-4 py-4 text-[12.5px] lg:grid-cols-2">
            <div>
              <p className="font-semibold text-slate-700">Draft proposal text (staff must review)</p>
              <p className="mt-1 whitespace-pre-line rounded-lg bg-white p-3 leading-relaxed text-slate-600">{aiResult.summary}</p>
            </div>
            <div className="space-y-2.5">
              <div>
                <p className="font-semibold text-slate-700">Missing information</p>
                {aiResult.missingInfo.length ? (
                  <ul className="mt-1 list-disc space-y-0.5 pl-4 text-slate-600">{aiResult.missingInfo.map((m, i) => <li key={i}>{m}</li>)}</ul>
                ) : <p className="mt-1 text-emerald-700">Nothing flagged — survey data looks complete.</p>}
              </div>
              <div>
                <p className="font-semibold text-slate-700">Suggested optional components (not auto-priced)</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-slate-600">{aiResult.optionalComponents.map((m, i) => <li key={i}>{m}</li>)}</ul>
              </div>
              <p className="rounded-lg bg-amber-50 px-2.5 py-2 text-[11px] text-amber-800">{aiResult.notes}</p>
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Line items */}
        <Card className="lg:col-span-2">
          <CardHeader title="Line items & totals"
            subtitle="All amounts computed by validated application code — the AI never totals"
            action={editable && <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Edit quotation</Button>} />
          <Table>
            <thead><tr><Th>Description</Th><Th className="text-right">Amount</Th></tr></thead>
            <tbody>
              <tr><Td>{q.package_name} — {q.capacity_kw} kW {q.system_type} ({q.panel_count} × {q.panel_wattage}W) <span className="text-slate-400">· equipment & BOS</span></Td><Td className="text-right">{formatINR(q.equipment_cost)}</Td></tr>
              <tr><Td>Installation charges — {q.inverter_spec}</Td><Td className="text-right">{formatINR(q.installation_cost)}</Td></tr>
              {q.additional_items.map((a, i) => (
                <tr key={i}><Td>{a.description} <span className="text-slate-400">· additional</span></Td><Td className="text-right">{formatINR(a.amount)}</Td></tr>
              ))}
              <tr><Td className="font-semibold">Subtotal</Td><Td className="text-right font-semibold">{formatINR(q.subtotal)}</Td></tr>
              {!!q.discount && <tr><Td className="text-rose-700">Discount</Td><Td className="text-right text-rose-700">− {formatINR(q.discount)}</Td></tr>}
              <tr><Td>GST @ {q.tax_percent}%</Td><Td className="text-right">{formatINR(q.tax_amount)}</Td></tr>
              {!!q.subsidy_estimate && <tr><Td className="text-brand-700">Estimated subsidy (editable assumption)</Td><Td className="text-right text-brand-700">− {formatINR(q.subsidy_estimate)}</Td></tr>}
              <tr className="bg-brand-50/70"><Td className="font-bold text-slate-900">Total payable</Td><Td className="text-right text-[15px] font-bold text-brand-800">{formatINR(q.total)}</Td></tr>
            </tbody>
          </Table>
        </Card>

        {/* Side meta */}
        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="text-sm font-semibold text-slate-800">Details</h3>
            <dl className="mt-3 space-y-2 text-[12.5px]">
              {[
                ["Customer", customer?.full_name ?? "—"],
                ["Linked survey", survey ? survey.code : "— (self-reported)"],
                ["Generated", formatDateTime(q.created_at)],
                ["Valid until", formatDate(q.valid_until)],
                ["Panels", `${q.panel_count} × ${q.panel_wattage}W`],
                ["Inverter", q.inverter_spec],
                ...(q.battery_spec !== "—" ? [["Battery", q.battery_spec]] : []),
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-slate-400">{k}</dt><dd className="text-right font-medium text-slate-700">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>

          {q.status === "accepted" && (
              <Card className="border-emerald-200 bg-emerald-50/60 p-4">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-emerald-900"><ShieldCheck className="h-4 w-4" /> Convert to installation</h3>
              {project ? (
                <p className="mt-2 text-[12.5px] text-emerald-800">
                  Already converted: <button className="font-semibold underline" onClick={() => navigate(`/installations/${project.id}`)}>{project.number}</button>.
                  Repeated conversion is prevented (idempotent).
                </p>
              ) : (
                <>
                  <p className="mt-2 text-[12.5px] text-emerald-800">Creates exactly one installation project with the accepted amount, a full checklist, and a default staged payment plan.</p>
                  <Button className="mt-3 w-full" onClick={() => setConvertConfirm(true)}>Convert → Project</Button>
                </>
              )}
            </Card>
          )}

          <Card>
            <CardHeader title="History" />
            <div className="px-4 py-3">
              {db.activity_logs.filter((a) => a.entity_id === q.id).slice(0, 8).map((a) => (
                <div key={a.id} className="border-b border-slate-50 py-1.5 text-[12px] last:border-0">
                  {a.message} <span className="text-slate-400">· {formatDateTime(a.created_at)}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {editing && <EditQuotationModal quotationId={q.id} onClose={() => setEditing(false)} />}
      <ConfirmDialog open={convertConfirm} onClose={() => setConvertConfirm(false)} title="Create installation project?"
        message={`Create the installation project for ${q.number} at ${formatINR(q.total)}? The project, checklist and staged payments are created together and conversion is idempotent.`}
        confirmLabel="Convert to project" onConfirm={convert} />
    </div>
  );
}

function EditQuotationModal({ quotationId, onClose }: { quotationId: string; onClose: () => void }) {
  const db = useDB();
  const toast = useToast();
  const q = db.quotations.find((x) => x.id === quotationId)!;
  const [items, setItems] = useState(q.additional_items.length ? q.additional_items.map((a) => ({ ...a })) : []);
  const [discount, setDiscount] = useState(q.discount);
  const [subsidy, setSubsidy] = useState(q.subsidy_estimate);
  const [installCost, setInstallCost] = useState(q.installation_cost);
  const [validUntil, setValidUntil] = useState(q.valid_until);

  const totals = computeQuotationTotals({
    equipment_cost: q.equipment_cost, installation_cost: installCost,
    additional_items: items, tax_percent: q.tax_percent, discount, subsidy_estimate: subsidy,
  });

  const save = () => {
    api.updateQuotationDetails(q.id, { additional_items: items, discount, subsidy_estimate: subsidy, installation_cost: installCost, valid_until: validUntil });
    toast.success("Quotation recalculated", `New total ${formatINR(totals.total)}`);
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={`Edit ${q.number}`} width="max-w-xl">
      <div className="space-y-3">
        <div>
          <Label>Additional line items</Label>
          {items.map((a, i) => (
            <div key={i} className="mb-1.5 flex gap-2">
              <Input value={a.description} onChange={(e) => setItems(items.map((x, xi) => xi === i ? { ...x, description: e.target.value } : x))} placeholder="Description" />
              <Input type="number" className="w-32" value={a.amount} onChange={(e) => setItems(items.map((x, xi) => xi === i ? { ...x, amount: Number(e.target.value) } : x))} />
              <Button variant="ghost" size="sm" onClick={() => setItems(items.filter((_, xi) => xi !== i))}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={() => setItems([...items, { description: "", amount: 0 }])}>+ Add item</Button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Installation charges (₹)</Label>
            <Input type="number" value={installCost} onChange={(e) => setInstallCost(Number(e.target.value))} />
          </div>
          <div>
            <Label>Discount (₹)</Label>
            <Input type="number" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} />
          </div>
          <div>
            <Label>Estimated subsidy (₹)</Label>
            <Input type="number" value={subsidy} onChange={(e) => setSubsidy(Number(e.target.value))} />
          </div>
          <div>
            <Label>Valid until</Label>
            <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
          </div>
        </div>
        <div className="rounded-lg bg-slate-50 p-3 text-[13px]">
          <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span>{formatINR(totals.subtotal)}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">GST {q.tax_percent}%</span><span>{formatINR(totals.tax_amount)}</span></div>
          <div className="flex justify-between pt-1.5 font-bold"><span>Total payable</span><span>{formatINR(totals.total)}</span></div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save}>Save & recalculate</Button>
        </div>
      </div>
    </Modal>
  );
}