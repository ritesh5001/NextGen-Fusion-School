/**
 * Per-tenant theme runtime.
 * A theme is a small JSON blob (preset name + optional overrides). Applied
 * by mutating CSS custom properties on <html>. Cached in localStorage per
 * tenant slug so pages hydrate without a colour flash.
 */

export type ThemeMode = "light" | "dark" | "system";

export type TenantTheme = {
  preset: PresetKey;
  mode: ThemeMode;
  radius: number; // rem
};

export const DEFAULT_THEME: TenantTheme = {
  preset: "emerald",
  mode: "light",
  radius: 0.625,
};

type Palette = {
  primary: string;
  primaryFg: string;
  ring: string;
  accent: string;
  accentFg: string;
  // dark counterparts
  darkPrimary: string;
  darkPrimaryFg: string;
  darkRing: string;
  darkAccent: string;
  darkAccentFg: string;
};

export const PRESETS = {
  emerald: {
    label: "Emerald",
    swatch: "#0f6b4f",
    primary: "oklch(0.38 0.09 165)",
    primaryFg: "oklch(0.985 0.002 60)",
    ring: "oklch(0.38 0.09 165)",
    accent: "oklch(0.94 0.02 165)",
    accentFg: "oklch(0.28 0.06 165)",
    darkPrimary: "oklch(0.7 0.13 165)",
    darkPrimaryFg: "oklch(0.16 0.03 165)",
    darkRing: "oklch(0.7 0.13 165)",
    darkAccent: "oklch(0.28 0.04 165)",
    darkAccentFg: "oklch(0.92 0.05 165)",
  },
  indigo: {
    label: "Indigo",
    swatch: "#3730a3",
    primary: "oklch(0.42 0.16 275)",
    primaryFg: "oklch(0.985 0.002 60)",
    ring: "oklch(0.42 0.16 275)",
    accent: "oklch(0.94 0.03 275)",
    accentFg: "oklch(0.3 0.1 275)",
    darkPrimary: "oklch(0.72 0.15 275)",
    darkPrimaryFg: "oklch(0.16 0.04 275)",
    darkRing: "oklch(0.72 0.15 275)",
    darkAccent: "oklch(0.28 0.06 275)",
    darkAccentFg: "oklch(0.92 0.05 275)",
  },
  sapphire: {
    label: "Sapphire",
    swatch: "#1d4ed8",
    primary: "oklch(0.44 0.16 245)",
    primaryFg: "oklch(0.985 0.002 60)",
    ring: "oklch(0.44 0.16 245)",
    accent: "oklch(0.94 0.03 245)",
    accentFg: "oklch(0.3 0.1 245)",
    darkPrimary: "oklch(0.72 0.15 245)",
    darkPrimaryFg: "oklch(0.16 0.04 245)",
    darkRing: "oklch(0.72 0.15 245)",
    darkAccent: "oklch(0.28 0.06 245)",
    darkAccentFg: "oklch(0.92 0.05 245)",
  },
  amber: {
    label: "Amber",
    swatch: "#b45309",
    primary: "oklch(0.55 0.15 65)",
    primaryFg: "oklch(0.985 0.002 60)",
    ring: "oklch(0.55 0.15 65)",
    accent: "oklch(0.95 0.04 75)",
    accentFg: "oklch(0.35 0.11 65)",
    darkPrimary: "oklch(0.78 0.15 75)",
    darkPrimaryFg: "oklch(0.2 0.04 65)",
    darkRing: "oklch(0.78 0.15 75)",
    darkAccent: "oklch(0.3 0.06 65)",
    darkAccentFg: "oklch(0.92 0.05 75)",
  },
  crimson: {
    label: "Crimson",
    swatch: "#b91c1c",
    primary: "oklch(0.48 0.19 25)",
    primaryFg: "oklch(0.985 0.002 60)",
    ring: "oklch(0.48 0.19 25)",
    accent: "oklch(0.94 0.03 25)",
    accentFg: "oklch(0.32 0.12 25)",
    darkPrimary: "oklch(0.72 0.18 25)",
    darkPrimaryFg: "oklch(0.16 0.04 25)",
    darkRing: "oklch(0.72 0.18 25)",
    darkAccent: "oklch(0.3 0.08 25)",
    darkAccentFg: "oklch(0.92 0.05 25)",
  },
  violet: {
    label: "Violet",
    swatch: "#7c3aed",
    primary: "oklch(0.5 0.2 300)",
    primaryFg: "oklch(0.985 0.002 60)",
    ring: "oklch(0.5 0.2 300)",
    accent: "oklch(0.94 0.03 300)",
    accentFg: "oklch(0.32 0.12 300)",
    darkPrimary: "oklch(0.74 0.17 300)",
    darkPrimaryFg: "oklch(0.16 0.04 300)",
    darkRing: "oklch(0.74 0.17 300)",
    darkAccent: "oklch(0.3 0.08 300)",
    darkAccentFg: "oklch(0.92 0.05 300)",
  },
  slate: {
    label: "Slate",
    swatch: "#1f2937",
    primary: "oklch(0.28 0.02 260)",
    primaryFg: "oklch(0.985 0.002 60)",
    ring: "oklch(0.28 0.02 260)",
    accent: "oklch(0.94 0.005 260)",
    accentFg: "oklch(0.3 0.02 260)",
    darkPrimary: "oklch(0.85 0.01 260)",
    darkPrimaryFg: "oklch(0.16 0.02 260)",
    darkRing: "oklch(0.85 0.01 260)",
    darkAccent: "oklch(0.28 0.01 260)",
    darkAccentFg: "oklch(0.92 0.01 260)",
  },
  teal: {
    label: "Teal",
    swatch: "#0f766e",
    primary: "oklch(0.44 0.11 190)",
    primaryFg: "oklch(0.985 0.002 60)",
    ring: "oklch(0.44 0.11 190)",
    accent: "oklch(0.94 0.03 190)",
    accentFg: "oklch(0.3 0.08 190)",
    darkPrimary: "oklch(0.72 0.13 190)",
    darkPrimaryFg: "oklch(0.16 0.03 190)",
    darkRing: "oklch(0.72 0.13 190)",
    darkAccent: "oklch(0.28 0.05 190)",
    darkAccentFg: "oklch(0.92 0.05 190)",
  },
} as const satisfies Record<string, Palette & { label: string; swatch: string }>;

