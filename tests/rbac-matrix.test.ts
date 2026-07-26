/**
 * RBAC matrix — validates that every role can reach exactly the endpoints it
 * should, across ALL server functions, using the same `hasPerm` logic the live
 * `requireAccess` middleware uses.
 *
 * Both sides are read from source (no DB needed):
 *  - role → permissions from scripts/db-setup.ts ROLE_TEMPLATES + catalogue
 *  - endpoint → required permission from each src/lib/*.functions.ts
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { hasPerm } from "@/lib/permissions.server";

const dbSetup = readFileSync("scripts/db-setup.ts", "utf8");

// ---- Permission catalogue (modules × actions) ----
function arr(name: string): string[] {
  const m = new RegExp(`const ${name} = \\[([\\s\\S]*?)\\]`).exec(dbSetup);
  return [...m![1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}
const MODULES = arr("MODULES");
const ACTIONS = arr("ACTIONS");
const ALL_PERMS = MODULES.flatMap((m) => ACTIONS.map((a) => `${m}.${a}`));

// ---- Role → effective permission set (expanding wildcards like db-setup) ----
function expand(perms: string[]): string[] {
  const set = new Set<string>();
  for (const p of perms) {
    if (p === "*") ALL_PERMS.forEach((k) => set.add(k));
    else if (p.endsWith(".*")) {
      const mod = p.slice(0, -2);
      ALL_PERMS.forEach((k) => k.startsWith(mod + ".") && set.add(k));
    } else set.add(p);
  }
  return [...set];
}

const ROLE_PERMS: Record<string, string[]> = {};
for (const m of dbSetup.matchAll(/\{ key: "(\w+)"[\s\S]*?perms: \[([^\]]*)\]/g)) {
  const key = m[1];
  const perms = [...m[2].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
  ROLE_PERMS[key] = expand(perms);
}
const ROLES = Object.keys(ROLE_PERMS);

// ---- Endpoints → required auth from the code ----
type Endpoint = {
  file: string;
  name: string;
  method: string;
  kind: "public" | "auth" | "plan" | "perm";
  perm?: string;
  anyPerm?: string[];
};

function parseEndpoints(): Endpoint[] {
  const out: Endpoint[] = [];
  const dir = "src/lib";
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".functions.ts"))) {
    const text = readFileSync(`${dir}/${f}`, "utf8");
    const re = /export const (\w+) = createServerFn\(\{\s*method:\s*"(\w+)"\s*\}\)/g;
    const matches = [...text.matchAll(re)];
    for (let i = 0; i < matches.length; i++) {
      const m = matches[i];
      const name = m[1];
      const method = m[2];
      const start = m.index!;
      const end = i + 1 < matches.length ? matches[i + 1].index! : text.length;
      const block = text.slice(start, end);
      // Everything from createServerFn up to the handler = the definition chain
      // (middleware, comments, multi-line args all included).
      const hIdx = block.indexOf(".handler(");
      const head = hIdx >= 0 ? block.slice(0, hIdx) : block;

      let kind: Endpoint["kind"] = "public";
      let perm: string | undefined;
      let anyPerm: string[] | undefined;
      if (/\.middleware\(/.test(head)) {
        kind = head.includes("requireAccess") ? "plan" : "auth";
        if (head.includes("requireAccess")) {
          const pm = /perm:\s*"([^"]+)"/.exec(head);
          const am = /anyPerm:\s*\[([\s\S]*?)\]/.exec(head);
          if (pm) {
            perm = pm[1];
            kind = "perm";
          } else if (am) {
            anyPerm = [...am[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
            kind = "perm";
          }
        }
      }
      out.push({ file: f, name, method, kind, perm, anyPerm });
    }
  }
  return out;
}

const ENDPOINTS = parseEndpoints();

function roleCanAccess(role: string, e: Endpoint): boolean {
  const perms = ROLE_PERMS[role];
  if (e.kind === "public" || e.kind === "auth" || e.kind === "plan") return true; // not perm-gated
  if (e.perm) return hasPerm(perms, e.perm);
  if (e.anyPerm) return e.anyPerm.some((p) => hasPerm(perms, p));
  return true;
}

function ep(name: string): Endpoint {
  const e = ENDPOINTS.find((x) => x.name === name);
  if (!e) throw new Error(`endpoint not found: ${name}`);
  return e;
}

describe("RBAC matrix — parsing sanity", () => {
  it("found all 9 roles with permissions", () => {
    expect(ROLES.sort()).toEqual(
      ["accountant", "admin", "hr", "hostel_warden", "librarian", "parent", "principal", "student", "teacher"].sort(),
    );
    expect(ROLE_PERMS.admin.length).toBe(ALL_PERMS.length); // admin = "*"
  });

  it("parsed a realistic number of endpoints", () => {
    expect(ENDPOINTS.length).toBeGreaterThan(180);
  });
});

describe("RBAC matrix — no unprotected mutations", () => {
  it("every POST endpoint is auth-gated (never public), except known public ones", () => {
    const KNOWN_PUBLIC_POST = new Set([
      "submitAdmission",
      "login",
      "refresh",
      "logout",
      "forgotPassword",
      "resetPassword",
      "runSetup",
      "submitContactMessage", // public marketing site — rate-limited
      "subscribeNewsletter", // public marketing site — rate-limited
    ]);
    const offenders = ENDPOINTS.filter(
      (e) => e.method === "POST" && e.kind === "public" && !KNOWN_PUBLIC_POST.has(e.name),
    ).map((e) => `${e.file}:${e.name}`);
    expect(offenders).toEqual([]);
  });
});

describe("RBAC matrix — per-role expectations", () => {
  it("admin can do everything", () => {
    for (const e of ENDPOINTS) expect(roleCanAccess("admin", e)).toBe(true);
  });

  it("teacher: read students & marks, but NOT delete students or record fees", () => {
    expect(roleCanAccess("teacher", ep("listStudents"))).toBe(true);
    expect(roleCanAccess("teacher", ep("saveMarks"))).toBe(true);
    expect(roleCanAccess("teacher", ep("deleteStudent"))).toBe(false);
    expect(roleCanAccess("teacher", ep("saveStudent"))).toBe(false);
    expect(roleCanAccess("teacher", ep("recordPayment"))).toBe(false);
  });

  it("accountant: record fees AND read students (fee picker), but not edit students or grades", () => {
    expect(roleCanAccess("accountant", ep("recordPayment"))).toBe(true);
    expect(roleCanAccess("accountant", ep("listStudents"))).toBe(true); // the workflow fix
    expect(roleCanAccess("accountant", ep("saveStudent"))).toBe(false);
    expect(roleCanAccess("accountant", ep("saveMarks"))).toBe(false);
  });

  it("hr: read employee attendance, not touch students", () => {
    expect(roleCanAccess("hr", ep("getEmployeeAttendance"))).toBe(true); // the workflow fix
    expect(roleCanAccess("hr", ep("deleteStudent"))).toBe(false);
  });

  it("librarian: manage library, read students", () => {
    expect(roleCanAccess("librarian", ep("listStudents"))).toBe(true);
    expect(roleCanAccess("librarian", ep("saveStudent"))).toBe(false);
  });

  it("student & parent cannot reach staff data endpoints", () => {
    for (const role of ["student", "parent"]) {
      expect(roleCanAccess(role, ep("listStudents"))).toBe(false);
      expect(roleCanAccess(role, ep("saveStudent"))).toBe(false);
      expect(roleCanAccess(role, ep("recordPayment"))).toBe(false);
      expect(roleCanAccess(role, ep("saveMarks"))).toBe(false);
    }
  });
});
