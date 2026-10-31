import { useEffect, useMemo, useState } from "react";
import {
  MapPin, Star, Phone, Wrench, Crosshair, Search, Shield, UserPlus,
  Edit3, UserMinus, CheckCircle2, Navigation, Layers, Compass, Filter
} from "lucide-react";
import {
  PageHeader, Card, Button, Input, Select, Label, Badge, Modal,
  Textarea, FieldError, EmptyState, StatTile
} from "@/components/ui";
import { useToast } from "@/components/toast";
import { useDB, api } from "@/services";
import { useSession } from "@/hooks/useSession";
import { haversineKm } from "@/lib/utils";
import { TECH_AVAILABILITY } from "@/lib/labels";
import type { TechnicianProfile } from "@/types";
import { GoogleMapView } from "@/components/GoogleMapView";
import { printTechnicianRequestAck } from "@/lib/certificate";

const SPECIALIZATIONS = [
  "All Specializations",
  "Inverter Specialist",
  "Solar PV Rooftop",
  "Electrical Works",
  "Performance Analysis",
  "Battery Systems",
  "Cleaning & Maintenance",
  "Structural/Roofing",
  "Off-grid",
  "Grid-Tie Expert",
];

const HYD_LOCATION_PRESETS = [
  { name: "Banjara Hills, Hyderabad", lat: 17.4126, lng: 78.4392 },
  { name: "Jubilee Hills, Hyderabad", lat: 17.4319, lng: 78.4073 },
  { name: "Gachibowli, Hyderabad", lat: 17.4401, lng: 78.3450 },
  { name: "Hitech City, Hyderabad", lat: 17.4483, lng: 78.3808 },
  { name: "Madhapur, Hyderabad", lat: 17.4485, lng: 78.3908 },
  { name: "Kukatpally, Hyderabad", lat: 17.4849, lng: 78.4137 },
  { name: "Kondapur, Hyderabad", lat: 17.4615, lng: 78.3592 },
  { name: "Secunderabad, Hyderabad", lat: 17.4399, lng: 78.4983 },
  { name: "Uppal, Hyderabad", lat: 17.4600, lng: 78.5200 },
  { name: "LB Nagar, Hyderabad", lat: 17.3457, lng: 78.5522 },
  { name: "Begumpet, Hyderabad", lat: 17.4447, lng: 78.4664 },
  { name: "Miyapur, Hyderabad", lat: 17.4968, lng: 78.3546 },
];

