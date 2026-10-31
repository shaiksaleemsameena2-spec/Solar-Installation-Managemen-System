// ============================================================
// SolarOps AI — Unified Authentication & User Management
// Supports:
// 1. Production Database: Supabase Auth & PostgreSQL
// 2. Local Database: Browser-persisted user registry & demo accounts
// ============================================================

import type { Role } from "@/types";
import { isSupabaseConfigured, supabaseSignUp, supabaseSignIn, supabaseSignOut } from "./supabase";
import { getDB, mutate } from "./store";
import { createCustomer } from "./api";

export interface Session {
  kind: "demo" | "supabase" | "registered";
  id?: string;
  name: string;
  email: string;
  role: Role;
  customerId?: string; // for customer role
}

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  role: Role;
  customerId?: string;
  password?: string;
  phone?: string;
  city?: string;
  createdAt: string;
}

const SESSION_KEY = "solarops_session";
const USERS_KEY = "solarops_registered_users";

export interface DemoUser {
  name: string;
  email: string;
  role: Role;
  customerId?: string;
}

export const DEMO_USERS: DemoUser[] = [
  { name: "Operations Manager (SuperAdmin)", email: "admin@demo.solarops", role: "superadmin" },
  { name: "Field Technician / Engineer (Staff)", email: "staff@demo.solarops", role: "staff" },
  { name: "Ramesh Gupta (Customer)", email: "customer@demo.solarops", role: "customer", customerId: "cust-01" },
];

let inMemoryUsers: UserAccount[] | null = null;
let inMemorySession: Session | null = null;

export function _resetAuthForTesting() {
  inMemoryUsers = [];
  inMemorySession = null;
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(USERS_KEY);
  }
}

/**
 * Retrieve current active session
 */
export function getSession(): Session | null {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(SESSION_KEY) : null;
    if (raw) return JSON.parse(raw) as Session;
  } catch {
    // fallback
  }
  return inMemorySession;
}

/**
 * Retrieve all registered users stored in the local database
 */
export function getRegisteredUsers(): UserAccount[] {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(USERS_KEY) : null;
    if (raw) return JSON.parse(raw) as UserAccount[];
  } catch {
    // fallback
  }
  return inMemoryUsers ?? [];
}

/**
 * Save user into local database registry
 */
function saveRegisteredUser(user: UserAccount): void {
  const existing = getRegisteredUsers();
  const filtered = existing.filter((u) => u.email.toLowerCase() !== user.email.toLowerCase());
  filtered.push(user);
  inMemoryUsers = filtered;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(USERS_KEY, JSON.stringify(filtered));
    }
  } catch {
    // ignore
  }
}

/**
 * Register a new account (Integrates with Supabase DB and Local DB)
 */
export async function registerAccount(params: {
  name: string;
  email: string;
  password: string;
  role: Role;
  phone?: string;
  city?: string;
}): Promise<Session> {
  const emailNorm = params.email.trim().toLowerCase();
  const nameNorm = params.name.trim();

  if (!emailNorm || !/.+@.+\..+/.test(emailNorm)) {
    throw new Error("Please enter a valid email address.");
  }
  if (!params.password || params.password.length < 6) {
    throw new Error("Password must be at least 6 characters long.");
  }
  if (!nameNorm) {
    throw new Error("Please enter your full name.");
  }

  // Check for duplicate in local registry
  const existingUsers = getRegisteredUsers();
  const duplicate = existingUsers.find((u) => u.email.toLowerCase() === emailNorm);
  if (duplicate) {
    throw new Error(`An account with email ${emailNorm} already exists. Please sign in.`);
  }

  let customerId: string | undefined = undefined;

  // If role is customer, create corresponding customer record in db.customers
  if (params.role === "customer") {
    try {
      const newCust = createCustomer({
        full_name: nameNorm,
        phone: params.phone || "+91 90000 00000",
        email: emailNorm,
        address: `${params.city || "Hyderabad"}, Telangana`,
        city: params.city || "Hyderabad",
        state: "Telangana",
        postal_code: "500081",
        customer_type: "residential",
        monthly_units: 300,
        monthly_bill: 2400,
        lead_source: "Self Registered Online",
        assigned_to: "Sales Executive — Alicia Dsouza",
        notes: "Account created via Create New Account portal.",
        lead_status: "won",
      });
      customerId = newCust.id;
    } catch {
      // If customer creation fails (e.g. duplicate phone), fallback to generated ID
      customerId = "cust-" + Date.now().toString().slice(-4);
    }
  }

  // 1. ALWAYS persist in local database registry
  // This guarantees the user can immediately log in from this browser regardless of email verification status
  const newUser: UserAccount = {
    id: "usr-" + Date.now(),
    name: nameNorm,
    email: emailNorm,
    role: params.role,
    customerId,
    password: params.password,
    phone: params.phone,
    city: params.city,
    createdAt: new Date().toISOString(),
  };

  saveRegisteredUser(newUser);

  // 2. Also register in Supabase cloud database if configured
  if (isSupabaseConfigured) {
    try {
      const res = await supabaseSignUp({
        name: nameNorm,
        email: emailNorm,
        password: params.password,
        role: params.role,
        phone: params.phone,
        city: params.city,
      });

      if (!res.error && res.profile) {
        newUser.id = res.profile.id;
        if (res.profile.customerId) {
          newUser.customerId = res.profile.customerId;
        }
        saveRegisteredUser(newUser);

        const session: Session = {
          kind: "supabase",
          id: res.profile.id,
          name: res.profile.name,
          email: res.profile.email,
          role: res.profile.role,
          customerId: res.profile.customerId || customerId,
        };

        inMemorySession = session;
        if (typeof localStorage !== "undefined") {
          localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        }
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("solarops-session"));
        }
        return session;
      }

      // If user already registered in Supabase, notify clearly
      if (res.error && res.error.toLowerCase().includes("already registered")) {
        throw new Error("An account with this email already exists in Supabase. Please sign in instead.");
      }

      console.warn("Supabase registration note:", res.error);
    } catch (err: any) {
      if (err.message && err.message.includes("already exists")) {
        throw err;
      }
      console.warn("Supabase network error, account registered in local database:", err.message);
    }
  }

  const session: Session = {
    kind: "registered",
    id: newUser.id,
    name: newUser.name,
    email: newUser.email,
    role: newUser.role,
    customerId: newUser.customerId,
  };

  inMemorySession = session;

  if (typeof localStorage !== "undefined") {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("solarops-session"));
  }
  return session;
}

