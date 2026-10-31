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
  { name: "Admin (demo)", email: "admin@demo.solarops", role: "admin" },
  { name: "Alicia Dsouza (demo)", email: "sales@demo.solarops", role: "sales" },
  { name: "Farhan Storekeeper (demo)", email: "inventory@demo.solarops", role: "inventory" },
  { name: "Sunil Khanna (demo)", email: "installation@demo.solarops", role: "installation" },
  { name: "Mahesh K. (demo)", email: "service@demo.solarops", role: "service" },
  { name: "Ramesh Gupta (demo customer)", email: "customer@demo.solarops", role: "customer", customerId: "cust-01" },
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
 * Register a new account (Integrates with Supabase DB or Local DB)
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

  // 1. If Supabase is configured, register via cloud database
  if (isSupabaseConfigured) {
    const res = await supabaseSignUp({
      name: nameNorm,
      email: emailNorm,
      password: params.password,
      role: params.role,
      phone: params.phone,
      city: params.city,
    });

    if (res.error) {
      throw new Error(res.error);
    }

    const session: Session = {
      kind: "supabase",
      id: res.profile.id,
      name: res.profile.name,
      email: res.profile.email,
      role: res.profile.role,
      customerId: res.profile.customerId,
    };

    if (typeof localStorage !== "undefined") {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("solarops-session"));
    }
    return session;
  }

  // 2. Local Database Registration
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
        lead_status: "new",
      });
      customerId = newCust.id;
    } catch {
      // If customer creation fails (e.g. duplicate phone), fallback to random ID
      customerId = "cust-" + Date.now().toString().slice(-4);
    }
  }

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
 * Authenticate existing user (Supabase Auth or Local DB)
 */
export async function authenticate(email: string, password: string): Promise<Session> {
  const emailNorm = email.trim().toLowerCase();

  // 1. Supabase cloud auth
  if (isSupabaseConfigured) {
    const res = await supabaseSignIn(emailNorm, password);
    if (res.error) {
      throw new Error(res.error);
    }
    const session: Session = {
      kind: "supabase",
      id: res.profile.id,
      name: res.profile.name,
      email: res.profile.email,
      role: res.profile.role,
      customerId: res.profile.customerId,
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

  // 2. Check local database registered accounts
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

  // 3. Check demo predefined users
  const demoUser = DEMO_USERS.find((u) => u.email.toLowerCase() === emailNorm);
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

  throw new Error("No account found with this email. Please click 'Create Account' to sign up.");
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
