import { useMemo, useState } from "react";
import { Search, Plus, Landmark, Info } from "lucide-react";
import { Card, PageHeader, Button, Input, Select, Modal, Label, Table, Th, Td, Badge, FieldError, EmptyState, StatTile, Textarea } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useDB, api } from "@/services";
import { SUBSIDY_STATUS } from "@/lib/labels";
import { formatINR, formatDate, todayISO, downloadTextFile } from "@/lib/utils";
import type { SubsidyApplication } from "@/types";

export default function SubsidiesPage() {
  const db = useDB();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [modal, setModal] = useState<{ app?: SubsidyApplication } | null>(null);

  const rows = useMemo(() => db.subsidy_applications
    .filter((s) => {
      const t = q.toLowerCase();
      const cust = db.customers.find((c) => c.id === s.customer_id)?.full_name ?? "";
      return !t || cust.toLowerCase().includes(t) || s.program_name.toLowerCase().includes(t) || s.application_ref.toLowerCase().includes(t);
    }), [db, q]);

  const totals = useMemo(() => {
    const est = db.subsidy_applications.reduce((s, x) => s + x.estimated_amount, 0);
    const app = db.subsidy_applications.reduce((s, x) => s + x.approved_amount, 0);
    const rec = db.subsidy_applications.reduce((s, x) => s + x.received_amount, 0);
    return { est, app, rec };
  }, [db]);

  return (
    <div className="space-y-5">
      <PageHeader title="Subsidy Tracking" subtitle="Estimated / requested / approved / received tracked separately — approvals are never promised">
        <Button onClick={() => setModal({})}><Plus className="h-4 w-4" /> New application</Button>
      </PageHeader>

      <div className="rounded-lg border border-sky-200 bg-sky-50 px-3.5 py-2.5 text-[12.5px] text-sky-800">
        <Info className="mr-1 inline h-3.5 w-3.5" /> This module <b>does not</b> hardcode current government subsidy amounts or eligibility rules.
        Amounts and program names are editable records maintained by staff — for example "PM Surya Ghar" is seeded as a labelled assumption.
      </div>

      <div className="grid gap-3 grid-cols-3">
        <StatTile label="Total estimated" value={formatINR(totals.est)} icon={Landmark} />
        <StatTile label="Total approved" value={formatINR(totals.app)} tone="good" icon={Landmark} />
        <StatTile label="Actually received" value={formatINR(totals.rec)} tone={totals.rec ? "good" : "default"} icon={Landmark} />
      </div>

      <div className="flex gap-2">
        <div className="relative w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input className="pl-8" placeholder="Search customer, program, reference…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      <Card>
        {rows.length ? (
          <Table>
            <thead><tr><Th>Customer / project</Th><Th>Program</Th><Th>Ref & dates</Th><Th>Estimated / requested</Th><Th>Approved / received</Th><Th>Status</Th><Th className="text-right">Action</Th></tr></thead>
            <tbody>
              {rows.map((s) => {
                const cust = db.customers.find((c) => c.id === s.customer_id);
                const proj = db.installation_projects.find((p) => p.id === s.project_id);
                return (
                  <tr key={s.id} className="hover:bg-slate-50/60">
                    <Td>{cust?.full_name}{proj && <p className="text-[10.5px] text-slate-400">{proj.number}</p>}</Td>
                    <Td className="max-w-[220px] text-[12px]">{s.program_name}</Td>
                    <Td><p className="font-mono text-[11px]">{s.application_ref || "—"}</p><p className="text-[10.5px] text-slate-400">applied {s.application_date ? formatDate(s.application_date) : "—"}{s.approval_date ? ` · approved ${formatDate(s.approval_date)}` : ""}</p></Td>
                    <Td><p>{formatINR(s.estimated_amount)}</p><p className="text-[10.5px] text-slate-400">requested {formatINR(s.requested_amount)}</p></Td>
                    <Td><p className="font-semibold">{formatINR(s.approved_amount)}</p><p className="text-[10.5px] text-emerald-700">received {formatINR(s.received_amount)}</p></Td>
                    <Td><Badge status={s.status} label={SUBSIDY_STATUS[s.status]} /></Td>
                    <Td className="text-right"><Button size="sm" variant="ghost" onClick={() => setModal({ app: s })}>Edit</Button></Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : <EmptyState icon={Landmark} title="No subsidy applications" action={<Button onClick={() => setModal({})}><Plus className="h-4 w-4" /> New application</Button>} />}
      </Card>

      {modal && <SubsidyModal app={modal.app} onClose={() => setModal(null)} />}
    </div>
  );
}

function SubsidyModal({ app, onClose }: { app?: SubsidyApplication; onClose: () => void }) {
  const db = useDB();
  const toast = useToast();
  const [form, setForm] = useState(() => app ? {
    customer_id: app.customer_id, project_id: app.project_id ?? "", program_name: app.program_name,
    estimated_amount: String(app.estimated_amount), requested_amount: String(app.requested_amount),
    application_ref: app.application_ref, application_date: app.application_date ?? "",
    status: app.status, approval_date: app.approval_date ?? "", approved_amount: String(app.approved_amount),
    received_amount: String(app.received_amount), notes: app.notes,
  } : {
    customer_id: db.customers[0]?.id ?? "", project_id: "", program_name: "PM Surya Ghar: Muft Bijli Yojana (assumption — verify current rules)",
    estimated_amount: "", requested_amount: "", application_ref: "", application_date: "", status: "draft" as const,
    approval_date: "", approved_amount: "", received_amount: "", notes: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const save = () => {
    const errs: Record<string, string> = {};
    if (!form.customer_id) errs.customer_id = "Select customer";
    if (!form.program_name.trim()) errs.program_name = "Program name required";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    api.saveSubsidy({
      id: app?.id, customer_id: form.customer_id, project_id: form.project_id || null,
      program_name: form.program_name, estimated_amount: Number(form.estimated_amount || 0),
      requested_amount: Number(form.requested_amount || 0), application_ref: form.application_ref,
      application_date: form.application_date || null, status: form.status as never,
      approval_date: form.approval_date || null, approved_amount: Number(form.approved_amount || 0),
      received_amount: Number(form.received_amount || 0), notes: form.notes,
    });
    toast.success(app ? "Application updated" : "Application created");
    onClose();
  };
  void errors;
  void toast;
  void downloadTextFile;
  void todayISO;
  return (
    <Modal open onClose={onClose} title={app ? `Edit subsidy application` : "New subsidy application"} width="max-w-xl">
      <div className="grid gap-3.5 sm:grid-cols-2">
        <FG className="sm:col-span-2" label="Customer" required>
          <Select value={form.customer_id} onChange={(e) => set("customer_id", e.target.value)}>
            <option value="">Select customer…</option>
            {db.customers.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            {db.customers.length === 0 && <option value="" disabled>No registered customers found</option>}
          </Select>
        </FG>
        <FG className="sm:col-span-2" label="Installation project (optional)">
          <Select value={form.project_id} onChange={(e) => set("project_id", e.target.value)}>
            <option value="">Not linked</option>
            {db.installation_projects.map((p) => <option key={p.id} value={p.id}>{p.number}</option>)}
          </Select>
        </FG>
        <FG className="sm:col-span-2" label="Program name" required hint="Editable text — keep assumptions explicit">
          <Input value={form.program_name} onChange={(e) => set("program_name", e.target.value)} />
        </FG>
        <FG label="Estimated amount (₹)"><Input type="number" value={form.estimated_amount} onChange={(e) => set("estimated_amount", e.target.value)} /></FG>
        <FG label="Requested amount (₹)"><Input type="number" value={form.requested_amount} onChange={(e) => set("requested_amount", e.target.value)} /></FG>
        <FG label="Application reference"><Input value={form.application_ref} onChange={(e) => set("application_ref", e.target.value)} /></FG>
        <FG label="Application date"><Input type="date" value={form.application_date} onChange={(e) => set("application_date", e.target.value)} /></FG>
        <FG label="Status">
          <Select value={form.status} onChange={(e) => set("status", e.target.value)}>
            {Object.entries(SUBSIDY_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </FG>
        <FG label="Approval date"><Input type="date" value={form.approval_date} onChange={(e) => set("approval_date", e.target.value)} /></FG>
        <FG label="Approved amount (₹)"><Input type="number" value={form.approved_amount} onChange={(e) => set("approved_amount", e.target.value)} /></FG>
        <FG label="Received amount (₹)"><Input type="number" value={form.received_amount} onChange={(e) => set("received_amount", e.target.value)} /></FG>
        <FG className="sm:col-span-2" label="Notes"><Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} className="min-h-[54px]" /></FG>
      </div>
      <div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save}>{app ? "Save changes" : "Create application"}</Button></div>
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
