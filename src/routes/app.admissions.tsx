import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  listApplications,
  updateApplicationStatus,
  enrollApplication,
  deleteApplication,
} from "@/lib/admissions.functions";
import { listSections } from "@/lib/academic.functions";
import { getSession } from "@/lib/session";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Eye, Check, X, GraduationCap, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/app/admissions")({
  component: AdmissionsPage,
});

type Application = {
  id: string;
  applicationNo: string;
  firstName: string;
  lastName: string | null;
  classAppliedId: string | null;
  className: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  guardianEmail: string | null;
  gender: "male" | "female" | "other" | null;
  dob: string | null;
  address: string | null;
  previousSchool: string | null;
  remarks: string | null;
  status: "pending" | "under_review" | "approved" | "rejected" | "enrolled";
  reviewNote: string | null;
  submittedAt: string | Date;
  enrolledStudentId: string | null;
};

type Sec = { id: string; name: string; classId: string };

const statusColors: Record<Application["status"], string> = {
  pending: "bg-amber-500/15 text-amber-600",
  under_review: "bg-sky-500/15 text-sky-600",
  approved: "bg-emerald-500/15 text-emerald-600",
  rejected: "bg-rose-500/15 text-rose-600",
  enrolled: "bg-primary/15 text-primary",
};

function AdmissionsPage() {
  const listFn = useServerFn(listApplications);
  const updFn = useServerFn(updateApplicationStatus);
  const enrollFn = useServerFn(enrollApplication);
  const delFn = useServerFn(deleteApplication);
  const listS = useServerFn(listSections);

  const [rows, setRows] = useState<Application[]>([]);
  const [sections, setSections] = useState<Sec[]>([]);
  const [statusFilter, setStatusFilter] = useState<
    Application["status"] | "all"
  >("all");
  const [view, setView] = useState<Application | null>(null);
  const [enroll, setEnroll] = useState<Application | null>(null);
  const [enrollForm, setEnrollForm] = useState({
    sectionId: "",
    admissionNo: "",
    rollNo: "",
  });
  const [tenantSlug, setTenantSlug] = useState<string>("");

  async function refresh() {
    const r = await listFn({ data: { status: statusFilter } });
    setRows(r as unknown as Application[]);
  }
  useEffect(() => {
    refresh();
    listS({}).then((s) => setSections(s as Sec[]));
    const session = getSession();
    if (session?.tenant?.slug) setTenantSlug(session.tenant.slug);
  }, []);
  useEffect(() => {
    refresh();
  }, [statusFilter]);

  const filteredSections = useMemo(
    () =>
      enroll?.classAppliedId
        ? sections.filter((s) => s.classId === enroll.classAppliedId)
        : [],
    [sections, enroll],
  );

  const publicUrl = tenantSlug
    ? `${window.location.origin}/apply/${tenantSlug}`
    : "";

  async function setStatus(
    app: Application,
    status: "under_review" | "approved" | "rejected",
  ) {
    const note =
      status === "rejected"
        ? prompt("Reason for rejection (optional):") ?? ""
        : null;
    try {
      await updFn({ data: { id: app.id, status, reviewNote: note || null } });
      toast.success("Updated");
      refresh();
    } catch (e) {
      toast.error(String(e));
    }
  }

  async function submitEnroll() {
    if (!enroll) return;
    if (!enrollForm.sectionId || !enrollForm.admissionNo)
      return toast.error("Section and admission number required");
    try {
      await enrollFn({
        data: {
          id: enroll.id,
          sectionId: enrollForm.sectionId,
          admissionNo: enrollForm.admissionNo,
          rollNo: enrollForm.rollNo || null,
        },
      });
      toast.success("Enrolled");
      setEnroll(null);
      refresh();
    } catch (e) {
      toast.error(String(e));
    }
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Online Admissions"
        description="Public applications, review, and enrollment"
      />

      {publicUrl && (
        <div className="border rounded-lg p-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase text-muted-foreground tracking-wider">
              Public application URL
            </div>
            <a
              href={publicUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-mono text-primary hover:underline break-all"
            >
              {publicUrl}
            </a>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              navigator.clipboard.writeText(publicUrl);
              toast.success("Copied");
            }}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Copy link
          </Button>
        </div>
      )}

      <div className="flex justify-between">
        <div className="w-56">
          <Select
            value={statusFilter}
            onValueChange={(v) =>
              setStatusFilter(v as typeof statusFilter)
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="under_review">Under review</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="enrolled">Enrolled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Application #</TableHead>
              <TableHead>Applicant</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Guardian</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-mono text-xs">
                  {a.applicationNo}
                </TableCell>
                <TableCell>
                  <div className="font-medium">
                    {a.firstName} {a.lastName ?? ""}
                  </div>
                  <div className="text-xs text-muted-foreground capitalize">
                    {a.gender ?? "—"} · {a.dob ?? ""}
                  </div>
                </TableCell>
                <TableCell>{a.className ?? "—"}</TableCell>
                <TableCell>
                  <div>{a.guardianName ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">
                    {a.guardianPhone ?? ""}
                  </div>
                </TableCell>
                <TableCell className="text-xs">
                  {new Date(a.submittedAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <span
                    className={`text-xs px-2 py-0.5 rounded capitalize ${statusColors[a.status]}`}
                  >
                    {a.status.replace("_", " ")}
                  </span>
                </TableCell>
                <TableCell className="text-right space-x-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    title="View"
                    onClick={() => setView(a)}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  {a.status !== "enrolled" && (
                    <>
                      {a.status !== "approved" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Approve"
                          onClick={() => setStatus(a, "approved")}
                        >
                          <Check className="w-4 h-4 text-emerald-600" />
                        </Button>
                      )}
                      {a.status !== "rejected" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Reject"
                          onClick={() => setStatus(a, "rejected")}
                        >
                          <X className="w-4 h-4 text-rose-600" />
                        </Button>
                      )}
                      {a.status === "approved" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Enroll"
                          onClick={() => {
                            setEnroll(a);
                            setEnrollForm({
                              sectionId: "",
                              admissionNo: "",
                              rollNo: "",
                            });
                          }}
                        >
                          <GraduationCap className="w-4 h-4 text-primary" />
                        </Button>
                      )}
                    </>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={async () => {
                      if (!confirm("Delete application?")) return;
                      await delFn({ data: { id: a.id } });
                      refresh();
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!rows.length && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-muted-foreground py-8"
                >
                  No applications yet
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Application {view?.applicationNo}</DialogTitle>
          </DialogHeader>
          {view && (
            <div className="space-y-2 text-sm">
              <Row label="Name">
                {view.firstName} {view.lastName ?? ""}
              </Row>
              <Row label="Gender / DOB">
                {view.gender ?? "—"} · {view.dob ?? "—"}
              </Row>
              <Row label="Class applied">{view.className ?? "—"}</Row>
              <Row label="Guardian">
                {view.guardianName ?? "—"} — {view.guardianPhone ?? ""}
              </Row>
              <Row label="Email">{view.guardianEmail ?? "—"}</Row>
              <Row label="Address">{view.address ?? "—"}</Row>
              <Row label="Previous school">{view.previousSchool ?? "—"}</Row>
              <Row label="Remarks">{view.remarks ?? "—"}</Row>
              {view.reviewNote && (
                <Row label="Review note">{view.reviewNote}</Row>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setView(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!enroll} onOpenChange={(o) => !o && setEnroll(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enroll applicant</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm p-3 bg-muted rounded">
              <div className="font-medium">
                {enroll?.firstName} {enroll?.lastName ?? ""}
              </div>
              <div className="text-xs text-muted-foreground">
                {enroll?.applicationNo} · {enroll?.className ?? ""}
              </div>
            </div>
            <div>
              <Label>Section</Label>
              <Select
                value={enrollForm.sectionId}
                onValueChange={(v) =>
                  setEnrollForm({ ...enrollForm, sectionId: v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose section" />
                </SelectTrigger>
                <SelectContent>
                  {filteredSections.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Admission number</Label>
              <Input
                value={enrollForm.admissionNo}
                onChange={(e) =>
                  setEnrollForm({
                    ...enrollForm,
                    admissionNo: e.target.value,
                  })
                }
              />
            </div>
            <div>
              <Label>Roll number (optional)</Label>
              <Input
                value={enrollForm.rollNo}
                onChange={(e) =>
                  setEnrollForm({ ...enrollForm, rollNo: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEnroll(null)}>
              Cancel
            </Button>
            <Button onClick={submitEnroll}>Enroll student</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-2">
      <div className="w-32 text-muted-foreground shrink-0">{label}</div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

// avoid unused import lint
void Textarea;
