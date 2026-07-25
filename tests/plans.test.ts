import { describe, it, expect } from "vitest";
import {
  planAtLeast,
  minPlanFor,
  planAllowsPath,
  toPlanTier,
  nextPlan,
} from "@/lib/plans";

describe("plans", () => {
  it("orders tiers", () => {
    expect(planAtLeast("max", "pro")).toBe(true);
    expect(planAtLeast("pro", "pro")).toBe(true);
    expect(planAtLeast("starter", "pro")).toBe(false);
    expect(planAtLeast("pro", "max")).toBe(false);
  });

  it("maps routes to min plan (exact and sub-paths)", () => {
    expect(minPlanFor("/app/exams")).toBe("pro");
    expect(minPlanFor("/app/exams/abc-123")).toBe("pro");
    expect(minPlanFor("/app/hrm")).toBe("max");
    expect(minPlanFor("/app/payroll/run")).toBe("max");
    expect(minPlanFor("/app/students")).toBe("starter");
    expect(minPlanFor("/app")).toBe("starter");
  });

  it("gates path access by plan", () => {
    expect(planAllowsPath("starter", "/app/exams")).toBe(false);
    expect(planAllowsPath("pro", "/app/exams")).toBe(true);
    expect(planAllowsPath("pro", "/app/hrm")).toBe(false);
    expect(planAllowsPath("max", "/app/hrm")).toBe(true);
    expect(planAllowsPath("starter", "/app/students")).toBe(true);
  });

  it("normalizes legacy / unknown plan values", () => {
    expect(toPlanTier("growth")).toBe("pro");
    expect(toPlanTier("premium")).toBe("max");
    expect(toPlanTier("pro")).toBe("pro");
    expect(toPlanTier(null)).toBe("starter");
    expect(toPlanTier(undefined)).toBe("starter");
    expect(toPlanTier("nonsense")).toBe("starter");
  });

  it("advances to the next tier", () => {
    expect(nextPlan("starter")).toBe("pro");
    expect(nextPlan("pro")).toBe("max");
    expect(nextPlan("max")).toBeNull();
  });
});
