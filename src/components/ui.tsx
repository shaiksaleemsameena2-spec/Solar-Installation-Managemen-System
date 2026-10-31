import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn, titleCase } from "@/lib/utils";
import { badgeClass } from "@/lib/labels";

// ---------- Button ----------
export function Button({
  variant = "primary", size = "md", className, type = "button", ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline" | "accent";
  size?: "sm" | "md" | "lg";
}) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-brand-600",
        size === "sm" && "h-8 px-2.5 text-xs",
        size === "md" && "h-9 px-3.5 text-[13px]",
        size === "lg" && "h-11 px-5 text-sm",
        variant === "primary" && "bg-brand-700 text-white hover:bg-brand-800",
        variant === "accent" && "bg-lime-300 text-brand-900 hover:bg-lime-400",
        variant === "secondary" && "bg-brand-50 text-brand-800 hover:bg-brand-100",
        variant === "outline" && "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
        variant === "ghost" && "text-slate-600 hover:bg-slate-100",
        variant === "danger" && "bg-rose-600 text-white hover:bg-rose-700",
        className,
      )}
      {...props}
    />
  );
}

// ---------- Card ----------
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-xl border border-slate-200 bg-white shadow-sm", className)} {...props} />;
}
export function CardHeader({ title, subtitle, action, className }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3", className)}>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

// ---------- Form fields ----------
const fieldCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[13px] text-slate-800 placeholder:text-slate-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/15 disabled:bg-slate-50";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldCls, props.className)} {...props} />;
}
export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(fieldCls, "min-h-[72px]", props.className)} {...props} />;
}
export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  // Extract width and flex layout tokens from className for the outer wrapper
  const isCustomLayout = className?.match(/\b(w-\S+|flex-1|flex-auto|flex-initial|grow|shrink-0|max-w-\S+|min-w-\S+)\b/g);
  const layoutClass = isCustomLayout ? isCustomLayout.join(" ") : "w-full";

  return (
    <div className={cn("relative inline-flex items-center", layoutClass)}>
      <select
        className={cn(
          fieldCls,
          "appearance-none pr-8 cursor-pointer text-slate-900 bg-white font-medium",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500">
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
}
export function Label({ children, required, ...props }: React.LabelHTMLAttributes<HTMLLabelElement> & { required?: boolean }) {
  return (
    <label className="mb-1 block text-xs font-medium text-slate-600" {...props}>
      {children} {required && <span className="text-rose-500">*</span>}
    </label>
  );
}
export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-[11px] font-medium text-rose-600">{message}</p>;
}

// ---------- Badge ----------
export function Badge({ status, label, className }: { status?: string; label?: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap", badgeClass[status ?? ""] ?? "bg-slate-100 text-slate-600", className)}>
      {label ?? titleCase(status ?? "")}
    </span>
  );
}

// ---------- Modal ----------
export function Modal({ open, onClose, title, children, width = "max-w-lg" }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; width?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 no-print" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={cn("max-h-[90vh] w-full overflow-y-auto rounded-xl bg-white shadow-2xl", width)}>
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-3.5">
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

// ---------- Confirm ----------
export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = "Delete", danger }: {
  open: boolean; onClose: () => void; onConfirm: () => void; title: string; message: string;
  confirmLabel?: string; danger?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} width="max-w-sm">
      <p className="text-[13px] text-slate-600">{message}</p>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button variant={danger ? "danger" : "primary"} onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</Button>
      </div>
    </Modal>
  );
}

// ---------- Page header ----------
export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-0.5 text-[13px] text-slate-500">{subtitle}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

// ---------- Empty state ----------
export function EmptyState({ icon: Icon, title, subtitle, action }: {
  icon: React.ComponentType<{ className?: string }>; title: string; subtitle?: string; action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-brand-50">
        <Icon className="h-5 w-5 text-brand-700" />
      </div>
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {subtitle && <p className="mt-1 max-w-sm text-xs text-slate-500">{subtitle}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ---------- Stat tile ----------
export function StatTile({ label, value, sub, icon: Icon, tone = "default" }: {
  label: string; value: ReactNode; sub?: ReactNode; icon?: React.ComponentType<{ className?: string }>;
  tone?: "default" | "good" | "warn" | "bad";
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        {Icon && (
          <div className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg",
            tone === "good" && "bg-emerald-50 text-emerald-600",
            tone === "warn" && "bg-amber-50 text-amber-600",
            tone === "bad" && "bg-rose-50 text-rose-600",
            tone === "default" && "bg-brand-50 text-brand-700",
          )}>
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
      <p className="mt-2 text-xl font-bold tracking-tight text-slate-900">{value}</p>
      {sub && <div className="mt-1 text-[11px] text-slate-500">{sub}</div>}
    </Card>
  );
}

// ---------- Tabs ----------
export function Tabs({ tabs, active, onChange, className }: {
  tabs: { key: string; label: string; count?: number }[]; active: string; onChange: (k: string) => void; className?: string;
}) {
  return (
    <div className={cn("flex gap-1 overflow-x-auto border-b border-slate-200", className)}>
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={cn(
            "-mb-px whitespace-nowrap border-b-2 px-3.5 py-2 text-[13px] font-medium transition-colors",
            active === t.key ? "border-brand-600 text-brand-800" : "border-transparent text-slate-500 hover:text-slate-700",
          )}
        >
          {t.label}
          {t.count !== undefined && (
            <span className={cn("ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold", active === t.key ? "bg-brand-100 text-brand-800" : "bg-slate-100 text-slate-500")}>
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ---------- Table ----------
export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full text-left text-[13px]">{children}</table>
    </div>
  );
}
export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return <th className={cn("border-b border-slate-200 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500", className)}>{children}</th>;
}
export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cn("border-b border-slate-100 px-3 py-2.5 align-middle text-slate-700", className)}>{children}</td>;
}

// ---------- Demo banner ----------
export function DemoPill({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800", className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
      Demo data
    </span>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-16 text-slate-500">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
      {label && <span className="ml-3 text-[13px]">{label}</span>}
    </div>
  );
}
