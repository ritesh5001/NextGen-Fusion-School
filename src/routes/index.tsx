import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { getInstallStatus } from "@/lib/setup.functions";
import { SchoolSiteView } from "./school.$slug";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NextGen Fusion School" },
      {
        name: "description",
        content:
          "A complete school management system — students, teachers, attendance, exams, fees, HR, payroll, hostel, library, and more.",
      },
      { property: "og:title", content: "NextGen Fusion School" },
      {
        property: "og:description",
        content: "A complete, modern school ERP.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "installed"; slug: string }
    | { status: "empty" }
  >({ status: "loading" });

  useEffect(() => {
    getInstallStatus()
      .then((s) => {
        if (s.installed && s.institution?.slug) {
          setState({ status: "installed", slug: s.institution.slug });
        } else {
          setState({ status: "empty" });
        }
      })
      .catch(() => setState({ status: "empty" }));
  }, []);

  if (state.status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  // Installed — render the school's public website inline at the root domain.
  // The site's own header includes a Login button.
  if (state.status === "installed") {
    return <SchoolSiteView slug={state.slug} />;
  }

  // Not installed yet — show a minimal setup CTA.
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-6">
      <div className="max-w-lg text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-muted px-3 py-1 text-xs text-muted-foreground">
          NextGen Fusion School
        </div>
        <h1 className="mt-6 font-display text-4xl font-semibold tracking-tight">
          Let's set up your school
        </h1>
        <p className="mt-4 text-muted-foreground">
          Complete the one-time installation to activate your school's public
          website and admin workspace.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link
            to="/setup"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
          >
            Complete setup <ArrowRight className="size-4" />
          </Link>
          <Link
            to="/auth/login"
            className="inline-flex items-center rounded-md border border-border px-5 py-2.5 text-sm font-medium hover:border-border-strong"
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
