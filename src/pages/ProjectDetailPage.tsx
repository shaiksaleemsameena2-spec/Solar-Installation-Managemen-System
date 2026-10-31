import { useState } from "react";
import { useParams, useNavigate } from "react-router";
import {
  ArrowLeft, User, FileText, Package, Users2, ListChecks, Camera, Wallet,
  ShieldCheck, History, CheckCircle2, CalendarPlus, Truck, Flag, ImagePlus, AlertTriangle, X,
} from "lucide-react";
import { Card, CardHeader, Badge, Button, Table, Th, Td, Modal, ConfirmDialog, Label, Input, Select, Textarea, StatTile, EmptyState } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useDB, api } from "@/services";
import { PROJECT_STATUS, EQUIPMENT_STATUS, PAYMENT_STAGE, WARRANTY_STATUS } from "@/lib/labels";
import { formatINR, formatDate, formatDateTime, todayISO, readFileAsDataURL } from "@/lib/utils";
import { computeProjectFinance } from "@/lib/calculations/finance";
import { printWarrantyCertificate } from "@/lib/certificate";

const CREW_WARNING = "This crew is not marked Available right now. You can still assign it — do you want to proceed?";

export default function ProjectDetailPage() {
  const { id } = useParams();
  const db = useDB();
  const navigate = useNavigate();
  const toast = useToast();
  const [modal, setModal] = useState<null | "crew" | "schedule" | "reserve" | "accept" | "photo">(null);
  const [warrantyConfirm, setWarrantyConfirm] = useState(false);
  const [reserveWarn, setReserveWarn] = useState("");

  const p = db.installation_projects.find((x) => x.id === id);
  if (!p) {
    return (
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate("/installations")}><ArrowLeft className="h-4 w-4" /> Back</Button>
        <EmptyState icon={Package} title="Project not found" />
      </div>
    );
  }
  const customer = db.customers.find((c) => c.id === p.customer_id);
  const quote = db.quotations.find((x) => x.id === p.quotation_id);
  const crew = db.installation_crews.find((c) => c.id === p.crew_id);
  const units = db.equipment_units.filter((u) => u.project_id === p.id);
  const checklist = db.checklist_items.filter((x) => x.project_id === p.id).sort((a, b) => a.sequence - b.sequence);
  const photos = db.installation_photos.filter((x) => x.project_id === p.id);
  const acceptance = db.customer_acceptances.find((a) => a.project_id === p.id);
  const payments = db.payments.filter((x) => x.project_id === p.id);
  const expenses = db.project_expenses.filter((x) => x.project_id === p.id);
  const warranties = db.warranties.filter((w) => w.project_id === p.id);
  const activity = db.activity_logs.filter((a) => a.project_id === p.id);
  const fin = computeProjectFinance({ contract_value: p.contract_value, payments, expenses });

  const checklistDone = checklist.filter((x) => x.completed).length;
  const canComplete = checklist.length > 0 && checklistDone === checklist.length && !!acceptance;

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" onClick={() => navigate("/installations")}><ArrowLeft className="h-4 w-4" /> Installations</Button>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-900">{p.number}</h1>
            <Badge status={p.status} label={PROJECT_STATUS[p.status]} />
            <Badge label={p.equipment_status === "dispatched" ? "Equipment dispatched" : p.equipment_status === "reserved" ? "Equipment reserved" : "Awaiting equipment"} className="bg-slate-100 text-slate-600" />
          </div>
          <p className="mt-0.5 text-[13px] text-slate-500">{customer?.full_name} · {p.capacity_kw} kW · {p.package_name} · {p.address}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {p.status === "awaiting_stock" && (
            <Button size="sm" variant="secondary" onClick={() => { setReserveWarn(""); setModal("reserve"); }}>Reserve equipment</Button>
          )}
          {p.equipment_status === "reserved" && units.length > 0 && (
            <Button size="sm" variant="secondary" onClick={() => { api.dispatchEquipment(p.id); toast.success("Equipment dispatched", `${units.filter((u) => u.status === "reserved").length} units moved to dispatch`); }}>
              <Truck className="h-3.5 w-3.5" /> Dispatch equipment
            </Button>
          )}
          {p.equipment_status === "dispatched" && !p.crew_id && (
            <Button size="sm" variant="secondary" onClick={() => setModal("crew")}><Users2 className="h-3.5 w-3.5" /> Assign crew</Button>
          )}
          {p.crew_id && !p.scheduled_start && (
            <Button size="sm" variant="secondary" onClick={() => setModal("schedule")}><CalendarPlus className="h-3.5 w-3.5" /> Schedule</Button>
          )}
          {["scheduled"].includes(p.status) && (
            <Button size="sm" variant="secondary" onClick={() => { api.setProjectStatus(p.id, "in_progress"); toast.success("Installation started"); }}>
              <Flag className="h-3.5 w-3.5" /> Start installation
            </Button>
          )}
          {p.status === "in_progress" && (
            <Button size="sm" variant="secondary" onClick={() => { api.setProjectStatus(p.id, "quality_inspection"); toast.success("Moved to quality inspection"); }}>
              Submit for inspection
            </Button>
          )}
          {(p.status === "quality_inspection" || ["in_progress", "quality_inspection"].includes(p.status)) && (
            <Button size="sm" variant="accent" onClick={() => {
              if (!canComplete) { toast.error("Can't complete yet", "All checklist items + customer acceptance required."); return; }
              try { api.completeProject(p.id); toast.success("Project completed", "Warranty activation is now available."); }
              catch (e) { toast.error("Blocked", e instanceof Error ? e.message : String(e)); }
            }}>
              Approve & complete
            </Button>
          )}
          {p.status === "completed" && warranties.length === 0 && (
            <Button size="sm" onClick={() => setWarrantyConfirm(true)}><ShieldCheck className="h-3.5 w-3.5" /> Activate warranties</Button>
          )}
        </div>
      </div>

      {/* Finance tiles */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
        <StatTile label="Contract value" value={formatINR(fin.contract_value)} sub={quote ? quote.number : ""} />
        <StatTile label="Collected" value={formatINR(fin.collected)} tone="good" />
        <StatTile label="Outstanding" value={formatINR(fin.outstanding)} tone={fin.outstanding ? "warn" : "default"} />
        <StatTile label="Expenses" value={formatINR(fin.expenses_total)} />
        <StatTile label="Est. profit" value={formatINR(fin.estimated_profit)} sub={`${fin.margin_percent}% margin`} tone={fin.estimated_profit >= 0 ? "good" : "bad"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Customer + quotation */}
        <Card className="p-4">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800"><User className="h-4 w-4 text-brand-700" /> Customer & quotation</h3>
          <dl className="mt-3 space-y-2 text-[12.5px]">
            {[
              ["Customer", customer?.full_name], ["Phone", customer?.phone],
              ["Address", `${p.address}`],
              ["Quotation", quote ? `${quote.number} · ${formatINR(quote.total)}` : "—"],
              ["Package", `${p.package_name} (${p.capacity_kw} kW)`],
              ["Planned cost", formatINR(p.planned_cost)],
              ["Manager", p.manager],
            ].map(([k, v]) => (
              <div key={String(k)} className="flex justify-between gap-3">
                <dt className="text-slate-400">{k}</dt><dd className="text-right font-medium text-slate-700">{v ?? "—"}</dd>
              </div>
            ))}
          </dl>
        </Card>

        {/* Equipment */}
        <Card>
          <CardHeader title="Equipment allocation" subtitle={`${units.length} serial-numbered units`}
            action={p.equipment_status !== "pending" && <Button size="sm" variant="ghost" onClick={() => setModal("reserve")}>Reserve more…</Button>} />
          <div className="max-h-60 overflow-y-auto px-4 py-3">
            {units.length ? units.map((u) => (
              <div key={u.id} className="flex items-center justify-between border-b border-slate-50 py-1.5 text-[12px] last:border-0">
                <div>
                  <p className="font-mono font-semibold text-slate-700">{u.serial_number}</p>
                  <p className="text-[10.5px] text-slate-400">{u.item_name}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10.5px] text-slate-400">{u.dispatched_at ? `dsp ${u.dispatched_at.slice(0, 10)}` : ""}</span>
                  {u.status !== "installed" && ["dispatched", "reserved", "in_stock"].includes(u.status) && p.status !== "completed" && (
                    <Button size="sm" variant="ghost" onClick={() => { api.markUnitInstalled(u.id); toast.success("Marked installed", u.serial_number); }}>Mark installed</Button>
                  )}
                  <Badge status={u.status} />
                </div>
              </div>
            )) : <EmptyState icon={Package} title="No equipment reserved yet" subtitle="Reserve serial-numbered stock for this project." />}
          </div>
        </Card>

        {/* Crew */}
        <Card className="p-4">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800"><Users2 className="h-4 w-4 text-brand-700" /> Crew & schedule</h3>
          <dl className="mt-3 space-y-2 text-[12.5px]">
            <div className="flex justify-between gap-3"><dt className="text-slate-400">Crew</dt>
              <dd className="text-right font-medium text-slate-700">{crew ? <span>{crew.name}<br /><span className="text-[11px] text-slate-400">{crew.leader} · {crew.phone}</span></span> : <button className="text-brand-700 underline" onClick={() => setModal("crew")}>Assign crew…</button>}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-slate-400">Scheduled</dt>
              <dd className="text-right font-medium text-slate-700">{p.scheduled_start ? `${formatDate(p.scheduled_start)} → ${formatDate(p.scheduled_end)}` : <button className="text-brand-700 underline" onClick={() => setModal("schedule")}>Schedule…</button>}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-slate-400">Accepted</dt><dd className="font-medium text-slate-700">{acceptance ? `${acceptance.customer_name} on ${formatDate(acceptance.accepted_at)}` : "not yet"}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-slate-400">Completed</dt><dd className="font-medium text-slate-700">{p.actual_completion ? formatDate(p.actual_completion) : "—"}</dd></div>
          </dl>
        </Card>

        {/* Checklist */}
        <Card className="lg:col-span-2">
          <CardHeader title="Installation checklist" subtitle={`Database-backed items · ${checklistDone}/${checklist.length} complete`}
            action={p.status === "completed" ? <Badge status="completed" /> : <span className="text-[11px] text-slate-400">completion requires 100% + acceptance</span>} />
          <div className="px-4 py-3">
            {checklist.map((item) => (
              <div key={item.id} className="flex items-center justify-between border-b border-slate-50 py-2 last:border-0">
                <div className="flex min-w-0 items-center gap-2.5">
                  {item.completed ? <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-600" /> : <span className="h-4 w-4 shrink-0 rounded-full border-2 border-slate-200" />}
                  <div className="min-w-0">
                    <p className={`text-[12.5px] ${item.completed ? "text-slate-500 line-through" : "font-medium text-slate-700"}`}>{item.sequence}. {item.description}</p>
                    {item.completed && <p className="text-[10.5px] text-slate-400">{item.completed_by} · {item.completed_at ? formatDateTime(item.completed_at) : ""}</p>}
                  </div>
                </div>
                {!item.completed && p.status !== "completed" ? (
                  <Button size="sm" variant="secondary" onClick={() => { api.completeChecklistItem(item.id, crew?.leader ?? "Installation Team"); toast.success("Checklist step recorded"); }}>
                    Mark done
                  </Button>
                ) : null}
              </div>
            ))}
            {checklist.length === 0 && <EmptyState icon={ListChecks} title="No checklist items" />}
            {!canComplete && p.status !== "completed" && !acceptance && (
              <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[11.5px] text-amber-800 flex items-center justify-between">
                <span><AlertTriangle className="mr-1 inline h-3.5 w-3.5" /> Customer acceptance is required before completing the project.</span>
                <Button size="sm" variant="outline" onClick={() => setModal("accept")}>Record acceptance</Button>
              </div>
            )}
          </div>
        </Card>

        {/* Photos */}
        <Card>
          <CardHeader title="Installation photos" subtitle={`${photos.length} uploaded (stored in app demo storage)`}
            action={<Button size="sm" variant="ghost" onClick={() => setModal("photo")}><ImagePlus className="h-3.5 w-3.5" /> Upload</Button>} />
          <div className="grid grid-cols-2 gap-2 px-4 py-3">
            {photos.map((ph) => (
              <div key={ph.id} className="group relative overflow-hidden rounded-lg border border-slate-200">
                <img src={ph.data_url} alt={ph.caption} className="h-24 w-full object-cover" />
                <button className="absolute right-1 top-1 hidden rounded bg-white/90 p-1 text-rose-600 group-hover:block" onClick={() => api.removeInstallationPhoto(ph.id)}><X className="h-3 w-3" /></button>
                <p className="truncate bg-slate-900/60 px-1.5 py-1 text-[10px] text-white">{ph.caption}</p>
              </div>
            ))}
            {photos.length === 0 && <p className="col-span-2 py-6 text-center text-[12px] text-slate-400">No photos yet. Upload site/proof photos here.</p>}
          </div>
        </Card>

        {/* Payments & expenses */}
        <Card className="lg:col-span-2">
          <CardHeader title="Payments" subtitle={`Only paid payments count as collected (demo accounting rule)`}
            action={<a href="/payments" className="text-[12px] font-semibold text-brand-700 hover:underline">Manage →</a>} />
          <Table>
            <thead><tr><Th>Stage</Th><Th>Amount</Th><Th>Date</Th><Th>Status</Th></tr></thead>
            <tbody>
              {payments.map((x) => (
                <tr key={x.id}>
                  <Td>{PAYMENT_STAGE[x.stage]}</Td><Td>{formatINR(x.amount)}</Td>
                  <Td className="text-[12px]">{x.payment_date ? formatDate(x.payment_date) : "—"}</Td>
                  <Td><Badge status={x.status} /></Td>
                </tr>
              ))}
              {expenses.slice(0, 4).map((e) => (
                <tr key={e.id} className="text-slate-400">
                  <Td>Expense — {e.category}</Td><Td>{formatINR(e.amount)}</Td><Td className="text-[12px]">{formatDate(e.expense_date)}</Td><Td>—</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>

        {/* Warranty */}
        <Card>
          <CardHeader title="Warranties" subtitle={p.status === "completed" ? "Activation available after completion (idempotent)" : "Activation unlocks on completion"}
            action={p.status === "completed" && warranties.length === 0 && (
              <Button size="sm" variant="secondary" onClick={() => setWarrantyConfirm(true)}>Activate</Button>
            )} />
          <div className="px-4 py-3">
            {warranties.length ? warranties.map((w) => (
              <div key={w.id} className="mb-2 rounded-lg border border-slate-200 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[12px] font-semibold text-slate-700">{w.warranty_type}</p>
                  <Badge status={w.status} label={WARRANTY_STATUS[w.status]} />
                </div>
                <p className="mt-0.5 text-[10.5px] text-slate-400">{w.product_name}</p>
                <div className="mt-1 flex items-center justify-between text-[10.5px] text-slate-500">
                  <span>{formatDate(w.start_date)} → {formatDate(w.end_date)}</span>
                  <button className="font-semibold text-brand-700 hover:underline" onClick={() => printWarrantyCertificate(w, customer)}>Certificate</button>
                </div>
              </div>
            )) : <EmptyState icon={ShieldCheck} title={p.status === "completed" ? "Not activated yet" : "Available after installation completes"} subtitle={p.status === "completed" ? "Click Activate to register product warranties from installed serials." : undefined} />}
          </div>
        </Card>
      </div>

      {/* Timeline */}
      <Card>
        <CardHeader title="Activity timeline" subtitle="Database-backed events for this project" />
        <div className="max-h-72 overflow-y-auto px-4 py-3">
          {activity.map((a) => (
            <div key={a.id} className="flex gap-3 border-b border-slate-50 py-2 last:border-0">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
              <div>
                <p className="text-[12.5px] text-slate-700">{a.message}</p>
                <p className="text-[11px] text-slate-400">{formatDateTime(a.created_at)}</p>
              </div>
            </div>
          ))}
          {activity.length === 0 && <EmptyState icon={History} title="No activity yet" />}
        </div>
      </Card>

      {modal === "crew" && <CrewModal projectId={p.id} onClose={() => setModal(null)} />}
      {modal === "schedule" && <ScheduleModal projectId={p.id} current={p} onClose={() => setModal(null)} />}
      {modal === "reserve" && <ReserveModal projectId={p.id} warn={reserveWarn} setWarn={setReserveWarn} onClose={() => setModal(null)} />}
      {modal === "accept" && <AcceptanceModal projectId={p.id} customerName={customer?.full_name ?? ""} onClose={() => setModal(null)} />}
      {modal === "photo" && <PhotoModal projectId={p.id} onClose={() => setModal(null)} />}
      <ConfirmDialog open={warrantyConfirm} onClose={() => setWarrantyConfirm(false)} title="Activate warranties?"
        message="Product warranties are created per installed serial group with duration from the item catalogue. Duplicate activation is prevented."
        confirmLabel="Activate" onConfirm={() => {
          const r = api.activateWarranties(p.id);
          if (r.created > 0) toast.success("Warranties activated", `${r.created} record(s) created.`);
          else toast.info("Nothing activated", r.message);
        }} />
    </div>
  );
}

function CrewModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const db = useDB();
  const toast = useToast();
  const [crewId, setCrewId] = useState("");
  const chosen = db.installation_crews.find((c) => c.id === crewId);
  const [confirmWarn, setConfirmWarn] = useState(false);
  const assign = () => {
    if (!chosen) return toast.error("Select a crew first");
    if (chosen.availability !== "available" && !confirmWarn) {
      setConfirmWarn(true); // first click warns, second confirms
      return;
    }
    api.assignCrew(projectId, crewId);
    toast.success("Crew assigned", chosen.name + (chosen.availability !== "available" ? " (assigned with availability warning)" : ""));
    onClose();
  };
  return (
    <Modal open onClose={onClose} title="Assign installation crew">
      <div className="space-y-2">
        {db.installation_crews.map((c) => (
          <button key={c.id} onClick={() => { setCrewId(c.id); setConfirmWarn(false); }}
            className={`w-full rounded-lg border px-3.5 py-3 text-left transition-colors ${crewId === c.id ? "border-brand-600 bg-brand-50" : "border-slate-200 hover:bg-slate-50"}`}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[13px] font-semibold text-slate-800">{c.name}</p>
              <Badge status={c.availability} />
            </div>
            <p className="mt-0.5 text-[11.5px] text-slate-500">Leader {c.leader} · {c.members.length + 1} members · {c.skills.join(", ")}</p>
          </button>
        ))}
        {chosen && chosen.availability !== "available" && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11.5px] text-amber-800"><AlertTriangle className="mr-1 inline h-3.5 w-3.5" />{CREW_WARNING}</p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={assign}>{confirmWarn ? "Assign anyway" : "Assign crew"}</Button>
        </div>
      </div>
    </Modal>
  );
}

function ScheduleModal({ projectId, current, onClose }: { projectId: string; current: { scheduled_start: string | null; scheduled_end: string | null }; onClose: () => void }) {
  const toast = useToast();
  const [start, setStart] = useState(current.scheduled_start ?? todayISO());
  const [end, setEnd] = useState(current.scheduled_end ?? todayISO());
  const [err, setErr] = useState("");
  const save = () => {
    try {
      api.scheduleProject(projectId, start, end);
      toast.success("Installation scheduled", `${start} → ${end}`);
      onClose();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  };
  return (
    <Modal open onClose={onClose} title="Schedule installation" width="max-w-sm">
      <div className="space-y-3">
        <div><Label required>Start date</Label><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
        <div><Label required>Expected completion</Label><Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
        {err && <p className="text-[11.5px] font-medium text-rose-600">{err}</p>}
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save}>Schedule</Button></div>
      </div>
    </Modal>
  );
}

function ReserveModal({ projectId, warn, setWarn, onClose }: { projectId: string; warn: string; setWarn: (s: string) => void; onClose: () => void }) {
  const db = useDB();
  const toast = useToast();
  const [itemId, setItemId] = useState("");
  const [qty, setQty] = useState(1);
  const item = db.inventory_items.find((x) => x.id === itemId);
  const proj = db.installation_projects.find((x) => x.id === projectId)!;
  const reserve = () => {
    if (!item) { setWarn("Select an item to reserve."); return; }
    try {
      api.reserveEquipment(itemId, qty, projectId);
      toast.success("Equipment reserved", `${qty} × ${item.name} → ${proj.number}`);
      onClose();
    } catch (e) {
      setWarn(e instanceof Error ? e.message : String(e));
    }
  };
  const suggest = ["solar_panel", "inverter", "battery"].includes(item?.category ?? "") && qty > item?.available_qty!;
  return (
    <Modal open onClose={onClose} title="Reserve equipment for project" width="max-w-md">
      {warn && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-[12px] text-rose-700"><AlertTriangle className="mr-1 inline h-3.5 w-3.5" />{warn}</p>}
      <div className="space-y-3">
        <div>
          <Label required>Inventory item</Label>
          <Select value={itemId} onChange={(e) => { setItemId(e.target.value); setWarn(""); }}>
            <option value="">Select item…</option>
            {db.inventory_items.map((i) => (
              <option key={i.id} value={i.id}>{i.name} — {i.available_qty} {i.unit} available ({i.reserved_qty} reserved)</option>
            ))}
            {db.inventory_items.length === 0 && <option value="" disabled>No inventory items available</option>}
          </Select>
        </div>
        <div>
          <Label required>Quantity</Label>
          <Input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} />
        </div>
        {suggest && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11.5px] text-amber-800"><AlertTriangle className="mr-1 inline h-3.5 w-3.5" />Only {item?.available_qty} available — serials will be reserved first, then bulk stock. Over-reservation is rejected.</p>
        )}
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={reserve}>Reserve</Button></div>
      </div>
    </Modal>
  );
}

