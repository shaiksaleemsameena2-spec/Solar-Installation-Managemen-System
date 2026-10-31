import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Search, Plus, Wrench, Send, CheckCircle2, ShieldAlert, Sparkles, X } from "lucide-react";
import { Card, PageHeader, Button, Input, Select, Modal, Label, Table, Th, Td, Badge, FieldError, EmptyState, StatTile, Tabs, Textarea, Modal as M } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useDB, api } from "@/services";
import { TICKET_STATUS, PRIORITY, ISSUE_CATEGORIES, ASSIGNMENT_STATUS } from "@/lib/labels";
import { formatDate, formatDateTime, formatINR, todayISO } from "@/lib/utils";
import { aiServiceGuidance, AI_SOURCE_LABEL } from "@/lib/ai";
import { downloadCSV } from "@/lib/csv";

export default function ServicePage() {
  const db = useDB();
  const toast = useToast();
  const [tab, setTab] = useState("tickets");
  const [q, setQ] = useState("");
  const [statusF, setStatusF] = useState("all");
  const [priorityF, setPriorityF] = useState("all");
  const [creating, setCreating] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);

  const rows = useMemo(() => db.service_tickets
    .filter((t) => (statusF === "all" ? true : t.status === statusF))
    .filter((t) => (priorityF === "all" ? true : t.priority === priorityF))
    .filter((t) => {
      const term = q.toLowerCase();
      const cust = db.customers.find((c) => c.id === t.customer_id)?.full_name ?? "";
      return !term || t.number.toLowerCase().includes(term) || cust.toLowerCase().includes(term) || t.description.toLowerCase().includes(term);
    }), [db.service_tickets, db.customers, q, statusF, priorityF]);

  const openCount = db.service_tickets.filter((t) => ["open", "assigned", "in_progress", "waiting_parts"].includes(t.status)).length;
  const requested = db.service_tickets.filter((t) => t.assignment_status === "requested" || t.assignment_status === "awaiting_confirmation");

  return (
    <div className="space-y-5">
      <PageHeader title="Service Center" subtitle={`${openCount} open · ${requested.length} assignment request(s) awaiting confirmation`}>
        <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New ticket</Button>
      </PageHeader>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <StatTile label="Open tickets" value={openCount} icon={Wrench} tone={openCount ? "warn" : "good"} />
        <StatTile label="Critical/high priority" value={db.service_tickets.filter((t) => ["high", "critical"].includes(t.priority) && !["resolved", "closed"].includes(t.status)).length} tone="bad" />
        <StatTile label="Resolved (all time)" value={db.service_tickets.filter((t) => ["resolved", "closed"].includes(t.status)).length} tone="good" />
        <StatTile label="Service revenue" value={formatINR(db.service_tickets.reduce((s, t) => s + t.actual_cost, 0))} />
      </div>

      <Tabs tabs={[
        { key: "tickets", label: "All tickets", count: db.service_tickets.length },
        { key: "assignments", label: "Assignment requests", count: requested.length },
        { key: "techdash", label: "Technician view (demo)" },
      ]} active={tab} onChange={setTab} />

      {tab === "tickets" && (
        <>
          <div className="flex flex-wrap gap-2">
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input className="pl-8" placeholder="Search ticket, customer, issue…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <Select className="w-40" value={statusF} onChange={(e) => setStatusF(e.target.value)}>
              <option value="all">All statuses</option>
              {Object.entries(TICKET_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
            <Select className="w-36" value={priorityF} onChange={(e) => setPriorityF(e.target.value)}>
              <option value="all">All priorities</option>
              {Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
            <Button variant="ghost" size="sm" onClick={() => downloadCSV("service-tickets.csv", db.service_tickets, ["number", "issue_category", "description", "priority", "status", "assigned_technician", "created_at"])}>Export CSV</Button>
          </div>
          <Card>
            {rows.length ? (
              <Table>
                <thead><tr><Th>Ticket</Th><Th>Customer / project</Th><Th>Issue</Th><Th>Serial</Th><Th>Assigned</Th><Th>Priority</Th><Th>Status</Th><Th className="text-right">Actions</Th></tr></thead>
                <tbody>
                  {rows.map((t) => {
                    const cust = db.customers.find((c) => c.id === t.customer_id);
                    const proj = db.installation_projects.find((p) => p.id === t.project_id);
                    return (
                      <tr key={t.id} className="hover:bg-slate-50/60">
                        <Td><p className="font-mono text-[12px] font-semibold">{t.number}</p><p className="text-[10.5px] text-slate-400">{formatDate(t.created_at)} · via {t.created_by.includes("Portal") ? "Portal" : "Staff"}</p></Td>
                        <Td>
                          <Link to={`/customers/${cust?.id}`} className="text-brand-700 hover:underline">{cust?.full_name}</Link>
                          {proj && <p className="text-[10.5px] text-slate-400">{proj.number}</p>}
                        </Td>
                        <Td><p className="font-medium">{t.issue_category}</p><p className="max-w-[220px] truncate text-[11px] text-slate-400">{t.description}</p></Td>
                        <Td className="font-mono text-[10.5px]">{t.serial_number || "—"}</Td>
                        <Td>
                          <p className="text-[12px]">{t.assigned_technician || "—"}</p>
                          {t.assignment_status && <Badge status={t.assignment_status} label={ASSIGNMENT_STATUS[t.assignment_status]} />}
                          {t.appointment_time && <p className="text-[10px] text-slate-400">apt: {t.appointment_time.slice(0, 16).replace("T", " ")}</p>}
                        </Td>
                        <Td><Badge status={t.priority} /></Td>
                        <Td><Badge status={t.status} label={TICKET_STATUS[t.status]} /></Td>
                        <Td>
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="secondary" onClick={() => setDetail(t.id)}>Open</Button>
                          </div>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            ) : <EmptyState icon={Wrench} title="No tickets match" action={<Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New ticket</Button>} />}
          </Card>
        </>
      )}

      {tab === "assignments" && (
        <Card>
          <Table>
            <thead><tr><Th>Ticket</Th><Th>Customer</Th><Th>Requested technician</Th><Th>Appointment</Th><Th>Assignment status</Th><Th className="text-right">Dispatch actions</Th></tr></thead>
            <tbody>
              {requested.map((t) => {
                const cust = db.customers.find((c) => c.id === t.customer_id);
                return (
                  <tr key={t.id}>
                    <Td className="font-mono text-[12px] font-semibold">{t.number}</Td>
                    <Td>{cust?.full_name}</Td>
                    <Td>{t.assigned_technician}</Td>
                    <Td className="text-[12px]">{t.appointment_time?.replace("T", " ") ?? "—"}</Td>
                    <Td><Badge status={t.assignment_status!} label={ASSIGNMENT_STATUS[t.assignment_status!]} /></Td>
                    <Td>
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="accent" onClick={() => { api.ticketConfirmAssignment(t.id, true); toast.success("Assignment confirmed", `${t.number} → ${t.assigned_technician}`); }}>Confirm</Button>
                        <Button size="sm" variant="outline" onClick={() => { api.ticketConfirmAssignment(t.id, false); toast.info("Request rejected"); }}>Reject</Button>
                      </div>
                    </Td>
                  </tr>
                );
              })}
              {requested.length === 0 && <tr><Td className="text-slate-400">No pending assignment requests.</Td></tr>}
            </tbody>
          </Table>
        </Card>
      )}

      {tab === "techdash" && <TechnicianDashboard onOpen={(id) => { setTab("tickets"); setDetail(id); }} />}

      {creating && <CreateTicketModal onClose={() => setCreating(false)} />}
      {detail && <TicketDetailModal ticketId={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

function TechnicianDashboard({ onOpen }: { onOpen: (id: string) => void }) {
  const db = useDB();
  const assignments = db.service_tickets
    .filter((t) => ["Mahesh K. (Demo Technician)", "Ramesh Yadav (Demo Technician)", "Farzana S. (Demo Technician)"].includes(t.assigned_technician))
    .sort((a, b) => (b.appointment_time ?? "").localeCompare(a.appointment_time ?? ""));
  return (
    <Card>
      <div className="border-b border-slate-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-800">Technician assignment board (demo view)</h3>
        <p className="text-[11.5px] text-slate-400">Confirmed assignments surface here for the assigned technician. In Supabase mode, technician-role users see only their own row via RLS.</p>
      </div>
      <Table>
        <thead><tr><Th>Ticket</Th><Th>Customer</Th><Th>Issue</Th><Th>Appointment</Th><Th>Assignment</Th><Th>Status</Th><Th className="text-right">Action</Th></tr></thead>
        <tbody>
          {assignments.map((t) => {
            const cust = db.customers.find((c) => c.id === t.customer_id);
            return (
              <tr key={t.id}>
                <Td className="font-mono text-[12px] font-semibold">{t.number}</Td>
                <Td>{cust?.full_name}</Td>
                <Td>{t.issue_category}</Td>
                <Td className="text-[12px]">{t.appointment_time?.replace("T", " ") ?? "—"}</Td>
                <Td>{t.assignment_status ? <Badge status={t.assignment_status} label={ASSIGNMENT_STATUS[t.assignment_status]} /> : "—"}</Td>
                <Td><Badge status={t.status} label={TICKET_STATUS[t.status]} /></Td>
                <Td><div className="text-right"><Button size="sm" variant="secondary" onClick={() => onOpen(t.id)}>Open</Button></div></Td>
              </tr>
            );
          })}
          {assignments.length === 0 && <tr><Td className="text-slate-400">No assignments.</Td></tr>}
        </tbody>
      </Table>
    </Card>
  );
}

function CreateTicketModal({ onClose }: { onClose: () => void }) {
  const db = useDB();
  const toast = useToast();
  const [form, setForm] = useState({
    customer_id: db.customers[0]?.id ?? "", project_id: "", issue_category: ISSUE_CATEGORIES[0],
    description: "", priority: "medium", serial_number: "", equipment_unit_id: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const projects = db.installation_projects.filter((p) => p.customer_id === form.customer_id);
  const units = db.equipment_units.filter((u) => u.project_id === form.project_id && ["installed", "dispatched", "in_stock"].includes(u.status));
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const save = () => {
    const errs: Record<string, string> = {};
    if (!form.customer_id) errs.customer_id = "Select a customer";
    if (form.description.trim().length < 10) errs.description = "At least 10 characters";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      api.createTicket({
        customer_id: form.customer_id, project_id: form.project_id || null,
        equipment_unit_id: form.equipment_unit_id || null, serial_number: form.serial_number,
        issue_category: form.issue_category, description: form.description,
        priority: form.priority as never, created_by: "Service Technician",
      });
      toast.success("Ticket created");
      onClose();
    } catch (e) { toast.error("Create failed", e instanceof Error ? e.message : String(e)); }
  };
  return (
    <Modal open onClose={onClose} title="New service ticket" width="max-w-lg">
      <div className="grid gap-3.5 sm:grid-cols-2">
        <FG label="Customer" required err={errors.customer_id} className="sm:col-span-2">
          <Select value={form.customer_id} onChange={(e) => { set("customer_id", e.target.value); set("project_id", ""); set("serial_number", ""); setForm((f) => ({ ...f, equipment_unit_id: "" })); }}>
            {db.customers.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </Select>
        </FG>
        <FG label="Installation project (optional)" className="sm:col-span-2">
          <Select value={form.project_id} onChange={(e) => { set("project_id", e.target.value); set("serial_number", ""); setForm((f) => ({ ...f, equipment_unit_id: "" })); }}>
            <option value="">Not linked</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.number} · {p.package_name} ({p.status})</option>)}
          </Select>
        </FG>
        <FG label="Equipment serial (optional)" className="sm:col-span-2" hint="Pick installed/dispatched units of the selected project">
          <Select value={form.equipment_unit_id} onChange={(e) => {
            const u = db.equipment_units.find((x) => x.id === e.target.value);
            setForm((f) => ({ ...f, equipment_unit_id: e.target.value, serial_number: u?.serial_number ?? "" }));
          }}>
            <option value="">Not specified</option>
            {units.map((u) => <option key={u.id} value={u.id}>{u.item_name} · {u.serial_number} ({u.status})</option>)}
          </Select>
        </FG>
        <FG label="Issue category">
          <Select value={form.issue_category} onChange={(e) => set("issue_category", e.target.value)}>
            {ISSUE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </Select>
        </FG>
        <FG label="Priority">
          <Select value={form.priority} onChange={(e) => set("priority", e.target.value)}>
            {Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </FG>
        <FG label="Problem description" required err={errors.description} className="sm:col-span-2">
          <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Reported problem… (10+ chars)" />
        </FG>
      </div>
      <div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save}>Create ticket</Button></div>
    </Modal>
  );
}

function TicketDetailModal({ ticketId, onClose }: { ticketId: string; onClose: () => void }) {
  const db = useDB();
  const toast = useToast();
  const t = db.service_tickets.find((x) => x.id === ticketId);
  const [note, setNote] = useState("");
  const [resolution, setResolution] = useState("");
  const [cost, setCost] = useState(0);
  const [ai, setAi] = useState<Awaited<ReturnType<typeof aiServiceGuidance>> | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const notes = t ? db.service_ticket_notes.filter((n) => n.ticket_id === t.id) : [];
  if (!t) return null;
  const cust = db.customers.find((c) => c.id === t.customer_id);
  const proj = db.installation_projects.find((p) => p.id === t.project_id);
  const warranties = t.serial_number ? db.warranties.filter((w) => t.serial_number && w.serial_number.includes(t.serial_number) || (t.equipment_unit_id === w.equipment_unit_id)) : [];

  const askAI = async () => {
    setAiBusy(true);
    try {
      const unit = t.equipment_unit_id ? db.equipment_units.find((u) => u.id === t.equipment_unit_id) : null;
      const out = await aiServiceGuidance({
        issue_category: t.issue_category, description: t.description,
        equipment: unit?.item_name ?? "solar system", serial: t.serial_number,
      });
      setAi(out);
    } finally { setAiBusy(false); }
  };

  const resolve = () => {
    try {
      api.resolveTicket(t.id, resolution, cost);
      toast.success("Ticket resolved");
      onClose();
    } catch (e) { toast.error("Failed", e instanceof Error ? e.message : String(e)); }
  };

  return (
    <M open onClose={onClose} title={`${t.number} · ${t.issue_category}`} width="max-w-3xl">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="rounded-lg bg-slate-50 p-3 text-[12.5px]">
            <p className="font-semibold text-slate-700">{cust?.full_name}{proj && ` · ${proj.number}`}</p>
            <p className="mt-1 text-slate-600">{t.description}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Badge status={t.status} label={TICKET_STATUS[t.status]} />
              <Badge status={t.priority} label={`${PRIORITY[t.priority]} priority`} />
              {t.serial_number && <span className="font-mono text-[10.5px] text-slate-500">{t.serial_number}</span>}
              <span className="text-[10.5px] text-slate-400">opened {formatDateTime(t.created_at)} by {t.created_by}</span>
            </div>
          </div>
          <div>
            <Label>Update status</Label>
            <Select value={t.status} onChange={(e) => { api.updateTicket(t.id, { status: e.target.value as never }); toast.success("Status updated"); }}>
              {Object.entries(TICKET_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Assign technician</Label>
              <Select value="" onChange={(e) => { if (e.target.value) { api.assignTicketTechnician(t.id, e.target.value); toast.success("Technician assigned", e.target.value); } }}>
                <option value="">— select —</option>
                {["Mahesh K. (Demo Technician)", "Ramesh Yadav (Demo Technician)", "Farzana S. (Demo Technician)", "Naveen Chandra (Demo Technician)", "Sohail Ahmed (Demo Technician)", "Iqbal Ahmed"].map((x) => <option key={x}>{x}</option>)}
              </Select>
            </div>
            <div>
              <Label>Estimated cost (₹)</Label>
              <Input type="number" defaultValue={0} onBlur={(e) => api.updateTicket(t.id, { estimated_cost: Number(e.target.value) })} />
            </div>
          </div>
          <div>
            <Label>Warranty check</Label>
            {warranties.length ? warranties.map((w) => (
              <p key={w.id} className="rounded-lg bg-emerald-50 px-3 py-2 text-[11.5px] text-emerald-800">
                <ShieldAlert className="mr-1 inline h-3.5 w-3.5" /> {w.code} active until {formatDate(w.end_date)} — {w.warranty_type}
              </p>
            )) : <p className="text-[11.5px] text-slate-400">No warranty record found for this serial.</p>}
          </div>
          {/* Resolution */}
          <div>
            <Label required>Resolution notes (on resolve)</Label>
            <Textarea value={resolution} onChange={(e) => setResolution(e.target.value)} className="min-h-[64px]" />
            <div className="mt-2 flex items-end gap-2">
              <div className="flex-1">
                <Label>Actual cost (₹)</Label>
                <Input type="number" value={cost} onChange={(e) => setCost(Number(e.target.value))} />
              </div>
              <Button variant="accent" onClick={resolve}>Resolve ticket</Button>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {/* AI */}
          <div className="rounded-xl border border-brand-200 bg-brand-50/60 p-3.5">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-900"><Sparkles className="h-3.5 w-3.5" /> AI troubleshooting assistant</p>
              <Button size="sm" variant="secondary" onClick={askAI} disabled={aiBusy}>{aiBusy ? "Analyzing…" : "Analyze issue"}</Button>
            </div>
            {ai && (
              <div className="mt-2.5 space-y-2 text-[12px]">
                <div className="flex items-start justify-between gap-2 rounded-lg bg-white p-3">
                  <p className="leading-relaxed text-slate-600">{ai.summary}</p>
                  <button onClick={() => setAi(null)} className="text-slate-400 hover:text-slate-600"><X className="h-3.5 w-3.5" /></button>
                </div>
                <Acc title="Possible causes" items={ai.causes} />
                <Acc title="Safe preliminary checks (customer-safe)" items={ai.safeChecks} />
                <Acc title="Recommended next steps" items={ai.nextSteps} />
                {ai.escalation && (
                  <p className="rounded-lg bg-rose-50 px-3 py-2 font-semibold text-rose-700"><ShieldAlert className="mr-1 inline h-3.5 w-3.5" />{ai.escalation}</p>
                )}
                <p className="text-[10px] text-slate-400">
                  {ai.source === "fallback" ? AI_SOURCE_LABEL.fallback : AI_SOURCE_LABEL.live}
                  {" · "}Assistance only — not a confirmed diagnosis and not an equipment inspection.
                </p>
              </div>
            )}
          </div>
          {/* Notes */}
          <div>
            <Label>Ticket notes</Label>
            <div className="max-h-40 space-y-1.5 overflow-y-auto">
              {notes.map((n) => (
                <div key={n.id} className="rounded-lg bg-slate-50 px-3 py-2 text-[12px]">
                  {n.note} <span className="text-[10px] text-slate-400">— {n.author} · {formatDateTime(n.created_at)}</span>
                </div>
              ))}
              {notes.length === 0 && <p className="text-[11px] text-slate-400">No notes yet.</p>}
            </div>
            <div className="mt-2 flex gap-2">
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note…" />
              <Button size="sm" disabled={!note.trim()} onClick={() => { api.addTicketNote(t.id, note); setNote(""); }}>Add</Button>
            </div>
          </div>
        </div>
      </div>
    </M>
  );
}

function Acc({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg bg-white px-3 py-2">
      <p className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">{title}</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-slate-600">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
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
