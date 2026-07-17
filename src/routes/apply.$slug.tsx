import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  getPublicSchool,
  submitAdmission,
} from "@/lib/admissions.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, GraduationCap } from "lucide-react";

export const Route = createFileRoute("/apply/$slug")({
  component: ApplyPage,
  head: ({ params }) => ({
    meta: [
      { title: `Apply for admission — ${params.slug}` },
      {
        name: "description",
        content:
          "Submit your online admission application. Fill in the applicant and guardian details to begin.",
      },
      { name: "robots", content: "index,follow" },
      { property: "og:title", content: "Online Admission Application" },
      {
        property: "og:description",
        content: "Apply for admission online.",
      },
    ],
  }),
});

type School = {
  tenant: { id: string; name: string; slug: string };
  classes: { id: string; name: string }[];
  currentYear: { id: string; name: string } | null;
};

function ApplyPage() {
  const { slug } = Route.useParams();
  const getSchool = useServerFn(getPublicSchool);
  const submit = useServerFn(submitAdmission);

  const [school, setSchool] = useState<School | null>(null);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState<{
    applicationNo: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    classAppliedId: "",
    firstName: "",
    lastName: "",
    gender: "" as "male" | "female" | "other" | "",
    dob: "",
    guardianName: "",
    guardianPhone: "",
    guardianEmail: "",
    address: "",
    previousSchool: "",
    remarks: "",
  });

  useEffect(() => {
    getSchool({ data: { slug } })
      .then((s) => setSchool(s as School))
      .catch((e) => setError(String(e)));
  }, [slug]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.firstName || !form.guardianPhone) {
      setError("Applicant name and guardian phone are required");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await submit({
        data: {
          tenantSlug: slug,
          classAppliedId: form.classAppliedId || null,
          firstName: form.firstName,
          lastName: form.lastName || null,
          gender: form.gender || null,
          dob: form.dob || null,
          guardianName: form.guardianName || null,
          guardianPhone: form.guardianPhone || null,
          guardianEmail: form.guardianEmail || null,
          address: form.address || null,
          previousSchool: form.previousSchool || null,
          remarks: form.remarks || null,
        },
      });
      setSubmitted({ applicationNo: res.applicationNo });
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  if (error && !school) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-3">
          <div className="text-2xl font-semibold">School not found</div>
          <div className="text-muted-foreground text-sm">
            The application link "/apply/{slug}" is invalid.
          </div>
        </div>
      </div>
    );
  }

  if (!school) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-lg border rounded-xl p-8 text-center space-y-4 bg-card">
          <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto" />
          <h1 className="text-2xl font-semibold">Application received</h1>
          <p className="text-muted-foreground">
            Thanks for applying to {school.tenant.name}. Your application
            number is:
          </p>
          <div className="text-2xl font-mono font-semibold bg-muted rounded-md py-3">
            {submitted.applicationNo}
          </div>
          <p className="text-sm text-muted-foreground">
            Please keep this number safe. The admissions team will contact you
            after review.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-primary/10 text-primary flex items-center justify-center">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <div className="font-semibold">{school.tenant.name}</div>
            <div className="text-xs text-muted-foreground">
              Online Admission Application
              {school.currentYear ? ` · ${school.currentYear.name}` : ""}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-6">
        <form
          onSubmit={onSubmit}
          className="bg-card border rounded-xl p-6 space-y-6"
        >
          <section className="space-y-4">
            <h2 className="font-semibold">Applicant details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>First name *</Label>
                <Input
                  required
                  value={form.firstName}
                  onChange={(e) =>
                    setForm({ ...form, firstName: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Last name</Label>
                <Input
                  value={form.lastName}
                  onChange={(e) =>
                    setForm({ ...form, lastName: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Gender</Label>
                <Select
                  value={form.gender}
                  onValueChange={(v) =>
                    setForm({
                      ...form,
                      gender: v as "male" | "female" | "other",
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Date of birth</Label>
                <Input
                  type="date"
                  value={form.dob}
                  onChange={(e) => setForm({ ...form, dob: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <Label>Applying for class</Label>
                <Select
                  value={form.classAppliedId}
                  onValueChange={(v) =>
                    setForm({ ...form, classAppliedId: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose class" />
                  </SelectTrigger>
                  <SelectContent>
                    {school.classes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label>Previous school</Label>
                <Input
                  value={form.previousSchool}
                  onChange={(e) =>
                    setForm({ ...form, previousSchool: e.target.value })
                  }
                />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="font-semibold">Guardian & contact</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Guardian name</Label>
                <Input
                  value={form.guardianName}
                  onChange={(e) =>
                    setForm({ ...form, guardianName: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Guardian phone *</Label>
                <Input
                  required
                  value={form.guardianPhone}
                  onChange={(e) =>
                    setForm({ ...form, guardianPhone: e.target.value })
                  }
                />
              </div>
              <div className="md:col-span-2">
                <Label>Guardian email</Label>
                <Input
                  type="email"
                  value={form.guardianEmail}
                  onChange={(e) =>
                    setForm({ ...form, guardianEmail: e.target.value })
                  }
                />
              </div>
              <div className="md:col-span-2">
                <Label>Address</Label>
                <Textarea
                  value={form.address}
                  onChange={(e) =>
                    setForm({ ...form, address: e.target.value })
                  }
                />
              </div>
              <div className="md:col-span-2">
                <Label>Remarks</Label>
                <Textarea
                  value={form.remarks}
                  onChange={(e) =>
                    setForm({ ...form, remarks: e.target.value })
                  }
                />
              </div>
            </div>
          </section>

          {error && (
            <div className="text-sm text-rose-600 bg-rose-500/10 rounded-md p-3">
              {error}
            </div>
          )}

          <div className="flex justify-end">
            <Button type="submit" disabled={busy} size="lg">
              {busy ? "Submitting…" : "Submit application"}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