export type PresetKey = keyof typeof PRESETS;

export function parseTheme(json: string | null | undefined): TenantTheme {
  if (!json) return DEFAULT_THEME;
  try {
    const raw = JSON.parse(json) as Partial<TenantTheme>;
    return {
      preset: raw.preset && raw.preset in PRESETS ? raw.preset : DEFAULT_THEME.preset,
      mode: raw.mode === "dark" || raw.mode === "system" ? raw.mode : "light",
      radius: typeof raw.radius === "number" ? Math.min(1.2, Math.max(0, raw.radius)) : DEFAULT_THEME.radius,
    };
  } catch {
    return DEFAULT_THEME;
  }
}

export function serializeTheme(t: TenantTheme): string {
  return JSON.stringify(t);
}

function prefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;
}

export function applyTheme(theme: TenantTheme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const p = PRESETS[theme.preset];
  const dark = theme.mode === "dark" || (theme.mode === "system" && prefersDark());

  root.style.setProperty("--radius", `${theme.radius}rem`);
  if (dark) {
    root.classList.add("dark");
    root.style.setProperty("--primary", p.darkPrimary);
    root.style.setProperty("--primary-foreground", p.darkPrimaryFg);
    root.style.setProperty("--ring", p.darkRing);
    root.style.setProperty("--accent", p.darkAccent);
    root.style.setProperty("--accent-foreground", p.darkAccentFg);
  } else {
    root.classList.remove("dark");
    root.style.setProperty("--primary", p.primary);
    root.style.setProperty("--primary-foreground", p.primaryFg);
    root.style.setProperty("--ring", p.ring);
    root.style.setProperty("--accent", p.accent);
    root.style.setProperty("--accent-foreground", p.accentFg);
  }
}

const CACHE_PREFIX = "sms.theme.v1.";

export function cacheTheme(tenantSlug: string, theme: TenantTheme) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CACHE_PREFIX + tenantSlug, serializeTheme(theme));
  } catch {
    /* ignore */
  }
}

export function readCachedTheme(tenantSlug: string): TenantTheme | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_PREFIX + tenantSlug);
    return raw ? parseTheme(raw) : null;
  } catch {
    return null;
  }
}

/** Reset to the app's design-system defaults (removes inline overrides). */
export function resetThemeOverrides() {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  for (const v of ["--primary", "--primary-foreground", "--ring", "--accent", "--accent-foreground", "--radius"]) {
    root.style.removeProperty(v);
  }
  root.classList.remove("dark");
}
