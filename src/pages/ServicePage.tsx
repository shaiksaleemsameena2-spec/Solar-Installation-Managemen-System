import { useMemo, useState } from "react";
import { Link } from "react-router";
import {
  Search, Plus, Wrench, Send, CheckCircle2, ShieldAlert, Sparkles, X,
  MapPin, UserCheck, UserMinus, UserPlus, Compass, Navigation, Phone, Star, Shield, Edit3
} from "lucide-react";
import {
  Card, PageHeader, Button, Input, Select, Modal, Label, Table, Th, Td, Badge,
  FieldError, EmptyState, StatTile, Tabs, Textarea, Modal as M
} from "@/components/ui";
import { useToast } from "@/components/toast";
import { useDB, api } from "@/services";
import { TICKET_STATUS, PRIORITY, ISSUE_CATEGORIES, ASSIGNMENT_STATUS } from "@/lib/labels";
import { formatDate, formatDateTime, formatINR, todayISO } from "@/lib/utils";
import { aiServiceGuidance } from "@/lib/ai";
import { downloadCSV } from "@/lib/csv";
import { GoogleMapView } from "@/components/GoogleMapView";
import type { TechnicianProfile } from "@/types";

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
];

export default function ServicePage() {
  const db = useDB();
  const toast = useToast();
  const [tab, setTab] = useState("tickets");
  const [q, setQ] = useState("");
  const [statusF, setStatusF] = useState("all");
  const [priorityF, setPriorityF] = useState("all");
  const [creating, setCreating] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);

  // Staff management state
  const [addStaffOpen, setAddStaffOpen] = useState(false);
  const [updateLocTech, setUpdateLocTech] = useState<TechnicianProfile | null>(null);
  const [removeTech, setRemoveTech] = useState<TechnicianProfile | null>(null);
  const [selectedMapTech, setSelectedMapTech] = useState<TechnicianProfile | null>(null);

  const rows = useMemo(() => db.service_tickets
    .filter((t) => (statusF === "all" ? true : t.status === statusF))
    .filter((t) => (priorityF === "all" ? true : t.priority === priorityF))
    .filter((t) => {
      const term = q.toLowerCase();
      const cust = db.customers.find((c) => c.id === t.customer_id)?.full_name ?? "";
      return !term || t.number.toLowerCase().includes(term) || cust.toLowerCase().includes(term) || t.description.toLowerCase().includes(term);
    }), [db.service_tickets, db.customers, q, statusF, priorityF]);

  const openCount = db.service_tickets.filter((t) => ["open", "assigned", "in_progress", "waiting_parts"].includes(t.status)).length;

  // Tickets awaiting Manager assignment
  const awaitingManager = db.service_tickets.filter(
    (t) => t.assignment_status === "awaiting_manager" || (!t.assigned_technician && t.status === "open") || t.assignment_status === "requested"
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Service Center"
        subtitle={`${openCount} open · ${awaitingManager.length} ticket(s) awaiting manager assignment · ${db.technicians.filter((t) => t.is_active).length} active staff`}
      >
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setTab("staff_management"); setAddStaffOpen(true); }}>
            <UserPlus className="h-4 w-4" /> Add staff
          </Button>
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> New ticket
          </Button>
        </div>
      </PageHeader>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <StatTile label="Open tickets" value={openCount} icon={Wrench} tone={openCount ? "warn" : "good"} />
        <StatTile label="Awaiting assignment" value={awaitingManager.length} icon={UserCheck} tone={awaitingManager.length ? "bad" : "good"} />
        <StatTile label="Active staff" value={db.technicians.filter((t) => t.is_active).length} icon={Shield} tone="good" />
        <StatTile label="Service revenue" value={formatINR(db.service_tickets.reduce((s, t) => s + t.actual_cost, 0))} />
      </div>

      <Tabs
        tabs={[
          { key: "tickets", label: "All tickets", count: db.service_tickets.length },
          { key: "manager_assign", label: "Manager Assignment", count: awaitingManager.length },
          { key: "staff_management", label: "Staff & Locations", count: db.technicians.length },
          { key: "techdash", label: "Staff Workboard" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {/* 1. ALL TICKETS TAB */}
      {tab === "tickets" && (
        <>
          <div className="flex flex-wrap gap-2">
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input className="pl-8" placeholder="Search ticket, customer, issue…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <Select className="w-40" value={statusF} onChange={(e) => setStatusF(e.target.value)}>
              <option value="all">All statuses</option>
              {Object.entries(TICKET_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
            <Select className="w-36" value={priorityF} onChange={(e) => setPriorityF(e.target.value)}>
              <option value="all">All priorities</option>
              {Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => downloadCSV("service-tickets.csv", db.service_tickets, ["number", "issue_category", "description", "priority", "status", "assigned_technician", "created_at"])}
            >
              Export CSV
            </Button>
          </div>
          <Card>
            {rows.length ? (
              <Table>
                <thead>
                  <tr>
                    <Th>Ticket</Th>
                    <Th>Customer / project</Th>
                    <Th>Issue</Th>
                    <Th>Serial</Th>
                    <Th>Assigned Staff</Th>
                    <Th>Priority</Th>
                    <Th>Status</Th>
                    <Th className="text-right">Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((t) => {
                    const cust = db.customers.find((c) => c.id === t.customer_id);
                    const proj = db.installation_projects.find((p) => p.id === t.project_id);
                    return (
                      <tr key={t.id} className="hover:bg-slate-50/60">
                        <Td>
                          <p className="font-mono text-[12px] font-semibold">{t.number}</p>
                          <p className="text-[10.5px] text-slate-400">{formatDate(t.created_at)} · via {t.created_by.includes("Portal") ? "Customer Portal" : "Operations"}</p>
                        </Td>
                        <Td>
                          <Link to={`/customers/${cust?.id}`} className="text-brand-700 hover:underline font-medium">
                            {cust?.full_name}
                          </Link>
                          {proj && <p className="text-[10.5px] text-slate-400">{proj.number}</p>}
                        </Td>
                        <Td>
                          <p className="font-medium text-slate-800">{t.issue_category}</p>
                          <p className="max-w-[220px] truncate text-[11px] text-slate-400">{t.description}</p>
                        </Td>
                        <Td className="font-mono text-[10.5px]">{t.serial_number || "—"}</Td>
                        <Td>
                          <p className="text-[12px] font-medium text-slate-700">{t.assigned_technician || "Unassigned"}</p>
                          {t.assignment_status && <Badge status={t.assignment_status} label={ASSIGNMENT_STATUS[t.assignment_status]} />}
                          {t.appointment_time && <p className="text-[10px] text-slate-400 mt-0.5">Appt: {t.appointment_time.slice(0, 16).replace("T", " ")}</p>}
                        </Td>
                        <Td><Badge status={t.priority} /></Td>
                        <Td><Badge status={t.status} label={TICKET_STATUS[t.status]} /></Td>
                        <Td>
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="secondary" onClick={() => setDetail(t.id)}>Open</Button>
                          </div>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            ) : (
              <EmptyState icon={Wrench} title="No tickets match" action={<Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New ticket</Button>} />
            )}
          </Card>
        </>
      )}

      {/* 2. MANAGER ASSIGNMENT TAB (DIRECT ASSIGNMENT WITHOUT REQUEST TO STAFF) */}
      {tab === "manager_assign" && (
        <ManagerAssignmentTab
          tickets={awaitingManager}
          onAssignComplete={() => {}}
          onOpenDetail={(id) => setDetail(id)}
        />
      )}

      {/* 3. STAFF & LOCATIONS MANAGEMENT TAB (MANAGER ADDS/REMOVES STAFF & UPDATES LOCATIONS) */}
      {tab === "staff_management" && (
        <StaffManagementTab
          onAddStaff={() => setAddStaffOpen(true)}
          onUpdateLocation={(tech) => setUpdateLocTech(tech)}
          onRemoveStaff={(tech) => setRemoveTech(tech)}
          selectedTech={selectedMapTech}
          onSelectTech={(tech) => setSelectedMapTech(tech)}
        />
      )}

      {/* 4. STAFF WORKBOARD TAB */}
      {tab === "techdash" && (
        <TechnicianDashboard onOpen={(id) => { setTab("tickets"); setDetail(id); }} />
      )}

      {/* Modals */}
      {creating && <CreateTicketModal onClose={() => setCreating(false)} />}
      {detail && <TicketDetailModal ticketId={detail} onClose={() => setDetail(null)} />}
      {addStaffOpen && <AddStaffModal onClose={() => setAddStaffOpen(false)} />}
      {updateLocTech && <UpdateLocationModal tech={updateLocTech} onClose={() => setUpdateLocTech(null)} />}
      {removeTech && (
        <RemoveStaffModal
          tech={removeTech}
          onClose={() => setRemoveTech(null)}
          onRemoved={() => {
            if (selectedMapTech?.id === removeTech.id) setSelectedMapTech(null);
            setRemoveTech(null);
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// MANAGER DIRECT ASSIGNMENT VIEW
// Requirement 2: Direct manager staff assignment without request to staff
// ============================================================
function ManagerAssignmentTab({
  tickets,
  onAssignComplete,
  onOpenDetail,
}: {
  tickets: import("@/types").ServiceTicket[];
  onAssignComplete: () => void;
  onOpenDetail: (id: string) => void;
}) {
  const db = useDB();
  const toast = useToast();
  const activeStaff = db.technicians.filter((t) => t.is_active);

  // Per-row assignment selection state
  const [selectedStaffMap, setSelectedStaffMap] = useState<Record<string, string>>({});

  const handleStaffChange = (ticketId: string, staffName: string) => {
    setSelectedStaffMap((prev) => ({ ...prev, [ticketId]: staffName }));
  };

  const handleDirectAssign = (ticketId: string, ticketNumber: string) => {
    const chosenStaff = selectedStaffMap[ticketId] || activeStaff[0]?.name;
    if (!chosenStaff) {
      toast.error("Select staff member", "Please select a staff member from the dropdown before assigning.");
      return;
    }

    try {
      api.directAssignTicketStaff(ticketId, chosenStaff);
      toast.success(
        "Staff assigned directly",
        `Assigned ${chosenStaff} to ticket ${ticketNumber}. No confirmation request required.`
      );
      onAssignComplete();
    } catch (e: any) {
      toast.error("Assignment failed", e.message || String(e));
    }
  };

  return (
    <Card>
      <div className="border-b border-slate-100 px-4 py-3 bg-gradient-to-r from-emerald-50/60 to-white flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-emerald-600" />
            Direct Staff Assignment by Operations Manager
          </h3>
          <p className="text-[11.5px] text-slate-500 mt-0.5">
            When a customer raises a service request, assign a staff member directly below. Tickets update to assigned immediately without sending confirmation requests to staff.
          </p>
        </div>
        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
          {tickets.length} Pending
        </span>
      </div>

      <Table>
        <thead>
          <tr>
            <Th>Ticket</Th>
            <Th>Customer & Address</Th>
            <Th>Issue Description</Th>
            <Th>Requested Appointment</Th>
            <Th>Select Staff Member</Th>
            <Th className="text-right">Direct Action</Th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((t) => {
            const cust = db.customers.find((c) => c.id === t.customer_id);
            const currentSelected = selectedStaffMap[t.id] || (activeStaff[0]?.name ?? "");
            return (
              <tr key={t.id} className="hover:bg-slate-50/70 transition">
                <Td>
                  <p className="font-mono text-[12px] font-bold text-slate-900">{t.number}</p>
                  <p className="text-[10px] text-slate-400">{formatDate(t.created_at)}</p>
                  <Badge status="awaiting_manager" label="Awaiting Manager" className="mt-1" />
                </Td>
                <Td>
                  <p className="font-semibold text-slate-800">{cust?.full_name || "Customer"}</p>
                  <p className="text-[11px] text-slate-500">{cust?.city || "Hyderabad"} · {cust?.phone}</p>
                </Td>
                <Td>
                  <p className="font-medium text-slate-800 text-xs">{t.issue_category}</p>
                  <p className="max-w-[240px] truncate text-[11px] text-slate-500">{t.description}</p>
                </Td>
                <Td className="text-[12px] text-slate-600 font-medium">
                  {t.appointment_time ? t.appointment_time.replace("T", " ") : "Flexible"}
                </Td>
                <Td>
                  <Select
                    value={currentSelected}
                    onChange={(e) => handleStaffChange(t.id, e.target.value)}
                    className="w-full min-w-[210px]"
                  >
                    {activeStaff.map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name} ({s.location_name}) — ★ {s.rating}
                      </option>
                    ))}
                    {activeStaff.length === 0 && (
                      <option value="" disabled>No active staff members found</option>
                    )}
                  </Select>
                </Td>
                <Td>
                  <div className="flex justify-end gap-1.5">
                    <Button
                      size="sm"
                      onClick={() => handleDirectAssign(t.id, t.number)}
                      className="shadow-sm"
                    >
                      <UserCheck className="h-3.5 w-3.5" /> Assign Staff
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onOpenDetail(t.id)}
                    >
                      View
                    </Button>
                  </div>
                </Td>
              </tr>
            );
          })}
          {tickets.length === 0 && (
            <tr>
              <td colSpan={6} className="py-8 text-center text-slate-400">
                <CheckCircle2 className="mx-auto h-7 w-7 text-emerald-500 mb-1.5" />
                All customer service requests have been assigned to staff members.
              </td>
            </tr>
          )}
        </tbody>
      </Table>
    </Card>
  );
}

// ============================================================
// STAFF & LOCATIONS MANAGEMENT VIEW
// Requirement 4: Manager marks / updates staff location
// Requirement 5: Manager adds or removes staff
// Requirement 3: Google Maps integration
// ============================================================
function StaffManagementTab({
  onAddStaff,
  onUpdateLocation,
  onRemoveStaff,
  selectedTech,
  onSelectTech,
}: {
  onAddStaff: () => void;
  onUpdateLocation: (tech: TechnicianProfile) => void;
  onRemoveStaff: (tech: TechnicianProfile) => void;
  selectedTech: TechnicianProfile | null;
  onSelectTech: (tech: TechnicianProfile) => void;
}) {
  const db = useDB();
  const staffList = db.technicians;

  return (
    <div className="space-y-4">
      {/* Top Banner with Action */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <MapPin className="h-4.5 w-4.5 text-emerald-600" />
            Field Staff Directory & Location Mapping (Google Maps)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            As Operations Manager, you have full authority to add new staff, remove staff, and mark or update each technician's live service coordinates on Google Maps.
          </p>
        </div>
        <Button onClick={onAddStaff} className="shadow-md">
          <UserPlus className="h-4 w-4" /> Add Staff Member
        </Button>
      </div>

      {/* Grid: Staff List + Google Map */}
      <div className="grid gap-4 lg:grid-cols-[420px_1fr]">
        {/* Left: Staff Directory List */}
        <div className="space-y-2.5 max-h-[640px] overflow-y-auto pr-1">
          {staffList.map((tech) => {
            const isSelected = selectedTech?.id === tech.id;
            return (
              <div
                key={tech.id}
                onClick={() => onSelectTech(tech)}
                className={`rounded-xl border p-3.5 transition cursor-pointer shadow-sm ${
                  isSelected
                    ? "border-emerald-500 bg-emerald-50/50 ring-1 ring-emerald-500"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-inner"
                      style={{ background: tech.photo_color || "#15803d" }}
                    >
                      {tech.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                        {tech.name}
                        <span className="flex items-center text-amber-500 text-[11px] font-semibold">
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400 inline mr-0.5" />
                          {tech.rating}
                        </span>
                      </p>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <Phone className="h-3 w-3 text-slate-400" />
                        {tech.phone}
                      </p>
                    </div>
                  </div>

                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                    tech.is_active ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"
                  }`}>
                    {tech.is_active ? "Active" : "Inactive"}
                  </span>
                </div>

                {/* Marked Location Badge */}
                <div className="mt-2.5 rounded-lg border border-slate-100 bg-slate-50/80 px-2.5 py-1.5 text-xs">
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
                <div className="mt-2 flex flex-wrap items-center gap-1 text-[11px]">
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600">
                    {tech.experience_years}+ yrs exp
                  </span>
                  {tech.specializations.slice(0, 2).map((sp) => (
                    <span key={sp} className="rounded bg-brand-50 px-1.5 py-0.5 font-medium text-brand-800">
                      {sp}
                    </span>
                  ))}
                  {tech.specializations.length > 2 && (
                    <span className="text-[10px] text-slate-400">+{tech.specializations.length - 2} more</span>
                  )}
                </div>

                {/* Manager Actions: Update Location & Remove Staff */}
                <div className="mt-3 flex items-center justify-end gap-2 border-t border-slate-100 pt-2.5">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdateLocation(tech);
                    }}
                    className="text-xs"
                  >
                    <Edit3 className="h-3.5 w-3.5 text-emerald-700" /> Update Location
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveStaff(tech);
                    }}
                    className="text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                  >
                    <UserMinus className="h-3.5 w-3.5" /> Remove
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: Live Google Map */}
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm flex flex-col">
          <div className="mb-2 flex items-center justify-between px-1">
            <p className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Compass className="h-3.5 w-3.5 text-emerald-600" />
              Live Google Map — Staff Locations Across Hyderabad
            </p>
            <p className="text-[11px] text-slate-400">
              Click pin for staff details · Use Map/Satellite view
            </p>
          </div>

          <GoogleMapView
            center={selectedTech ? { lat: selectedTech.lat, lng: selectedTech.lng } : { lat: 17.385, lng: 78.4867 }}
            zoom={selectedTech ? 13 : 11}
            technicians={staffList}
            selected={selectedTech}
            onSelect={(t) => onSelectTech(t)}
            height="560px"
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MODAL: ADD NEW STAFF MEMBER (Requirement 5)
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
    if (phone.trim().length < 7) return setErr("Please enter a valid phone number.");
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
// MODAL: UPDATE STAFF LOCATION (Requirement 4)
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
          <Label>Click on Google Map to Mark Live Pin</Label>
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
// MODAL: REMOVE STAFF MEMBER (Requirement 5)
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
        `${tech.name} has been removed from active field operations. Any open tickets were re-queued for manager assignment.`
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
          ⚠️ <b>Manager Notice:</b> Removing this staff member will remove them from the active technicians directory. Any open tickets currently assigned to them will automatically return to the <b>Manager Assignment</b> queue for reassignment.
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
// MODAL: CREATE TICKET
// ============================================================
function CreateTicketModal({ onClose }: { onClose: () => void }) {
  const db = useDB();
  const toast = useToast();
  const [form, setForm] = useState({
    customer_id: db.customers[0]?.id ?? "",
    project_id: "",
    issue_category: ISSUE_CATEGORIES[0],
    description: "",
    priority: "medium",
    serial_number: "",
    equipment_unit_id: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const projects = db.installation_projects.filter((p) => p.customer_id === form.customer_id);
  const units = form.project_id
    ? db.equipment_units.filter((u) => u.project_id === form.project_id)
    : db.equipment_units.filter((u) => {
        const p = db.installation_projects.find((proj) => proj.id === u.project_id);
        return p?.customer_id === form.customer_id;
      });
  const displayUnits = units.length > 0 ? units : db.equipment_units.slice(0, 10);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = () => {
    const errs: Record<string, string> = {};
    if (!form.customer_id) errs.customer_id = "Select a customer";
    if (form.description.trim().length < 10) errs.description = "At least 10 characters";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      api.createTicket({
        customer_id: form.customer_id,
        project_id: form.project_id || null,
        equipment_unit_id: form.equipment_unit_id || null,
        serial_number: form.serial_number,
        issue_category: form.issue_category,
        description: form.description,
        priority: form.priority as never,
        created_by: "Operations Staff",
        assignment_status: "awaiting_manager",
      });
      toast.success("Ticket created", "Submitted to Manager Assignment queue.");
      onClose();
    } catch (e: any) {
      toast.error("Create failed", e.message || String(e));
    }
  };

  return (
    <Modal open onClose={onClose} title="New Service Ticket" width="max-w-lg">
      <div className="grid gap-3.5 sm:grid-cols-2">
        <FG label="Customer" required err={errors.customer_id} className="sm:col-span-2">
          <Select
            value={form.customer_id}
            onChange={(e) => {
              set("customer_id", e.target.value);
              set("project_id", "");
              set("serial_number", "");
              setForm((f) => ({ ...f, equipment_unit_id: "" }));
            }}
          >
            <option value="">Select customer…</option>
            {db.customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name} ({c.city})
              </option>
            ))}
            {db.customers.length === 0 && <option value="" disabled>No customers registered</option>}
          </Select>
        </FG>
        <FG label="Installation project (optional)" className="sm:col-span-2">
          <Select
            value={form.project_id}
            onChange={(e) => {
              set("project_id", e.target.value);
              set("serial_number", "");
              setForm((f) => ({ ...f, equipment_unit_id: "" }));
            }}
          >
            <option value="">Not linked</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.number} · {p.package_name} ({p.status})
              </option>
            ))}
          </Select>
        </FG>
        <FG label="Equipment serial (optional)" className="sm:col-span-2">
          <Select
            value={form.equipment_unit_id}
            onChange={(e) => {
              const u = db.equipment_units.find((x) => x.id === e.target.value);
              setForm((f) => ({
                ...f,
                equipment_unit_id: e.target.value,
                serial_number: u?.serial_number ?? "",
              }));
            }}
          >
            <option value="">General Rooftop System / Not specified</option>
            {displayUnits.map((u) => (
              <option key={u.id} value={u.id}>
                {u.item_name} · {u.serial_number} ({u.status})
              </option>
            ))}
          </Select>
        </FG>
        <FG label="Issue category">
          <Select value={form.issue_category} onChange={(e) => set("issue_category", e.target.value)}>
            {ISSUE_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </FG>
        <FG label="Priority">
          <Select value={form.priority} onChange={(e) => set("priority", e.target.value)}>
            {Object.entries(PRIORITY).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </FG>
        <FG label="Problem description" required err={errors.description} className="sm:col-span-2">
          <Textarea
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Reported problem… (10+ chars)"
          />
        </FG>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={save}>Create Ticket</Button>
      </div>
    </Modal>
  );
}

// ============================================================
// MODAL: TICKET DETAIL & DIRECT REASSIGNMENT
// ============================================================
function TicketDetailModal({ ticketId, onClose }: { ticketId: string; onClose: () => void }) {
  const db = useDB();
  const toast = useToast();
  const t = db.service_tickets.find((x) => x.id === ticketId);
  const [resolution, setResolution] = useState("");
  const [cost, setCost] = useState(0);
  const [ai, setAi] = useState<Awaited<ReturnType<typeof aiServiceGuidance>> | null>(null);
  const [aiBusy, setAiBusy] = useState(false);

  if (!t) return null;
  const cust = db.customers.find((c) => c.id === t.customer_id);
  const proj = db.installation_projects.find((p) => p.id === t.project_id);
  const warranties = t.serial_number
    ? db.warranties.filter(
        (w) =>
          (t.serial_number && w.serial_number.includes(t.serial_number)) ||
          t.equipment_unit_id === w.equipment_unit_id
      )
    : [];

  const activeStaff = db.technicians.filter((s) => s.is_active);

  const askAI = async () => {
    setAiBusy(true);
    try {
      const unit = t.equipment_unit_id ? db.equipment_units.find((u) => u.id === t.equipment_unit_id) : null;
      const out = await aiServiceGuidance({
        issue_category: t.issue_category,
        description: t.description,
        equipment: unit?.item_name ?? "solar system",
        serial: t.serial_number,
      });
      setAi(out);
    } finally {
      setAiBusy(false);
    }
  };

  const resolve = () => {
    try {
      api.resolveTicket(t.id, resolution, cost);
      toast.success("Ticket resolved");
      onClose();
    } catch (e: any) {
      toast.error("Failed", e.message || String(e));
    }
  };

  const handleDirectAssignStaff = (staffName: string) => {
    if (!staffName) return;
    try {
      api.directAssignTicketStaff(t.id, staffName);
      toast.success("Staff assigned directly", `Ticket ${t.number} assigned to ${staffName}.`);
    } catch (e: any) {
      toast.error("Assignment failed", e.message || String(e));
    }
  };

  return (
    <M open onClose={onClose} title={`${t.number} · ${t.issue_category}`} width="max-w-3xl">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="rounded-lg bg-slate-50 p-3 text-[12.5px]">
            <p className="font-semibold text-slate-700">
              {cust?.full_name}
              {proj && ` · ${proj.number}`}
            </p>
            <p className="mt-1 text-slate-600">{t.description}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Badge status={t.status} label={TICKET_STATUS[t.status]} />
              <Badge status={t.priority} label={`${PRIORITY[t.priority]} priority`} />
              {t.serial_number && <span className="font-mono text-[10.5px] text-slate-500">{t.serial_number}</span>}
              <span className="text-[10.5px] text-slate-400">
                opened {formatDateTime(t.created_at)} by {t.created_by}
              </span>
            </div>
          </div>

          <div>
            <Label>Update status</Label>
            <Select
              value={t.status}
              onChange={(e) => {
                api.updateTicket(t.id, { status: e.target.value as never });
                toast.success("Status updated");
              }}
            >
              {Object.entries(TICKET_STATUS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </div>

          {/* Direct Staff Assignment Dropdown */}
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-2.5">
            <Label className="text-emerald-900 font-semibold">Direct Staff Assignment (Manager)</Label>
            <div className="mt-1 flex gap-2">
              <Select
                value={t.assigned_technician || ""}
                onChange={(e) => handleDirectAssignStaff(e.target.value)}
                className="bg-white flex-1"
              >
                <option value="">— Select Staff Member —</option>
                {activeStaff.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name} ({s.location_name}) — ★ {s.rating}
                  </option>
                ))}
                {activeStaff.length === 0 && (
                  <option value="" disabled>No active staff members found</option>
                )}
              </Select>
            </div>
            <p className="text-[10.5px] text-emerald-800/80 mt-1">
              Direct assignment updates ticket immediately without requiring staff confirmation.
            </p>
          </div>

          <div>
            <Label>Estimated cost (₹)</Label>
            <Input
              type="number"
              defaultValue={t.estimated_cost || 0}
              onBlur={(e) => api.updateTicket(t.id, { estimated_cost: Number(e.target.value) })}
            />
          </div>

          <div>
            <Label>Warranty check</Label>
            {warranties.length ? (
              warranties.map((w) => (
                <p key={w.id} className="rounded-lg bg-emerald-50 px-3 py-2 text-[11.5px] text-emerald-800">
                  <ShieldAlert className="mr-1 inline h-3.5 w-3.5" /> {w.code} active until {formatDate(w.end_date)} — {w.warranty_type}
                </p>
              ))
            ) : (
              <p className="text-[11.5px] text-slate-400">No warranty record found for this serial.</p>
            )}
          </div>

          {/* Resolution */}
          <div>
            <Label required>Resolution notes (on resolve)</Label>
            <Textarea value={resolution} onChange={(e) => setResolution(e.target.value)} className="min-h-[64px]" />
            <div className="mt-2 flex items-end gap-2">
              <div className="flex-1">
                <Label>Actual cost (₹)</Label>
                <Input type="number" value={cost} onChange={(e) => setCost(Number(e.target.value))} />
              </div>
              <Button variant="accent" onClick={resolve}>
                Resolve ticket
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {/* AI Guidance */}
          <div className="rounded-xl border border-brand-200 bg-brand-50/60 p-3.5">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-900">
                <Sparkles className="h-3.5 w-3.5" /> AI troubleshooting assistant
              </p>
              <Button size="sm" variant="secondary" onClick={askAI} disabled={aiBusy}>
                {aiBusy ? "Analyzing…" : "Analyze issue"}
              </Button>
            </div>
            {ai && (
              <div className="mt-2.5 space-y-2 text-[12px]">
                <div className="rounded-lg bg-white p-3 border border-brand-100">
                  <p className="font-semibold text-slate-800">Likely Root Cause:</p>
                  <p className="text-slate-600 mt-0.5">{ai.causes.join(", ")}</p>
                  <p className="font-semibold text-slate-800 mt-2">Recommended Steps:</p>
                  <ul className="list-disc pl-4 text-slate-600 space-y-0.5 mt-0.5">
                    {ai.nextSteps.map((s, idx) => (
                      <li key={idx}>{s}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </M>
  );
}

// ============================================================
// STAFF WORKBOARD
// ============================================================
function TechnicianDashboard({ onOpen }: { onOpen: (id: string) => void }) {
  const db = useDB();
  const assignments = db.service_tickets
    .filter((t) => t.assigned_technician)
    .sort((a, b) => (b.appointment_time ?? "").localeCompare(a.appointment_time ?? ""));

  return (
    <Card>
      <div className="border-b border-slate-100 px-4 py-3 bg-slate-50/50">
        <h3 className="text-sm font-semibold text-slate-800">Active Staff Workboard</h3>
        <p className="text-[11.5px] text-slate-400">
          All service tickets assigned to field staff by the Operations Manager.
        </p>
      </div>
      <Table>
        <thead>
          <tr>
            <Th>Ticket</Th>
            <Th>Customer</Th>
            <Th>Assigned Staff</Th>
            <Th>Issue</Th>
            <Th>Appointment</Th>
            <Th>Status</Th>
            <Th className="text-right">Action</Th>
          </tr>
        </thead>
        <tbody>
          {assignments.map((t) => {
            const cust = db.customers.find((c) => c.id === t.customer_id);
            return (
              <tr key={t.id}>
                <Td className="font-mono text-[12px] font-semibold">{t.number}</Td>
                <Td>{cust?.full_name}</Td>
                <Td className="font-medium text-emerald-800">{t.assigned_technician}</Td>
                <Td>{t.issue_category}</Td>
                <Td className="text-[12px]">{t.appointment_time?.replace("T", " ") ?? "Flexible"}</Td>
                <Td><Badge status={t.status} label={TICKET_STATUS[t.status]} /></Td>
                <Td>
                  <div className="text-right">
                    <Button size="sm" variant="secondary" onClick={() => onOpen(t.id)}>
                      Open
                    </Button>
                  </div>
                </Td>
              </tr>
            );
          })}
          {assignments.length === 0 && (
            <tr>
              <td colSpan={7} className="text-slate-400 text-center py-6 text-xs">
                No tickets currently assigned to staff.
              </td>
            </tr>
          )}
        </tbody>
      </Table>
    </Card>
  );
}

function FG({
  label,
  required,
  err,
  className,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  err?: string;
  className?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label required={required}>{label}</Label>
      {hint && <p className="mb-1 text-[11px] text-slate-400">{hint}</p>}
      {children}
      <FieldError message={err} />
    </div>
  );
}
