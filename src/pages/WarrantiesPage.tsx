import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Search, ShieldCheck, Printer } from "lucide-react";
import { Card, PageHeader, Input, Select, Table, Th, Td, Badge, EmptyState, StatTile, Button } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useDB, api } from "@/services";
import { WARRANTY_STATUS } from "@/lib/labels";
import { formatDate, daysUntil } from "@/lib/utils";
import { printWarrantyCertificate } from "@/lib/certificate";
import { downloadCSV } from "@/lib/csv";

export default function WarrantiesPage() {
  const db = useDB();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [statusF, setStatusF] = useState("all");

  const rows = useMemo(() => db.warranties
    .filter((w) => (statusF === "all" ? true : w.status === statusF))
    .filter((w) => {
      const t = q.toLowerCase();
      const cust = db.customers.find((c) => c.id === w.customer_id)?.full_name ?? "";
      return !t || w.code.toLowerCase().includes(t) || cust.toLowerCase().includes(t) || w.serial_number.toLowerCase().includes(t);
    }), [db, q, statusF]);

  const expiringSoon = db.warranties.filter((w) => w.status === "active" && daysUntil(w.end_date) <= 30 && daysUntil(w.end_date) >= 0);
  const expired = db.warranties.filter((w) => w.status === "active" ? daysUntil(w.end_date) < 0 : w.status === "expired");

  const claim = (w: typeof db.warranties[number]) => {
    try {
      const t = db.service_tickets.length;
      void t;
      api.updateWarrantyStatus(w.id, "claimed");
      toast.success("Warranty marked as claimed", `${w.code} — a service ticket can now track the claim.`);
    } catch (e) { toast.error("Failed", e instanceof Error ? e.message : String(e)); }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Warranty Management" subtitle="Activated per completed installation from installed serial numbers — duplicate activation prevented">
        <Button variant="ghost" size="sm" onClick={() => downloadCSV("warranties.csv", db.warranties, ["code", "product_name", "serial_number", "warranty_type", "start_date", "end_date", "status"])}>Export CSV</Button>
      </PageHeader>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <StatTile label="Active warranties" value={db.warranties.filter((w) => w.status === "active").length} icon={ShieldCheck} tone="good" />
        <StatTile label="Expiring within 30 days" value={expiringSoon.length} tone={expiringSoon.length ? "warn" : "default"} icon={ShieldCheck} />
        <StatTile label="Expired" value={expired.length} icon={ShieldCheck} tone="default" />
        <StatTile label="Total records" value={db.warranties.length} icon={ShieldCheck} />
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input className="pl-8" placeholder="Search code, customer, serial…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select className="w-44" value={statusF} onChange={(e) => setStatusF(e.target.value)}>
          <option value="all">All statuses</option>
          {Object.entries(WARRANTY_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
      </div>

      <Card>
        {rows.length ? (
          <Table>
            <thead><tr><Th>Code</Th><Th>Customer</Th><Th>Product / serials</Th><Th>Type</Th><Th>Period</Th><Th>Status</Th><Th className="text-right">Actions</Th></tr></thead>
            <tbody>
              {rows.map((w) => {
                const cust = db.customers.find((c) => c.id === w.customer_id);
                const proj = db.installation_projects.find((p) => p.id === w.project_id);
                const left = daysUntil(w.end_date);
                return (
                  <tr key={w.id} className="hover:bg-slate-50/60">
                    <Td><p className="font-semibold text-slate-800">{w.code}</p><p className="text-[11px] text-slate-400">{proj?.number}</p></Td>
                    <Td><Link to={`/customers/${cust?.id}`} className="text-brand-700 hover:underline">{cust?.full_name}</Link></Td>
                    <Td><p>{w.product_name}</p><p className="font-mono text-[10.5px] text-slate-400">{w.serial_number}</p></Td>
                    <Td className="text-[12px]">{w.warranty_type}</Td>
                    <Td><p className="text-[12px]">{formatDate(w.start_date)} → {formatDate(w.end_date)}</p>
                      <p className="text-[10.5px] text-slate-400">{w.status === "active" ? left > 0 ? `${left} days left` : "past end date" : `${w.duration_months} months`}</p></Td>
                    <Td><Badge status={w.status} label={WARRANTY_STATUS[w.status]} /></Td>
                    <Td>
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" title="Print certificate" onClick={() => printWarrantyCertificate(w, cust)}><Printer className="h-3.5 w-3.5" /></Button>
                        {w.status === "active" && <Button size="sm" variant="ghost" onClick={() => claim(w)}>Mark claimed</Button>}
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : <EmptyState icon={ShieldCheck} title="No warranties" subtitle="Warranties are activated from a completed installation's equipment page." />}
      </Card>

      {expiringSoon.length > 0 && (
        <Card>
          <CardHeaderWrap title="Expiring soon — proactive outreach list" />
          <div className="flex flex-wrap gap-2 px-4 py-3">
            {expiringSoon.map((w) => (
              <span key={w.id} className="rounded-lg bg-amber-50 px-3 py-1.5 text-[12px] text-amber-800">
                {w.code} · {db.customers.find((c) => c.id === w.customer_id)?.full_name} · ends {formatDate(w.end_date)}
              </span>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function CardHeaderWrap({ title }: { title: string }) {
  return <div className="border-b border-slate-100 px-4 py-3"><h3 className="text-sm font-semibold text-slate-800">{title}</h3></div>;
}
