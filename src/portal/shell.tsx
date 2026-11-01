import { useMemo, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router";
import { SunMedium, LogOut, HeartHandshake, Search, LayoutDashboard, Eye, ArrowLeft } from "lucide-react";
import { useSession, logout } from "@/hooks/useSession";
import { useDB } from "@/services";
import { DemoPill } from "@/components/ui";
import { SunPowerLogo } from "@/components/SunPowerLogo";
import { cn } from "@/lib/utils";

export function PortalShell() {
  const session = useSession();
  const db = useDB();
  const navigate = useNavigate();
  const [previewCustomerId, setPreviewCustomerId] = useState<string | null>(null);

  const isStaff = session?.role && session.role !== "customer";

  // Determine active customer ID (session link -> preview pick -> first customer fallback for customer role)
  const activeCustomerId =
    session?.customerId ||
    previewCustomerId ||
    (session?.role === "customer" ? db.customers[0]?.id : null);

  const matchedCustomer = db.customers.find((c) => c.id === activeCustomerId);

  // If customer role, provide a live profile fallback if not found in db array
  const customer =
    matchedCustomer ||
    (session?.role === "customer"
      ? {
          id: session.customerId || "cust-live",
          code: "CUST-" + (session.customerId?.slice(-4) || "LIVE").toUpperCase(),
          full_name: session.name || "Customer",
          email: session.email || "",
          phone: "+91 98000 00000",
          city: "Hyderabad",
          state: "Telangana",
          customer_type: "residential" as const,
          monthly_units: 350,
          monthly_bill: 2800,
          lead_source: "Online Registration",
          assigned_to: "Sales Executive — Alicia Dsouza",
          notes: "Customer portal active profile.",
          lead_status: "won" as const,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      : null);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Staff mode banner */}
      {isStaff && (
        <div className="border-b border-amber-300 bg-amber-500/10 px-4 py-2 text-xs font-medium text-amber-950 backdrop-blur-sm">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              <span>
                Staff Mode: Signed in as <b>{session?.name}</b> (Role: <span className="capitalize">{session?.role}</span>).
              </span>
              {customer && (
                <span className="text-amber-800">
                  · Viewing Customer: <b>{customer.full_name}</b> ({customer.code})
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate("/dashboard")}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700 transition cursor-pointer shadow-xs"
              >
                <LayoutDashboard className="h-3.5 w-3.5" /> Back to Operations Dashboard
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white no-print">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
          <SunPowerLogo size="sm" variant="light" />
          <div className="leading-tight">
            <p className="text-sm font-bold text-slate-900">SunPower · Customer Portal</p>
            <p className="text-[10px] text-slate-400">
              {customer?.full_name ?? session?.name ?? "Customer"} · {customer?.city || "India"}
            </p>
          </div>
          <nav className="ml-auto flex items-center gap-1">
            {isStaff && (
              <button
                type="button"
                onClick={() => navigate("/dashboard")}
                className="mr-2 hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-[12.5px] font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition cursor-pointer"
              >
                <LayoutDashboard className="h-3.5 w-3.5" /> Operations Dashboard
              </button>
            )}
            <NavLink
              to="/portal"
              end
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium",
                  isActive ? "bg-brand-50 text-brand-800" : "text-slate-600 hover:bg-slate-50",
                )
              }
            >
              <HeartHandshake className="h-4 w-4" /> My Solar
            </NavLink>
            <NavLink
              to="/portal/technician"
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium",
                  isActive ? "bg-brand-50 text-brand-800" : "text-slate-600 hover:bg-slate-50",
                )
              }
            >
              <Search className="h-4 w-4" /> Find a Technician
            </NavLink>
            <button
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium text-slate-500 hover:bg-slate-50 hover:text-rose-600 cursor-pointer"
              onClick={() => {
                logout();
                navigate("/login");
              }}
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </nav>
          <DemoPill />
        </div>
      </header>

      <main className="mx-auto max-w-7xl p-4 lg:p-8">
        {customer ? (
          <Outlet />
        ) : (
          <div className="mx-auto mt-12 max-w-lg rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-xl">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <LayoutDashboard className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-lg font-bold text-slate-900">Operations Staff Portal Access</h2>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              You are signed in as <b>{session?.name ?? "staff"}</b> (Role: <b>{session?.role ?? "staff"}</b>).
              The Customer Portal is configured for customer self-service, but you can inspect it or return to your staff management workspace anytime.
            </p>

            <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 shadow-md transition cursor-pointer"
                onClick={() => navigate("/dashboard")}
              >
                <LayoutDashboard className="h-4 w-4" /> Go to Operations Dashboard
              </button>

              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                onClick={() => setPreviewCustomerId("cust-01")}
              >
                <Eye className="h-4 w-4 text-brand-600" /> Preview Customer (Ramesh Gupta)
              </button>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 text-center">
              <button
                type="button"
                className="text-xs font-medium text-slate-400 hover:text-slate-600 cursor-pointer"
                onClick={() => {
                  logout();
                  navigate("/login");
                }}
              >
                Sign out & switch account
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export const PORTAL_TRACK_STAGES = [
  { key: "enquiry", label: "Enquiry" },
  { key: "survey", label: "Site Survey" },
  { key: "quotation", label: "Quotation" },
  { key: "order", label: "Order Confirmed" },
  { key: "equipment", label: "Equipment Preparation" },
  { key: "scheduled", label: "Installation Scheduled" },
  { key: "installing", label: "Installation In Progress" },
  { key: "inspection", label: "Quality Inspection" },
  { key: "completed", label: "Completed" },
] as const;

export type PortalStageKey = (typeof PORTAL_TRACK_STAGES)[number]["key"];

export function computeCustomerJourney(db: ReturnType<typeof useDB>, customerId: string): Record<PortalStageKey, { done: boolean; detail: string }> {
  const surveys = db.site_surveys.filter((s) => s.customer_id === customerId);
  const quotes = db.quotations.filter((q) => q.customer_id === customerId);
  const accepted = quotes.find((q) => q.status === "accepted");
  const proj = accepted ? db.installation_projects.find((p) => p.quotation_id === accepted.id) ?? db.installation_projects.find((p) => p.customer_id === customerId) : db.installation_projects.find((p) => p.customer_id === customerId);
  const units = proj ? db.equipment_units.filter((u) => u.project_id === proj.id) : [];
  const statuses = proj ? [proj.status] : [];
  return {
    enquiry: { done: !!db.customers.find((c) => c.id === customerId), detail: surveys.length ? "" : "" },
    survey: { done: surveys.some((s) => s.status === "completed"), detail: surveys.length ? `${surveys.filter((s) => s.status === "completed").length}/${surveys.length} completed` : "No surveys yet" },
    quotation: { done: quotes.some((q) => ["generated", "sent", "accepted"].includes(q.status)), detail: quotes.length ? quotes[0].number : "Not generated" },
    order: { done: !!accepted, detail: accepted ? `Accepted — ${accepted.number}` : "Awaiting acceptance" },
    equipment: { done: !!proj && proj.equipment_status === "dispatched" || statuses.includes("in_progress"), detail: proj ? (proj.equipment_status === "dispatched" ? "Dispatched" : proj.equipment_status === "reserved" ? "Reserved in stock" : "Waiting for stock") : "—" },
    scheduled: { done: !!proj && !!proj.scheduled_start, detail: proj?.scheduled_start ? `${proj.scheduled_start}` : "Not scheduled" },
    installing: { done: statuses.includes("in_progress"), detail: statuses.includes("in_progress") ? "Crew on site" : "—" },
    inspection: { done: statuses.includes("quality_inspection") || statuses.includes("completed"), detail: statuses.includes("quality_inspection") ? "Inspection underway" : statuses.includes("completed") ? "Passed" : "—" },
    completed: { done: statuses.includes("completed"), detail: proj?.actual_completion ? proj.actual_completion : "—" },
  };
}

export function usePortalProject(customerId?: string) {
  const db = useDB();
  return useMemo(() => {
    if (!customerId) return null;
    const quotes = db.quotations.filter((q) => q.customer_id === customerId);
    const accepted = quotes.find((q) => q.status === "accepted");
    const proj = db.installation_projects.find((p) => p.customer_id === customerId);
    return { quotes, accepted, proj, customer: db.customers.find((c) => c.id === customerId) };
  }, [db, customerId]);
}
