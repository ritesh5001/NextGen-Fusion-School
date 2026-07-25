import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, ArrowRight, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { usePlan } from "@/lib/use-plan";
import {
  PLAN_TIERS,
  PLAN_FEATURES,
  PLAN_RANK,
  PLAN_LABELS,
  type PlanTier,
} from "@/lib/plans";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/upgrade")({
  component: UpgradePage,
});

const ACCENT: Record<PlanTier, string> = {
  starter: "border-border",
  pro: "border-primary/50 ring-1 ring-primary/20",
  max: "border-amber-500/50 ring-1 ring-amber-500/20",
};

function UpgradePage() {
  const { plan, isSuperAdmin } = usePlan();
  const currentRank = PLAN_RANK[plan];

  return (
    <div className="p-8">
      <PageHeader
        title="Plans & Upgrade"
        description={
          isSuperAdmin
            ? "Overview of the three license tiers and what each unlocks."
            : `Your school is on the ${PLAN_LABELS[plan]} plan. Upgrade to unlock more of the platform.`
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {PLAN_TIERS.map((tier) => {
          const f = PLAN_FEATURES[tier];
          const rank = PLAN_RANK[tier];
          const isCurrent = !isSuperAdmin && tier === plan;
          const isIncluded = !isSuperAdmin && rank < currentRank;
          const isUpgrade = !isSuperAdmin && rank > currentRank;
          return (
            <div
              key={tier}
              className={cn(
                "flex flex-col rounded-2xl border bg-card p-6 shadow-sm",
                isCurrent ? ACCENT[tier] : "border-border",
              )}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-display text-xl font-semibold tracking-tight">
                  {f.label}
                </h3>
                {isCurrent && (
                  <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary ring-1 ring-primary/25">
                    Current
                  </span>
                )}
                {isIncluded && (
                  <span className="rounded-full bg-success/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-success">
                    Included
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{f.tagline}</p>

              <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                {f.highlights.map((h) => (
                  <li key={h} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-6">
                {isUpgrade ? (
                  <Link
                    to="/app/settings"
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
                  >
                    Upgrade to {f.label} <ArrowRight className="size-4" />
                  </Link>
                ) : isCurrent ? (
                  <div className="rounded-md border border-border px-4 py-2 text-center text-sm text-muted-foreground">
                    Your current plan
                  </div>
                ) : (
                  <div className="rounded-md px-4 py-2 text-center text-sm text-muted-foreground">
                    {isSuperAdmin ? " " : "Included in your plan"}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!isSuperAdmin && plan !== "max" && (
        <div className="mt-8 flex flex-wrap items-center gap-3 rounded-2xl border border-primary/25 bg-gradient-to-r from-primary/10 to-transparent p-6">
          <Sparkles className="size-5 text-primary" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">How upgrading works</div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Contact NextGen Fusion to purchase a higher tier. You&apos;ll receive a
              new license key — activate it under{" "}
              <Link to="/app/settings" className="font-medium text-primary hover:underline">
                Settings → Deployment license
              </Link>{" "}
              and the new modules unlock instantly.
            </p>
          </div>
          <a
            href="https://nextgenfusion.in"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            Contact sales <ArrowRight className="size-4" />
          </a>
        </div>
      )}
    </div>
  );
}
