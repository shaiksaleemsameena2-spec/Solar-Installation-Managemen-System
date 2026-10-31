import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Search, Plus, Pencil, Trash2, Filter } from "lucide-react";
import { Card, PageHeader, Button, Input, Select, Modal, ConfirmDialog, Label, Table, Th, Td, Badge, FieldError, EmptyState } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useDB, api } from "@/services";
import { useSession } from "@/hooks/useSession";
import type { Customer } from "@/types";
import { LEAD_STATUS, CUSTOMER_TYPE, LEAD_SOURCES, badgeClass } from "@/lib/labels";
import { formatDate, formatINR, titleCase } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { z } from "zod";

const customerSchema = z.object({
  full_name: z.string().trim().min(3, "Name must be at least 3 characters"),
  phone: z.string().trim().regex(/^(\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}$|^(\+91[\s-]?)?[6-9]\d{9}$/, "Enter a valid Indian mobile number"),
  email: z.string().trim().email("Enter a valid email"),
  address: z.string().trim().min(5, "Address required"),
  city: z.string().trim().min(2, "City required"),
  state: z.string().trim().min(2, "State required"),
  postal_code: z.string().trim().regex(/^\d{6}$/, "6-digit postal code"),
  monthly_units: z.coerce.number().min(0, "Cannot be negative"),
  monthly_bill: z.coerce.number().min(0, "Cannot be negative"),
});

const empty = {
  full_name: "", phone: "", email: "", address: "", city: "Hyderabad", state: "Telangana",
  postal_code: "", customer_type: "residential", monthly_units: "", monthly_bill: "",
  lead_source: LEAD_SOURCES[0], assigned_to: "Sales Executive — Alicia Dsouza", notes: "", lead_status: "new",
};

