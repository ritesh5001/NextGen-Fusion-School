import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Palette, Check, RotateCcw, Save, Sun, Moon, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { getSession } from "@/lib/session";
import {
  PRESETS,
  DEFAULT_THEME,
  applyTheme,
  cacheTheme,
  parseTheme,
  type PresetKey,
  type TenantTheme,
  type ThemeMode,
} from "@/lib/theme-client";
import { getMyTenantTheme, saveMyTenantTheme } from "@/lib/theme.functions";

export const Route = createFileRoute("/app/appearance")({
  head: () => ({
    meta: [
      { title: "Appearance — NextGen Fusion School" },
      { name: "description", content: "Customize your school workspace theme." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AppearancePage,
});

function AppearancePage() {
  const sess = getSession();
  const slug = sess?.user.tenant?.slug ?? "";

  const [theme, setTheme] = useState<TenantTheme>(DEFAULT_THEME);
  const [initial, setInitial] = useState<TenantTheme>(DEFAULT_THEME);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await getMyTenantTheme();
        const t = parseTheme(res.themeJson);
        setTheme(t);
        setInitial(t);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Live-preview every change
  useEffect(() => {
    if (!loading) applyTheme(theme);
  }, [theme, loading]);

  function update<K extends keyof TenantTheme>(key: K, value: TenantTheme[K]) {
    setTheme((t) => ({ ...t, [key]: value }));
    setSaved(false);
  }

  async function onSave() {
    setSaving(true);
    setSaved(false);
    try {
      await saveMyTenantTheme({ data: theme });
      if (slug) cacheTheme(slug, theme);
      setInitial(theme);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  function onRevert() {
    setTheme(initial);
    applyTheme(initial);
  }

  function onResetDefaults() {
    setTheme(DEFAULT_THEME);
  }

  const dirty = JSON.stringify(theme) !== JSON.stringify(initial);

  if (!sess?.user.tenantId) {
    return (
      <div className="p-8">
        <h1 className="font-display text-2xl">Appearance</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Theme customization is per-school. Sign in as a school user to configure a workspace theme.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            <Palette className="size-3.5" /> Workspace theme
          </div>
          <h1 className="mt-3 font-display text-3xl tracking-tight">Appearance</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Pick a colour palette, mode and corner radius. Changes apply to your entire school workspace — dashboard,
            public website and portals — and only to your school. Other schools on NextGen Fusion School keep their own themes.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" onClick={onRevert} disabled={!dirty || saving}>
            <RotateCcw className="mr-2 size-4" /> Revert
          </Button>
          <Button onClick={onSave} disabled={!dirty || saving}>
            <Save className="mr-2 size-4" /> {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </header>

      {saved && (
        <div className="mt-4 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-primary">
          Theme saved. Applied across your workspace.
        </div>
      )}

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium">Colour palette</Label>
            <p className="text-xs text-muted-foreground">Choose an accent identity for your workspace.</p>
          </div>
          <button
            onClick={onResetDefaults}
            className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Reset to NextGen defaults
          </button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {(Object.entries(PRESETS) as [PresetKey, (typeof PRESETS)[PresetKey]][]).map(([key, p]) => {
            const active = theme.preset === key;
            return (
              <button
                key={key}
                onClick={() => update("preset", key)}
                className={`group flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                  active
                    ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                    : "border-border bg-card hover:border-border-strong"
                }`}
              >
                <span
                  className="size-10 shrink-0 rounded-lg border border-border-strong"
                  style={{ background: p.swatch }}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{p.label}</div>
                  <div className="truncate text-[11px] text-muted-foreground">{p.swatch.toUpperCase()}</div>
                </div>
                {active && <Check className="size-4 text-primary" />}
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-10 grid gap-6 md:grid-cols-2">
        <div>
          <Label className="text-sm font-medium">Interface mode</Label>
          <p className="text-xs text-muted-foreground">Affects the workspace shell.</p>
          <div className="mt-3 inline-flex rounded-lg border border-border bg-card p-1">
            {([
              { key: "light", label: "Light", icon: Sun },
              { key: "dark", label: "Dark", icon: Moon },
              { key: "system", label: "System", icon: Monitor },
            ] as { key: ThemeMode; label: string; icon: typeof Sun }[]).map((opt) => {
              const active = theme.mode === opt.key;
              const Icon = opt.icon;
              return (
                <button
                  key={opt.key}
                  onClick={() => update("mode", opt.key)}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition ${
                    active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="size-3.5" /> {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Corner radius</Label>
            <span className="text-xs tabular-nums text-muted-foreground">{theme.radius.toFixed(2)} rem</span>
          </div>
          <p className="text-xs text-muted-foreground">Controls buttons, cards and inputs.</p>
          <input
            type="range"
            min={0}
            max={1.2}
            step={0.05}
            value={theme.radius}
            onChange={(e) => update("radius", Number(e.target.value))}
            className="mt-3 w-full accent-primary"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <div className="rounded-sm border border-border bg-card px-3 py-2 text-xs" style={{ borderRadius: `${theme.radius}rem` }}>
              Card sample
            </div>
            <button
              className="rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
              style={{ borderRadius: `${theme.radius}rem` }}
            >
              Button sample
            </button>
          </div>
        </div>
      </section>

      <section className="mt-10">
        <Label className="text-sm font-medium">Live preview</Label>
        <p className="text-xs text-muted-foreground">A quick look at core surfaces with the current theme.</p>
        <div className="mt-4 rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Dashboard</div>
              <div className="mt-1 font-display text-xl">Welcome back, {sess.user.firstName ?? "Admin"}</div>
            </div>
            <Button size="sm">Primary action</Button>
          </div>
          <div className="mt-6 grid grid-cols-3 gap-3">
            {[
              { l: "Students", v: "1,248" },
              { l: "Attendance", v: "94%" },
              { l: "Fees due", v: "₹1.2L" },
            ].map((c) => (
              <div key={c.l} className="rounded-xl border border-border bg-background p-4">
                <div className="text-xs text-muted-foreground">{c.l}</div>
                <div className="mt-1 font-display text-2xl">{c.v}</div>
              </div>
            ))}
          </div>
          <div className="mt-6 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs text-accent-foreground">
              <span className="size-1.5 rounded-full bg-primary" /> Accent tag
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary">
              Primary tint
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
