/**
 * Reusable upsell primitives for the tiered SaaS experience.
 *
 * These let any Starter-accessible page surface the deeper Pro/Max capabilities
 * it connects to, with a consistent "upgrade" call-to-action that deep-links to
 * the Plans & Upgrade page.
 *
 *  - <PlanPill>        small tier badge
 *  - <UpgradeNudge>    slim inline banner ("X is available on the Pro plan")
 *  - <UpgradeCard>     full empty-state card with the tier's highlights
 *  - <FeatureGate>     render children only if the plan allows, else a fallback
 *  - <LockedButton>    a button that routes to upgrade instead of acting
 */
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Lock, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlan } from "@/lib/use-plan";
import { PLAN_FEATURES, PLAN_LABELS, type PlanTier } from "@/lib/plans";

const TIER_PILL: Record<PlanTier, string> = {
  starter: "bg-slate-500/10 text-slate-600 ring-slate-500/25 dark:text-slate-300",
  pro: "bg-primary/10 text-primary ring-primary/25",
  max: "bg-amber-500/10 text-amber-700 ring-amber-500/25 dark:text-amber-300",
};

export function PlanPill({ tier, className }: { tier: PlanTier; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1",
        TIER_PILL[tier],
        className,
      )}
    >
      {PLAN_LABELS[tier]}
    </span>
  );
}

/**
 * Slim inline banner. Renders nothing when the current plan already includes
 * the feature, so it's safe to drop into any page unconditionally.
 */
export function UpgradeNudge({
  requiredPlan,
  feature,
  className,
}: {
  requiredPlan: PlanTier;
  feature: string;
  className?: string;
}) {
  const { allows } = usePlan();
  if (allows(requiredPlan)) return null;
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-xl border border-primary/25 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-4 py-3",
        className,
      )}
    >
      <Sparkles className="size-4 shrink-0 text-primary" />
      <div className="min-w-0 flex-1 text-sm">
        <span className="font-medium">{feature}</span>{" "}
        <span className="text-muted-foreground">
          is part of the {PLAN_LABELS[requiredPlan]} plan.
        </span>
      </div>
      <PlanPill tier={requiredPlan} />
      <Link
        to="/app/upgrade"
        className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
      >
        Upgrade <ArrowRight className="size-3.5" />
      </Link>
    </div>
  );
}

/**
 * Full-width empty-state card, e.g. shown in place of a locked panel/section.
 */
export function UpgradeCard({
  requiredPlan,
  title,
  description,
  className,
}: {
  requiredPlan: PlanTier;
  title?: string;
  description?: string;
  className?: string;
}) {
  const feature = PLAN_FEATURES[requiredPlan];
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card p-8 text-center shadow-sm",
        className,
      )}
    >
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Lock className="size-6" />
      </div>
      <div className="mt-4 flex items-center justify-center gap-2">
        <h3 className="font-display text-lg font-semibold tracking-tight">
          {title ?? `${feature.label} plan feature`}
        </h3>
        <PlanPill tier={requiredPlan} />
      </div>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        {description ?? feature.tagline}
      </p>
      <ul className="mx-auto mt-5 grid max-w-md gap-2 text-left text-sm sm:grid-cols-2">
        {feature.highlights.map((h) => (
          <li key={h} className="flex items-start gap-2">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
            <span className="text-muted-foreground">{h}</span>
          </li>
        ))}
      </ul>
      <Link
        to="/app/upgrade"
        className="mt-6 inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
      >
        See upgrade options <ArrowRight className="size-4" />
      </Link>
    </div>
  );
}

/**
 * Renders `children` only when the plan allows `requiredPlan`; otherwise shows
 * `fallback` (defaults to an <UpgradeCard>). Super admins always pass.
 */
export function FeatureGate({
  requiredPlan,
  children,
  fallback,
}: {
  requiredPlan: PlanTier;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { allows } = usePlan();
  if (allows(requiredPlan)) return <>{children}</>;
  return <>{fallback ?? <UpgradeCard requiredPlan={requiredPlan} />}</>;
}

/**
 * A button that performs its action when the plan allows it, but routes to the
 * upgrade page (with a lock icon) when it doesn't. Use for actions that live on
 * a Starter page but unlock deeper Pro/Max behaviour.
 */
export function LockedButton({
  requiredPlan,
  onClick,
  children,
  className,
}: {
  requiredPlan: PlanTier;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
}) {
  const { allows } = usePlan();
  const base =
    "inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition";
  if (allows(requiredPlan)) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(base, "bg-primary text-primary-foreground hover:opacity-90", className)}
      >
        {children}
      </button>
    );
  }
  return (
    <Link
      to="/app/upgrade"
      title={`Available on the ${PLAN_LABELS[requiredPlan]} plan`}
      className={cn(
        base,
        "border border-border bg-surface-muted text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      <Lock className="size-3.5" />
      {children}
      <PlanPill tier={requiredPlan} className="ml-1" />
    </Link>
  );
}