export default function CustomersPage() {
  const db = useDB();
  const session = useSession();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [modal, setModal] = useState<{ mode: "create" | "edit"; customer?: Customer } | null>(null);
  const [del, setDel] = useState<Customer | null>(null);

  const filtered = useMemo(() => {
    const term = q.toLowerCase().trim();
    return db.customers
      .filter((c) => (status === "all" ? true : c.lead_status === status))
      .filter((c) => (type === "all" ? true : c.customer_type === type))
      .filter((c) => !term || [c.full_name, c.phone, c.email, c.city, c.code].some((v) => v.toLowerCase().includes(term)));
  }, [db.customers, q, status, type]);

  const stats = useMemo(() => ({
    total: db.customers.length,
    won: db.customers.filter((c) => c.lead_status === "won").length,
    lost: db.customers.filter((c) => c.lead_status === "lost").length,
  }), [db.customers]);

  return (
    <div className="space-y-5">
      <PageHeader title="Customers & Leads" subtitle={`${stats.total} customers · ${stats.won} won · ${stats.lost} lost`} >
        <Button onClick={() => setModal({ mode: "create" })}><Plus className="h-4 w-4" /> New customer</Button>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input className="pl-8" placeholder="Search name, phone, email, code…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select className="w-48" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All lead statuses</option>
          {Object.entries(LEAD_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <Select className="w-36" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="all">All types</option>
          {Object.entries(CUSTOMER_TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        {(q || status !== "all" || type !== "all") && (
          <Button variant="ghost" size="sm" onClick={() => { setQ(""); setStatus("all"); setType("all"); }}>
            <Filter className="h-3.5 w-3.5" /> Clear filters
          </Button>
        )}
      </div>

      <Card>
        {filtered.length ? (
          <Table>
            <thead>
              <tr>
                <Th>Customer</Th><Th>Contact</Th><Th>Type</Th><Th>Consumption</Th><Th>Lead status</Th><Th>Source</Th><Th>Created</Th><Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const quoteCount = db.quotations.filter((x) => x.customer_id === c.id).length;
                return (
                  <tr key={c.id} className="hover:bg-slate-50/60">
                    <Td>
                      <Link to={`/customers/${c.id}`} className="font-semibold text-slate-800 hover:text-brand-700 hover:underline">{c.full_name}</Link>
                      <p className="text-[11px] text-slate-400">{c.code} · {c.city}</p>
                    </Td>
                    <Td><p>{c.phone}</p><p className="text-[11px] text-slate-400">{c.email}</p></Td>
                    <Td><Badge label={CUSTOMER_TYPE[c.customer_type]} className={c.customer_type === "commercial" ? "bg-violet-100 text-violet-700" : "bg-sky-100 text-sky-700"} /></Td>
                    <Td><p>{c.monthly_units} units/mo</p><p className="text-[11px] text-slate-400">{formatINR(c.monthly_bill)} bill</p></Td>
                    <Td><Badge status={c.lead_status} label={LEAD_STATUS[c.lead_status]} /></Td>
                    <Td className="text-[12px] text-slate-500">{c.lead_source}</Td>
                    <Td className="text-[12px] text-slate-500">{formatDate(c.created_at)}</Td>
                    <Td>
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" title={quoteCount ? `${quoteCount} quotations` : "No quotations"}><span className="text-[11px] font-semibold text-slate-400">{quoteCount ? `${quoteCount}Q` : ""}</span></Button>
                        <Button size="sm" variant="ghost" onClick={() => setModal({ mode: "edit", customer: c })}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => setDel(c)}><Trash2 className="h-3.5 w-3.5 text-rose-500" /></Button>
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <EmptyState icon={Search} title="No customers match" subtitle="Adjust search filters or create a new customer." action={<Button onClick={() => setModal({ mode: "create" })}><Plus className="h-4 w-4" /> New customer</Button>} />
        )}
      </Card>

      {modal && <CustomerModal mode={modal.mode} customer={modal.customer} onClose={() => setModal(null)} canWrite={session?.role === "superadmin" || session?.role === "staff" || session?.role === "admin" || session?.role === "sales"} />}
      <ConfirmDialog
        open={!!del} onClose={() => setDel(null)}
        title="Delete customer?" message={`Delete ${del?.full_name}? This only works if the customer has no installation projects.`}
        confirmLabel="Delete" danger
        onConfirm={() => {
          try {
            api.deleteCustomer(del!.id);
            toast.success("Customer deleted");
          } catch (e) { toast.error("Cannot delete", e instanceof Error ? e.message : String(e)); }
        }}
      />
    </div>
  );
}

function CustomerModal({ mode, customer, onClose, canWrite }: {
  mode: "create" | "edit"; customer?: Customer; onClose: () => void; canWrite: boolean;
}) {
  const db = useDB();
  const [form, setForm] = useState(() => customer ? {
    full_name: customer.full_name, phone: customer.phone, email: customer.email, address: customer.address,
    city: customer.city, state: customer.state, postal_code: customer.postal_code, customer_type: customer.customer_type,
    monthly_units: String(customer.monthly_units), monthly_bill: String(customer.monthly_bill),
    lead_source: customer.lead_source, assigned_to: customer.assigned_to, notes: customer.notes, lead_status: customer.lead_status,
  } : { ...empty });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const toast = useToast();

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = () => {
    const parsed = customerSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.errors.forEach((e) => { errs[String(e.path[0])] = e.message; });
      setErrors(errs);
      return;
    }
    const payload = {
      ...parsed.data,
      customer_type: form.customer_type as Customer["customer_type"],
      lead_status: form.lead_status as Customer["lead_status"],
      lead_source: form.lead_source,
      assigned_to: form.assigned_to,
      notes: form.notes,
    };
    try {
      if (!canWrite) throw new Error("Your role cannot modify customers (demo role guard).");
      if (mode === "create") {
        api.createCustomer(payload);
        toast.success("Customer created", "Added to leads pipeline.");
      } else {
        api.updateCustomer(customer!.id, payload);
        toast.success("Customer updated");
      }
      onClose();
    } catch (e) {
      toast.error("Save failed", e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Modal open onClose={onClose} title={mode === "create" ? "New customer / lead" : `Edit — ${customer?.full_name}`} width="max-w-2xl">
      <div className="grid gap-3.5 sm:grid-cols-2">
        <FG label="Full name" required err={errors.full_name}>
          <Input value={form.full_name} onChange={(e) => set("full_name", e.target.value)} />
        </FG>
        <FG label="Phone" required err={errors.phone}>
          <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+91 90000 00000" />
        </FG>
        <FG label="Email" required err={errors.email}>
          <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
        </FG>
        <FG label="Customer type">
          <Select value={form.customer_type} onChange={(e) => set("customer_type", e.target.value)}>
            {Object.entries(CUSTOMER_TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </FG>
        <FG className="sm:col-span-2" label="Installation address" required err={errors.address}>
          <Input value={form.address} onChange={(e) => set("address", e.target.value)} />
        </FG>
        <FG label="City" required err={errors.city}>
          <Input value={form.city} onChange={(e) => set("city", e.target.value)} />
        </FG>
        <FG label="State" required err={errors.state}>
          <Input value={form.state} onChange={(e) => set("state", e.target.value)} />
        </FG>
        <FG label="Postal code" required err={errors.postal_code}>
          <Input value={form.postal_code} onChange={(e) => set("postal_code", e.target.value)} />
        </FG>
        <FG label="Lead source">
          <Select value={form.lead_source} onChange={(e) => set("lead_source", e.target.value)}>
            {LEAD_SOURCES.map((s) => <option key={s}>{s}</option>)}
          </Select>
        </FG>
        <FG label="Monthly units" err={errors.monthly_units}>
          <Input type="number" value={form.monthly_units} onChange={(e) => set("monthly_units", e.target.value)} />
        </FG>
        <FG label="Monthly bill (₹)" err={errors.monthly_bill}>
          <Input type="number" value={form.monthly_bill} onChange={(e) => set("monthly_bill", e.target.value)} />
        </FG>
        <FG label="Assigned sales executive">
          <Select value={form.assigned_to} onChange={(e) => set("assigned_to", e.target.value)}>
            {["Sales Executive — Alicia Dsouza", "Sales Executive — Rahul Menon"].map((s) => <option key={s}>{s}</option>)}
          </Select>
        </FG>
        <FG label="Lead status" className="sm:col-span-2">
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(LEAD_STATUS).map(([k, v]) => (
              <button key={k} type="button" onClick={() => set("lead_status", k)}
                className={cn("rounded-full border px-3 py-1.5 text-[11.5px] font-semibold transition-colors",
                  form.lead_status === k ? "border-brand-600 bg-brand-50 text-brand-800" : "border-slate-200 text-slate-600 hover:bg-slate-50")}>
                {v}
              </button>
            ))}
          </div>
        </FG>
        <FG label="Notes" className="sm:col-span-2">
          <Input value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Internal notes" />
        </FG>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={save}>{mode === "create" ? "Create customer" : "Save changes"}</Button>
      </div>
      <div className="mt-2 text-right text-[10.5px] text-slate-400">{db.customers.length} existing · duplicates are blocked by phone number</div>
    </Modal>
  );
}

function FG({ label, children, err, required, className }: { label: string; children: React.ReactNode; err?: string; required?: boolean; className?: string }) {
  return (
    <div className={className}>
      <Label required={required}>{label}</Label>
      {children}
      <FieldError message={err} />
    </div>
  );
}

export function LeadSelect({ exceptions }: { exceptions?: string[] }) {
  return (
    <Select>
      {Object.entries(LEAD_STATUS).filter(([k]) => !exceptions?.includes(k)).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
    </Select>
  );
}
