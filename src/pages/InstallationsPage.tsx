import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Search, HardHat } from "lucide-react";
import { Card, PageHeader, Input, Select, Table, Th, Td, Badge, EmptyState, StatTile } from "@/components/ui";
import { useDB } from "@/services";
import { PROJECT_STATUS } from "@/lib/labels";
import { formatINR } from "@/lib/utils";
import { computeProjectFinance } from "@/lib/calculations/finance";

export default function InstallationsPage() {
  const db = useDB();
  const [q, setQ] = useState("");
  const [statusF, setStatusF] = useState("all");

  const rows = useMemo(() => db.installation_projects
    .filter((p) => (statusF === "all" ? true : p.status === statusF))
    .filter((p) => {
      const t = q.toLowerCase();
      const cust = db.customers.find((c) => c.id === p.customer_id)?.full_name ?? "";
      return !t || p.number.toLowerCase().includes(t) || cust.toLowerCase().includes(t) || p.package_name.toLowerCase().includes(t);
    }), [db, q, statusF]);

  const stats = useMemo(() => {
    const fin = db.installation_projects.filter((p) => p.status !== "cancelled").reduce((acc, p) => {
      const f = computeProjectFinance({
        contract_value: p.contract_value,
        payments: db.payments.filter((x) => x.project_id === p.id),
        expenses: db.project_expenses.filter((x) => x.project_id === p.id),
      });
      return { value: acc.value + f.contract_value, collected: acc.collected + f.collected, profit: acc.profit + f.estimated_profit };
    }, { value: 0, collected: 0, profit: 0 });
    return fin;
  }, [db]);

  return (
    <div className="space-y-5">
      <PageHeader title="Installation Projects" subtitle="Projects are created from accepted quotations — exactly one per quotation" />

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <StatTile label="Active projects" value={db.installation_projects.filter((p) => p.status !== "completed" && p.status !== "cancelled").length} icon={HardHat} />
        <StatTile label="Total contract value" value={formatINR(stats.value)} />
        <StatTile label="Collected" value={formatINR(stats.collected)} tone="good" />
        <StatTile label="Est. profit" value={formatINR(stats.profit)} tone={stats.profit >= 0 ? "good" : "bad"} />
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input className="pl-8" placeholder="Search project, customer, package…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select className="w-48" value={statusF} onChange={(e) => setStatusF(e.target.value)}>
          <option value="all">All statuses</option>
          {Object.entries(PROJECT_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
      </div>

      <Card>
        {rows.length ? (
          <Table>
            <thead><tr><Th>Project</Th><Th>Customer</Th><Th>System</Th><Th>Schedule</Th><Th>Crew</Th><Th>Finance</Th><Th>Status</Th></tr></thead>
            <tbody>
              {rows.map((p) => {
                const cust = db.customers.find((c) => c.id === p.customer_id);
                const crew = db.installation_crews.find((c) => c.id === p.crew_id);
                const fin = computeProjectFinance({
                  contract_value: p.contract_value,
                  payments: db.payments.filter((x) => x.project_id === p.id),
                  expenses: db.project_expenses.filter((x) => x.project_id === p.id),
                });
                return (
                  <tr key={p.id} className="hover:bg-slate-50/60">
                    <Td><Link to={`/installations/${p.id}`} className="font-semibold text-brand-700 hover:underline">{p.number}</Link><p className="text-[11px] text-slate-400">{p.installation_type}</p></Td>
                    <Td>{cust?.full_name}<p className="text-[11px] text-slate-400">{p.address.split(",").slice(1, 2)}</p></Td>
                    <Td><p>{p.capacity_kw} kW</p><p className="text-[11px] text-slate-400">{p.package_name}</p></Td>
                    <Td><p>{p.scheduled_start && p.scheduled_end ? `${p.scheduled_start} → ${p.scheduled_end}` : "—"}</p>{p.actual_completion && <p className="text-[11px] text-emerald-600">done {p.actual_completion}</p>}</Td>
                    <Td><p className="text-[12px]">{crew?.name ?? "—"}</p></Td>
                    <Td>
                      <p className="font-semibold">{formatINR(fin.contract_value)}</p>
                      <p className="text-[11px] text-slate-400">collected {formatINR(fin.collected)} · {fin.outstanding > 0 ? <span className="text-amber-600">outstanding {formatINR(fin.outstanding)}</span> : <span className="text-emerald-600">fully paid</span>}</p>
                    </Td>
                    <Td><Badge status={p.status} label={PROJECT_STATUS[p.status]} /></Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : <EmptyState icon={HardHat} title="No projects" subtitle="Accept a quotation to create the first installation project." />}
      </Card>
    </div>
  );
}
