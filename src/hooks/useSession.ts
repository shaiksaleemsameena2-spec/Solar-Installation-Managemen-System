import { useSyncExternalStore } from "react";
import { getSession, logout, type Session } from "@/services/auth";

const sub = (cb: () => void) => {
  window.addEventListener("solarops-session", cb);
  return () => window.removeEventListener("solarops-session", cb);
};
const snap = () => JSON.stringify(getSession());

export function useSession(): Session | null {
  return useSyncExternalStore(sub, snap, snap) ? getSession() : null;
}

export { logout };

export function setSession(s: Session | null) {
  if (s) localStorage.setItem("solarops_session", JSON.stringify(s));
  else if (s === null) localStorage.removeItem("solarops_session");
  window.dispatchEvent(new Event("solarops-session"));
}
