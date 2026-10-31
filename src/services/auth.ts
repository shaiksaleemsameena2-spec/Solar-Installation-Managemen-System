// Demo auth — clearly labeled. In Supabase mode this would be
// replaced by supabase.auth. Persisted in localStorage.
import type { Role } from "@/types";

export interface Session {
  kind: "demo";
  name: string;
  email: string;
  role: Role;
  customerId?: string; // for customer role
}

const SKEY = "solarops_session";

export interface DemoUser {
  name: string;
  email: string;
  role: Role;
  customerId?: string; // for customer role
}

export const DEMO_USERS: DemoUser[] = [
  { name: "Admin (demo)", email: "admin@demo.solarops", role: "admin" as Role },
  { name: "Alicia Dsouza (demo)", email: "sales@demo.solarops", role: "sales" as Role },
  { name: "Farhan Storekeeper (demo)", email: "inventory@demo.solarops", role: "inventory" as Role },
  { name: "Sunil Khanna (demo)", email: "installation@demo.solarops", role: "installation" as Role },
  { name: "Mahesh K. (demo)", email: "service@demo.solarops", role: "service" as Role },
  { name: "Ramesh Gupta (demo customer)", email: "customer@demo.solarops", role: "customer" as Role, customerId: "cust-01" },
] as const;

export function getSession(): Session | null {
  try {
    const raw = localStorage.getItem(SKEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function login(email: string, role: Role, customerId?: string): Session {
  const u = DEMO_USERS.find((x) => x.email === email) ?? DEMO_USERS[0];
  const s: Session = { kind: "demo", name: u.name, email: u.email, role, customerId };
  localStorage.setItem(SKEY, JSON.stringify(s));
  return s;
}

export function logout() {
  localStorage.removeItem(SKEY);
  // tell all subscribed components (useSession) that the session changed
  window.dispatchEvent(new Event("solarops-session"));
}
