/**
 * Client auth store — persists tokens + user in localStorage and exposes
 * a tiny observable API for React components.
 */
export type SessionUser = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  tenantId: string | null;
  isSuperAdmin: boolean;
  perms: string[];
  roleKeys?: string[];
  tenant?: { id: string; name: string; slug: string; plan: string } | null;
};

type Session = {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
} | null;

const KEY = "sms.session.v1";
type Listener = (s: Session) => void;
const listeners = new Set<Listener>();
let current: Session = null;

function read(): Session {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function initSession() {
  current = read();
}

export function getSession(): Session {
  return current;
}

export function getAccessToken(): string | null {
  return current?.accessToken ?? null;
}

export function setSession(s: Session) {
  current = s;
  if (typeof window !== "undefined") {
    if (s) window.localStorage.setItem(KEY, JSON.stringify(s));
    else window.localStorage.removeItem(KEY);
  }
  listeners.forEach((l) => l(current));
}

export function subscribeSession(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function hasPermission(key: string): boolean {
  const u = current?.user;
  if (!u) return false;
  if (u.isSuperAdmin || u.perms.includes("*")) return true;
  if (u.perms.includes(key)) return true;
  const [mod] = key.split(".");
  return u.perms.includes(`${mod}.*`);
}
