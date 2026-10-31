import { useMemo, useState } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  AreaChart, Area, PieChart, Pie, Cell,
} from "recharts";
import { Card, CardHeader, PageHeader, StatTile, Table, Th, Td, Badge, Select, Tabs, Button } from "@/components/ui";
import { useDB } from "@/services";
import { formatINR, formatCompactINR, daysUntil } from "@/lib/utils";
import { computeProjectFinance, isLowStock, stockValue } from "@/lib/calculations/finance";
import { PROJECT_STATUS, WARRANTY_STATUS } from "@/lib/labels";
import { Link } from "react-router";
import { downloadCSV } from "@/lib/csv";
import { aiBusinessInsights, type BusinessInsight } from "@/lib/ai";
import { useEffect } from "react";

const PIE_COLORS = ["#16a34a", "#f59e0b", "#8b5cf6", "#06b6d4", "#64748b"];

export default function AnalyticsPage() {
  const db = useDB();
  const [yearF, setYearF] = useState("all");
  const [statusF, setStatusF] = useState("all");
  const [insights, setInsights] = useState<BusinessInsight[]>([]);
  const [insightSource, setInsightSource] = useState<"live" | "fallback" | null>(null);
  const [insightBusy, setInsightBusy] = useState(false);

  const projects = useMemo(() => db.installation_projects
    .filter((p) => (statusF === "all" ? true : p.status === statusF))
    .filter((p) => (yearF === "all" ? true : p.created_at.startsWith(yearF))), [db, yearF, statusF]);

  const fin = useMemo(() => {
    let contract = 0, collected = 0, outstanding = 0, expenses = 0;
    const rows = projects.map((p) => {
      const f = computeProjectFinance({
        contract_value: p.contract_value,
        payments: db.payments.filter((x) => x.project_id === p.id),
        expenses: db.project_expenses.filter((x) => x.project_id === p.id),
      });
      contract += f.contract_value; collected += f.collected;
      outstanding += f.outstanding; expenses += f.expenses_total;
      return { p, f };
    });
    return { contract, collected, outstanding, expenses, profit: contract - expenses, rows: rows.sort((a, b) => b.f.estimated_profit - a.f.estimated_profit) };
  }, [projects, db]);

  const rates = useMemo(() => {
    const total = db.customers.length;
    const won = db.customers.filter((c) => c.lead_status === "won").length;
    const lost = db.customers.filter((c) => c.lead_status === "lost").length;
    const completed = db.installation_projects.filter((p) => p.status === "completed").length;
    const notCancelled = db.installation_projects.filter((p) => p.status !== "cancelled").length || 1;
    return {
      leadConversion: total ? Math.round((won / total) * 100) : 0,
      lostPercent: total ? Math.round((lost / total) * 100) : 0,
      completionRate: Math.round((completed / notCancelled) * 100),
    };
  }, [db]);

  const monthly = useMemo(() => {
    const map = new Map<string, { m: string; revenue: number; expenses: number; installs: number }>();
    const get = (iso: string) => {
      const d = new Date(iso);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!map.has(key)) map.set(key, { m: d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }), revenue: 0, expenses: 0, installs: 0 });
      return map.get(key)!;
    };
    db.payments.filter((p) => p.status === "paid" && p.payment_date).forEach((p) => { get(p.payment_date!).revenue += p.amount; });
    db.project_expenses.forEach((e) => { get(e.expense_date).expenses += e.amount; });
    db.installation_projects.filter((p) => p.actual_completion).forEach((p) => { get(p.actual_completion!).installs += 1; });
    return [...map.entries()].sort().map(([, v]) => v);
  }, [db]);

  const lowStock = db.inventory_items.filter(isLowStock);
  const expiring = db.warranties.filter((w) => w.status === "active" && daysUntil(w.end_date) <= 60);
  const openTickets = db.service_tickets.filter((t) => ["open", "assigned", "in_progress", "waiting_parts"].includes(t.status));

  const years = useMemo(() => [...new Set(db.installation_projects.map((p) => p.created_at.slice(0, 4)))].sort().reverse(), [db]);

  const askInsights = async () => {
    setInsightBusy(true);
    try {
      const leads = Object.entries(db.customers.reduce<Record<string, number>>((acc, c) => { acc[c.lead_status] = (acc[c.lead_status] ?? 0) + 1; return acc; }, {}));
      const low = lowStock.map((i) => `${i.name} (${i.available_qty}/${i.reorder_level})`);
      const outst = fin.rows.map(({ p, f }) => [p.number, db.customers.find((c) => c.id === p.customer_id)?.full_name ?? "", f.outstanding] as [string, string, number]).filter(([, , v]) => v > 0);
      const tickets = openTickets.map((t) => [t.number, t.issue_category] as [string, string]);
      const out = await aiBusinessInsights({ leads, lowStock: low, outstandingProjects: outst, openTickets: tickets });
      setInsights(out.items);
      setInsightSource(out.source);
    } finally { setInsightBusy(false); }
  };

  useEffect(() => { void askInsights(); /* auto-generate rule-based view once */ }, []);

  return (
    <div className="space-y-5">
      <PageHeader title="Analytics & Reports" subtitle="All figures computed from live application data with documented definitions">
        <Select value={yearF} onChange={(e) => setYearF(e.target.value)} className="w-28">
          <option value="all">All years</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </Select>
        <Select value={statusF} onChange={(e) => setStatusF(e.target.value)} className="w-44">
          <option value="all">All project statuses</option>
          {Object.entries(PROJECT_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
      </PageHeader>

      {/* KPIs */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Total contract value" value={formatCompactINR(fin.contract)} />
        <StatTile label="Amount collected" value={formatCompactINR(fin.collected)} tone="good" />
        <StatTile label="Outstanding payments" value={formatCompactINR(fin.outstanding)} tone={fin.outstanding ? "warn" : "default"} />
        <StatTile label="Project expenses" value={formatCompactINR(fin.expenses)} />
        <StatTile label="Est. gross profit" value={formatCompactINR(fin.profit)} tone={fin.profit >= 0 ? "good" : "bad"} />
        <StatTile label="Inventory valuation" value={formatCompactINR(stockValue(db.inventory_items))} />
      </div>
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <StatTile label="Lead conversion rate" value={`${rates.leadConversion}%`} sub="won ÷ total customers" />
        <StatTile label="Lost leads" value={`${rates.lostPercent}%`} sub="of all customers" />
        <StatTile label="Installation completion" value={`${rates.completionRate}%`} sub="completed ÷ non-cancelled" />
        <StatTile label="Low-stock items" value={lowStock.length} tone={lowStock.length ? "warn" : "good"} />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Monthly revenue & expenses" subtitle="Revenue = payments with status Paid only" />
          <div className="h-60 px-2 py-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="m" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCompactINR(Number(v))} width={62} />
                <Tooltip formatter={(v) => formatINR(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#16a34a" fill="#dcfce7" strokeWidth={2} />
                <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#f59e0b" fill="#fef3c7" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <CardHeader title="Monthly installation trend" />
          <div className="h-60 px-2 py-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="m" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="installs" name="Installations" fill="#16a34a" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* AI insights */}
      <Card>
        <CardHeader title="Business insights"
          subtitle={insightSource === "live" ? "AI-generated via server proxy" : insightSource === "fallback" ? "Rule-based offline generation (no AI key configured)" : "Generating…"}
          action={<Button size="sm" variant="outline" onClick={askInsights} disabled={insightBusy}>{insightBusy ? "Analyzing…" : "Regenerate"}</Button>} />
        <div className="grid gap-3 px-4 py-4 md:grid-cols-2">
          {insights.map((i, idx) => (
            <div key={idx} className={`rounded-xl border px-3.5 py-3 text-[12.5px] ${i.severity === "warn" ? "border-amber-200 bg-amber-50 text-amber-900" : i.severity === "critical" ? "border-rose-200 bg-rose-50 text-rose-900" : "border-slate-200 bg-slate-50 text-slate-700"}`}>
              <p className="text-[11px] font-bold uppercase tracking-wide opacity-70">{i.title}</p>
              <p className="mt-1 leading-relaxed">{i.insight}</p>
            </div>
          ))}
          {insights.length === 0 && !insightBusy && <p className="text-[12.5px] text-slate-400">No insights generated.</p>}
        </div>
      </Card>

      {/* Profitability table */}
      <Card>
        <CardHeader title="Project profitability" subtitle="Revenue (contract value) − recorded project expenses. Sorted by margin."
          action={<Button size="sm" variant="ghost" onClick={() => downloadCSV("project-profitability.csv", fin.rows.map(({ p, f }) => ({ number: p.number, customer: db.customers.find((c) => c.id === p.customer_id)?.full_name, contract: f.contract_value, collected: f.collected, outstanding: f.outstanding, expenses: f.expenses_total, profit: f.estimated_profit, margin: f.margin_percent, status: p.status })), ["number", "customer", "contract", "collected", "outstanding", "expenses", "profit", "margin", "status"])}>Export CSV</Button>} />
        <Table>
          <thead><tr><Th>Project</Th><Th>Customer</Th><Th className="text-right">Contract</Th><Th className="text-right">Collected</Th><Th className="text-right">Outstanding</Th><Th className="text-right">Expenses</Th><Th className="text-right">Est. profit</Th><Th>Status</Th></tr></thead>
          <tbody>
            {fin.rows.map(({ p, f }) => (
              <tr key={p.id} className="hover:bg-slate-50/60">
                <Td><Link to={`/installations/${p.id}`} className="font-semibold text-brand-700 hover:underline">{p.number}</Link></Td>
                <Td>{db.customers.find((c) => c.id === p.customer_id)?.full_name}</Td>
                <Td className="text-right">{formatINR(f.contract_value)}</Td>
                <Td className="text-right text-emerald-700">{formatINR(f.collected)}</Td>
                <Td className="text-right text-amber-700">{formatINR(f.outstanding)}</Td>
                <Td className="text-right">{formatINR(f.expenses_total)}</Td>
                <Td className={`text-right font-semibold ${f.estimated_profit >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{formatINR(f.estimated_profit)} <span className="text-[10.5px] font-normal text-slate-400">({f.margin_percent}%)</span></Td>
                <Td><Badge status={p.status} label={PROJECT_STATUS[p.status]} /></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      {/* Reports */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Low-stock report" subtitle="Items at or below reorder level" />
          <Table>
            <thead><tr><Th>Item</Th><Th>Avail</Th><Th>Reorder</Th></tr></thead>
            <tbody>
              {lowStock.map((i) => (
                <tr key={i.id}><Td>{i.name}</Td><Td className="font-semibold text-rose-600">{i.available_qty}</Td><Td>{i.reorder_level}</Td></tr>
              ))}
              {lowStock.length === 0 && <tr><Td className="text-slate-400">Nothing to reorder.</Td></tr>}
            </tbody>
          </Table>
        </Card>
        <Card>
          <CardHeader title="Warranty expiry report" subtitle="Active warranties ending within 60 days" />
          <Table>
            <thead><tr><Th>Code</Th><Th>Customer</Th><Th>Ends</Th></tr></thead>
            <tbody>
              {expiring.map((w) => (
                <tr key={w.id}>
                  <Td><Badge status={w.status} label={WARRANTY_STATUS[w.status]} /> {w.code}</Td>
                  <Td className="text-[12px]">{db.customers.find((c) => c.id === w.customer_id)?.full_name}</Td>
                  <Td className="text-[12px]">{daysUntil(w.end_date)}d</Td>
                </tr>
              ))}
              {expiring.length === 0 && <tr><Td className="text-slate-400">No warranties expiring soon.</Td></tr>}
            </tbody>
          </Table>
        </Card>
        <Card>
          <CardHeader title="Open service tickets" subtitle="Not yet resolved or closed" />
          <Table>
            <thead><tr><Th>Ticket</Th><Th>Priority</Th><Th>Status</Th></tr></thead>
            <tbody>
              {openTickets.map((t) => (
                <tr key={t.id}>
                  <Td className="font-mono text-[12px]">{t.number}</Td>
                  <Td><Badge status={t.priority} /></Td>
                  <Td><Badge status={t.status} /></Td>
                </tr>
              ))}
              {openTickets.length === 0 && <tr><Td className="text-slate-400">No open tickets 🎉</Td></tr>}
            </tbody>
          </Table>
        </Card>
      </div>

      <p className="rounded-lg bg-slate-100 px-3.5 py-2.5 text-[11.5px] leading-relaxed text-slate-500">
        <b>Definitions.</b> <b>Contract value</b> — accepted quotation total allocated to the project at creation.
        <b> Collected</b> — payments with status <em>Paid</em> only (pending/failed excluded; refunds subtract).
        <b> Outstanding</b> — contract value − collected, floored at zero.
        <b> Expenses</b> — recorded project expenses including equipment cost basis, labor, transport and others.
        <b> Est. gross profit</b> — contract value − expenses. Not audited financials.
      </p>
    </div>
  );
}
