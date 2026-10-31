import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Search, Plus, Pencil, Play, CheckCircle2, XCircle, FileText, ClipboardCheck } from "lucide-react";
import { Card, PageHeader, Button, Input, Select, Modal, Label, Table, Th, Td, Badge, FieldError, EmptyState, ConfirmDialog } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useDB, api } from "@/services";
import type { SiteSurvey } from "@/types";
import { SURVEY_STATUS } from "@/lib/labels";
import { recommendCapacity } from "@/lib/calculations/finance";
import { formatDate, titleCase } from "@/lib/utils";
import { todayISO } from "@/lib/utils";

const ROOF_TYPES = ["RCC concrete", "Sheet roof", "Tile roof", "Metal sheet", "Ground mount"];
const SHADING = ["None", "Minimal (some morning shadow)", "Moderate afternoon", "Heavy shading", "Unknown"];

export default function SurveysPage() {
  const db = useDB();
  const toast = useToast();
  const navigate = useNavigate();
  const [modal, setModal] = useState<{ mode: "create" | "edit"; survey?: SiteSurvey } | null>(null);
  const [cancelTarget, setCancelTarget] = useState<SiteSurvey | null>(null);
  const [q, setQ] = useState("");
  const [statusF, setStatusF] = useState("all");

  const rows = useMemo(() => db.site_surveys
    .filter((s) => (statusF === "all" ? true : s.status === statusF))
    .filter((s) => {
      const term = q.toLowerCase();
      const cust = db.customers.find((c) => c.id === s.customer_id)?.full_name ?? "";
      return !term || s.code.toLowerCase().includes(term) || cust.toLowerCase().includes(term);
    }), [db.site_surveys, db.customers, q, statusF]);

  return (
    <div className="space-y-5">
      <PageHeader title="Site Surveys" subtitle={`${db.site_surveys.filter((s) => ["scheduled", "in_progress"].includes(s.status)).length} pending · ${db.site_surveys.filter((s) => s.status === "completed").length} completed`}>
        <Button onClick={() => setModal({ mode: "create" })}><Plus className="h-4 w-4" /> Schedule survey</Button>
      </PageHeader>

      <div className="flex flex-wrap gap-2">
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input className="pl-8" placeholder="Search customer or survey code…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select className="w-44" value={statusF} onChange={(e) => setStatusF(e.target.value)}>
          <option value="all">All statuses</option>
          {Object.entries(SURVEY_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
      </div>

      <Card>
        {rows.length ? (
          <Table>
            <thead>
              <tr><Th>Survey</Th><Th>Customer</Th><Th>Date</Th><Th>Roof</Th><Th>Capacity</Th><Th>Status</Th><Th className="text-right">Actions</Th></tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const cust = db.customers.find((c) => c.id === s.customer_id);
                return (
                  <tr key={s.id} className="hover:bg-slate-50/60">
                    <Td><p className="font-semibold text-slate-800">{s.code}</p><p className="text-[11px] text-slate-400">{s.surveyor}</p></Td>
                    <Td><Link to={`/customers/${cust?.id}`} className="text-brand-700 hover:underline">{cust?.full_name}</Link><p className="text-[11px] text-slate-400">{cust?.city}</p></Td>
                    <Td>{formatDate(s.survey_date)}</Td>
                    <Td><p>{s.roof_type}</p><p className="text-[11px] text-slate-400">{s.roof_area_sqm} m² / {s.installable_area_sqm} m² usable</p></Td>
                    <Td><p className="font-semibold">{s.required_capacity_kw} kW</p><p className="text-[11px] text-slate-400">≈{recommendCapacity(s.monthly_units)} kW est · {s.monthly_units} u/mo</p></Td>
                    <Td><Badge status={s.status} label={SURVEY_STATUS[s.status]} /></Td>
                    <Td>
                      <div className="flex justify-end gap-1">
                        {s.status === "scheduled" && (
                          <Button size="sm" variant="ghost" title="Start survey" onClick={() => { api.updateSurvey(s.id, { status: "in_progress" }); toast.success("Survey marked in progress"); }}>
                            <Play className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {["scheduled", "in_progress"].includes(s.status) && (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => setModal({ mode: "edit", survey: s })}><Pencil className="h-3.5 w-3.5" /></Button>
                            <Button size="sm" variant="secondary" onClick={() => {
                              api.completeSurvey(s.id);
                              toast.success("Survey completed", "Use “Generate quotation” to create the proposal.");
                            }}><CheckCircle2 className="h-3.5 w-3.5" /> Complete</Button>
                          </>
                        )}
                        {s.status !== "cancelled" && s.status !== "completed" && (
                          <Button size="sm" variant="ghost" title="Cancel survey" onClick={() => setCancelTarget(s)}><XCircle className="h-3.5 w-3.5 text-rose-500" /></Button>
                        )}
                        {s.status === "completed" && (
                          <Button size="sm" variant="secondary" onClick={() => navigate(`/quotations?customer=${s.customer_id}&survey=${s.id}`)}>
                            <FileText className="h-3.5 w-3.5" /> Generate quotation
                          </Button>
                        )}
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : <EmptyState icon={ClipboardCheck} title="No surveys" subtitle="Schedule the first site survey." action={<Button onClick={() => setModal({ mode: "create" })}><Plus className="h-4 w-4" /> Schedule survey</Button>} />}
      </Card>

      {modal && <SurveyModal mode={modal.mode} survey={modal.survey} onClose={() => setModal(null)} />}
      <ConfirmDialog open={!!cancelTarget} onClose={() => setCancelTarget(null)} title="Cancel survey?"
        message={`Cancel survey ${cancelTarget?.code}? The customer's lead status will remain unchanged.`}
        confirmLabel="Cancel survey" danger
        onConfirm={() => { api.updateSurvey(cancelTarget!.id, { status: "cancelled" }); toast.info("Survey cancelled"); }} />
    </div>
  );
}

function SurveyModal({ mode, survey, onClose }: { mode: "create" | "edit"; survey?: SiteSurvey; onClose: () => void }) {
  const db = useDB();
  const toast = useToast();
  const customers = db.customers;
  const [form, setForm] = useState(() => survey ? {
    customer_id: survey.customer_id, survey_date: survey.survey_date, surveyor: survey.surveyor,
    property_type: survey.property_type, roof_type: survey.roof_type,
    roof_area_sqm: String(survey.roof_area_sqm), installable_area_sqm: String(survey.installable_area_sqm),
    shading: survey.shading, monthly_units: String(survey.monthly_units), monthly_bill: String(survey.monthly_bill),
    required_capacity_kw: String(survey.required_capacity_kw), grid_available: survey.grid_available,
    recommended_system_type: survey.recommended_system_type, constraints: survey.constraints,
    notes: survey.notes, status: survey.status,
  } : {
    customer_id: customers[0]?.id ?? "", survey_date: todayISO(), surveyor: "Kiran Babu (Surveyor)",
    property_type: "Independent house", roof_type: ROOF_TYPES[0], roof_area_sqm: "", installable_area_sqm: "",
    shading: SHADING[0], monthly_units: "", monthly_bill: "", required_capacity_kw: "", grid_available: true,
    recommended_system_type: "on_grid", constraints: "", notes: "", status: "scheduled",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: string, v: string | boolean) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (k === "monthly_units" && !form.required_capacity_kw) {
      const n = Number(v);
      if (n > 0) setForm((f) => ({ ...f, monthly_units: String(v), required_capacity_kw: String(recommendCapacity(n)) }));
    }
  };

  const save = () => {
    const errs: Record<string, string> = {};
    if (!form.customer_id) errs.customer_id = "Select a customer";
    if (mode === "create" || form.roof_area_sqm !== String(survey?.roof_area_sqm)) {
      if (!Number(form.roof_area_sqm)) errs.roof_area_sqm = "Roof area required";
      else if (Number(form.roof_area_sqm) <= 0) errs.roof_area_sqm = "Must be > 0";
    }
    if (Number(form.installable_area_sqm) > Number(form.roof_area_sqm)) errs.installable_area_sqm = "Usable area cannot exceed roof area";
    if (Number(form.monthly_bill) < 0) errs.monthly_bill = "Cannot be negative";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const payload = {
      customer_id: form.customer_id, survey_date: form.survey_date, surveyor: form.surveyor,
      property_type: form.property_type, roof_type: form.roof_type,
      roof_area_sqm: Number(form.roof_area_sqm), installable_area_sqm: Number(form.installable_area_sqm),
      shading: form.shading, monthly_units: Number(form.monthly_units), monthly_bill: Number(form.monthly_bill),
      required_capacity_kw: Number(form.required_capacity_kw), grid_available: form.grid_available,
      recommended_system_type: form.recommended_system_type, constraints: form.constraints,
      notes: form.notes, status: form.status as SiteSurvey["status"],
    };
    try {
      if (mode === "create") {
        const s = api.createSurvey(payload);
        toast.success("Survey scheduled", `${s.code} for ${db.customers.find((c) => c.id === s.customer_id)?.full_name}`);
      } else {
        api.updateSurvey(survey!.id, payload);
        toast.success("Survey updated");
      }
      onClose();
    } catch (e) { toast.error("Save failed", e instanceof Error ? e.message : String(e)); }
  };

  return (
    <Modal open onClose={onClose} title={mode === "create" ? "Schedule site survey" : `Edit survey ${survey?.code}`} width="max-w-2xl">
      <div className="grid gap-3.5 sm:grid-cols-2">
        <FG label="Customer" required err={errors.customer_id} className="sm:col-span-2">
          <Select value={form.customer_id} onChange={(e) => set("customer_id", e.target.value)}>
            <option value="">Select customer…</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.full_name} · {c.city} ({c.customer_type})</option>)}
          </Select>
        </FG>
        <FG label="Survey date" required>
          <Input type="date" value={form.survey_date} onChange={(e) => set("survey_date", e.target.value)} />
        </FG>
        <FG label="Surveyor">
          <Select value={form.surveyor} onChange={(e) => set("surveyor", e.target.value)}>
            {["Kiran Babu (Surveyor)", "Deepak Rao (Surveyor)"].map((s) => <option key={s}>{s}</option>)}
          </Select>
        </FG>
        <FG label="Property type">
          <Select value={form.property_type} onChange={(e) => set("property_type", e.target.value)}>
            {["Independent house", "Apartment (own rooftop rights)", "Commercial building", "Industrial shed"].map((s) => <option key={s}>{s}</option>)}
          </Select>
        </FG>
        <FG label="Roof type">
          <Select value={form.roof_type} onChange={(e) => set("roof_type", e.target.value)}>
            {ROOF_TYPES.map((s) => <option key={s}>{s}</option>)}
          </Select>
        </FG>
        <FG label="Roof area (m²)" required err={errors.roof_area_sqm}>
          <Input type="number" value={form.roof_area_sqm} onChange={(e) => set("roof_area_sqm", e.target.value)} />
        </FG>
        <FG label="Installable area (m²)" err={errors.installable_area_sqm}>
          <Input type="number" value={form.installable_area_sqm} onChange={(e) => set("installable_area_sqm", e.target.value)} />
        </FG>
        <FG label="Shading conditions">
          <Select value={form.shading} onChange={(e) => set("shading", e.target.value)}>
            {SHADING.map((s) => <option key={s}>{s}</option>)}
          </Select>
        </FG>
        <FG label="Current consumption (units/month)" >
          <Input type="number" value={form.monthly_units} onChange={(e) => set("monthly_units", e.target.value)} />
        </FG>
        <FG label="Monthly electricity bill (₹)" err={errors.monthly_bill}>
          <Input type="number" value={form.monthly_bill} onChange={(e) => set("monthly_bill", e.target.value)} />
        </FG>
        <FG label="Required system capacity (kW)" hint="Auto-suggested from monthly units">
          <Input type="number" step="0.5" value={form.required_capacity_kw} onChange={(e) => set("required_capacity_kw", e.target.value)} />
        </FG>
        <FG label="Grid availability">
          <Select value={String(form.grid_available)} onChange={(e) => set("grid_available", e.target.value === "true")}>
            <option value="true">Grid available</option>
            <option value="false">No grid connection</option>
          </Select>
        </FG>
        <FG label="Recommended system type">
          <Select value={form.recommended_system_type} onChange={(e) => set("recommended_system_type", e.target.value)}>
            <option value="on_grid">On-Grid</option>
            <option value="off_grid">Off-Grid</option>
          </Select>
        </FG>
        {mode === "edit" && (
          <FG label="Status" className="sm:col-span-2">
            <Select value={form.status} onChange={(e) => set("status", e.target.value)}>
              {Object.keys(SURVEY_STATUS).map((k) => <option key={k} value={k}>{titleCase(k)}</option>)}
            </Select>
          </FG>
        )}
        <FG label="Installation constraints" className="sm:col-span-2">
          <Input value={form.constraints} onChange={(e) => set("constraints", e.target.value)} placeholder="Lift availability, roof age, cable runs…" />
        </FG>
        <FG label="Survey notes" className="sm:col-span-2">
          <Input value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </FG>
      </div>
      {(Number(form.monthly_units) > 0) && (
        <p className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-[11.5px] text-brand-800">
          Suggested capacity for {form.monthly_units} units/month ≈ <b>{recommendCapacity(Number(form.monthly_units))} kW</b> (assumption: 4 kWh/kW/day, editable guidance).
        </p>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={save}>{mode === "create" ? "Schedule survey" : "Save survey"}</Button>
      </div>
    </Modal>
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
