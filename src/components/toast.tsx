import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastKind = "success" | "error" | "info";
interface Toast { id: number; kind: ToastKind; title: string; body?: string }

const ToastCtx = createContext<{ push: (kind: ToastKind, title: string, body?: string) => void }>({
  push: () => undefined,
});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(1);
  const push = useCallback((kind: ToastKind, title: string, body?: string) => {
    const id = idRef.current++;
    setToasts((t) => [...t, { id, kind, title, body }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);
  const value = useMemo(() => ({ push }), [push]);
  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex w-80 flex-col gap-2 no-print">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "flex items-start gap-2.5 rounded-lg border bg-white p-3 shadow-lg animate-in",
              t.kind === "success" && "border-emerald-200",
              t.kind === "error" && "border-rose-200",
              t.kind === "info" && "border-slate-200",
            )}
          >
            {t.kind === "success" && <CheckCircle2 className="h-4.5 w-4.5 mt-0.5 shrink-0 text-emerald-600" />}
            {t.kind === "error" && <XCircle className="h-4.5 w-4.5 mt-0.5 shrink-0 text-rose-600" />}
            {t.kind === "info" && <Info className="h-4.5 w-4.5 mt-0.5 shrink-0 text-sky-600" />}
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-slate-800">{t.title}</p>
              {t.body && <p className="mt-0.5 text-xs text-slate-500 break-words">{t.body}</p>}
            </div>
            <button onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))} className="text-slate-400 hover:text-slate-600">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const { push } = useContext(ToastCtx);
  return {
    success: (title: string, body?: string) => push("success", title, body),
    error: (title: string, body?: string) => push("error", title, body),
    info: (title: string, body?: string) => push("info", title, body),
  };
}
