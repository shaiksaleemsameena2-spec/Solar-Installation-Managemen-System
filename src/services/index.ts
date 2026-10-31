import { useSyncExternalStore } from "react";
import { getDB, resetDemoDB, subscribe, getVersion } from "./store";
import * as api from "./api";
import type { DemoDB } from "./settings";

export const DEMO_MODE = !import.meta.env.VITE_SUPABASE_URL;

let snapshot: { v: number; db: DemoDB } | null = null;
function getSnapshot() {
  if (!snapshot || snapshot.v !== getVersion()) {
    snapshot = { v: getVersion(), db: getDB() };
  }
  return snapshot;
}
function subscribeWrap(cb: () => void) {
  return subscribe(cb);
}

/** Reactive access to the whole demo DB. */
export function useDB(): DemoDB {
  return useSyncExternalStore(subscribeWrap, getSnapshot, getSnapshot).db;
}

export { api, resetDemoDB, getDB };
export type { DemoDB };
