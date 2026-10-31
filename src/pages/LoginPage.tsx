import { useState } from "react";
import { useNavigate } from "react-router";
import { SunMedium, Eye, EyeOff, LogIn } from "lucide-react";
import { Button, Input, Label, Card, DemoPill } from "@/components/ui";
import { DEMO_USERS, login as persistSession } from "@/services/auth";
import { setSession } from "@/hooks/useSession";
import { useToast } from "@/components/toast";
import { DEMO_MODE } from "@/services";
import { AnimatedSolarSky } from "@/components/AnimatedSolarSky";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const toast = useToast();
  const navigate = useNavigate();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!/.+@.+\..+/.test(email)) return setError("Enter a valid email address.");
    if (password.length < 4) return setError("Password must be at least 4 characters (demo: any password works).");
    setBusy(true);
    const u = DEMO_USERS.find((x) => x.email === email);
    // Demo auth: password is not real. Real auth requires Supabase (never pretend otherwise).
    window.setTimeout(() => {
      setBusy(false);
      if (!u) {
        setError("No demo account with that email. Use one of the demo accounts listed below.");
        return;
      }
      setSession(persistSession(u.email, u.role, u.customerId));
      toast.success(`Signed in as ${u.name}`, DEMO_MODE ? "Demo mode — credentials are not verified." : undefined);
      navigate(u.role === "customer" ? "/portal" : "/dashboard");
    }, 350);
  };

  return (
    <AnimatedSolarSky className="min-h-screen p-4 flex items-center justify-center">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-2xl border border-white/40 bg-white/92 shadow-2xl backdrop-blur-xl md:grid-cols-2">
        {/* Brand side */}
        <div className="hidden flex-col justify-between bg-gradient-to-br from-emerald-950/90 via-emerald-900/85 to-brand-900/90 p-8 text-white backdrop-blur-md md:flex border-r border-white/10">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 border border-white/20 shadow-inner">
                <SunMedium className="h-6 w-6 text-lime-300 animate-pulse" />
              </div>
              <div>
                <p className="text-lg font-bold tracking-tight">SolarOps AI</p>
                <p className="text-xs text-brand-200">SunPower Solutions</p>
              </div>
            </div>
            <p className="mt-8 text-2xl font-bold leading-snug text-white">
              From First Lead to Lifetime Solar Service.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-emerald-100/90">
              Manage enquiries, site surveys, quotations, inventory, serial-numbered equipment,
              installations, warranties, service, payments and analytics — in one connected platform.
            </p>
          </div>
          <div className="flex items-center justify-between text-[11px] text-emerald-200/70 border-t border-white/10 pt-4">
            <span>© 2026 SunPower Solutions</span>
            <span>Live Solar Rooftop View</span>
          </div>
        </div>

        {/* Form side */}
        <div className="p-8 bg-white/95">
          <div className="mb-6 flex items-center justify-between md:hidden">
            <div className="flex items-center gap-2">
              <SunMedium className="h-5 w-5 text-brand-700" />
              <p className="text-base font-bold text-slate-900">SolarOps AI</p>
            </div>
            <DemoPill />
          </div>
          <h1 className="text-lg font-bold text-slate-900">Sign in</h1>
          <p className="mt-1 text-[13px] text-slate-500">Staff operations dashboard & customer portal.</p>
          <form onSubmit={submit} className="mt-5 space-y-3.5">
            <div>
              <Label required>Email</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@demo.solarops" autoComplete="username" />
            </div>
            <div>
              <Label required>Password</Label>
              <div className="relative">
                <Input
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="pr-9"
                />
                <button type="button" className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600" onClick={() => setShow(!show)} tabIndex={-1}>
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">{error}</p>}
            <Button type="submit" size="lg" className="w-full shadow-md" disabled={busy}>
              <LogIn className="h-4 w-4" /> {busy ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          {DEMO_MODE && (
            <div className="mt-6">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Demo accounts — click to fill</p>
              <div className="mt-2 space-y-1">
                {DEMO_USERS.map((u) => (
                  <button
                    key={u.email}
                    onClick={() => { setEmail(u.email); setPassword("demo1234"); }}
                    className="flex w-full items-center justify-between rounded-lg border border-slate-200/80 bg-white/70 px-3 py-2 text-left text-[12px] hover:border-brand-400 hover:bg-brand-50/70 transition shadow-xs"
                  >
                    <span>
                      <span className="font-semibold text-slate-700">{u.name}</span>
                      <span className="ml-2 text-slate-400">{u.email}</span>
                    </span>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold capitalize text-slate-500">{u.role}</span>
                  </button>
                ))}
              </div>
              <p className="mt-3 text-[11px] leading-snug text-slate-500">
                Demo authentication is clearly labeled and does NOT verify real credentials.
                Configure Supabase Auth in Settings → Environment for production login.
              </p>
            </div>
          )}
        </div>
      </div>
    </AnimatedSolarSky>
  );
}
