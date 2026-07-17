import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  listIdTemplates,
  saveIdTemplate,
  deleteIdTemplate,
  getIdCardBatch,
} from "@/lib/idcards.functions";
import { listClasses, listSections } from "@/lib/academic.functions";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Plus, Trash2, Pencil, Printer, IdCard } from "lucide-react";

export const Route = createFileRoute("/app/id-cards")({
  component: IdCardsPage,
});

type Template = {
  id: string;
  name: string;
  audience: string;
  orientation: string;
  widthMm: number;
  heightMm: number;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  logoUrl: string | null;
  showPhoto: boolean;
  showQr: boolean;
  footerText: string | null;
  isDefault: boolean;
};

type Cls = { id: string; name: string };
type Sec = { id: string; name: string; classId: string };

type Person = {
  id: string;
  code: string;
  firstName: string;
  lastName: string | null;
  photoUrl: string | null;
  className: string | null;
  sectionName: string | null;
  guardianPhone: string | null;
};

function IdCardsPage() {
  const listT = useServerFn(listIdTemplates);
  const saveT = useServerFn(saveIdTemplate);
  const delT = useServerFn(deleteIdTemplate);
  const getBatch = useServerFn(getIdCardBatch);
  const listC = useServerFn(listClasses);
  const listS = useServerFn(listSections);

  const [templates, setTemplates] = useState<Template[]>([]);
  const [classes, setClasses] = useState<Cls[]>([]);
  const [sections, setSections] = useState<Sec[]>([]);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Partial<Template> | null>(null);

  const [audience, setAudience] = useState<"student" | "teacher" | "employee">(
    "student",
  );
  const [selTpl, setSelTpl] = useState<string>("");
  const [classFilter, setClassFilter] = useState<string>("");
  const [sectionFilter, setSectionFilter] = useState<string>("");
  const [people, setPeople] = useState<Person[]>([]);
  const [tenantName, setTenantName] = useState<string>("");

  async function refresh() {
    const [t, c, s] = await Promise.all([listT(), listC(), listS({})]);
    setTemplates(t as Template[]);
    setClasses(c as Cls[]);
    setSections(s as Sec[]);
  }
  useEffect(() => {
    refresh();
  }, []);

  const filteredSections = useMemo(
    () =>
      classFilter
        ? sections.filter((s) => s.classId === classFilter)
        : sections,
    [sections, classFilter],
  );

  const activeTemplate = useMemo(
    () => templates.find((t) => t.id === selTpl) ?? null,
    [templates, selTpl],
  );

  async function loadBatch() {
    try {
      const res = await getBatch({
        data: {
          audience,
          classId: classFilter || undefined,
          sectionId: sectionFilter || undefined,
        },
      });
      setPeople(res.rows as Person[]);
      setTenantName(res.tenant?.name ?? "");
    } catch (e) {
      toast.error(String(e));
    }
  }

  async function submit() {
    if (!edit?.name) return toast.error("Name required");
    try {
      await saveT({
        data: {
          id: edit.id,
          name: edit.name!,
          audience: (edit.audience as "student") ?? "student",
          orientation:
            (edit.orientation as "portrait" | "landscape") ?? "portrait",
          widthMm: edit.widthMm ?? 54,
          heightMm: edit.heightMm ?? 86,
          accentColor: edit.accentColor ?? "#10b981",
          backgroundColor: edit.backgroundColor ?? "#ffffff",
          textColor: edit.textColor ?? "#0a0a0a",
          logoUrl: edit.logoUrl ?? null,
          showPhoto: edit.showPhoto ?? true,
          showQr: edit.showQr ?? true,
          footerText: edit.footerText ?? null,
          isDefault: edit.isDefault ?? false,
        },
      });
      toast.success("Saved");
      setOpen(false);
      setEdit(null);
      refresh();
    } catch (e) {
      toast.error(String(e));
    }
  }

  return (
    <div className="p-6 space-y-6 print:p-0 print:space-y-0">
      <div className="print:hidden">
        <PageHeader
          title="ID Cards"
          description="Design templates and print student, teacher, and staff cards in bulk"
        />
      </div>

      <Tabs defaultValue="print" className="print:hidden">
        <TabsList>
          <TabsTrigger value="print">Print</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="print" className="space-y-4">
          <div className="border rounded-lg p-4 grid grid-cols-1 md:grid-cols-5 gap-3">
            <div>
              <Label>Audience</Label>
              <Select
                value={audience}
                onValueChange={(v) => {
                  setAudience(v as typeof audience);
                  setPeople([]);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">Students</SelectItem>
                  <SelectItem value="teacher">Teachers</SelectItem>
                  <SelectItem value="employee">Employees</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Template</Label>
              <Select value={selTpl} onValueChange={setSelTpl}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick template" />
                </SelectTrigger>
                <SelectContent>
                  {templates
                    .filter((t) => t.audience === audience)
                    .map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                        {t.isDefault ? " (default)" : ""}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            {audience === "student" && (
              <>
                <div>
                  <Label>Class</Label>
                  <Select
                    value={classFilter}
                    onValueChange={(v) => {
                      setClassFilter(v === "all" ? "" : v);
                      setSectionFilter("");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All classes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All classes</SelectItem>
                      {classes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Section</Label>
                  <Select
                    value={sectionFilter}
                    onValueChange={(v) =>
                      setSectionFilter(v === "all" ? "" : v)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All sections" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All sections</SelectItem>
                      {filteredSections.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            <div className="flex items-end gap-2">
              <Button className="w-full" onClick={loadBatch}>
                Load
              </Button>
              <Button
                variant="outline"
                onClick={() => window.print()}
                disabled={!people.length || !activeTemplate}
              >
                <Printer className="w-4 h-4 mr-2" />
                Print
              </Button>
            </div>
          </div>

          {!activeTemplate && (
            <div className="border rounded-lg p-8 text-center text-muted-foreground">
              <IdCard className="w-8 h-8 mx-auto mb-2 opacity-40" />
              Choose a template to begin
            </div>
          )}

          {activeTemplate && people.length === 0 && (
            <div className="border rounded-lg p-8 text-center text-muted-foreground">
              Click Load to fetch cards
            </div>
          )}
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <div className="flex justify-end">
            <Button
              onClick={() => {
                setEdit({
                  audience: "student",
                  orientation: "portrait",
                  widthMm: 54,
                  heightMm: 86,
                  accentColor: "#10b981",
                  backgroundColor: "#ffffff",
                  textColor: "#0a0a0a",
                  showPhoto: true,
                  showQr: true,
                  isDefault: false,
                });
                setOpen(true);
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              New template
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((t) => (
              <div
                key={t.id}
                className="border rounded-lg p-4 space-y-3 hover:border-primary/40 transition"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold">{t.name}</div>
                    <div className="text-xs text-muted-foreground capitalize">
                      {t.audience} · {t.orientation} · {t.widthMm}×{t.heightMm}mm
                    </div>
                  </div>
                  {t.isDefault && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary uppercase tracking-wider">
                      Default
                    </span>
                  )}
                </div>
                <IdCardPreview
                  template={t}
                  person={{
                    id: "demo",
                    code: "STU-0001",
                    firstName: "Ananya",
                    lastName: "Sharma",
                    photoUrl: null,
                    className: "Grade 8",
                    sectionName: "A",
                    guardianPhone: "+91 98765 43210",
                  }}
                  tenantName={tenantName || "NextGen Fusion School"}
                />
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setEdit(t);
                      setOpen(true);
                    }}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={async () => {
                      if (!confirm("Delete template?")) return;
                      await delT({ data: { id: t.id } });
                      refresh();
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
            {!templates.length && (
              <div className="col-span-full text-center text-muted-foreground py-12 border rounded-lg">
                No templates yet
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Print sheet */}
      {activeTemplate && people.length > 0 && (
        <div className="flex flex-wrap gap-3 justify-center print:gap-2">
          {people.map((p) => (
            <IdCardPreview
              key={p.id}
              template={activeTemplate}
              person={p}
              tenantName={tenantName}
            />
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{edit?.id ? "Edit" : "New"} template</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Name</Label>
              <Input
                value={edit?.name ?? ""}
                onChange={(e) => setEdit({ ...edit, name: e.target.value })}
              />
            </div>
            <div>
              <Label>Audience</Label>
              <Select
                value={edit?.audience ?? "student"}
                onValueChange={(v) => setEdit({ ...edit, audience: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="teacher">Teacher</SelectItem>
                  <SelectItem value="employee">Employee</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Orientation</Label>
              <Select
                value={edit?.orientation ?? "portrait"}
                onValueChange={(v) => setEdit({ ...edit, orientation: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="portrait">Portrait</SelectItem>
                  <SelectItem value="landscape">Landscape</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Width (mm)</Label>
              <Input
                type="number"
                value={edit?.widthMm ?? 54}
                onChange={(e) =>
                  setEdit({ ...edit, widthMm: Number(e.target.value) })
                }
              />
            </div>
            <div>
              <Label>Height (mm)</Label>
              <Input
                type="number"
                value={edit?.heightMm ?? 86}
                onChange={(e) =>
                  setEdit({ ...edit, heightMm: Number(e.target.value) })
                }
              />
            </div>
            <div>
              <Label>Accent</Label>
              <Input
                type="color"
                value={edit?.accentColor ?? "#10b981"}
                onChange={(e) =>
                  setEdit({ ...edit, accentColor: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Background</Label>
              <Input
                type="color"
                value={edit?.backgroundColor ?? "#ffffff"}
                onChange={(e) =>
                  setEdit({ ...edit, backgroundColor: e.target.value })
                }
              />
            </div>
            <div className="col-span-2">
              <Label>Logo URL</Label>
              <Input
                value={edit?.logoUrl ?? ""}
                onChange={(e) =>
                  setEdit({ ...edit, logoUrl: e.target.value })
                }
              />
            </div>
            <div className="col-span-2">
              <Label>Footer text</Label>
              <Input
                value={edit?.footerText ?? ""}
                onChange={(e) =>
                  setEdit({ ...edit, footerText: e.target.value })
                }
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={edit?.showPhoto ?? true}
                onChange={(e) =>
                  setEdit({ ...edit, showPhoto: e.target.checked })
                }
              />
              Show photo
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={edit?.showQr ?? true}
                onChange={(e) =>
                  setEdit({ ...edit, showQr: e.target.checked })
                }
              />
              Show QR code
            </label>
            <label className="flex items-center gap-2 text-sm col-span-2">
              <input
                type="checkbox"
                checked={edit?.isDefault ?? false}
                onChange={(e) =>
                  setEdit({ ...edit, isDefault: e.target.checked })
                }
              />
              Set as default for this audience
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function IdCardPreview({
  template,
  person,
  tenantName,
}: {
  template: Template;
  person: Person;
  tenantName: string;
}) {
  const isLandscape = template.orientation === "landscape";
  const w = isLandscape ? template.heightMm : template.widthMm;
  const h = isLandscape ? template.widthMm : template.heightMm;
  const initials = `${person.firstName?.[0] ?? ""}${person.lastName?.[0] ?? ""}`.toUpperCase();
  return (
    <div
      className="relative rounded-md overflow-hidden shadow-sm border print:shadow-none print:border-black/40 print:break-inside-avoid"
      style={{
        width: `${w * 3.78}px`,
        height: `${h * 3.78}px`,
        background: template.backgroundColor,
        color: template.textColor,
      }}
    >
      <div
        className="absolute top-0 left-0 right-0 h-[18%] flex items-center px-2"
        style={{ background: template.accentColor }}
      >
        {template.logoUrl && (
          <img
            src={template.logoUrl}
            alt=""
            className="h-full py-1"
          />
        )}
        <div className="text-white text-[9px] font-semibold ml-2 truncate">
          {tenantName || "School"}
        </div>
      </div>
      <div className="absolute inset-x-0 top-[18%] bottom-[14%] p-2 flex flex-col items-center gap-1">
        {template.showPhoto && (
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-lg font-bold overflow-hidden border-2"
            style={{ borderColor: template.accentColor }}
          >
            {person.photoUrl ? (
              <img
                src={person.photoUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <span>{initials || "?"}</span>
            )}
          </div>
        )}
        <div className="text-center leading-tight">
          <div className="text-[11px] font-bold truncate max-w-[90%] mx-auto">
            {person.firstName} {person.lastName ?? ""}
          </div>
          <div className="text-[9px] opacity-70 truncate max-w-[90%] mx-auto">
            {person.code}
          </div>
          {person.className && (
            <div className="text-[8px] mt-0.5 opacity-80">
              {person.className}
              {person.sectionName ? ` · ${person.sectionName}` : ""}
            </div>
          )}
        </div>
      </div>
      <div
        className="absolute bottom-0 left-0 right-0 h-[14%] flex items-center justify-center text-[7px] px-1"
        style={{ background: template.accentColor, color: "white" }}
      >
        {template.footerText || person.guardianPhone || ""}
      </div>
    </div>
  );
}
