// Local demo store: loads seed on first run, persists to
// localStorage, notifies subscribers on change.
import type { DemoDB } from "./settings";
import { buildSeedDB } from "./seed";

const KEY = "solarops_demo_db_v1";

type Listener = () => void;
const listeners = new Set<Listener>();
let current: DemoDB | null = null;
let version = 0;

export function getDB(): DemoDB {
  if (current) return current;
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as DemoDB;
        if (parsed && Array.isArray(parsed.customers)) {
          current = parsed;
          return current;
        }
      }
    }
  } catch {
    // fall through to fresh seed
  }
  current = buildSeedDB().db;
  persist();
  return current;
}

function persist() {
  try {
    if (typeof localStorage !== "undefined" && current) {
      localStorage.setItem(KEY, JSON.stringify(current));
    }
  } catch (e) {
    console.warn("Demo persistence failed (storage full?)", e);
  }
}

export function mutate(fn: (db: DemoDB) => void) {
  const db = getDB();
  fn(db);
  version++;
  persist();
  listeners.forEach((l) => l());
}

export function subscribe(fn: Listener) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function getVersion() {
  return version;
}

export function resetDemoDB() {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(KEY);
  }
  current = null;
  getDB();
  version++;
  listeners.forEach((l) => l());
}

export type { DemoDB };