function AcceptanceModal({ projectId, customerName, onClose }: { projectId: string; customerName: string; onClose: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(customerName);
  const [sig, setSig] = useState<string | null>(null);
  const save = () => {
    if (!name.trim()) return toast.error("Enter the customer's name");
    try {
      api.recordAcceptance(projectId, name.trim(), sig);
      toast.success("Acceptance recorded", "A typed name is stored as a record, NOT a verified digital signature.");
      onClose();
    } catch (e) { toast.error("Failed", e instanceof Error ? e.message : String(e)); }
  };
  return (
    <Modal open onClose={onClose} title="Customer acceptance" width="max-w-md">
      <div className="space-y-3">
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11.5px] text-amber-800">This records the customer name as an acceptance marker. It is not represented as a verified digital signature.</p>
        <div><Label required>Customer name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div>
          <Label>Signature image (optional)</Label>
          <input type="file" accept="image/*" className="text-[12px]" onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) setSig(await readFileAsDataURL(f));
          }} />
          {sig && <img src={sig} alt="signature" className="mt-2 h-16 rounded border border-slate-200 bg-white" />}
        </div>
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save}>Record acceptance</Button></div>
      </div>
    </Modal>
  );
}

function PhotoModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const toast = useToast();
  const [caption, setCaption] = useState("");
  const [dataUrl, setDataUrl] = useState("");
  const save = () => {
    if (!dataUrl) return toast.error("Choose a photo first");
    api.addInstallationPhoto(projectId, caption, dataUrl);
    toast.success("Photo added");
    onClose();
  };
  return (
    <Modal open onClose={onClose} title="Upload installation photo" width="max-w-sm">
      <div className="space-y-3">
        <div><Label>Caption</Label><Input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="e.g., Panel mounting complete" /></div>
        <div>
          <Label required>Photo</Label>
          <input type="file" accept="image/*" className="text-[12px]" onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) {
              if (f.size > 3 * 1024 * 1024) { toast.error("File too large", "Please use an image under 3 MB."); return; }
              setDataUrl(await readFileAsDataURL(f));
            }
          }} />
        </div>
        {dataUrl && <img src={dataUrl} className="max-h-40 w-full rounded-lg border border-slate-200 object-cover" alt="preview" />}
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save}>Add photo</Button></div>
      </div>
    </Modal>
  );
}
