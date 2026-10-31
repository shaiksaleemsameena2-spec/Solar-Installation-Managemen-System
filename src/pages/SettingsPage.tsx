import { useState } from "react";
import { CheckCircle2, XCircle, RefreshCcw, SunMedium, Database, Sparkles, Calculator, MapPin, Bot, ShieldAlert } from "lucide-react";
import { Card, CardHeader, PageHeader, Button, Input, Label, Badge, Modal } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useDB, api, resetDemoDB, DEMO_MODE } from "@/services";
import { useSession } from "@/hooks/useSession";
import type { SavingsAssumptions } from "@/types";

// Environment/font-end capability status shown honestly.
const ENV_STATUS = [
  {
    key: "GitHub/OSM Map (no key)",
    ok: true,
    detail: "Technician locator uses OpenStreetMap tiles via Leaflet. No API key needed.",
  },
  {
    key: "AI assistants (OpenAI)",
    ok: Boolean(import.meta.env.VITE_OPENAI_PROXY_URL),
    detail: "Set VITE_OPENAI_PROXY_URL to a server-side proxy (see supabase/functions/ai-proxy). Without it, assistants run the clearly-labeled rule-based fallback.",
  },
  {
    key: "Supabase (auth + cloud DB)",
    ok: Boolean(import.meta.env.VITE_SUPABASE_URL),
    detail: "Run supabase/migrations/*.sql in your Supabase SQL editor, then set VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY. Demo mode stays available either way.",
  },
  {
    key: "Google Maps upgrade",
    ok: Boolean(import.meta.env.VITE_GOOGLE_MAPS_API_KEY),
    detail: "Optional. OSM works with zero keys; Google Maps would replace tiles only.",
  },
];

