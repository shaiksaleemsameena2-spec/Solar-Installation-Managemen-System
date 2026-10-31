// ============================================================
// SolarOps AI — Supabase Database & Auth Client
// Dual-mode:
// 1. If VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY are set,
//    connects to real Supabase PostgreSQL DB and Auth.
// 2. If not set, runs in zero-credential local database mode
//    with full localStorage persistence and reactivity.
// ============================================================

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Role } from "@/types";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabaseAnonKey && supabaseUrl.trim() !== "" && supabaseAnonKey.trim() !== ""
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

export interface AuthProfile {
  id: string;
  name: string;
  email: string;
  role: Role;
  customerId?: string;
}

/**
 * Register a new user in Supabase (Auth + Profiles table + Customers table)
 */
export async function supabaseSignUp(params: {
  name: string;
  email: string;
  password: string;
  role: Role;
  phone?: string;
  city?: string;
}): Promise<{ profile: AuthProfile; error?: string }> {
  if (!supabase) {
    throw new Error("Supabase is not configured");
  }

  // 1. Create auth user in Supabase Auth
  const { data: authData, error: authErr } = await supabase.auth.signUp({
    email: params.email,
    password: params.password,
    options: {
      data: {
        name: params.name,
        role: params.role,
      },
    },
  });

  if (authErr || !authData.user) {
    return { profile: null as any, error: authErr?.message || "Registration failed in Supabase Auth" };
  }

  const userId = authData.user.id;
  let customerId: string | undefined = undefined;

  // 2. If role is 'customer', create corresponding customer row in public.customers
  if (params.role === "customer") {
    const { data: custData, error: custErr } = await supabase
      .from("customers")
      .insert({
        full_name: params.name,
        email: params.email,
        phone: params.phone || "+91 90000 00000",
        city: params.city || "Hyderabad",
        state: "Telangana",
        customer_type: "residential",
        lead_status: "new",
        notes: "Account self-registered online.",
      })
      .select("id")
      .single();

    if (!custErr && custData) {
      customerId = custData.id;
    }
  }

  // 3. Insert or update public.profiles
  const { error: profErr } = await supabase.from("profiles").upsert({
    id: userId,
    name: params.name,
    email: params.email,
    role: params.role,
    customer_id: customerId || null,
  });

  if (profErr) {
    console.warn("Could not write to public.profiles:", profErr);
  }

  return {
    profile: {
      id: userId,
      name: params.name,
      email: params.email,
      role: params.role,
      customerId,
    },
  };
}

/**
 * Sign in existing user with Supabase
 */
export async function supabaseSignIn(
  email: string,
  password: string,
): Promise<{ profile: AuthProfile; error?: string }> {
  if (!supabase) {
    throw new Error("Supabase is not configured");
  }

  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authErr || !authData.user) {
    return { profile: null as any, error: authErr?.message || "Invalid email or password" };
  }

  // Fetch role and details from public.profiles
  const { data: profData } = await supabase
    .from("profiles")
    .select("name, role, customer_id")
    .eq("id", authData.user.id)
    .single();

  const profile: AuthProfile = {
    id: authData.user.id,
    name: profData?.name || authData.user.user_metadata?.name || email.split("@")[0],
    email,
    role: (profData?.role || authData.user.user_metadata?.role || "customer") as Role,
    customerId: profData?.customer_id || undefined,
  };

  return { profile };
}

/**
 * Sign out from Supabase
 */
export async function supabaseSignOut(): Promise<void> {
  if (supabase) {
    await supabase.auth.signOut();
  }
}
