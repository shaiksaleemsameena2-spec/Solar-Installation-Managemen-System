import { useMemo } from "react";
import { Link } from "react-router";
import {
  Users, UserPlus, ClipboardCheck, FileText, Briefcase, CalendarDays, HardHat,
  Boxes, TriangleAlert, ShieldCheck, Wrench, Wallet, Landmark, CircleDollarSign, Activity as ActIcon,
  ArrowRight,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";
import { Card, CardHeader, StatTile, Badge, Table, Th, Td, PageHeader } from "@/components/ui";
import { useDB } from "@/services";
import { formatINR, formatCompactINR, formatDateTime } from "@/lib/utils";
import { computeProjectFinance, isLowStock } from "@/lib/calculations/finance";
import { PROJECT_STATUS } from "@/lib/labels";
import { DEMO_MODE } from "@/services";

const PIE_COLORS = ["#16a34a", "#2563eb", "#f59e0b", "#8b5cf6", "#06b6d4", "#f43f5e", "#64748b"];

export default function DashboardPage() {
  const db = useDB();

  const kpis = useMemo(() => {
    const paid = db.payments.filter((p) => p.status === "paid");
    const revenue = paid.reduce((s, p) => s + p.amount, 0);
    const activeProjects = db.installation_projects.filter((p) => p.status !== "cancelled");
    const outstanding = activeProjects.reduce((s, pj) => {
      const pays = db.payments.filter((p) => p.project_id === pj.id);
      const col = pays.filter((p) => p.status === "paid").reduce((x, p) => x + p.amount, 0);
      const ref = pays.filter((p) => p.status === "refunded").reduce((x, p) => x + p.amount, 0);
      return s + Math.max(0, pj.contract_value - (col - ref));
    }, 0);
    const expenses = db.project_expenses
      .filter((e) => activeProjects.some((p) => p.id === e.project_id))
      .reduce((s, e) => s + e.amount, 0);
    return {
      customers: db.customers.length,
      newLeads: db.customers.filter((c) => ["new", "contacted"].includes(c.lead_status)).length,
      pendingSurveys: db.site_surveys.filter((s) => ["scheduled", "in_progress"].includes(s.status)).length,
      quotesAwaiting: db.quotations.filter((q) => ["generated", "sent"].includes(q.status)).length,
      acceptedProjects: activeProjects.filter((p) => p.status !== "completed").length,
      scheduled: activeProjects.filter((p) => p.status === "scheduled").length,
      completed: activeProjects.filter((p) => p.status === "completed").length,
      availableStock: db.inventory_items.reduce((s, i) => s + i.available_qty, 0),
      lowStock: db.inventory_items.filter(isLowStock).length,
      activeWarranties: db.warranties.filter((w) => w.status === "active").length,
      openTickets: db.service_tickets.filter((t) => ["open", "assigned", "in_progress", "waiting_parts"].includes(t.status)).length,
      revenue,
      outstanding,
      expenses,
      grossProfit: revenue - expenses,
    };
  }, [db]);

  const monthly = useMemo(() => {
    const map = new Map<string, { m: string; revenue: number; expenses: number; installations: number }>();
    const get = (dISO: string) => {
      const d = new Date(dISO);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!map.has(key)) map.set(key, { m: d.toLocaleDateString("en-IN", { month: "short" }), revenue: 0, expenses: 0, installations: 0 });
      return map.get(key)!;
    };
    db.payments.filter((p) => p.status === "paid" && p.payment_date).forEach((p) => { get(p.payment_date!).revenue += p.amount; });
    db.project_expenses.forEach((e) => { get(e.expense_date).expenses += e.amount; });
    db.installation_projects.filter((p) => p.actual_completion).forEach((p) => { get(p.actual_completion!).installations += 1; });
    return [...map.entries()].sort().map(([, v]) => v);
  }, [db]);

  const statusDist = useMemo(() => {
    const counts = new Map<string, number>();
    db.installation_projects.forEach((p) => counts.set(p.status, (counts.get(p.status) ?? 0) + 1));
    return [...counts.entries()].map(([status, value]) => ({ name: PROJECT_STATUS[status] ?? status, value }));
  }, [db]);

  const funnel = useMemo(() => {
    const stages = ["won", "quotation_sent", "survey_completed", "contacted", "new"] as const;
    const colors = ["#16a34a", "#8b5cf6", "#0ea5e9", "#f59e0b", "#2563eb"];
    return stages.map((s, i) => ({
      name: s === "won" ? "Won (customers)" : s === "new" ? "New leads" : s.replaceAll("_", " "),
      count: db.customers.filter((c) => c.lead_status === s).length,
      color: colors[i],
    })).reverse();
  }, [db]);

  const lowStockItems = db.inventory_items.filter(isLowStock);
  const recent = db.activity_logs.slice(0, 8);
  const upcoming = db.installation_projects
    .filter((p) => ["scheduled", "in_progress", "quality_inspection"].includes(p.status) && p.scheduled_start)
    .sort((a, b) => a.scheduled_start!.localeCompare(b.scheduled_start!))
    .slice(0, 5);
  const pendingQuotes = db.quotations.filter((q) => ["generated", "sent", "draft"].includes(q.status)).slice(0, 5);
  const urgentTickets = db.service_tickets.filter((t) => ["open", "assigned", "in_progress", "waiting_parts"].includes(t.status) && ["high", "critical"].includes(t.priority));

  return (
    <div className="space-y-6">
      <PageHeader title="Executive Overview" subtitle="All metrics are computed live from application records.">
        <span className="rounded-lg bg-brand-50 px-3 py-1.5 text-[12px] font-semibold text-brand-800">
          {db.customers.length} customers · {db.installation_projects.length} projects
        </span>
      </PageHeader>

      {DEMO_MODE && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[12.5px] text-amber-800">
          You are viewing <b>seeded demo data</b> (fictional customers, quotations, payments and equipment). Reset it any time from Settings.
        </div>
      )}

      {/* KPI row 1 */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Total customers" value={kpis.customers} icon={Users} />
        <StatTile label="New leads" value={kpis.newLeads} icon={UserPlus} tone="default" />
        <StatTile label="Pending surveys" value={kpis.pendingSurveys} icon={ClipboardCheck} tone={kpis.pendingSurveys ? "warn" : "default"} />
        <StatTile label="Quotes awaiting" value={kpis.quotesAwaiting} icon={FileText} tone={kpis.quotesAwaiting ? "warn" : "default"} />
        <StatTile label="Active projects" value={kpis.acceptedProjects} icon={Briefcase} />
        <StatTile label="Scheduled installs" value={kpis.scheduled} icon={CalendarDays} />
      </div>
      {/* KPI row 2 */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Installations done" value={kpis.completed} icon={HardHat} tone="good" />
        <StatTile label="Stock available" value={kpis.availableStock} icon={Boxes} />
        <StatTile label="Low-stock items" value={kpis.lowStock} icon={TriangleAlert} tone={kpis.lowStock ? "bad" : "good"} />
        <StatTile label="Active warranties" value={kpis.activeWarranties} icon={ShieldCheck} />
        <StatTile label="Open tickets" value={kpis.openTickets} icon={Wrench} tone={kpis.openTickets ? "warn" : "default"} />
        <StatTile label="Subsidy received" value={formatCompactINR(db.subsidy_applications.reduce((s, x) => s + x.received_amount, 0))} icon={Landmark} />
      </div>

      {/* KPI row 3 — finance */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <StatTile label="Revenue collected" value={formatCompactINR(kpis.revenue)} icon={Wallet} tone="good" />
        <StatTile label="Outstanding payments" value={formatCompactINR(kpis.outstanding)} icon={CircleDollarSign} tone={kpis.outstanding ? "warn" : "default"} />
        <StatTile label="Project expenses" value={formatCompactINR(kpis.expenses)} icon={ActIcon} />
        <StatTile label="Est. gross profit" value={formatCompactINR(kpis.grossProfit)} icon={CircleDollarSign} tone={kpis.grossProfit >= 0 ? "good" : "bad"} />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Revenue vs expenses (monthly)" subtitle="Paid customer payments vs recorded project expenses" />
          <div className="h-56 px-2 py-3">
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
          <CardHeader title="Installations completed (monthly)" />
          <div className="h-56 px-2 py-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="m" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="installations" name="Installations" fill="#16a34a" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <CardHeader title="Project status distribution" />
          <div className="h-56 px-2 py-3">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusDist} dataKey="value" nameKey="name" innerRadius={45} outerRadius={72} paddingAngle={2}>
                  {statusDist.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <CardHeader title="Lead-to-installation pipeline" subtitle="Customers by lead stage — the widest stages show conversion backlog" />
          <div className="h-56 px-2 py-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnel} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10.5 }} width={110} />
                <Tooltip />
                <Bar dataKey="count" name="Customers" radius={[0, 6, 6, 0]}>
                  {funnel.map((f, i) => <Cell key={i} fill={f.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Sections */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Recent activity" subtitle="Database-backed event log" />
          <div className="max-h-72 overflow-y-auto px-4 py-3">
            {recent.map((a) => (
              <div key={a.id} className="flex gap-3 border-b border-slate-50 py-2 last:border-0">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                <div className="min-w-0">
                  <p className="text-[12.5px] text-slate-700">{a.message}</p>
                  <p className="text-[11px] text-slate-400">{formatDateTime(a.created_at)}</p>
                </div>
              </div>
            ))}
            {recent.length === 0 && <p className="py-4 text-center text-[12.5px] text-slate-400">No activity yet.</p>}
          </div>
        </Card>

        <Card>
          <CardHeader title="Upcoming installations" action={<Link to="/installations" className="text-[12px] font-semibold text-brand-700 hover:underline">View all <ArrowRight className="inline h-3 w-3" /></Link>} />
          <Table>
            <thead><tr><Th>Project</Th><Th>Customer</Th><Th>Schedule</Th><Th>Status</Th></tr></thead>
            <tbody>
              {upcoming.map((p) => (
                <tr key={p.id}>
                  <Td><Link to={`/installations/${p.id}`} className="font-semibold text-brand-700 hover:underline">{p.number}</Link></Td>
                  <Td>{db.customers.find((c) => c.id === p.customer_id)?.full_name}</Td>
                  <Td>{p.scheduled_start}</Td>
                  <Td><Badge status={p.status} label={PROJECT_STATUS[p.status]} /></Td>
                </tr>
              ))}
              {upcoming.length === 0 && <tr><Td className="text-slate-400">No scheduled installations.</Td></tr>}
            </tbody>
          </Table>
        </Card>

        <Card>
          <CardHeader title="Pending quotations" action={<Link to="/quotations" className="text-[12px] font-semibold text-brand-700 hover:underline">View all</Link>} />
          <Table>
            <thead><tr><Th>Number</Th><Th>Customer</Th><Th>Amount</Th><Th>Status</Th></tr></thead>
            <tbody>
              {pendingQuotes.map((q) => (
                <tr key={q.id}>
                  <Td><Link to={`/quotations/${q.id}`} className="font-semibold text-brand-700 hover:underline">{q.number}</Link></Td>
                  <Td>{db.customers.find((c) => c.id === q.customer_id)?.full_name}</Td>
                  <Td>{formatINR(q.total)}</Td>
                  <Td><Badge status={q.status} /></Td>
                </tr>
              ))}
              {pendingQuotes.length === 0 && <tr><Td className="text-slate-400">No pending quotations.</Td></tr>}
            </tbody>
          </Table>
        </Card>

        <Card>
          <CardHeader title="Low-stock alerts" action={<Link to="/inventory" className="text-[12px] font-semibold text-brand-700 hover:underline">Inventory</Link>} />
          <Table>
            <thead><tr><Th>Item</Th><Th>Available</Th><Th>Reorder at</Th><Th></Th></tr></thead>
            <tbody>
              {lowStockItems.slice(0, 5).map((i) => (
                <tr key={i.id}>
                  <Td>{i.name} <span className="text-slate-400">({i.sku})</span></Td>
                  <Td className="font-semibold text-rose-600">{i.available_qty} {i.unit}</Td>
                  <Td>{i.reorder_level}</Td>
                  <Td><Badge status="low" label="Reorder" /></Td>
                </tr>
              ))}
              {lowStockItems.length === 0 && <tr><Td className="text-slate-400">All items above reorder level.</Td></tr>}
            </tbody>
          </Table>
        </Card>

        <Card>
          <CardHeader title="Urgent service tickets" action={<Link to="/service" className="text-[12px] font-semibold text-brand-700 hover:underline">Service Center</Link>} />
          <Table>
            <thead><tr><Th>Ticket</Th><Th>Issue</Th><Th>Priority</Th></tr></thead>
            <tbody>
              {urgentTickets.map((t) => (
                <tr key={t.id}>
                  <Td><span className="font-mono text-[12px] font-semibold">{t.number}</span></Td>
                  <Td className="max-w-[200px] truncate">{t.issue_category} — {t.description}</Td>
                  <Td><Badge status={t.priority} /></Td>
                </tr>
              ))}
              {urgentTickets.length === 0 && <tr><Td className="text-slate-400">No urgent tickets. 🎉</Td></tr>}
            </tbody>
          </Table>
        </Card>

        <Card>
          <CardHeader title="Recently completed installations" />
          <Table>
            <thead><tr><Th>Project</Th><Th>Customer</Th><Th>Completed</Th><Th>Revenue</Th></tr></thead>
            <tbody>
              {db.installation_projects.filter((p) => p.status === "completed" && p.actual_completion).sort((a, b) => b.actual_completion!.localeCompare(a.actual_completion!)).slice(0, 5).map((p) => {
                const fin = computeProjectFinance({
                  contract_value: p.contract_value,
                  payments: db.payments.filter((x) => x.project_id === p.id),
                  expenses: db.project_expenses.filter((x) => x.project_id === p.id),
                });
                return (
                  <tr key={p.id}>
                    <Td><Link to={`/installations/${p.id}`} className="font-semibold text-brand-700 hover:underline">{p.number}</Link></Td>
                    <Td>{db.customers.find((c) => c.id === p.customer_id)?.full_name}</Td>
                    <Td>{p.actual_completion}</Td>
                    <Td>{formatINR(fin.contract_value)}</Td>
                  </tr>
                );
              })}
              {db.installation_projects.filter((p) => p.status === "completed").length === 0 && <tr><Td className="text-slate-400">No completed installations yet.</Td></tr>}
            </tbody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
