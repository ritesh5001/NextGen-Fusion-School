import { describe, it, expect } from "vitest";
import { hasPerm } from "@/lib/permissions.server";

describe("permissions.hasPerm (RBAC matching)", () => {
  it("matches exact permission keys", () => {
    expect(hasPerm(["students.read"], "students.read")).toBe(true);
    expect(hasPerm(["students.read"], "students.create")).toBe(false);
  });

  it("honors module wildcards", () => {
    expect(hasPerm(["students.*"], "students.create")).toBe(true);
    expect(hasPerm(["students.*"], "students.delete")).toBe(true);
    expect(hasPerm(["students.*"], "fees.read")).toBe(false);
  });

  it("honors the global wildcard (admin)", () => {
    expect(hasPerm(["*"], "anything.delete")).toBe(true);
  });

  it("denies with an empty permission set", () => {
    expect(hasPerm([], "students.read")).toBe(false);
  });

  it("models the accountant fee-collection workflow", () => {
    // accountant template: fees.*, accounts.*, payroll.*, reports.read, students.read
    const accountant = ["fees.*", "accounts.*", "payroll.*", "reports.read", "students.read"];
    expect(hasPerm(accountant, "fees.create")).toBe(true); // record a payment
    expect(hasPerm(accountant, "students.read")).toBe(true); // pick a student
    expect(hasPerm(accountant, "students.delete")).toBe(false); // but not edit them
    expect(hasPerm(accountant, "marks.update")).toBe(false); // and not touch grades
  });
});
