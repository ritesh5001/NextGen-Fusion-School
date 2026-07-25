import { describe, it, expect } from "vitest";
import { computeEntitlement, STUDENT_CAP } from "@/lib/entitlements.server";

const future = new Date(Date.now() + 5 * 86_400_000);
const past = new Date(Date.now() - 86_400_000);

describe("entitlements.computeEntitlement", () => {
  it("grants Max during an active trial regardless of licensed tier", () => {
    const e = computeEntitlement({
      plan: "starter",
      subscriptionStatus: "trialing",
      trialEndsAt: future,
    });
    expect(e.effectivePlan).toBe("max");
    expect(e.licensedPlan).toBe("starter");
    expect(e.trialActive).toBe(true);
    expect(e.trialDaysLeft).toBeGreaterThan(0);
    expect(e.studentCap).toBeNull(); // Max = unlimited during trial
  });

  it("falls back to the licensed tier once the trial expires", () => {
    const e = computeEntitlement({
      plan: "starter",
      subscriptionStatus: "trialing",
      trialEndsAt: past,
    });
    expect(e.effectivePlan).toBe("starter");
    expect(e.trialActive).toBe(false);
    expect(e.studentCap).toBe(STUDENT_CAP.starter);
  });

  it("uses the licensed tier when active (no trial)", () => {
    const e = computeEntitlement({
      plan: "pro",
      subscriptionStatus: "active",
      trialEndsAt: null,
    });
    expect(e.effectivePlan).toBe("pro");
    expect(e.trialActive).toBe(false);
    expect(e.studentCap).toBe(STUDENT_CAP.pro);
  });

  it("gives Max unlimited students", () => {
    const e = computeEntitlement({
      plan: "max",
      subscriptionStatus: "active",
      trialEndsAt: null,
    });
    expect(e.studentCap).toBeNull();
  });

  it("caps scale by tier", () => {
    expect(STUDENT_CAP.starter).toBe(500);
    expect(STUDENT_CAP.pro).toBe(2000);
    expect(STUDENT_CAP.max).toBeNull();
  });
});
