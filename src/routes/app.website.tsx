import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  getSiteMeta,
  saveSiteMeta,
  listSliders,
  saveSlider,
  deleteSlider,
  listTestimonials,
  saveTestimonial,
  deleteTestimonial,
  listGallery,
  saveGalleryItem,
  deleteGalleryItem,
  listFaqs,
  saveFaq,
  deleteFaq,
  listTimeline,
  saveTimelineItem,
  deleteTimelineItem,
  listContactMessages,
  markContactRead,
  deleteContactMessage,
  listSubscribers,
} from "@/lib/website.functions";
import { getSession } from "@/lib/session";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
} from "@/components/ui/table";
import { ImagePicker } from "@/components/image-picker";
// re-export placeholder to keep line count stable
const __ip = ImagePicker;
void __ip;
const _unused_table_row = {

  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Trash2,
  Pencil,
  ExternalLink,
  Mail,
  Copy,
  Eye,
} from "lucide-react";

export const Route = createFileRoute("/app/website")({
  component: WebsitePage,
});

type Meta = {
  heroTitle: string | null;
  heroSubtitle: string | null;
  heroImageUrl: string | null;
  aboutHtml: string | null;
  missionHtml: string | null;
  visionHtml: string | null;
  footerText: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  contactAddress: string | null;
  mapEmbed: string | null;
  socialFacebook: string | null;
  socialInstagram: string | null;
  socialTwitter: string | null;
  socialYoutube: string | null;
  socialLinkedin: string | null;
  googleAnalyticsId: string | null;
  language: string;
  isPublished: boolean;
};

const DEFAULT_META: Meta = {
  heroTitle: "",
  heroSubtitle: "",
  heroImageUrl: "",
  aboutHtml: "",
  missionHtml: "",
  visionHtml: "",
  footerText: "",
  logoUrl: "",
  faviconUrl: "",
  contactEmail: "",
  contactPhone: "",
  contactAddress: "",
  mapEmbed: "",
  socialFacebook: "",
  socialInstagram: "",
  socialTwitter: "",
  socialYoutube: "",
  socialLinkedin: "",
  googleAnalyticsId: "",
  language: "en",
  isPublished: true,
};

function WebsitePage() {
  const session = getSession();
  const slug = session?.user.tenant?.slug ?? "";
  const publicUrl =
    typeof window !== "undefined" && slug
      ? `${window.location.origin}/school/${slug}`
      : "";

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Public Website"
        description="Manage the marketing site visitors see for your school"
        action={
          publicUrl ? (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(publicUrl);
                  toast.success("URL copied");
                }}
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy URL
              </Button>
              <Button asChild size="sm">
                <Link
                  to="/school/$slug"
                  params={{ slug }}
                  target="_blank"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  View site
                </Link>
              </Button>
            </div>
          ) : null
        }
      />

      <Tabs defaultValue="branding">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="sliders">Sliders</TabsTrigger>
          <TabsTrigger value="testimonials">Testimonials</TabsTrigger>
          <TabsTrigger value="gallery">Gallery</TabsTrigger>
          <TabsTrigger value="faq">FAQ</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
          <TabsTrigger value="subscribers">Subscribers</TabsTrigger>
        </TabsList>

        <TabsContent value="branding">
          <BrandingPanel />
        </TabsContent>
        <TabsContent value="sliders">
          <SliderPanel />
        </TabsContent>
        <TabsContent value="testimonials">
          <TestimonialPanel />
        </TabsContent>
        <TabsContent value="gallery">
          <GalleryPanel />
        </TabsContent>
        <TabsContent value="faq">
          <FaqPanel />
        </TabsContent>
        <TabsContent value="timeline">
          <TimelinePanel />
        </TabsContent>
        <TabsContent value="messages">
          <MessagesPanel />
        </TabsContent>
        <TabsContent value="subscribers">
          <SubscribersPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* --------------------------- Branding ---------------------------- */

