import { useMemo, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router";
import { SunMedium, LogOut, HeartHandshake, Search } from "lucide-react";
import { useSession, logout } from "@/hooks/useSession";
import { useDB } from "@/services";
import { DemoPill } from "@/components/ui";
import { cn } from "@/lib/utils";

export function PortalShell() {
  const session = useSession();
  const db = useDB();
  const navigate = useNavigate();
  const customer = db.customers.find((c) => c.id === session?.customerId);
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white no-print">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
          <SunMedium className="h-5 w-5 text-brand-700" />
          <div className="leading-tight">
            <p className="text-sm font-bold text-slate-900">SolarOps AI · Customer Portal</p>
            <p className="text-[10px] text-slate-400">{customer?.full_name ?? session?.name} · {customer?.city}</p>
          </div>
          <nav className="ml-auto flex items-center gap-1">
            <NavLink
              to="/portal"
              end
              className={({ isActive }) => cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium",
                isActive ? "bg-brand-50 text-brand-800" : "text-slate-600 hover:bg-slate-50",
              )}
            >
              <HeartHandshake className="h-4 w-4" /> My Solar
            </NavLink>
            <NavLink
              to="/portal/technician"
              className={({ isActive }) => cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium",
                isActive ? "bg-brand-50 text-brand-800" : "text-slate-600 hover:bg-slate-50",
              )}
            >
              <Search className="h-4 w-4" /> Find a Technician
            </NavLink>
            <button
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium text-slate-500 hover:bg-slate-50 hover:text-rose-600"
              onClick={() => { logout(); navigate("/login"); }}
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
          <div className="mx-auto mt-16 max-w-md rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
            <HeartHandshake className="mx-auto h-8 w-8 text-amber-600" />
            <h2 className="mt-3 text-base font-semibold text-amber-900">Customer portal needs a customer account</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-amber-800">
              You are signed in as <b>{session?.name ?? "staff"}</b>, which is a staff role without a linked customer record.
              Sign out and use the customer demo account (<span className="font-mono">customer@demo.solarops</span>) to view the portal,
              or sign in as staff to manage it from the operations dashboard.
            </p>
            <button
              className="mt-4 rounded-lg bg-amber-700 px-4 py-2 text-[13px] font-semibold text-white hover:bg-amber-800"
              onClick={() => { logout(); navigate("/login"); }}
            >
              Sign out & choose customer account
            </button>
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
