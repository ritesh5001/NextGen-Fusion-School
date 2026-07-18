import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { getPublicTeacher } from "@/lib/portal.functions";
import { GraduationCap, Mail, Phone, Calendar } from "lucide-react";

export const Route = createFileRoute("/teachers/$slug/$teacherId")({
  component: PublicTeacherProfile,
  loader: async ({ params }) => {
    try {
      const data = (await getPublicTeacher({
        data: { tenantSlug: params.slug, teacherId: params.teacherId },
      })) as {
        tenant: { id: string; name: string };
        teacher: {
          id: string;
          employeeCode: string;
          firstName: string;
          lastName: string | null;
          qualification: string | null;
          designation: string | null;
          email: string | null;
          phone: string | null;
          joinedOn: string | Date | null;
        };
        assignments: { subjectName: string; className: string }[];
      };
      return data;
    } catch {
      throw notFound();
    }
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const { teacher, tenant } = loaderData;
    const name = `${teacher.firstName} ${teacher.lastName ?? ""}`.trim();
    const title = `${name} — ${tenant.name}`;
    const desc = teacher.designation
      ? `${teacher.designation}${teacher.qualification ? " · " + teacher.qualification : ""} at ${tenant.name}.`
      : `Faculty profile at ${tenant.name}.`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "profile" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
      Teacher not found.
    </div>
  ),
  errorComponent: () => (
    <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
      Unable to load teacher profile.
    </div>
  ),
});

function PublicTeacherProfile() {
  const { tenant, teacher, assignments } = Route.useLoaderData();
  const name = `${teacher.firstName} ${teacher.lastName ?? ""}`.trim();
  return (
    <div className="min-h-screen bg-surface-muted">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5">
          <Link to="/" className="font-display text-sm font-semibold tracking-tight">
            {tenant.name}
          </Link>
          <div className="text-xs text-muted-foreground">Faculty</div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-12">
        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          <div className="flex items-start gap-6">
            <div className="flex size-20 items-center justify-center rounded-full bg-primary/15 text-primary">
              <GraduationCap className="size-8" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-3xl font-semibold tracking-tight">{name}</h1>
              <div className="mt-1 text-sm text-muted-foreground">
                {teacher.designation ?? "Faculty"}
                {teacher.qualification ? ` · ${teacher.qualification}` : ""}
              </div>
              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                {teacher.email && (
                  <span className="inline-flex items-center gap-2">
                    <Mail className="size-4" />
                    {teacher.email}
                  </span>
                )}
                {teacher.phone && (
                  <span className="inline-flex items-center gap-2">
                    <Phone className="size-4" />
                    {teacher.phone}
                  </span>
                )}
                {teacher.joinedOn && (
                  <span className="inline-flex items-center gap-2">
                    <Calendar className="size-4" />
                    Joined {new Date(teacher.joinedOn as string).toLocaleDateString()}
                  </span>
                )}
                <span className="inline-flex items-center gap-2">
                  Emp. #{teacher.employeeCode}
                </span>
              </div>
            </div>
          </div>
        </div>

        <section className="mt-8">
          <h2 className="font-display text-lg font-semibold">Teaching assignments</h2>
          {assignments.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              No active teaching assignments.
            </p>
          ) : (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {assignments.map((a, i) => (
                <li
                  key={i}
                  className="rounded-lg border border-border bg-card px-4 py-3 text-sm"
                >
                  <div className="font-medium">{a.subjectName}</div>
                  <div className="text-xs text-muted-foreground">{a.className}</div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