function BrandingPanel() {
  const getFn = useServerFn(getSiteMeta);
  const saveFn = useServerFn(saveSiteMeta);
  const [meta, setMeta] = useState<Meta>(DEFAULT_META);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getFn().then((m) => {
      if (m) setMeta({ ...DEFAULT_META, ...(m as Partial<Meta>) });
    });
  }, []);

  async function save() {
    setBusy(true);
    try {
      await saveFn({ data: meta });
      toast.success("Saved");
    } catch (e) {
      toast.error(String(e));
    } finally {
      setBusy(false);
    }
  }

  const set = <K extends keyof Meta>(k: K, v: Meta[K]) =>
    setMeta((m) => ({ ...m, [k]: v }));

  return (
    <div className="space-y-6 mt-4">
      <Section title="Hero">
        <Field label="Hero title">
          <Input
            value={meta.heroTitle ?? ""}
            onChange={(e) => set("heroTitle", e.target.value)}
            placeholder="Welcome to Springfield Public School"
          />
        </Field>
        <Field label="Hero subtitle">
          <Input
            value={meta.heroSubtitle ?? ""}
            onChange={(e) => set("heroSubtitle", e.target.value)}
            placeholder="Nurturing curious minds since 1974"
          />
        </Field>
        <Field label="Hero background image URL" full>
          <Input
            value={meta.heroImageUrl ?? ""}
            onChange={(e) => set("heroImageUrl", e.target.value)}
          />
        </Field>
      </Section>

      <Section title="About the school">
        <Field label="About" full>
          <Textarea
            rows={4}
            value={meta.aboutHtml ?? ""}
            onChange={(e) => set("aboutHtml", e.target.value)}
          />
        </Field>
        <Field label="Mission">
          <Textarea
            rows={3}
            value={meta.missionHtml ?? ""}
            onChange={(e) => set("missionHtml", e.target.value)}
          />
        </Field>
        <Field label="Vision">
          <Textarea
            rows={3}
            value={meta.visionHtml ?? ""}
            onChange={(e) => set("visionHtml", e.target.value)}
          />
        </Field>
      </Section>

      <Section title="Contact block">
        <Field label="Email">
          <Input
            value={meta.contactEmail ?? ""}
            onChange={(e) => set("contactEmail", e.target.value)}
          />
        </Field>
        <Field label="Phone">
          <Input
            value={meta.contactPhone ?? ""}
            onChange={(e) => set("contactPhone", e.target.value)}
          />
        </Field>
        <Field label="Address" full>
          <Textarea
            rows={2}
            value={meta.contactAddress ?? ""}
            onChange={(e) => set("contactAddress", e.target.value)}
          />
        </Field>
        <Field label="Google Maps embed HTML" full>
          <Textarea
            rows={3}
            value={meta.mapEmbed ?? ""}
            onChange={(e) => set("mapEmbed", e.target.value)}
            placeholder='<iframe src="…"></iframe>'
          />
        </Field>
      </Section>

      <Section title="Social & analytics">
        <Field label="Facebook URL">
          <Input
            value={meta.socialFacebook ?? ""}
            onChange={(e) => set("socialFacebook", e.target.value)}
          />
        </Field>
        <Field label="Instagram URL">
          <Input
            value={meta.socialInstagram ?? ""}
            onChange={(e) => set("socialInstagram", e.target.value)}
          />
        </Field>
        <Field label="Twitter / X URL">
          <Input
            value={meta.socialTwitter ?? ""}
            onChange={(e) => set("socialTwitter", e.target.value)}
          />
        </Field>
        <Field label="YouTube URL">
          <Input
            value={meta.socialYoutube ?? ""}
            onChange={(e) => set("socialYoutube", e.target.value)}
          />
        </Field>
        <Field label="LinkedIn URL">
          <Input
            value={meta.socialLinkedin ?? ""}
            onChange={(e) => set("socialLinkedin", e.target.value)}
          />
        </Field>
        <Field label="Google Analytics ID">
          <Input
            value={meta.googleAnalyticsId ?? ""}
            onChange={(e) => set("googleAnalyticsId", e.target.value)}
            placeholder="G-XXXXXXX"
          />
        </Field>
      </Section>

      <Section title="Assets & footer">
        <Field label="Logo URL">
          <Input
            value={meta.logoUrl ?? ""}
            onChange={(e) => set("logoUrl", e.target.value)}
          />
        </Field>
        <Field label="Favicon URL">
          <Input
            value={meta.faviconUrl ?? ""}
            onChange={(e) => set("faviconUrl", e.target.value)}
          />
        </Field>
        <Field label="Footer text" full>
          <Input
            value={meta.footerText ?? ""}
            onChange={(e) => set("footerText", e.target.value)}
            placeholder="© Springfield Public School. All rights reserved."
          />
        </Field>
        <Field label="Language">
          <Input
            value={meta.language ?? "en"}
            onChange={(e) => set("language", e.target.value)}
          />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={meta.isPublished}
            onChange={(e) => set("isPublished", e.target.checked)}
          />
          Publish site (uncheck to take offline)
        </label>
      </Section>

      <div className="flex justify-end">
        <Button onClick={save} disabled={busy} size="lg">
          {busy ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border rounded-lg p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
        {title}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <Label className="mb-1.5 inline-block">{label}</Label>
      {children}
    </div>
  );
}