/**
 * Authenticate existing user (Local DB, Supabase Auth, or Pre-seeded Demo)
 */
export async function authenticate(email: string, password: string): Promise<Session> {
  const emailNorm = email.trim().toLowerCase();

  // 1. Check predefined demo accounts first
  let demoUser = DEMO_USERS.find((u) => u.email.toLowerCase() === emailNorm);
  if (!demoUser && emailNorm === "superadmin@demo.solarops") {
    demoUser = DEMO_USERS[0];
  } else if (!demoUser && (emailNorm === "manager@demo.solarops")) {
    demoUser = DEMO_USERS[0];
  } else if (!demoUser && ["sales@demo.solarops", "inventory@demo.solarops", "installation@demo.solarops", "service@demo.solarops"].includes(emailNorm)) {
    demoUser = DEMO_USERS[1];
  }
  if (demoUser && (password === "demo1234" || password === "admin" || emailNorm.endsWith("@demo.solarops"))) {
    const session: Session = {
      kind: "demo",
      name: demoUser.name,
      email: demoUser.email,
      role: demoUser.role,
      customerId: demoUser.customerId,
    };
    inMemorySession = session;
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("solarops-session"));
    }
    return session;
  }

  // 2. Check local database registered accounts first
  // Instant authentication: ensures users can immediately sign in without being blocked by unconfirmed emails
  const localUsers = getRegisteredUsers();
  const foundUser = localUsers.find((u) => u.email.toLowerCase() === emailNorm);
  if (foundUser) {
    if (foundUser.password && foundUser.password !== password) {
      throw new Error("Incorrect password. Please try again.");
    }
    const session: Session = {
      kind: "registered",
      id: foundUser.id,
      name: foundUser.name,
      email: foundUser.email,
      role: foundUser.role,
      customerId: foundUser.customerId,
    };
    inMemorySession = session;
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("solarops-session"));
    }
    return session;
  }

  // 3. Supabase cloud auth (for accounts registered directly in Supabase or from other browsers)
  if (isSupabaseConfigured) {
    try {
      const res = await supabaseSignIn(emailNorm, password);
      if (!res.error && res.profile) {
        const session: Session = {
          kind: "supabase",
          id: res.profile.id,
          name: res.profile.name,
          email: res.profile.email,
          role: res.profile.role,
          customerId: res.profile.customerId,
        };

        // Cache locally for fast future sign-in
        saveRegisteredUser({
          id: res.profile.id,
          name: res.profile.name,
          email: res.profile.email,
          role: res.profile.role,
          customerId: res.profile.customerId,
          password,
          createdAt: new Date().toISOString(),
        });

        inMemorySession = session;
        if (typeof localStorage !== "undefined") {
          localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        }
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("solarops-session"));
        }
        return session;
      }

      if (res.error) {
        if (res.error.toLowerCase().includes("email not confirmed")) {
          throw new Error("Email confirmation pending. Please check your inbox for the Supabase confirmation email, or confirm your email to sign in.");
        }
        if (
          res.error.toLowerCase().includes("invalid login credentials") ||
          res.error.toLowerCase().includes("invalid email or password")
        ) {
          throw new Error("Incorrect password for this email. Please check your password and try again.");
        }
        if (!res.error.toLowerCase().includes("network error") && !res.error.toLowerCase().includes("fetch failed")) {
          throw new Error(res.error);
        }
      }
    } catch (err: any) {
      if (!err.message?.includes("fetch failed") && !err.message?.includes("network")) {
        throw err;
      }
      console.warn("Supabase auth offline/unreachable:", err.message);
    }
  }

  // 4. Fallback check for demo users if password was customized
  if (demoUser) {
    const session: Session = {
      kind: "demo",
      name: demoUser.name,
      email: demoUser.email,
      role: demoUser.role,
      customerId: demoUser.customerId,
    };
    inMemorySession = session;
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("solarops-session"));
    }
    return session;
  }

  throw new Error(`No account found with email "${emailNorm}". Please click 'Create Account' to sign up.`);
}

/**
 * Backward-compatible login helper for demo clicks
 */
export function login(email: string, role: Role, customerId?: string): Session {
  const u = DEMO_USERS.find((x) => x.email === email) ?? DEMO_USERS[0];
  const s: Session = { kind: "demo", name: u.name, email: u.email, role, customerId };
  inMemorySession = s;
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("solarops-session"));
  }
  return s;
}

/**
 * Logout
 */
export async function logout(): Promise<void> {
  inMemorySession = null;
  if (isSupabaseConfigured) {
    await supabaseSignOut();
  }
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(SESSION_KEY);
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("solarops-session"));
  }
}
