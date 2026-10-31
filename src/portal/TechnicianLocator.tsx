import { useEffect, useMemo, useState } from "react";
import { MapPin, Star, Phone, Wrench, X, Crosshair } from "lucide-react";
import { Button, Badge, Input, Select, Label, Modal, Textarea, FieldError, DemoPill, EmptyState } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useDB, api } from "@/services";
import { useSession } from "@/hooks/useSession";
import { haversineKm, cn } from "@/lib/utils";
import { TECH_AVAILABILITY } from "@/lib/labels";
import type { TechnicianProfile } from "@/types";
import { printTechnicianRequestAck } from "@/lib/certificate";
import { GoogleMapView } from "@/components/GoogleMapView";

const SPECIALIZATIONS = ["Any specialization", "Inverter Specialist", "Electrical Works", "Performance Analysis", "Battery Systems", "Cleaning & Maintenance", "Structural/Roofing", "Off-grid", "Monitoring/App", "Grid-Tie Expert"];

export default function TechnicianLocator() {
  const db = useDB();
  const session = useSession();
  const toast = useToast();
  const [area, setArea] = useState("Hyderabad (demo location)");
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [geoError, setGeoError] = useState("");
  const [radius, setRadius] = useState(25);
  const [spec, setSpec] = useState(SPECIALIZATIONS[0]);
  const [onlyAvailable, setOnlyAvailable] = useState(true);
  const [selected, setSelected] = useState<TechnicianProfile | null>(null);
  const [requestTech, setRequestTech] = useState<TechnicianProfile | null>(null);

  useEffect(() => {
    setPos({ lat: db.settings.demo_lat, lng: db.settings.demo_lng });
  }, [db.settings.demo_lat, db.settings.demo_lng]);

  const locate = () => {
    if (!navigator.geolocation) return setGeoError("Geolocation is not supported by this browser.");
    navigator.geolocation.getCurrentPosition(
      (p) => { setPos({ lat: p.coords.latitude, lng: p.coords.longitude }); setGeoError(""); toast.info("Location found", "Using your current coordinates for distance calc."); },
      () => setGeoError("Location permission denied — using the demo location instead. You can still browse all technicians."),
    );
  };

  const customer = db.customers.find((c) => c.id === session?.customerId);

  const ranked = useMemo(() => {
    const src = db.technicians.filter((t) => t.is_active);
    return src
      .map((t) => ({ t, distance: pos ? haversineKm(pos.lat, pos.lng, t.lat, t.lng) : null }))
      .filter((x) => x.distance === null || x.distance <= radius)
      .filter((x) => spec === SPECIALIZATIONS[0] || x.t.specializations.includes(spec))
      .filter((x) => !onlyAvailable || x.t.availability === "available")
      .sort((a, b) => {
        const score = (y: { t: TechnicianProfile; distance: number | null }) =>
          (y.t.availability === "available" ? 0 : y.t.availability === "busy" ? 1 : 2) * 100
          + (y.distance ?? 999);
        return score(a) - score(b);
      });
  }, [db.technicians, pos, radius, spec, onlyAvailable]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Find a Technician</h1>
          <p className="text-[13px] text-slate-500">Search nearby solar technicians, check availability and request a service visit. Distances are straight-line approximations.</p>
        </div>
        <Button variant="outline" size="sm" onClick={locate}><Crosshair className="h-3.5 w-3.5" /> Use my location</Button>
      </div>

      {geoError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[12.5px] text-amber-800">{geoError}</div>
      )}

      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        {/* List */}
        <div className="space-y-3">
          <div className="rounded-xl border border-slate-200 bg-white p-3.5">
            <Label>Search location</Label>
            <div className="relative">
              <MapPin className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input className="pl-8" value={area} onChange={(e) => setArea(e.target.value)} />
            </div>
            <div className="mt-2.5 grid grid-cols-2 gap-2">
              <div>
                <Label>Radius (km)</Label>
                <Select value={radius} onChange={(e) => setRadius(Number(e.target.value))}>
                  {[5, 10, 15, 25, 50, 100].map((r) => <option key={r} value={r}>{r} km</option>)}
                </Select>
              </div>
              <div>
                <Label>Specialization</Label>
                <Select value={spec} onChange={(e) => setSpec(e.target.value)}>
                  {SPECIALIZATIONS.map((s) => <option key={s}>{s}</option>)}
                </Select>
              </div>
            </div>
            <label className="mt-2.5 flex items-center gap-2 text-[12px] text-slate-600">
              <input type="checkbox" checked={onlyAvailable} onChange={(e) => setOnlyAvailable(e.target.checked)} className="accent-brand-700" />
              Show only currently-available technicians
            </label>
          </div>

          {ranked.map(({ t, distance }) => (
            <div key={t.id} className="cursor-pointer rounded-xl border border-slate-200 bg-white p-3.5 transition-shadow hover:shadow-md" onClick={() => setSelected(t)}>
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[15px] font-bold text-white" style={{ background: t.photo_color }}>
                  {t.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[13px] font-semibold text-slate-800">{t.name}</p>
                    <Badge status={t.availability} label={TECH_AVAILABILITY[t.availability]} />
                  </div>
                  <p className="mt-0.5 text-[11.5px] text-slate-500">{t.specializations.join(" · ")}</p>
                  <div className="mt-1 flex items-center gap-3 text-[11.5px] text-slate-500">
                    <span className="flex items-center gap-1"><Star className="h-3 w-3 fill-amber-400 text-amber-400" />{t.rating} ({t.completed_jobs} jobs)</span>
                    <span>{distance !== null ? `${distance.toFixed(1)} km` : t.location_name}</span>
                    <span>{t.experience_years}+ yrs</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {ranked.length === 0 && (
            <EmptyState icon={MapPin} title="No technicians match your filters" subtitle="Try a larger radius, other specializations, or include busy technicians." />
          )}
        </div>

        {/* Google Map View */}
        <div className="relative min-h-[520px] overflow-hidden rounded-xl border border-slate-200 bg-white">
          {pos && (
            <GoogleMapView
              center={pos}
              technicians={db.technicians.filter((t) => t.is_active)}
              onSelect={(t) => setSelected(t)}
              selected={selected}
              customerLocation={{ lat: pos.lat, lng: pos.lng, label: "Your Location" }}
              height="520px"
            />
          )}
        </div>
      </div>

      {/* Detail card */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title="Technician details" width="max-w-md">
        {selected && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full text-lg font-bold text-white" style={{ background: selected.photo_color }}>
                {selected.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
              </div>
              <div>
                <p className="text-[15px] font-bold text-slate-900">{selected.name}</p>
                <div className="mt-0.5 flex items-center gap-2 text-[12px] text-slate-500">
                  <Badge status={selected.availability} label={TECH_AVAILABILITY[selected.availability]} />
                  <span>{selected.working_hours}</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-[12.5px]">
              <Fact label="Specializations" value={selected.specializations.join(", ")} />
              <Fact label="Experience" value={`${selected.experience_years}+ years`} />
              <Fact label="Service areas" value={selected.service_areas.join(", ")} />
              <Fact label="Service radius" value={`up to ${selected.max_radius_km} km`} />
              <Fact label="Rating" value={`${selected.rating} / 5 · ${selected.completed_jobs} completed jobs`} />
              <Fact label="Base location" value={selected.location_name} />
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-[11.5px] text-slate-500">
              Direct staff dispatch managed by SolarOps Operations Manager.
            </div>
            <div className="flex gap-2">
              <a href={`tel:${selected.phone.replace(/\s/g, "")}`} className="flex-1">
                <Button variant="outline" className="w-full"><Phone className="h-4 w-4" /> Call technician</Button>
              </a>
              <Button className="flex-1" onClick={() => { setRequestTech(selected); setSelected(null); }}>
                <Wrench className="h-4 w-4" /> Request service
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <RequestModal tech={requestTech} onClose={() => setRequestTech(null)} customerId={session?.customerId} customerName={customer?.full_name} />
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/50 px-2.5 py-2">
      <p className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 text-[12px] text-slate-700">{value}</p>
    </div>
  );
}

// ---------- Service request modal (Direct Manager Assignment) ----------
function RequestModal({ tech, onClose, customerId, customerName }: {
  tech: TechnicianProfile | null; onClose: () => void;
  customerId?: string; customerName?: string;
}) {
  const db = useDB();
  const toast = useToast();
  const projects = db.installation_projects.filter((p) => p.customer_id === customerId || p.customer_id === "cust-01");
  const units = projects.flatMap((p) => db.equipment_units.filter((u) => u.project_id === p.id && u.project_id));
  const myProj = projects.find((p) => p.customer_id === customerId) ?? projects[0];
  const [form, setForm] = useState({ issue: "", category: "Performance Issue", equipment: "", time: "", newTicket: true });
  const [err, setErr] = useState("");
  const openTickets = db.service_tickets.filter((t) => ["open", "assigned", "in_progress"].includes(t.status) && (t.customer_id === customerId || t.customer_id === "cust-01"));

  const submit = () => {
    if (!tech) return;
    if (!customerId) { setErr("Sign in to submit a request."); return; }
    if (!form.equipment) return setErr("Select the installed equipment this visit is about.");
    if (form.issue.trim().length < 10) return setErr("Describe the issue in at least 10 characters.");
    const unit = units.find((u) => u.serial_number === form.equipment) ?? null;
    
    if (!form.newTicket && openTickets.length) {
      const t = openTickets[0];
      api.updateTicket(t.id, {
        appointment_time: form.time || null,
        assignment_status: "awaiting_manager",
      });
      toast.success(
        "Request submitted to Manager",
        `Attached to ticket ${t.number}. Operations Manager will assign staff to your rooftop.`
      );
    } else {
      api.createTicket({
        customer_id: customerId,
        project_id: myProj?.id ?? null,
        equipment_unit_id: unit?.id ?? null,
        serial_number: unit?.serial_number ?? "",
        issue_category: form.category,
        description: `${form.issue} (Customer preferred technician: ${tech.name})`,
        priority: "medium",
        assigned_technician: "",
        assignment_status: "awaiting_manager",
        appointment_time: form.time || null,
        created_by: "Customer Portal",
      });
      toast.success(
        "Request submitted to Manager",
        "Operations Manager will assign staff to your rooftop without delay."
      );
    }
    printTechnicianRequestAck(form.newTicket ? "New ticket" : openTickets[0]?.number ?? "", tech.name, form.time);
    onClose();
  };

  if (!tech) return null;
  return (
    <Modal open={!!tech} onClose={onClose} title={`Request service · ${tech.name}`}>
      <div className="space-y-3.5">
        <div className="rounded-lg bg-brand-50 px-3 py-2 text-[12px] text-brand-800">
          Preferred Staff: <b>{tech.name}</b> ({tech.location_name})
          <span className="block mt-0.5 text-slate-500 text-[11px]">
            Your request will be routed directly to the Operations Manager for staff dispatch.
          </span>
        </div>
        {openTickets.length > 0 && (
          <div>
            <Label>Attach to an existing ticket, or create a new request</Label>
            <Select value={form.newTicket ? "new" : ""} onChange={(e) => setForm({ ...form, newTicket: e.target.value === "new" })}>
              <option value="new">Create a new service request</option>
              {openTickets.map((t) => <option key={t.id} value={t.id}>{t.number} — {t.issue_category}</option>)}
            </Select>
          </div>
        )}
        <div>
          <Label required>System Component / Installed Equipment</Label>
          <Select value={form.equipment || "Full Rooftop Solar PV System"} onChange={(e) => setForm({ ...form, equipment: e.target.value })}>
            <option value="Full Rooftop Solar PV System">Full Rooftop Solar PV System</option>
            <option value="Solar Inverter (On-Grid / Hybrid)">Solar Inverter (On-Grid / Hybrid)</option>
            <option value="Solar PV Panels (Mono PERC)">Solar PV Panels (Mono PERC)</option>
            <option value="AC/DC Distribution Box & Wiring">AC/DC Distribution Box & Wiring</option>
            <option value="Battery Storage Backup">Battery Storage Backup</option>
            {units.map((u) => <option key={u.id} value={u.serial_number}>{u.item_name} — {u.serial_number}</option>)}
          </Select>
        </div>
        <div>
          <Label>Issue category</Label>
          <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {["Performance Issue", "Inverter Fault", "Panel Damage", "Wiring/Electrical", "Battery Issue", "Monitoring/App", "Cleaning Request", "Other"].map((c) => <option key={c}>{c}</option>)}
          </Select>
        </div>
        <div>
          <Label required>Describe the problem</Label>
          <Textarea value={form.issue} onChange={(e) => setForm({ ...form, issue: e.target.value })} placeholder="What is happening with your system?" />
          <FieldError message={err} />
        </div>
        <div>
          <Label>Preferred appointment</Label>
          <Input type="datetime-local" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={!form.newTicket}>Submit to Manager</Button>
        </div>
        {!form.newTicket && <p className="text-[11px] text-amber-700">Select "Create a new service request" to request this technician, or attach later from the ticket.</p>}
      </div>
    </Modal>
  );
}
