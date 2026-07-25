import { describe, it, expect } from "vitest";
import { formatCurrency, formatCurrencyCompact } from "@/lib/currency";

describe("currency", () => {
  it("formats with Indian digit grouping", () => {
    expect(formatCurrency(100000)).toBe("₹1,00,000");
    expect(formatCurrency(1234567)).toBe("₹12,34,567");
    expect(formatCurrency(0)).toBe("₹0");
    expect(formatCurrency(999)).toBe("₹999");
  });

  it("rounds fractional inputs", () => {
    expect(formatCurrency(100.6)).toBe("₹101");
  });

  it("uses a custom symbol", () => {
    expect(formatCurrency(1000, "$")).toBe("$1,000");
  });

  it("compacts large amounts (L / Cr / K)", () => {
    expect(formatCurrencyCompact(4210000)).toBe("₹42.1L");
    expect(formatCurrencyCompact(12000000)).toBe("₹1.2Cr");
    expect(formatCurrencyCompact(5000)).toBe("₹5.0K");
    expect(formatCurrencyCompact(500)).toBe("₹500");
  });
});