export default function TechniciansDirectoryPage() {
  const db = useDB();
  const session = useSession();
  const toast = useToast();

  const isAdmin = session?.role === "superadmin" || session?.role === "admin";

  const [area, setArea] = useState("Hyderabad (Central Hub)");
  const [pos, setPos] = useState<{ lat: number; lng: number }>({
    lat: db.settings.demo_lat || 17.385,
    lng: db.settings.demo_lng || 78.4867,
  });
  const [geoError, setGeoError] = useState("");
  const [radius, setRadius] = useState(25);
  const [spec, setSpec] = useState(SPECIALIZATIONS[0]);
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [selectedTech, setSelectedTech] = useState<TechnicianProfile | null>(null);

  // Modals
  const [requestTech, setRequestTech] = useState<TechnicianProfile | null>(null);
  const [addStaffOpen, setAddStaffOpen] = useState(false);
  const [updateLocTech, setUpdateLocTech] = useState<TechnicianProfile | null>(null);
  const [removeTech, setRemoveTech] = useState<TechnicianProfile | null>(null);

  const locate = () => {
    if (!navigator.geolocation) return setGeoError("Geolocation is not supported by this browser.");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPos({ lat: p.coords.latitude, lng: p.coords.longitude });
        setGeoError("");
        toast.info("Location detected", "Calculated straight-line distances from your current location.");
      },
      () => {
        setGeoError("Location permission not granted — using default Hyderabad coordinates.");
      }
    );
  };

  // Rank technicians by distance from current pos
  const ranked = useMemo(() => {
    const src = db.technicians.filter((t) => t.is_active);
    return src
      .map((t) => ({
        tech: t,
        distance: pos ? haversineKm(pos.lat, pos.lng, t.lat, t.lng) : null,
      }))
      .filter((x) => x.distance === null || x.distance <= radius)
      .filter((x) => spec === SPECIALIZATIONS[0] || x.tech.specializations.includes(spec))
      .filter((x) => !onlyAvailable || x.tech.availability === "available")
      .sort((a, b) => {
        const distA = a.distance ?? 999;
        const distB = b.distance ?? 999;
        return distA - distB;
      });
  }, [db.technicians, pos, radius, spec, onlyAvailable]);

  const activeCount = db.technicians.filter((t) => t.is_active && t.availability === "available").length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Nearby Service Persons & Technicians"
        subtitle={`Locate verified solar engineers and maintenance specialists stationed nearest to your rooftop · ${db.technicians.filter((t) => t.is_active).length} total staff (${activeCount} available now)`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={locate}>
            <Crosshair className="h-3.5 w-3.5 text-emerald-700" /> Use My Location
          </Button>

          {isAdmin && (
            <Button size="sm" onClick={() => setAddStaffOpen(true)}>
              <UserPlus className="h-3.5 w-3.5" /> Add Staff Member
            </Button>
          )}
        </div>
      </PageHeader>

      {geoError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs text-amber-800">
          {geoError}
        </div>
      )}

      {/* Filter Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label>Search Area / Station</Label>
            <div className="relative">
              <MapPin className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                className="pl-8"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                placeholder="Area name or landmark"
              />
            </div>
          </div>

          <div>
            <Label>Search Radius (km)</Label>
            <Select value={radius} onChange={(e) => setRadius(Number(e.target.value))}>
              {[5, 10, 15, 25, 50, 100].map((r) => (
                <option key={r} value={r}>
                  Within {r} km
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label>Specialization Filter</Label>
            <Select value={spec} onChange={(e) => setSpec(e.target.value)}>
              {SPECIALIZATIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex flex-col justify-end">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 pb-2 cursor-pointer">
              <input
                type="checkbox"
                checked={onlyAvailable}
                onChange={(e) => setOnlyAvailable(e.target.checked)}
                className="accent-brand-700 h-4 w-4 rounded"
              />
              Show only currently available staff
            </label>
          </div>
        </div>
      </div>

      {/* Split View: Staff Directory + Map */}
      <div className="grid gap-4 lg:grid-cols-[440px_1fr]">
        {/* Left: Ranked Staff Cards */}
        <div className="space-y-3 max-h-[640px] overflow-y-auto pr-1">
          {ranked.map(({ tech, distance }) => {
            const isSelected = selectedTech?.id === tech.id;
            return (
              <div
                key={tech.id}
                onClick={() => setSelectedTech(tech)}
                className={`rounded-xl border p-4 transition shadow-sm cursor-pointer ${
                  isSelected
                    ? "border-emerald-500 bg-emerald-50/50 ring-1 ring-emerald-500"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-inner"
                      style={{ background: tech.photo_color || "#15803d" }}
                    >
                      {tech.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                        {tech.name}
                        <span className="flex items-center text-amber-500 text-[11px] font-semibold">
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400 inline mr-0.5" />
                          {tech.rating}
                        </span>
                      </h3>
                      {tech.email && (
                        <p className="text-[11px] text-slate-400 font-mono truncate">{tech.email}</p>
                      )}
                      <p className="text-xs text-slate-600 flex items-center gap-1 mt-0.5">
                        <Phone className="h-3 w-3 text-slate-400" />
                        {tech.phone}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <Badge status={tech.availability} label={TECH_AVAILABILITY[tech.availability]} />
                    {distance !== null && (
                      <p className="mt-1 text-[11px] font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-full inline-block">
                        {distance.toFixed(1)} km away
                      </p>
                    )}
                  </div>
                </div>

                {/* Location Station */}
                <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-1.5 text-xs">
                  <div className="flex items-center justify-between text-slate-700">
                    <span className="flex items-center gap-1 font-medium truncate">
                      <MapPin className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      {tech.location_name}
                    </span>
                    <span className="font-mono text-[10.5px] text-slate-400 shrink-0">
                      {tech.lat.toFixed(4)}, {tech.lng.toFixed(4)}
                    </span>
                  </div>
                </div>

                {/* Specializations & Experience */}
                <div className="mt-2.5 flex flex-wrap items-center gap-1 text-[11px]">
                  <span className="rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
                    {tech.experience_years}+ yrs exp
                  </span>
                  {tech.specializations.map((sp) => (
                    <span key={sp} className="rounded bg-brand-50 px-2 py-0.5 font-medium text-brand-800">
                      {sp}
                    </span>
                  ))}
                </div>

                {/* Actions */}
                <div className="mt-3.5 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                  <a
                    href={`tel:${tech.phone.replace(/\s/g, "")}`}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                  >
                    <Phone className="h-3.5 w-3.5 text-brand-700" /> Call
                  </a>

                  <div className="flex items-center gap-1.5">
                    {isAdmin && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            setUpdateLocTech(tech);
                          }}
                          className="text-xs"
                        >
                          <Edit3 className="h-3.5 w-3.5 text-emerald-700" /> Location
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRemoveTech(tech);
                          }}
                          className="text-xs text-rose-600 hover:bg-rose-50"
                        >
                          <UserMinus className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}

                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setRequestTech(tech);
                      }}
                      className="text-xs"
                    >
                      <Wrench className="h-3.5 w-3.5" /> Request Service
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}

          {ranked.length === 0 && (
            <EmptyState
              icon={MapPin}
              title="No service persons match filters"
              subtitle="Try increasing your search radius or clearing specialization filters to locate available technicians."
            />
          )}
        </div>

        {/* Right: Interactive Live Map */}
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm flex flex-col">
          <div className="mb-2 flex items-center justify-between px-1">
            <p className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Compass className="h-3.5 w-3.5 text-emerald-600" />
              Live Map · Nearby Service Persons Network
            </p>
            <p className="text-[11px] text-slate-400">
              Gold = Center/You · Emerald = Technicians · Click pin for details
            </p>
          </div>

          <GoogleMapView
            center={selectedTech ? { lat: selectedTech.lat, lng: selectedTech.lng } : pos}
            zoom={selectedTech ? 13 : 11}
            technicians={db.technicians.filter((t) => t.is_active)}
            selected={selectedTech}
            onSelect={(t) => setSelectedTech(t)}
            customerLocation={{ lat: pos.lat, lng: pos.lng, label: "Search Location / Center" }}
            onMapClick={(coords) => {
              setPos(coords);
              toast.info("Map location selected", "Recalculated technician distances from selected coordinates.");
            }}
            height="580px"
          />
        </div>
      </div>

      {/* Modals */}
      {addStaffOpen && <AddStaffModal onClose={() => setAddStaffOpen(false)} />}
      {updateLocTech && <UpdateLocationModal tech={updateLocTech} onClose={() => setUpdateLocTech(null)} />}
      {removeTech && (
        <RemoveStaffModal
          tech={removeTech}
          onClose={() => setRemoveTech(null)}
          onRemoved={() => {
            if (selectedTech?.id === removeTech.id) setSelectedTech(null);
            setRemoveTech(null);
          }}
        />
      )}
      {requestTech && (
        <RequestServiceModal
          tech={requestTech}
          onClose={() => setRequestTech(null)}
        />
      )}
    </div>
  );
}

// ============================================================
// MODAL: ADD STAFF MEMBER (ADMIN)
// Admin sets Email ID and Password for staff login
// ============================================================
function AddStaffModal({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState("");
  const [locationName, setLocationName] = useState(HYD_LOCATION_PRESETS[0].name);
  const [lat, setLat] = useState(String(HYD_LOCATION_PRESETS[0].lat));
  const [lng, setLng] = useState(String(HYD_LOCATION_PRESETS[0].lng));
  const [experience, setExperience] = useState("4");
  const [workingHours, setWorkingHours] = useState("Mon–Sat 9:00–18:00");
  const [primarySpec, setPrimarySpec] = useState("Inverter Specialist");
  const [err, setErr] = useState("");

  const handlePresetChange = (presetName: string) => {
    setLocationName(presetName);
    const p = HYD_LOCATION_PRESETS.find((x) => x.name === presetName);
    if (p) {
      setLat(String(p.lat));
      setLng(String(p.lng));
    }
  };

  const handleSave = () => {
    if (name.trim().length < 2) return setErr("Please enter the staff member's full name.");
    if (!email.trim() || !/.+@.+\..+/.test(email.trim())) return setErr("Please enter a valid official email ID for the staff member.");
    if (!password || password.length < 4) return setErr("Staff login password must be at least 4 characters long.");
    if (phone.trim().length < 7) return setErr("Please enter a valid contact phone number.");
    if (!locationName.trim()) return setErr("Please enter the base location name.");
    if (isNaN(Number(lat)) || isNaN(Number(lng))) return setErr("Please enter valid latitude and longitude coordinates.");

    try {
      const created = api.createTechnician({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password: password.trim(),
        phone: phone.trim(),
        location_name: locationName.trim(),
        lat: Number(lat),
        lng: Number(lng),
        experience_years: Number(experience) || 3,
        working_hours: workingHours,
        specializations: [primarySpec, "Solar PV Rooftop"],
      });

      toast.success(
        "Staff member & login account created",
        `${created.name} (${email.trim()}) can now sign in from the home page using their credentials.`
      );
      onClose();
    } catch (e: any) {
      setErr(e.message || String(e));
    }
  };

  return (
    <Modal open onClose={onClose} title="Add New Staff Member" width="max-w-lg">
      <div className="space-y-3.5">
        <div>
          <Label required>Full Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Anand Varma"
            required
          />
        </div>

        {/* Staff Login Credentials (Email & Password) */}
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-950">
            <Shield className="h-4 w-4 text-emerald-600" />
            Staff Login Credentials (Login From Home Page)
          </div>
          <p className="text-[11px] text-emerald-800/80 leading-snug">
            Set an official email ID and password. The staff member can use these credentials to sign in directly from the login page.
          </p>

          <div>
            <Label required>Staff Email ID</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. anand@solarops.com"
              required
            />
          </div>

          <div>
            <Label required>Set Login Password (min 4 characters)</Label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="pr-9"
              />
              <button
                type="button"
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <Label required>Phone Number</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98000 00000"
              required
            />
          </div>
          <div>
            <Label>Experience (Years)</Label>
            <Input
              type="number"
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
              min={1}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <Label>Primary Specialization</Label>
            <Select value={primarySpec} onChange={(e) => setPrimarySpec(e.target.value)}>
              {[
                "Inverter Specialist",
                "Solar PV Rooftop",
                "High Voltage AC/DC & Wiring",
                "Battery Storage Backup",
                "Cleaning & Performance Maintenance",
                "Structural / Elevated Roofing",
                "Grid-Tie Systems Expert",
                "Off-Grid Specialist",
              ].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Working Hours</Label>
            <Input
              value={workingHours}
              onChange={(e) => setWorkingHours(e.target.value)}
              placeholder="Mon–Sat 9:00–18:00"
            />
          </div>
        </div>

        {/* Location & Coordinates */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
          <Label required>Base Location / Station Hub</Label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[11px] text-slate-500">Quick City Preset</Label>
              <Select value={locationName} onChange={(e) => handlePresetChange(e.target.value)}>
                {HYD_LOCATION_PRESETS.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label className="text-[11px] text-slate-500">Custom Location Name</Label>
              <Input
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                placeholder="Area name"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[11px] text-slate-500">Latitude</Label>
              <Input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="17.4126" />
            </div>
            <div>
              <Label className="text-[11px] text-slate-500">Longitude</Label>
              <Input value={lng} onChange={(e) => setLng(e.target.value)} placeholder="78.4392" />
            </div>
          </div>
        </div>

        <FieldError message={err} />

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            <UserPlus className="h-4 w-4" /> Save Staff Member & Credentials
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ============================================================
// MODAL: UPDATE STAFF LOCATION (ADMIN)
// ============================================================
function UpdateLocationModal({
  tech,
  onClose,
}: {
  tech: TechnicianProfile;
  onClose: () => void;
}) {
  const toast = useToast();
  const [locationName, setLocationName] = useState(tech.location_name);
  const [lat, setLat] = useState(String(tech.lat));
  const [lng, setLng] = useState(String(tech.lng));
  const [err, setErr] = useState("");

  const handlePresetSelect = (preset: typeof HYD_LOCATION_PRESETS[0]) => {
    setLocationName(preset.name);
    setLat(String(preset.lat));
    setLng(String(preset.lng));
  };

  const handleMapClick = (coords: { lat: number; lng: number }) => {
    setLat(coords.lat.toFixed(6));
    setLng(coords.lng.toFixed(6));
  };

  const handleSave = () => {
    if (!locationName.trim()) return setErr("Location name cannot be empty.");
    if (isNaN(Number(lat)) || isNaN(Number(lng))) return setErr("Valid coordinates required.");

    try {
      api.updateTechnicianLocation(tech.id, Number(lat), Number(lng), locationName.trim());
      toast.success(
        "Location updated",
        `Updated ${tech.name}'s location to ${locationName.trim()} (${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}).`
      );
      onClose();
    } catch (e: any) {
      setErr(e.message || String(e));
    }
  };

  return (
    <Modal open onClose={onClose} title={`Update Location · ${tech.name}`} width="max-w-xl">
      <div className="space-y-3.5">
        <p className="text-xs text-slate-500">
          Mark or update the base station and live service coordinates for staff member <b>{tech.name}</b>.
        </p>

        {/* Quick Hub Presets */}
        <div>
          <Label>Select Location Preset (Hyderabad Solar Hubs)</Label>
          <div className="mt-1 flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 bg-slate-50 rounded-lg border border-slate-200">
            {HYD_LOCATION_PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => handlePresetSelect(p)}
                className={`rounded-md px-2 py-1 text-[11px] font-medium transition cursor-pointer ${
                  locationName === p.name
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                {p.name.split(",")[0]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label required>Base Area Name</Label>
          <Input
            value={locationName}
            onChange={(e) => setLocationName(e.target.value)}
            placeholder="e.g. Hitech City, Hyderabad"
          />
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <Label required>Latitude</Label>
            <Input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="17.4401" />
          </div>
          <div>
            <Label required>Longitude</Label>
            <Input value={lng} onChange={(e) => setLng(e.target.value)} placeholder="78.3450" />
          </div>
        </div>

        {/* Interactive Google Map Pin Drop */}
        <div className="space-y-1">
          <Label>Click on Map to Mark Live Pin</Label>
          <GoogleMapView
            center={{ lat: Number(lat) || tech.lat, lng: Number(lng) || tech.lng }}
            zoom={13}
            editablePin={{ lat: Number(lat) || tech.lat, lng: Number(lng) || tech.lng, label: tech.name }}
            onMapClick={handleMapClick}
            height="220px"
          />
        </div>

        <FieldError message={err} />

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            <MapPin className="h-4 w-4" /> Save Updated Location
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ============================================================
// MODAL: REMOVE STAFF MEMBER (ADMIN)
// ============================================================
function RemoveStaffModal({
  tech,
  onClose,
  onRemoved,
}: {
  tech: TechnicianProfile;
  onClose: () => void;
  onRemoved: () => void;
}) {
  const toast = useToast();

  const handleConfirm = () => {
    try {
      api.deleteTechnician(tech.id);
      toast.success(
        "Staff member removed",
        `${tech.name} has been removed. Any open tickets were re-queued for manager assignment.`
      );
      onRemoved();
    } catch (e: any) {
      toast.error("Removal failed", e.message || String(e));
    }
  };

  return (
    <Modal open onClose={onClose} title="Remove Staff Member" width="max-w-md">
      <div className="space-y-3">
        <p className="text-sm text-slate-700">
          Are you sure you want to remove <b>{tech.name}</b> from the staff team?
        </p>
        <div className="rounded-lg bg-rose-50 p-3 text-xs text-rose-800 leading-relaxed border border-rose-200">
          ⚠️ <b>Manager Notice:</b> Removing this staff member will remove them from active service. Any open tickets assigned to them will return to the <b>Manager Assignment</b> queue for reassignment.
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleConfirm}>
            <UserMinus className="h-4 w-4" /> Confirm Removal
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ============================================================
// MODAL: REQUEST SERVICE VISIT
// ============================================================
function RequestServiceModal({
  tech,
  onClose,
}: {
  tech: TechnicianProfile;
  onClose: () => void;
}) {
  const db = useDB();
  const session = useSession();
  const toast = useToast();

  const [equipment, setEquipment] = useState("Full Rooftop Solar PV System");
  const [category, setCategory] = useState("Performance Issue");
  const [description, setDescription] = useState("");
  const [appointmentTime, setAppointmentTime] = useState("");
  const [err, setErr] = useState("");

  const custId = session?.customerId || db.customers[0]?.id || "cust-01";
  const myProj = db.installation_projects.find((p) => p.customer_id === custId) ?? db.installation_projects[0];
  const units = db.equipment_units.filter((u) => u.project_id === myProj?.id);

  const handleSubmit = () => {
    if (description.trim().length < 10) return setErr("Please describe the issue in at least 10 characters.");

    const unit = units.find((u) => u.serial_number === equipment) ?? null;

    api.createTicket({
      customer_id: custId,
      project_id: myProj?.id ?? null,
      equipment_unit_id: unit?.id ?? null,
      serial_number: unit?.serial_number ?? (equipment.startsWith("SP-") ? equipment : "SYS-PV-ROOFTOP"),
      issue_category: category,
      description: `${description} (Preferred technician: ${tech.name})`,
      priority: "medium",
      assigned_technician: "",
      assignment_status: "awaiting_manager",
      appointment_time: appointmentTime || null,
      created_by: session?.name || "Customer / Service Request",
    });

    toast.success(
      "Service request submitted",
      `Your request has been routed to the Operations Manager for direct staff dispatch of ${tech.name}.`
    );
    printTechnicianRequestAck("New Service Request", tech.name, appointmentTime);
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={`Request Service · ${tech.name}`}>
      <div className="space-y-3.5">
        <div className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-900 border border-emerald-200">
          Requesting visit by: <b>{tech.name}</b> ({tech.location_name}) · Rating: ★ {tech.rating}
          <span className="block mt-0.5 text-slate-500 text-[11px]">
            Your service request will be reviewed by the Operations Manager and directly assigned.
          </span>
        </div>

        <div>
          <Label required>System Component / Equipment</Label>
          <Select value={equipment} onChange={(e) => setEquipment(e.target.value)}>
            <option value="Full Rooftop Solar PV System">Full Rooftop Solar PV System</option>
            <option value="Solar Inverter (On-Grid / Hybrid)">Solar Inverter (On-Grid / Hybrid)</option>
            <option value="Solar PV Panels (Mono PERC)">Solar PV Panels (Mono PERC)</option>
            <option value="AC/DC Distribution Box & Wiring">AC/DC Distribution Box & Wiring</option>
            <option value="Battery Storage Backup">Battery Storage Backup</option>
            {units.map((u) => (
              <option key={u.id} value={u.serial_number}>
                {u.item_name} — {u.serial_number}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label>Issue Category</Label>
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            {[
              "Performance Issue",
              "Inverter Fault",
              "Panel Damage",
              "Wiring/Electrical",
              "Battery Issue",
              "Monitoring/App",
              "Cleaning Request",
              "Other",
            ].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        </div>

        <div>
          <Label required>Describe the Issue</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is happening with your solar rooftop system?"
          />
          <FieldError message={err} />
        </div>

        <div>
          <Label>Preferred Appointment Time</Label>
          <Input
            type="datetime-local"
            value={appointmentTime}
            onChange={(e) => setAppointmentTime(e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            Submit Service Request to Manager
          </Button>
        </div>
      </div>
    </Modal>
  );
}
