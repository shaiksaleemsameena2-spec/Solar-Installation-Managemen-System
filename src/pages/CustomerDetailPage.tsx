import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft, Plus, FileText, ClipboardCheck, HardHat, Wallet, Wrench, Pencil, Trash2, Send } from "lucide-react";
import { Card, CardHeader, Badge, Button, Modal, ConfirmDialog, Label, Textarea, Table, Th, Td, PageHeader, EmptyState } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useDB, api } from "@/services";
import { LEAD_STATUS, PROJECT_STATUS, TICKET_STATUS } from "@/lib/labels";
import { formatDate, formatDateTime, formatINR } from "@/lib/utils";

export default function CustomerDetailPage() {
  const { id } = useParams();
  const db = useDB();
  const navigate = useNavigate();
  const toast = useToast();
  const [note, setNote] = useState("");
  const [delConfirm, setDelConfirm] = useState(false);
  const [editingLead, setEditingLead] = useState(false);

  const c = db.customers.find((x) => x.id === id);
  if (!c) {
    return (
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate("/customers")}><ArrowLeft className="h-4 w-4" /> Back to customers</Button>
        <EmptyState icon={Plus} title="Customer not found" />
      </div>
    );
  }

  const surveys = db.site_surveys.filter((s) => s.customer_id === c.id);
  const quotes = db.quotations.filter((q) => q.customer_id === c.id);
  const projects = db.installation_projects.filter((p) => p.customer_id === c.id);
  const payments = db.payments.filter((p) => p.customer_id === c.id);
  const tickets = db.service_tickets.filter((t) => t.customer_id === c.id);
  const subsidies = db.subsidy_applications.filter((s) => s.customer_id === c.id);
  const notes = db.customer_notes.filter((n) => n.customer_id === c.id);
  const activity = db.activity_logs.filter((a) => a.customer_id === c.id);

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" onClick={() => navigate("/customers")}><ArrowLeft className="h-4 w-4" /> Customers</Button>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-900">{c.full_name}</h1>
            <Badge status={c.lead_status} label={LEAD_STATUS[c.lead_status]} />
          </div>
          <p className="mt-0.5 text-[13px] text-slate-500">
            {c.code} · {c.address}, {c.city}, {c.state} {c.postal_code}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditingLead(!editingLead)}><Pencil className="h-3.5 w-3.5" /> Update lead status</Button>
          <Link to="/surveys"><Button variant="outline" size="sm"><ClipboardCheck className="h-3.5 w-3.5" /> Schedule survey</Button></Link>
          <Link to={`/quotations?customer=${c.id}`}><Button variant="outline" size="sm"><FileText className="h-3.5 w-3.5" /> New quotation</Button></Link>
          <Button size="sm" variant="ghost" onClick={() => setDelConfirm(true)}><Trash2 className="h-3.5 w-3.5 text-rose-500" /></Button>
        </div>
      </div>

      {editingLead && (
        <Card className="p-3.5">
          <p className="mb-2 text-xs font-semibold text-slate-600">Change lead status</p>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(LEAD_STATUS).map(([k, v]) => (
              <Button key={k} size="sm" variant={v === LEAD_STATUS[c.lead_status] ? "primary" : "outline"}
                onClick={() => { api.updateCustomer(c.id, { lead_status: k as never }); toast.success("Lead status updated"); }}>
                {v}
              </Button>
            ))}
          </div>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Profile card */}
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-slate-800">Profile</h3>
          <dl className="mt-3 space-y-2 text-[12.5px]">
            {[
              ["Phone", c.phone], ["Email", c.email],
              ["Type", c.customer_type === "residential" ? "Residential" : "Commercial"],
              ["Monthly consumption", `${c.monthly_units} units · ${formatINR(c.monthly_bill)} bill`],
              ["Lead source", c.lead_source], ["Sales executive", c.assigned_to],
              ["Customer since", formatDate(c.created_at)],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3">
                <dt className="text-slate-400">{k}</dt><dd className="text-right font-medium text-slate-700">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>

        {/* Linked records */}
        <Card className="p-4 lg:col-span-2">
          <h3 className="text-sm font-semibold text-slate-800">Linked records</h3>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            {[
              { icon: ClipboardCheck, label: "Surveys", n: surveys.length, to: "/surveys" },
              { icon: FileText, label: "Quotations", n: quotes.length, to: "/quotations" },
              { icon: HardHat, label: "Projects", n: projects.length, to: "/installations" },
              { icon: Wallet, label: "Payments", n: payments.length, to: "/payments" },
              { icon: Wrench, label: "Tickets", n: tickets.length, to: "/service" },
              { icon: Plus, label: "Subsidies", n: subsidies.length, to: "/subsidies" },
            ].map((x) => (
              <Link key={x.label} to={x.to} className="rounded-lg border border-slate-200 px-3 py-2.5 transition-colors hover:border-brand-300 hover:bg-brand-50/40">
                <x.icon className="h-4 w-4 text-brand-700" />
                <p className="mt-1.5 text-lg font-bold text-slate-800">{x.n}</p>
                <p className="text-[10.5px] font-medium uppercase tracking-wide text-slate-400">{x.label}</p>
              </Link>
            ))}
          </div>
          {projects.length > 0 && (
            <div className="mt-4">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Projects</p>
              {projects.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-[12.5px]">
                  <Link to={`/installations/${p.id}`} className="font-semibold text-brand-700 hover:underline">{p.number} · {p.package_name}</Link>
                  <Badge status={p.status} label={PROJECT_STATUS[p.status]} />
                </div>
              ))}
            </div>
          )}
          {payments.length > 0 && (
            <div className="mt-3">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Payment history</p>
              <div className="flex flex-wrap gap-1.5">
                {payments.slice(0, 6).map((p) => (
                  <span key={p.id} className="rounded-md bg-slate-100 px-2 py-1 text-[11px] text-slate-600">
                    {formatINR(p.amount)} · <Badge status={p.status} className="!px-1.5 !py-0" />
                  </span>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Timeline */}
        <Card className="lg:col-span-2">
          <CardHeader title="Activity timeline" subtitle="Database-backed events for this customer" />
          <div className="max-h-80 overflow-y-auto px-4 py-3">
            {activity.slice(0, 30).map((a) => (
              <div key={a.id} className="flex gap-3 border-b border-slate-50 py-2 last:border-0">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                <div>
                  <p className="text-[12.5px] text-slate-700">{a.message}</p>
                  <p className="text-[11px] text-slate-400">{formatDateTime(a.created_at)} · {a.type}</p>
                </div>
              </div>
            ))}
            {activity.length === 0 && <EmptyState icon={Plus} title="No activity yet" />}
          </div>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader title="Notes" subtitle={`${notes.length} notes`} />
          <div className="px-4 py-3">
            <Label>Add note</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g., Follow up on Friday…" className="min-h-[64px]" />
            <Button size="sm" className="mt-2 w-full" disabled={!note.trim()}
              onClick={() => { api.addCustomerNote(c.id, note); setNote(""); toast.success("Note added"); }}>
              <Send className="h-3.5 w-3.5" /> Add note
            </Button>
            <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">
              {notes.map((n) => (
                <div key={n.id} className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="text-[12.5px] text-slate-700">{n.note}</p>
                  <p className="mt-0.5 text-[10.5px] text-slate-400">{n.author} · {formatDateTime(n.created_at)}</p>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Tickets */}
      {tickets.length > 0 && (
        <Card>
          <CardHeader title="Service requests" />
          <Table>
            <thead><tr><Th>Ticket</Th><Th>Issue</Th><Th>Status</Th><Th>Technician</Th></tr></thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id}>
                  <Td className="font-mono text-[12px] font-semibold">{t.number}</Td>
                  <Td className="max-w-xs truncate">{t.issue_category} — {t.description}</Td>
                  <Td><Badge status={t.status} label={TICKET_STATUS[t.status]} /></Td>
                  <Td className="text-[12px]">{t.assigned_technician || "—"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      <ConfirmDialog
        open={delConfirm} onClose={() => setDelConfirm(false)} title="Delete customer?"
        message={`Delete ${c.full_name}? Possible only if no installation projects exist.`}
        confirmLabel="Delete" danger
        onConfirm={() => {
          try { api.deleteCustomer(c.id); toast.success("Customer deleted"); navigate("/customers"); }
          catch (e) { toast.error("Cannot delete", e instanceof Error ? e.message : String(e)); }
        }}
      />
    </div>
  );
}
