import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Search, Plus, Wallet, Wallet2, Trash2, CheckCircle2, Send } from "lucide-react";
import { Card, PageHeader, Button, Input, Select, Modal, Label, Table, Th, Td, Badge, FieldError, EmptyState, StatTile, Tabs, ConfirmDialog, Textarea } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useDB, api } from "@/services";
import { useSession } from "@/hooks/useSession";
import { PAYMENT_STATUS, PAYMENT_STAGE, PAYMENT_METHODS, EXPENSE_CATEGORIES } from "@/lib/labels";
import { formatINR, formatDate, todayISO } from "@/lib/utils";
import { downloadCSV } from "@/lib/csv";
import type { PaymentStage } from "@/types";

export default function PaymentsPage() {
  const db = useDB();
  const session = useSession();
  const toast = useToast();
  const [tab, setTab] = useState("payments");
  const [q, setQ] = useState("");
  const [statusF, setStatusF] = useState("all");
  const [payModal, setPayModal] = useState(false);
  const [expModal, setExpModal] = useState(false);
  const [delPay, setDelPay] = useState<string | null>(null);

  const payments = useMemo(() => db.payments
    .filter((p) => (statusF === "all" ? true : p.status === statusF))
    .filter((p) => {
      const t = q.toLowerCase();
      const cust = db.customers.find((c) => c.id === p.customer_id)?.full_name ?? "";
      return !t || p.number.toLowerCase().includes(t) || cust.toLowerCase().includes(t) || p.txn_ref.toLowerCase().includes(t);
    }), [db.payments, db.customers, q, statusF]);

  const totals = useMemo(() => {
    const collected = db.payments.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0);
    const pending = db.payments.filter((p) => p.status === "pending").reduce((s, p) => s + p.amount, 0);
    const refunds = db.payments.filter((p) => p.status === "refunded").reduce((s, p) => s + p.amount, 0);
    const contract = db.installation_projects.filter((p) => p.status !== "cancelled").reduce((s, p) => s + p.contract_value, 0);
    return { collected, pending, refunds, contract, outstanding: Math.max(0, contract - collected) };
  }, [db]);

  const expenses = db.project_expenses.slice().sort((a, b) => b.expense_date.localeCompare(a.expense_date));
  const expensesTotal = expenses.reduce((s, e) => s + e.amount, 0);
  const canManage = session?.role === "superadmin" || session?.role === "staff" || session?.role === "admin" || session?.role === "sales" || session?.role === "inventory";

  return (
    <div className="space-y-5">
      <PageHeader title="Payments & Expenses" subtitle="Collected ≠ contract value — refunded and pending amounts are tracked separately">
        <Button variant="outline" onClick={() => setExpModal(true)}><Wallet2 className="h-4 w-4" /> Record expense</Button>
        <Button onClick={() => setPayModal(true)}><Plus className="h-4 w-4" /> Record payment</Button>
      </PageHeader>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
        <StatTile label="Contract value (all projects)" value={formatINR(totals.contract)} icon={Wallet} />
        <StatTile label="Collected" value={formatINR(totals.collected)} tone="good" icon={Wallet} />
        <StatTile label="Outstanding" value={formatINR(totals.outstanding)} tone={totals.outstanding ? "warn" : "default"} icon={Wallet} />
        <StatTile label="Pending payment requests" value={formatINR(totals.pending)} icon={Wallet} />
        <StatTile label="Project expenses" value={formatINR(expensesTotal)} icon={Wallet2} tone="default" />
      </div>

      <Tabs tabs={[
        { key: "payments", label: "Payments", count: db.payments.length },
        { key: "expenses", label: "Project expenses", count: expenses.length },
      ]} active={tab} onChange={setTab} />

      {tab === "payments" && (
        <>
          <div className="flex flex-wrap gap-2">
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input className="pl-8" placeholder="Search number, customer, txn ref…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <Select className="w-40" value={statusF} onChange={(e) => setStatusF(e.target.value)}>
              <option value="all">All statuses</option>
              {Object.entries(PAYMENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
            <Button variant="ghost" size="sm" onClick={() => downloadCSV("payments.csv", db.payments, ["number", "amount", "payment_date", "method", "txn_ref", "stage", "status"])}>Export CSV</Button>
          </div>
          <Card>
            <Table>
              <thead><tr><Th>Number</Th><Th>Customer / project</Th><Th>Stage</Th><Th>Amount</Th><Th>Date</Th><Th>Method / ref</Th><Th>Status</Th><Th className="text-right">Actions</Th></tr></thead>
              <tbody>
                {payments.map((p) => {
                  const cust = db.customers.find((c) => c.id === p.customer_id);
                  const proj = db.installation_projects.find((x) => x.id === p.project_id);
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/60">
                      <Td className="font-mono text-[12px] font-semibold">{p.number}</Td>
                      <Td>{cust?.full_name}{proj && <p className="text-[10.5px] text-slate-400">{proj.number}</p>}</Td>
                      <Td className="text-[12px]">{PAYMENT_STAGE[p.stage]}</Td>
                      <Td className="font-semibold">{formatINR(p.amount)}</Td>
                      <Td className="text-[12px]">{p.payment_date ? formatDate(p.payment_date) : "—"}</Td>
                      <Td className="text-[11.5px] text-slate-500">{p.method}{p.txn_ref && <> · <span className="font-mono">{p.txn_ref}</span></>}</Td>
                      <Td><Badge status={p.status} /></Td>
                      <Td>
                        <div className="flex justify-end gap-1">
                          {p.status === "pending" && canManage && (
                            <>
                              <Button size="sm" variant="accent" onClick={() => { api.updatePaymentStatus(p.id, "paid"); toast.success("Marked paid", `${formatINR(p.amount)} collected for ${p.number}`); }}><CheckCircle2 className="h-3.5 w-3.5" /> Mark paid</Button>
                              <Button size="sm" variant="ghost" onClick={() => { api.updatePaymentStatus(p.id, "failed"); toast.info("Marked failed"); }}>Fail</Button>
                            </>
                          )}
                          {["paid"].includes(p.status) && canManage && (
                            <Button size="sm" variant="ghost" onClick={() => { api.updatePaymentStatus(p.id, "refunded"); toast.info("Marked refunded — collected total reduces automatically"); }}>Refund</Button>
                          )}
                          {canManage && <Button size="sm" variant="ghost" onClick={() => setDelPay(p.id)}><Trash2 className="h-3.5 w-3.5 text-rose-500" /></Button>}
                        </div>
                      </Td>
                    </tr>
                  );
                })}
                {payments.length === 0 && <tr><Td className="text-slate-400">No payments match the filters.</Td></tr>}
              </tbody>
            </Table>
          </Card>
        </>
      )}

      {tab === "expenses" && (
        <Card>
          <Table>
            <thead><tr><Th>Date</Th><Th>Project</Th><Th>Category</Th><Th>Vendor</Th><Th>Amount</Th><Th>Notes</Th><Th className="text-right">Action</Th></tr></thead>
            <tbody>
              {expenses.map((e) => {
                const proj = db.installation_projects.find((x) => x.id === e.project_id);
                return (
                  <tr key={e.id}>
                    <Td className="text-[12px]">{formatDate(e.expense_date)}</Td>
                    <Td><Link to={`/installations/${proj?.id}`} className="text-brand-700 hover:underline">{proj?.number}</Link></Td>
                    <Td className="text-[12px]">{e.category}</Td>
                    <Td className="text-[12px]">{e.vendor}</Td>
                    <Td className="font-semibold">{formatINR(e.amount)}</Td>
                    <Td className="max-w-[220px] truncate text-[12px] text-slate-400">{e.notes}</Td>
                    <Td className="text-right">{canManage && <Button size="sm" variant="ghost" onClick={() => { api.deleteExpense(e.id); toast.info("Expense removed"); }}><Trash2 className="h-3.5 w-3.5 text-rose-500" /></Button>}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          {expenses.length === 0 && <EmptyState icon={Wallet2} title="No expenses recorded" />}
        </Card>
      )}

      {payModal && <PaymentModal onClose={() => setPayModal(false)} />}
      {expModal && <ExpenseModal onClose={() => setExpModal(false)} />}
      <ConfirmDialog open={!!delPay} onClose={() => setDelPay(null)} title="Delete payment?"
        message="Remove this payment record from the ledger (demo action — real ledgers use refunds)."
        confirmLabel="Delete" danger
        onConfirm={() => { api.deletePayment(delPay!); toast.success("Payment removed"); }} />
    </div>
  );
}

function PaymentModal({ onClose }: { onClose: () => void }) {
  const db = useDB();
  const toast = useToast();
  const [form, setForm] = useState({
    project_id: "", amount: "", payment_date: todayISO(), method: PAYMENT_METHODS[0],
    txn_ref: "", stage: "booking_advance" as PaymentStage, status: "paid" as const, notes: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const proj = db.installation_projects.find((p) => p.id === form.project_id);
  const customer = proj ? db.customers.find((c) => c.id === proj.customer_id) : db.customers.find((c) => c.lead_status === "won") ?? db.customers[0];
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const save = () => {
    const errs: Record<string, string> = {};
    if (!form.project_id) errs.project_id = "Select a project";
    if (!(Number(form.amount) > 0)) errs.amount = "Amount must be > 0";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      api.recordPayment({
        customer_id: customer?.id ?? "", project_id: proj?.id ?? null,
        quotation_id: proj?.quotation_id ?? null, amount: Number(form.amount),
        payment_date: form.payment_date || null, method: form.method, txn_ref: form.txn_ref,
        stage: form.stage, status: form.status, notes: form.notes,
      });
      toast.success(form.status === "paid" ? "Payment recorded" : "Payment request created", `${formatINR(Number(form.amount))}${form.txn_ref ? ` · ref ${form.txn_ref}` : ""}`);
      onClose();
    } catch (e) { toast.error("Record failed", e instanceof Error ? e.message : String(e)); }
  };
  return (
    <Modal open onClose={onClose} title="Record payment" width="max-w-lg">
      <div className="grid gap-3.5 sm:grid-cols-2">
        <FG label="Project" required err={errors.project_id} className="sm:col-span-2">
          <Select value={form.project_id} onChange={(e) => set("project_id", e.target.value)}>
            <option value="">Select project…</option>
            {db.installation_projects.map((p) => {
              const c = db.customers.find((x) => x.id === p.customer_id);
              return <option key={p.id} value={p.id}>{p.number} · {c?.full_name} · {formatINR(p.contract_value)}</option>;
            })}
          </Select>
        </FG>
        <FG label="Amount (₹)" required err={errors.amount}><Input type="number" value={form.amount} onChange={(e) => set("amount", e.target.value)} /></FG>
        <FG label="Stage">
          <Select value={form.stage} onChange={(e) => set("stage", e.target.value)}>
            {Object.entries(PAYMENT_STAGE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </FG>
        <FG label="Method">
          <Select value={form.method} onChange={(e) => set("method", e.target.value)}>
            {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
          </Select>
        </FG>
        <FG label="Status">
          <Select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as never }))}>
            <option value="paid">Paid (collected)</option>
            <option value="pending">Pending (request)</option>
          </Select>
        </FG>
        <FG label="Payment date"><Input type="date" value={form.payment_date} onChange={(e) => set("payment_date", e.target.value)} /></FG>
        <FG label="Transaction reference" hint="Same ref + project + amount cannot repeat (idempotency)"><Input value={form.txn_ref} onChange={(e) => set("txn_ref", e.target.value)} className="font-mono" /></FG>
        <FG label="Notes" className="sm:col-span-2"><Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} className="min-h-[54px]" /></FG>
      </div>
      <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
        {form.txn_ref.trim() ? "Duplicate txn reference is checked at save time." : "Tip: include a transaction reference to enable duplicate-payment protection."}
        {" "}No card data is stored. Razorpay would be server-verified.
      </p>
      <div className="mt-3 flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save}>Record payment</Button></div>
    </Modal>
  );
}

function ExpenseModal({ onClose }: { onClose: () => void }) {
  const db = useDB();
  const toast = useToast();
  const [form, setForm] = useState({ project_id: db.installation_projects[0]?.id ?? "", category: EXPENSE_CATEGORIES[0], amount: "", expense_date: todayISO(), vendor: "", notes: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const save = () => {
    const errs: Record<string, string> = {};
    if (!form.project_id) errs.project_id = "Select project";
    if (!(Number(form.amount) > 0)) errs.amount = "Amount must be > 0";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    api.addExpense({
      project_id: form.project_id, category: form.category, amount: Number(form.amount),
      expense_date: form.expense_date, vendor: form.vendor, notes: form.notes,
    });
    toast.success("Expense recorded", `${formatINR(Number(form.amount))} · recalc done live`);
    onClose();
  };
  return (
    <Modal open onClose={onClose} title="Record project expense" width="max-w-lg">
      <div className="grid gap-3.5 sm:grid-cols-2">
        <FG label="Project" required err={errors.project_id} className="sm:col-span-2">
          <Select value={form.project_id} onChange={(e) => set("project_id", e.target.value)}>
            {db.installation_projects.map((p) => <option key={p.id} value={p.id}>{p.number} · {p.package_name}</option>)}
          </Select>
        </FG>
        <FG label="Category">
          <Select value={form.category} onChange={(e) => set("category", e.target.value)}>
            {EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </Select>
        </FG>
        <FG label="Amount (₹)" required err={errors.amount}><Input type="number" value={form.amount} onChange={(e) => set("amount", e.target.value)} /></FG>
        <FG label="Expense date"><Input type="date" value={form.expense_date} onChange={(e) => set("expense_date", e.target.value)} /></FG>
        <FG label="Vendor / supplier"><Input value={form.vendor} onChange={(e) => set("vendor", e.target.value)} /></FG>
        <FG label="Notes" className="sm:col-span-2"><Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} className="min-h-[50px]" /></FG>
      </div>
      <div className="mt-3 flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save}>Record expense</Button></div>
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