/* --------------------------- Sliders ------------------------------ */

type Slider = {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  ctaLabel: string | null;
  ctaUrl: string | null;
  sortOrder: number;
  isActive: boolean;
};

function SliderPanel() {
  const listFn = useServerFn(listSliders);
  const saveFn = useServerFn(saveSlider);
  const delFn = useServerFn(deleteSlider);
  const [rows, setRows] = useState<Slider[]>([]);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Partial<Slider> | null>(null);

  const refresh = () =>
    listFn().then((r) => setRows(r as unknown as Slider[]));
  useEffect(() => {
    refresh();
  }, []);

  async function submit() {
    if (!edit?.title || !edit?.imageUrl)
      return toast.error("Title and image required");
    await saveFn({
      data: {
        id: edit.id,
        title: edit.title!,
        subtitle: edit.subtitle ?? null,
        imageUrl: edit.imageUrl!,
        ctaLabel: edit.ctaLabel ?? null,
        ctaUrl: edit.ctaUrl ?? null,
        sortOrder: edit.sortOrder ?? 0,
        isActive: edit.isActive ?? true,
      },
    });
    setOpen(false);
    setEdit(null);
    refresh();
  }

  return (
    <div className="space-y-4 mt-4">
      <div className="flex justify-end">
        <Button
          onClick={() => {
            setEdit({ isActive: true, sortOrder: rows.length });
            setOpen(true);
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add slide
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {rows.map((s) => (
          <div key={s.id} className="border rounded-lg overflow-hidden group">
            <div
              className="aspect-video bg-muted bg-cover bg-center"
              style={{ backgroundImage: `url(${s.imageUrl})` }}
            />
            <div className="p-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium">{s.title}</div>
                  {s.subtitle && (
                    <div className="text-xs text-muted-foreground">
                      {s.subtitle}
                    </div>
                  )}
                </div>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded ${
                    s.isActive
                      ? "bg-emerald-500/15 text-emerald-600"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {s.isActive ? "Live" : "Off"}
                </span>
              </div>
              <div className="flex justify-end gap-1 mt-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setEdit(s);
                    setOpen(true);
                  }}
                >
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={async () => {
                    if (!confirm("Delete slide?")) return;
                    await delFn({ data: { id: s.id } });
                    refresh();
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
        {!rows.length && (
          <div className="col-span-full text-center text-muted-foreground py-12 border rounded-lg">
            No slides yet
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{edit?.id ? "Edit" : "New"} slide</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Title</Label>
              <Input
                value={edit?.title ?? ""}
                onChange={(e) => setEdit({ ...edit, title: e.target.value })}
              />
            </div>
            <div>
              <Label>Subtitle</Label>
              <Input
                value={edit?.subtitle ?? ""}
                onChange={(e) =>
                  setEdit({ ...edit, subtitle: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Image URL</Label>
              <Input
                value={edit?.imageUrl ?? ""}
                onChange={(e) =>
                  setEdit({ ...edit, imageUrl: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>CTA label</Label>
                <Input
                  value={edit?.ctaLabel ?? ""}
                  onChange={(e) =>
                    setEdit({ ...edit, ctaLabel: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>CTA URL</Label>
                <Input
                  value={edit?.ctaUrl ?? ""}
                  onChange={(e) =>
                    setEdit({ ...edit, ctaUrl: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Sort order</Label>
                <Input
                  type="number"
                  value={edit?.sortOrder ?? 0}
                  onChange={(e) =>
                    setEdit({ ...edit, sortOrder: Number(e.target.value) })
                  }
                />
              </div>
              <label className="flex items-center gap-2 text-sm mt-6">
                <input
                  type="checkbox"
                  checked={edit?.isActive ?? true}
                  onChange={(e) =>
                    setEdit({ ...edit, isActive: e.target.checked })
                  }
                />
                Active
              </label>
            </div>
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

/* --------------------------- Testimonials --------------------------- */

type Testimonial = {
  id: string;
  authorName: string;
  authorRole: string | null;
  quote: string;
  avatarUrl: string | null;
  rating: number;
  isActive: boolean;
  sortOrder: number;
};

function TestimonialPanel() {
  const listFn = useServerFn(listTestimonials);
  const saveFn = useServerFn(saveTestimonial);
  const delFn = useServerFn(deleteTestimonial);
  const [rows, setRows] = useState<Testimonial[]>([]);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Partial<Testimonial> | null>(null);

  const refresh = () =>
    listFn().then((r) => setRows(r as unknown as Testimonial[]));
  useEffect(() => {
    refresh();
  }, []);

  async function submit() {
    if (!edit?.authorName || !edit?.quote)
      return toast.error("Author and quote required");
    await saveFn({
      data: {
        id: edit.id,
        authorName: edit.authorName!,
        authorRole: edit.authorRole ?? null,
        quote: edit.quote!,
        avatarUrl: edit.avatarUrl ?? null,
        rating: edit.rating ?? 5,
        isActive: edit.isActive ?? true,
        sortOrder: edit.sortOrder ?? 0,
      },
    });
    setOpen(false);
    setEdit(null);
    refresh();
  }

  return (
    <div className="space-y-4 mt-4">
      <div className="flex justify-end">
        <Button
          onClick={() => {
            setEdit({ isActive: true, rating: 5, sortOrder: rows.length });
            setOpen(true);
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add testimonial
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {rows.map((t) => (
          <div key={t.id} className="border rounded-lg p-4 space-y-2">
            <div className="text-sm italic">"{t.quote}"</div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">{t.authorName}</div>
                <div className="text-xs text-muted-foreground">
                  {t.authorRole ?? ""} · {"★".repeat(t.rating)}
                </div>
              </div>
              <div className="flex gap-1">
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
                    if (!confirm("Delete?")) return;
                    await delFn({ data: { id: t.id } });
                    refresh();
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
        {!rows.length && (
          <div className="col-span-full text-center text-muted-foreground py-12 border rounded-lg">
            No testimonials yet
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {edit?.id ? "Edit" : "New"} testimonial
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Author name</Label>
              <Input
                value={edit?.authorName ?? ""}
                onChange={(e) =>
                  setEdit({ ...edit, authorName: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Role / relation</Label>
              <Input
                value={edit?.authorRole ?? ""}
                onChange={(e) =>
                  setEdit({ ...edit, authorRole: e.target.value })
                }
                placeholder="Parent of Grade 5 student"
              />
            </div>
            <div>
              <Label>Quote</Label>
              <Textarea
                rows={4}
                value={edit?.quote ?? ""}
                onChange={(e) =>
                  setEdit({ ...edit, quote: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Avatar URL</Label>
                <Input
                  value={edit?.avatarUrl ?? ""}
                  onChange={(e) =>
                    setEdit({ ...edit, avatarUrl: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Rating (1-5)</Label>
                <Input
                  type="number"
                  min={1}
                  max={5}
                  value={edit?.rating ?? 5}
                  onChange={(e) =>
                    setEdit({ ...edit, rating: Number(e.target.value) })
                  }
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={edit?.isActive ?? true}
                onChange={(e) =>
                  setEdit({ ...edit, isActive: e.target.checked })
                }
              />
              Active
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

/* --------------------------- Gallery ------------------------------ */

type GalleryItem = {
  id: string;
  title: string | null;
  imageUrl: string;
  category: string;
  sortOrder: number;
};

function GalleryPanel() {
  const listFn = useServerFn(listGallery);
  const saveFn = useServerFn(saveGalleryItem);
  const delFn = useServerFn(deleteGalleryItem);
  const [rows, setRows] = useState<GalleryItem[]>([]);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Partial<GalleryItem> | null>(null);

  const refresh = () =>
    listFn().then((r) => setRows(r as unknown as GalleryItem[]));
  useEffect(() => {
    refresh();
  }, []);

  async function submit() {
    if (!edit?.imageUrl) return toast.error("Image URL required");
    await saveFn({
      data: {
        id: edit.id,
        title: edit.title ?? null,
        imageUrl: edit.imageUrl!,
        category: edit.category ?? "general",
        sortOrder: edit.sortOrder ?? 0,
      },
    });
    setOpen(false);
    setEdit(null);
    refresh();
  }

  return (
    <div className="space-y-4 mt-4">
      <div className="flex justify-end">
        <Button
          onClick={() => {
            setEdit({ category: "general", sortOrder: rows.length });
            setOpen(true);
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add photo
        </Button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {rows.map((g) => (
          <div key={g.id} className="border rounded-lg overflow-hidden group">
            <div
              className="aspect-square bg-muted bg-cover bg-center"
              style={{ backgroundImage: `url(${g.imageUrl})` }}
            />
            <div className="p-2 flex items-center justify-between">
              <div className="text-xs">
                <div className="truncate">{g.title ?? "Untitled"}</div>
                <div className="text-muted-foreground">{g.category}</div>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => {
                    setEdit(g);
                    setOpen(true);
                  }}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={async () => {
                    if (!confirm("Delete?")) return;
                    await delFn({ data: { id: g.id } });
                    refresh();
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>
        ))}
        {!rows.length && (
          <div className="col-span-full text-center text-muted-foreground py-12 border rounded-lg">
            No photos yet
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {edit?.id ? "Edit" : "New"} gallery item
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Image URL</Label>
              <Input
                value={edit?.imageUrl ?? ""}
                onChange={(e) =>
                  setEdit({ ...edit, imageUrl: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Title</Label>
              <Input
                value={edit?.title ?? ""}
                onChange={(e) => setEdit({ ...edit, title: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Category</Label>
                <Input
                  value={edit?.category ?? "general"}
                  onChange={(e) =>
                    setEdit({ ...edit, category: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Sort order</Label>
                <Input
                  type="number"
                  value={edit?.sortOrder ?? 0}
                  onChange={(e) =>
                    setEdit({ ...edit, sortOrder: Number(e.target.value) })
                  }
                />
              </div>
            </div>
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

/* ----------------------------- FAQ ---------------------------------- */

type Faq = {
  id: string;
  question: string;
  answer: string;
  category: string;
  sortOrder: number;
  isActive: boolean;
};

function FaqPanel() {
  const listFn = useServerFn(listFaqs);
  const saveFn = useServerFn(saveFaq);
  const delFn = useServerFn(deleteFaq);
  const [rows, setRows] = useState<Faq[]>([]);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Partial<Faq> | null>(null);

  const refresh = () => listFn().then((r) => setRows(r as unknown as Faq[]));
  useEffect(() => {
    refresh();
  }, []);

  async function submit() {
    if (!edit?.question || !edit?.answer)
      return toast.error("Question and answer required");
    await saveFn({
      data: {
        id: edit.id,
        question: edit.question!,
        answer: edit.answer!,
        category: edit.category ?? "general",
        sortOrder: edit.sortOrder ?? 0,
        isActive: edit.isActive ?? true,
      },
    });
    setOpen(false);
    setEdit(null);
    refresh();
  }

  return (
    <div className="space-y-4 mt-4">
      <div className="flex justify-end">
        <Button
          onClick={() => {
            setEdit({
              isActive: true,
              category: "general",
              sortOrder: rows.length,
            });
            setOpen(true);
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add FAQ
        </Button>
      </div>
      <div className="border rounded-lg divide-y">
        {rows.map((f) => (
          <div key={f.id} className="p-4 flex items-start gap-3">
            <div className="flex-1">
              <div className="font-medium">{f.question}</div>
              <div className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                {f.answer}
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                {f.category}
                {!f.isActive && " · hidden"}
              </div>
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setEdit(f);
                  setOpen(true);
                }}
              >
                <Pencil className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={async () => {
                  if (!confirm("Delete?")) return;
                  await delFn({ data: { id: f.id } });
                  refresh();
                }}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
        {!rows.length && (
          <div className="p-12 text-center text-muted-foreground">
            No FAQs yet
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{edit?.id ? "Edit" : "New"} FAQ</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Question</Label>
              <Input
                value={edit?.question ?? ""}
                onChange={(e) =>
                  setEdit({ ...edit, question: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Answer</Label>
              <Textarea
                rows={4}
                value={edit?.answer ?? ""}
                onChange={(e) =>
                  setEdit({ ...edit, answer: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Category</Label>
                <Input
                  value={edit?.category ?? "general"}
                  onChange={(e) =>
                    setEdit({ ...edit, category: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Sort order</Label>
                <Input
                  type="number"
                  value={edit?.sortOrder ?? 0}
                  onChange={(e) =>
                    setEdit({ ...edit, sortOrder: Number(e.target.value) })
                  }
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={edit?.isActive ?? true}
                onChange={(e) =>
                  setEdit({ ...edit, isActive: e.target.checked })
                }
              />
              Show on public site
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

/* ---------------------------- Timeline -------------------------------- */

type Timeline = {
  id: string;
  yearLabel: string;
  title: string;
  description: string | null;
  sortOrder: number;
};

function TimelinePanel() {
  const listFn = useServerFn(listTimeline);
  const saveFn = useServerFn(saveTimelineItem);
  const delFn = useServerFn(deleteTimelineItem);
  const [rows, setRows] = useState<Timeline[]>([]);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Partial<Timeline> | null>(null);

  const refresh = () =>
    listFn().then((r) => setRows(r as unknown as Timeline[]));
  useEffect(() => {
    refresh();
  }, []);

  async function submit() {
    if (!edit?.yearLabel || !edit?.title)
      return toast.error("Year and title required");
    await saveFn({
      data: {
        id: edit.id,
        yearLabel: edit.yearLabel!,
        title: edit.title!,
        description: edit.description ?? null,
        sortOrder: edit.sortOrder ?? 0,
      },
    });
    setOpen(false);
    setEdit(null);
    refresh();
  }

  return (
    <div className="space-y-4 mt-4">
      <div className="flex justify-end">
        <Button
          onClick={() => {
            setEdit({ sortOrder: rows.length });
            setOpen(true);
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add milestone
        </Button>
      </div>
      <div className="border rounded-lg divide-y">
        {rows.map((t) => (
          <div key={t.id} className="p-4 flex items-start gap-4">
            <div className="w-20 shrink-0 text-lg font-semibold text-primary">
              {t.yearLabel}
            </div>
            <div className="flex-1">
              <div className="font-medium">{t.title}</div>
              {t.description && (
                <div className="text-sm text-muted-foreground mt-0.5">
                  {t.description}
                </div>
              )}
            </div>
            <div className="flex gap-1">
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
                  if (!confirm("Delete?")) return;
                  await delFn({ data: { id: t.id } });
                  refresh();
                }}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
        {!rows.length && (
          <div className="p-12 text-center text-muted-foreground">
            No milestones yet
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {edit?.id ? "Edit" : "New"} milestone
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Year</Label>
                <Input
                  value={edit?.yearLabel ?? ""}
                  onChange={(e) =>
                    setEdit({ ...edit, yearLabel: e.target.value })
                  }
                  placeholder="1974"
                />
              </div>
              <div>
                <Label>Sort order</Label>
                <Input
                  type="number"
                  value={edit?.sortOrder ?? 0}
                  onChange={(e) =>
                    setEdit({ ...edit, sortOrder: Number(e.target.value) })
                  }
                />
              </div>
            </div>
            <div>
              <Label>Title</Label>
              <Input
                value={edit?.title ?? ""}
                onChange={(e) => setEdit({ ...edit, title: e.target.value })}
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                rows={3}
                value={edit?.description ?? ""}
                onChange={(e) =>
                  setEdit({ ...edit, description: e.target.value })
                }
              />
            </div>
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

/* ----------------------------- Messages ------------------------------- */

type Message = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  subject: string | null;
  message: string;
  isRead: boolean;
  createdAt: string | Date;
};

function MessagesPanel() {
  const listFn = useServerFn(listContactMessages);
  const markFn = useServerFn(markContactRead);
  const delFn = useServerFn(deleteContactMessage);
  const [rows, setRows] = useState<Message[]>([]);
  const [view, setView] = useState<Message | null>(null);

  const refresh = () =>
    listFn().then((r) => setRows(r as unknown as Message[]));
  useEffect(() => {
    refresh();
  }, []);

  return (
    <div className="space-y-4 mt-4">
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead></TableHead>
              <TableHead>From</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Received</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((m) => (
              <TableRow
                key={m.id}
                className={!m.isRead ? "bg-primary/5" : ""}
              >
                <TableCell>
                  <Mail
                    className={`w-4 h-4 ${
                      m.isRead ? "text-muted-foreground" : "text-primary"
                    }`}
                  />
                </TableCell>
                <TableCell>
                  <div className="font-medium">{m.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {m.email ?? m.phone ?? ""}
                  </div>
                </TableCell>
                <TableCell>{m.subject ?? "—"}</TableCell>
                <TableCell className="text-xs">
                  {new Date(m.createdAt).toLocaleString()}
                </TableCell>
                <TableCell className="text-right space-x-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={async () => {
                      setView(m);
                      if (!m.isRead) {
                        await markFn({ data: { id: m.id, isRead: true } });
                        refresh();
                      }
                    }}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={async () => {
                      if (!confirm("Delete message?")) return;
                      await delFn({ data: { id: m.id } });
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
                  colSpan={5}
                  className="text-center text-muted-foreground py-8"
                >
                  No messages yet
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{view?.subject ?? "Message"}</DialogTitle>
          </DialogHeader>
          {view && (
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">From:</span>{" "}
                {view.name}
                {view.email && ` <${view.email}>`}
                {view.phone && ` · ${view.phone}`}
              </div>
              <div className="text-muted-foreground text-xs">
                {new Date(view.createdAt).toLocaleString()}
              </div>
              <div className="whitespace-pre-wrap border-t pt-3">
                {view.message}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* --------------------------- Subscribers ---------------------------- */

type Sub = { id: string; email: string; createdAt: string | Date };

function SubscribersPanel() {
  const listFn = useServerFn(listSubscribers);
  const [rows, setRows] = useState<Sub[]>([]);

  useEffect(() => {
    listFn().then((r) => setRows(r as unknown as Sub[]));
  }, []);

  function exportCsv() {
    const csv =
      "email,subscribed_at\n" +
      rows
        .map(
          (r) => `${r.email},${new Date(r.createdAt).toISOString()}`,
        )
        .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "subscribers.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4 mt-4">
      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">
          {rows.length} subscribers
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={!rows.length}>
          Export CSV
        </Button>
      </div>
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Subscribed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-sm">{r.email}</TableCell>
                <TableCell className="text-xs">
                  {new Date(r.createdAt).toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
            {!rows.length && (
              <TableRow>
                <TableCell
                  colSpan={2}
                  className="text-center text-muted-foreground py-8"
                >
                  No subscribers yet
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