export default function SettingsPage() {
  const db = useDB();
  const session = useSession();
  const toast = useToast();
  const [resetConfirm, setResetConfirm] = useState(false);
  const [savings, setSavings] = useState<SavingsAssumptions>({ ...db.settings.savings });
  const [orgName, setOrgName] = useState(db.settings.org_name);
  const [demoLoc, setDemoLoc] = useState({
    name: db.settings.demo_location_name,
    lat: String(db.settings.demo_lat),
    lng: String(db.settings.demo_lng),
  });

  const saveOrg = () => {
    api.updateSettings({ org_name: orgName });
    toast.success("Organization name updated");
  };
  const saveSavings = () => {
    api.updateSettings({ savings });
    toast.success("Savings assumptions updated", "The customer portal estimator uses these instantly.");
  };
  const saveLoc = () => {
    api.updateSettings({
      demo_location_name: demoLoc.name,
      demo_lat: Number(demoLoc.lat) || db.settings.demo_lat,
      demo_lng: Number(demoLoc.lng) || db.settings.demo_lng,
    });
    toast.success("Demo location updated");
  };

  const numeric = (v: string) => (Number(v) >= 0 ? Number(v) : 0);

  return (
    <div className="space-y-5">
      <PageHeader title="Settings & Environment" subtitle="Organization, demo assumptions, environment capability status, and data reset" />

      {DEMO_MODE && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[12.5px] text-amber-800">
          <b>Demo mode is active.</b> All data is seeded locally (browser localStorage) and clearly labeled.
          Credential features (real auth, cloud sync, live AI) require the optional setup below — the app is fully usable without them.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Organization */}
        <Card className="p-4">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800"><SunMedium className="h-4 w-4 text-brand-700" /> Organization</h3>
          <div className="mt-3 space-y-3">
            <div>
              <Label required>Organization name (used on printed documents)</Label>
              <div className="flex gap-2">
                <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} />
                <Button onClick={saveOrg}>Save</Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Demo location */}
        <Card className="p-4">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800"><MapPin className="h-4 w-4 text-brand-700" /> Demo location (technician locator default)</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-3">
              <Label>Location name</Label>
              <Input value={demoLoc.name} onChange={(e) => setDemoLoc({ ...demoLoc, name: e.target.value })} />
            </div>
            <div>
              <Label>Latitude</Label>
              <Input value={demoLoc.lat} onChange={(e) => setDemoLoc({ ...demoLoc, lat: e.target.value })} />
            </div>
            <div>
              <Label>Longitude</Label>
              <Input value={demoLoc.lng} onChange={(e) => setDemoLoc({ ...demoLoc, lng: e.target.value })} />
            </div>
            <div className="flex items-end">
              <Button className="w-full" onClick={saveLoc}>Save location</Button>
            </div>
          </div>
        </Card>

        {/* Savings assumptions */}
        <Card>
          <CardHeader title="Savings estimator assumptions"
            subtitle="Editable inputs used by the customer portal estimator. Shown transparently to customers as assumptions."
            action={<Badge status="pending" label="Editable assumptions" className="!bg-amber-100 !text-amber-800" />} />
          <div className="grid gap-3 px-4 py-4 sm:grid-cols-2">
            <div>
              <Label>Grid tariff (₹ per unit/kWh)</Label>
              <Input type="number" step="0.5" value={savings.grid_rate_per_unit}
                onChange={(e) => setSavings({ ...savings, grid_rate_per_unit: numeric(e.target.value) })} />
            </div>
            <div>
              <Label>Daily sun hours (peak-equivalent)</Label>
              <Input type="number" step="0.1" value={savings.daily_sun_hours}
                onChange={(e) => setSavings({ ...savings, daily_sun_hours: numeric(e.target.value) })} />
            </div>
            <div>
              <Label>Performance ratio (0–1)</Label>
              <Input type="number" step="0.05" value={savings.performance_ratio}
                onChange={(e) => setSavings({ ...savings, performance_ratio: numeric(e.target.value) })} />
            </div>
            <div>
              <Label>Export tariff (₹ per unit) — documentation</Label>
              <Input type="number" step="0.5" value={savings.export_tariff_per_unit}
                onChange={(e) => setSavings({ ...savings, export_tariff_per_unit: numeric(e.target.value) })} />
            </div>
            <div>
              <Label>Annual degradation (%/yr)</Label>
              <Input type="number" step="0.1" value={savings.annual_degradation_percent}
                onChange={(e) => setSavings({ ...savings, annual_degradation_percent: numeric(e.target.value) })} />
            </div>
            <div className="flex items-end">
              <Button className="w-full" onClick={saveSavings}><Calculator className="h-4 w-4" /> Save assumptions</Button>
            </div>
          </div>
        </Card>

        {/* Environment capability */}
        <Card>
          <CardHeader title="Environment capability status" subtitle="Honest status of optional integrations — nothing is faked as live when it is a fallback" />
          <div className="space-y-2.5 px-4 py-4">
            {ENV_STATUS.map((e) => (
              <div key={e.key} className="flex items-start gap-2.5 rounded-lg border border-slate-100 px-3 py-2">
                <div className="mt-0.5 shrink-0">
                  {e.ok ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-slate-300" />}
                </div>
                <div className="min-w-0">
                  <p className="text-[12.5px] font-semibold text-slate-700">{e.key} — {e.ok ? "configured" : "not configured"}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{e.detail}</p>
                </div>
              </div>
            ))}
            <p className="flex items-start gap-1.5 rounded-lg bg-brand-50 px-3 py-2 text-[11.5px] text-brand-800">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              AI text assistants and business calculations are strictly separated: financial totals are ALWAYS computed by validated application code (src/lib/calculations/finance.ts), never by the AI.
            </p>
          </div>
        </Card>

        {/* SolarBot AI Knowledge Base */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="SolarBot AI Assistant — Knowledge Base & Status"
            subtitle="Verified domain guidelines, package catalogs, and security rules powering the floating assistant"
            action={<Badge status="approved" label="SolarBot Active" className="!bg-emerald-100 !text-emerald-800" />}
          />
          <div className="grid gap-4 p-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5">
              <p className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <Bot className="h-4 w-4 text-emerald-600" /> System Sizing & Packages
              </p>
              <ul className="mt-2 space-y-1 text-[11.5px] text-slate-600">
                <li>• <b>{db.solar_packages.length} Packages:</b> 1 kW, 2 kW, 3 kW, 5 kW On-Grid & Off-Grid</li>
                <li>• <b>Generation baseline:</b> ~4.5 kWh/day per kW</li>
                <li>• <b>Roof space rule:</b> ~80–100 sq.ft per kW</li>
                <li>• <b>Payback benchmark:</b> 3.0 to 4.5 years</li>
              </ul>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5">
              <p className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <Sparkles className="h-4 w-4 text-amber-500" /> Government Subsidies
              </p>
              <ul className="mt-2 space-y-1 text-[11.5px] text-slate-600">
                <li>• <b>Scheme:</b> PM Surya Ghar Muft Bijli Yojana</li>
                <li>• <b>1 kW Subsidy:</b> ₹30,000</li>
                <li>• <b>2 kW Subsidy:</b> ₹60,000</li>
                <li>• <b>3 kW+ Cap:</b> ₹78,000 max central aid</li>
                <li>• <b>Official Portal:</b> <span className="font-mono text-[10.5px]">pmsuryaghar.gov.in</span></li>
              </ul>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5">
              <p className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <ShieldAlert className="h-4 w-4 text-rose-500" /> Safety & Data Isolation
              </p>
              <ul className="mt-2 space-y-1 text-[11.5px] text-slate-600">
                <li>• <b>High-Voltage Rule:</b> Never instruct users to touch live DC cables</li>
                <li>• <b>Data Privacy:</b> Private orders/warranties require login</li>
                <li>• <b>Customer Isolation:</b> Strict scoping to own customerId</li>
                <li>• <b>Support Line:</b> +91 90000 76527</li>
              </ul>
            </div>
          </div>
        </Card>

        {/* Data management */}
        <Card>
          <CardHeader title="Demo data" subtitle="Seeded fictional dataset persisted in this browser (localStorage)" />
          <div className="flex flex-wrap items-center gap-2 px-4 py-4">
            <Button variant="outline" onClick={() => setResetConfirm(true)}><RefreshCcw className="h-4 w-4" /> Reset demo data</Button>
            <Button variant="ghost" onClick={() => { downloadJSON(db); toast.success("Data snapshot downloaded", "solarops-demo-db.json"); }}>Export full JSON</Button>
            <p className="w-full text-[11px] text-slate-500">
              Resetting restores the original seed (customers, quotations, projects, equipment, payments, tickets, technicians).
              Useful right before a demo/presentation.
            </p>
          </div>
        </Card>

        {/* Supabase setup */}
        <Card>
          <CardHeader title="Supabase (optional production setup)" subtitle="Real auth + cloud persistence; demo mode keeps working regardless"
            action={ENV_STATUS[1].ok || ENV_STATUS[2].ok ? <Badge status="approved" label="Partially configured" /> : <Badge status="not_started" label="Demo only" />} />
          <ol className="list-decimal space-y-1.5 px-4 py-4 pl-8 text-[12px] leading-relaxed text-slate-600">
            <li>Create a project at <span className="font-mono text-brand-700">supabase.com</span> (free tier is fine).</li>
            <li>Open <b>SQL Editor</b> and run the files in order from <span className="font-mono text-brand-700">supabase/migrations/</span> (schema, then RLS, then policies).</li>
            <li>Run <span className="font-mono text-brand-700">supabase/seed.sql</span> to load the same demo dataset into the cloud DB.</li>
            <li>Optionally deploy <span className="font-mono text-brand-700">supabase/functions/ai-proxy</span> (Edge Function) and set <span className="font-mono text-brand-700">OPENAI_API_KEY</span> as a secret — the OpenAI key never touches the browser.</li>
            <li>Copy your project URL + anon key into <span className="font-mono text-brand-700">.env.local</span> as <span className="font-mono">VITE_SUPABASE_URL</span> and <span className="font-mono">VITE_SUPABASE_ANON_KEY</span>, then restart the dev server.</li>
          </ol>
          <p className="px-4 pb-4 text-[11px] text-slate-400">
            See .env.example for the full variable list. Nothing here is required to run the hackathon demo.
          </p>
        </Card>
      </div>

      <Modal open={resetConfirm} onClose={() => setResetConfirm(false)} title="Reset demo data?" width="max-w-sm">
        <p className="text-[13px] text-slate-600">
          This wipes all locally-stored changes (new customers, quotations, payments…) and restores the seeded dataset.
          You will remain signed in.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setResetConfirm(false)}>Cancel</Button>
          <Button variant="danger" onClick={() => { resetDemoDB(); setResetConfirm(false); toast.success("Demo data reset", "Seed dataset restored."); window.location.reload(); }}>
            Reset data
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function downloadJSON(db: ReturnType<typeof useDB>) {
  const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "solarops-demo-db.json";
  a.click();
  URL.revokeObjectURL(url);
}
