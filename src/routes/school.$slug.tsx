import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  getPublicSite,
  submitContactMessage,
  subscribeNewsletter,
} from "@/lib/website.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Facebook,
  Instagram,
  Twitter,
  Youtube,
  Linkedin,
  Mail,
  Phone,
  MapPin,
  GraduationCap,
  Calendar,
  ChevronRight,
  Star,
} from "lucide-react";

export const Route = createFileRoute("/school/$slug")({
  component: SchoolSite,
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug} — School website` },
      {
        name: "description",
        content:
          "Explore programs, faculty, admissions, events, and gallery.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
});

type Site = Awaited<ReturnType<typeof getPublicSite>>;

function SchoolSite() {
  const { slug } = Route.useParams();
  const get = useServerFn(getPublicSite);
  const [site, setSite] = useState<Site | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    get({ data: { slug } })
      .then((s) => setSite(s as Site))
      .catch((e) => setError(String(e)));
    // Apply the tenant's saved theme to the public site as well.
    (async () => {
      try {
        const [{ getTenantThemeBySlug }, themeMod] = await Promise.all([
          import("@/lib/theme.functions"),
          import("@/lib/theme-client"),
        ]);
        const res = await getTenantThemeBySlug({ data: { slug } });
        const t = themeMod.parseTheme(res.themeJson);
        themeMod.applyTheme(t);
      } catch {
        /* ignore — defaults stay applied */
      }
    })();
  }, [slug]);

  if (error && !site) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold">School not found</h1>
          <p className="text-muted-foreground text-sm">
            No public site exists at /school/{slug}.
          </p>
        </div>
      </div>
    );
  }

  if (!site) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  const accent = site.tenant.primaryColor || "#10b981";
  const meta = site.meta;
  const heroImage =
    meta?.heroImageUrl ||
    site.sliders[0]?.imageUrl ||
    "";

  return (
    <div
      className="min-h-screen bg-background text-foreground"
      style={{ ["--brand" as unknown as string]: accent } as React.CSSProperties}
    >
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/85 backdrop-blur border-b">
        <div className="max-w-6xl mx-auto px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {site.tenant.logoUrl || meta?.logoUrl ? (
              <img
                src={site.tenant.logoUrl || meta?.logoUrl || ""}
                alt=""
                className="h-8 w-8 object-contain"
              />
            ) : (
              <div
                className="h-8 w-8 rounded-md flex items-center justify-center text-white"
                style={{ background: accent }}
              >
                <GraduationCap className="h-4 w-4" />
              </div>
            )}
            <div className="font-semibold">{site.tenant.name}</div>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <a href="#about" className="hover:text-primary">About</a>
            <a href="#faculty" className="hover:text-primary">Faculty</a>
            <a href="#events" className="hover:text-primary">Events</a>
            <a href="#gallery" className="hover:text-primary">Gallery</a>
            <a href="#faq" className="hover:text-primary">FAQ</a>
            <a href="#contact" className="hover:text-primary">Contact</a>
          </nav>
          <Button asChild size="sm" style={{ background: accent }}>
            <Link to="/apply/$slug" params={{ slug }}>
              Apply
            </Link>
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section
        className="relative overflow-hidden"
        style={{
          backgroundImage: heroImage
            ? `linear-gradient(135deg, rgba(0,0,0,0.55), rgba(0,0,0,0.25)), url(${heroImage})`
            : `linear-gradient(135deg, ${accent}22, transparent)`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="max-w-6xl mx-auto px-5 py-24 md:py-36 relative">
          <div className={heroImage ? "text-white" : ""}>
            <div
              className="inline-block text-xs uppercase tracking-widest font-semibold mb-4 px-2 py-1 rounded"
              style={{
                background: heroImage ? "rgba(255,255,255,0.15)" : `${accent}20`,
                color: heroImage ? "white" : accent,
              }}
            >
              Est. {site.timeline[0]?.yearLabel ?? "1900"}
            </div>
            <h1 className="text-4xl md:text-6xl font-semibold leading-tight max-w-3xl">
              {meta?.heroTitle || `Welcome to ${site.tenant.name}`}
            </h1>
            <p
              className={`mt-4 max-w-2xl text-lg ${
                heroImage ? "text-white/85" : "text-muted-foreground"
              }`}
            >
              {meta?.heroSubtitle ||
                "A place where curious minds grow into capable, kind, and confident individuals."}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" style={{ background: accent }}>
                <Link to="/apply/$slug" params={{ slug }}>
                  Apply for admission
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className={
                  heroImage ? "bg-white/10 text-white border-white/30" : ""
                }
              >
                <a href="#about">Learn more</a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Sliders quick strip */}
      {site.sliders.length > 1 && (
        <section className="border-b bg-muted/30">
          <div className="max-w-6xl mx-auto px-5 py-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            {site.sliders.slice(0, 3).map((s) => (
              <a
                key={s.id}
                href={s.ctaUrl || "#"}
                className="group relative rounded-lg overflow-hidden aspect-[16/9] block"
              >
                <div
                  className="absolute inset-0 bg-cover bg-center group-hover:scale-105 transition-transform duration-500"
                  style={{ backgroundImage: `url(${s.imageUrl})` }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                <div className="absolute bottom-3 left-3 right-3 text-white">
                  <div className="text-sm font-semibold">{s.title}</div>
                  {s.subtitle && (
                    <div className="text-xs opacity-80">{s.subtitle}</div>
                  )}
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* About */}
      <section id="about" className="max-w-6xl mx-auto px-5 py-20">
        <div className="grid md:grid-cols-3 gap-10">
          <div>
            <div
              className="text-xs uppercase tracking-widest font-semibold mb-2"
              style={{ color: accent }}
            >
              About us
            </div>
            <h2 className="text-3xl font-semibold">Who we are</h2>
          </div>
          <div className="md:col-span-2 space-y-4 text-muted-foreground leading-relaxed">
            <p className="whitespace-pre-line">
              {meta?.aboutHtml ||
                `${site.tenant.name} is committed to holistic education that balances academic excellence, character development, and community engagement.`}
            </p>
            {(meta?.missionHtml || meta?.visionHtml) && (
              <div className="grid md:grid-cols-2 gap-5 pt-4">
                {meta?.missionHtml && (
                  <div className="border rounded-lg p-5">
                    <div
                      className="text-xs uppercase tracking-widest font-semibold mb-1"
                      style={{ color: accent }}
                    >
                      Mission
                    </div>
                    <p className="text-sm whitespace-pre-line">
                      {meta.missionHtml}
                    </p>
                  </div>
                )}
                {meta?.visionHtml && (
                  <div className="border rounded-lg p-5">
                    <div
                      className="text-xs uppercase tracking-widest font-semibold mb-1"
                      style={{ color: accent }}
                    >
                      Vision
                    </div>
                    <p className="text-sm whitespace-pre-line">
                      {meta.visionHtml}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Programs / classes */}
      {site.classes.length > 0 && (
        <section className="bg-muted/30 py-20">
          <div className="max-w-6xl mx-auto px-5">
            <div
              className="text-xs uppercase tracking-widest font-semibold mb-2"
              style={{ color: accent }}
            >
              Programs
            </div>
            <h2 className="text-3xl font-semibold mb-8">
              Classes we offer
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {site.classes.map((c) => (
                <div
                  key={c.id}
                  className="border rounded-lg p-4 text-center bg-background hover:border-primary/40 transition"
                >
                  <div className="text-sm font-medium">{c.name}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Timeline */}
      {site.timeline.length > 0 && (
        <section className="max-w-6xl mx-auto px-5 py-20">
          <div
            className="text-xs uppercase tracking-widest font-semibold mb-2"
            style={{ color: accent }}
          >
            Our journey
          </div>
          <h2 className="text-3xl font-semibold mb-10">Milestones</h2>
          <div className="relative pl-6 border-l-2 space-y-8" style={{ borderColor: `${accent}30` }}>
            {site.timeline.map((t) => (
              <div key={t.id} className="relative">
                <div
                  className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border-4 border-background"
                  style={{ background: accent }}
                />
                <div className="text-sm font-semibold" style={{ color: accent }}>
                  {t.yearLabel}
                </div>
                <div className="font-medium">{t.title}</div>
                {t.description && (
                  <div className="text-sm text-muted-foreground">
                    {t.description}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Faculty */}
      {site.faculty.length > 0 && (
        <section id="faculty" className="bg-muted/30 py-20">
          <div className="max-w-6xl mx-auto px-5">
            <div
              className="text-xs uppercase tracking-widest font-semibold mb-2"
              style={{ color: accent }}
            >
              Faculty
            </div>
            <h2 className="text-3xl font-semibold mb-8">Meet our teachers</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {site.faculty.map((f) => {
                const initials = `${f.firstName?.[0] ?? ""}${f.lastName?.[0] ?? ""}`;
                return (
                  <div
                    key={f.id}
                    className="border rounded-lg p-4 bg-background text-center"
                  >
                    <div
                      className="w-20 h-20 rounded-full mx-auto flex items-center justify-center text-lg font-semibold text-white mb-3 overflow-hidden"
                      style={{ background: accent }}
                    >
                      {f.photoUrl ? (
                        <img
                          src={f.photoUrl}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        initials
                      )}
                    </div>
                    <div className="font-medium text-sm">
                      {f.firstName} {f.lastName ?? ""}
                    </div>
                    {f.designation && (
                      <div className="text-xs text-muted-foreground">
                        {f.designation}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Events / Notices */}
      {(site.events.length > 0 || site.notices.length > 0) && (
        <section id="events" className="max-w-6xl mx-auto px-5 py-20">
          <div className="grid md:grid-cols-2 gap-10">
            {site.events.length > 0 && (
              <div>
                <div
                  className="text-xs uppercase tracking-widest font-semibold mb-2"
                  style={{ color: accent }}
                >
                  Upcoming
                </div>
                <h2 className="text-2xl font-semibold mb-5">
                  Events & calendar
                </h2>
                <div className="space-y-2">
                  {site.events.map((e) => (
                    <div
                      key={e.id}
                      className="border rounded-lg p-4 flex gap-3"
                    >
                      <Calendar
                        className="w-5 h-5 mt-0.5 shrink-0"
                        style={{ color: accent }}
                      />
                      <div className="flex-1">
                        <div className="font-medium">{e.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {e.startDate}
                          {e.endDate && e.endDate !== e.startDate
                            ? ` – ${e.endDate}`
                            : ""}
                          {e.location ? ` · ${e.location}` : ""}
                        </div>
                        {e.description && (
                          <div className="text-sm text-muted-foreground mt-1">
                            {e.description}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {site.notices.length > 0 && (
              <div>
                <div
                  className="text-xs uppercase tracking-widest font-semibold mb-2"
                  style={{ color: accent }}
                >
                  Notices
                </div>
                <h2 className="text-2xl font-semibold mb-5">
                  From the office
                </h2>
                <div className="space-y-2">
                  {site.notices.map((n) => (
                    <div key={n.id} className="border rounded-lg p-4">
                      <div className="font-medium">
                        {n.isPinned && (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded uppercase mr-2 font-semibold"
                            style={{
                              background: `${accent}20`,
                              color: accent,
                            }}
                          >
                            Pinned
                          </span>
                        )}
                        {n.title}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1 line-clamp-3">
                        {n.body}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Testimonials */}
      {site.testimonials.length > 0 && (
        <section className="bg-muted/30 py-20">
          <div className="max-w-6xl mx-auto px-5">
            <div
              className="text-xs uppercase tracking-widest font-semibold mb-2"
              style={{ color: accent }}
            >
              Voices
            </div>
            <h2 className="text-3xl font-semibold mb-8">
              From our community
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {site.testimonials.map((t) => (
                <div
                  key={t.id}
                  className="border rounded-lg p-5 bg-background"
                >
                  <div className="flex gap-0.5 mb-2">
                    {Array.from({ length: t.rating }).map((_, i) => (
                      <Star
                        key={i}
                        className="w-4 h-4 fill-current"
                        style={{ color: accent }}
                      />
                    ))}
                  </div>
                  <p className="text-sm italic leading-relaxed mb-3">
                    "{t.quote}"
                  </p>
                  <div className="text-sm font-medium">{t.authorName}</div>
                  {t.authorRole && (
                    <div className="text-xs text-muted-foreground">
                      {t.authorRole}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Gallery */}
      {site.gallery.length > 0 && (
        <section id="gallery" className="max-w-6xl mx-auto px-5 py-20">
          <div
            className="text-xs uppercase tracking-widest font-semibold mb-2"
            style={{ color: accent }}
          >
            Gallery
          </div>
          <h2 className="text-3xl font-semibold mb-8">Life on campus</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {site.gallery.map((g) => (
              <div
                key={g.id}
                className="aspect-square rounded-md overflow-hidden bg-muted bg-cover bg-center hover:scale-[1.02] transition-transform"
                style={{ backgroundImage: `url(${g.imageUrl})` }}
                title={g.title ?? ""}
              />
            ))}
          </div>
        </section>
      )}

      {/* FAQ */}
      {site.faqs.length > 0 && (
        <section id="faq" className="bg-muted/30 py-20">
          <div className="max-w-4xl mx-auto px-5">
            <div
              className="text-xs uppercase tracking-widest font-semibold mb-2"
              style={{ color: accent }}
            >
              FAQ
            </div>
            <h2 className="text-3xl font-semibold mb-8">
              Frequently asked questions
            </h2>
            <div className="space-y-2">
              {site.faqs.map((f) => (
                <details
                  key={f.id}
                  className="border rounded-lg bg-background group"
                >
                  <summary className="cursor-pointer p-4 font-medium flex justify-between items-center">
                    <span>{f.question}</span>
                    <ChevronRight className="w-4 h-4 group-open:rotate-90 transition-transform" />
                  </summary>
                  <div className="px-4 pb-4 text-sm text-muted-foreground whitespace-pre-line">
                    {f.answer}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Contact */}
      <section id="contact" className="max-w-6xl mx-auto px-5 py-20">
        <div className="grid md:grid-cols-2 gap-10">
          <div>
            <div
              className="text-xs uppercase tracking-widest font-semibold mb-2"
              style={{ color: accent }}
            >
              Get in touch
            </div>
            <h2 className="text-3xl font-semibold mb-5">Visit or contact us</h2>
            <div className="space-y-3 text-sm">
              {meta?.contactEmail && (
                <div className="flex gap-3">
                  <Mail
                    className="w-4 h-4 mt-0.5"
                    style={{ color: accent }}
                  />
                  <a
                    href={`mailto:${meta.contactEmail}`}
                    className="hover:underline"
                  >
                    {meta.contactEmail}
                  </a>
                </div>
              )}
              {meta?.contactPhone && (
                <div className="flex gap-3">
                  <Phone
                    className="w-4 h-4 mt-0.5"
                    style={{ color: accent }}
                  />
                  <a
                    href={`tel:${meta.contactPhone}`}
                    className="hover:underline"
                  >
                    {meta.contactPhone}
                  </a>
                </div>
              )}
              {meta?.contactAddress && (
                <div className="flex gap-3">
                  <MapPin
                    className="w-4 h-4 mt-0.5"
                    style={{ color: accent }}
                  />
                  <div className="whitespace-pre-line">
                    {meta.contactAddress}
                  </div>
                </div>
              )}
            </div>

            {meta?.mapEmbed && (
              <div
                className="mt-6 aspect-video rounded-lg overflow-hidden border [&_iframe]:w-full [&_iframe]:h-full"
                dangerouslySetInnerHTML={{ __html: meta.mapEmbed }}
              />
            )}
          </div>

          <ContactForm slug={slug} accent={accent} />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-muted/30">
        <div className="max-w-6xl mx-auto px-5 py-10 grid md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <div className="font-semibold">{site.tenant.name}</div>
            <p className="text-sm text-muted-foreground">
              {meta?.footerText ||
                "Nurturing tomorrow's leaders through education, empathy, and excellence."}
            </p>
          </div>

          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
              Quick links
            </div>
            <ul className="text-sm space-y-1">
              <li><a href="#about" className="hover:text-primary">About</a></li>
              <li><a href="#faculty" className="hover:text-primary">Faculty</a></li>
              <li><a href="#events" className="hover:text-primary">Events</a></li>
              <li>
                <Link
                  to="/apply/$slug"
                  params={{ slug }}
                  className="hover:text-primary"
                >
                  Admissions
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
              Subscribe
            </div>
            <NewsletterForm slug={slug} accent={accent} />
            <div className="flex gap-2 mt-4">
              {meta?.socialFacebook && (
                <SocialIcon href={meta.socialFacebook} Icon={Facebook} />
              )}
              {meta?.socialInstagram && (
                <SocialIcon href={meta.socialInstagram} Icon={Instagram} />
              )}
              {meta?.socialTwitter && (
                <SocialIcon href={meta.socialTwitter} Icon={Twitter} />
              )}
              {meta?.socialYoutube && (
                <SocialIcon href={meta.socialYoutube} Icon={Youtube} />
              )}
              {meta?.socialLinkedin && (
                <SocialIcon href={meta.socialLinkedin} Icon={Linkedin} />
              )}
            </div>
          </div>
        </div>
        <div className="border-t py-4 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} {site.tenant.name}. Powered by NextGen
          Fusion School.
        </div>
      </footer>
    </div>
  );
}

function SocialIcon({
  href,
  Icon,
}: {
  href: string;
  Icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="w-8 h-8 border rounded-md flex items-center justify-center hover:bg-muted transition"
    >
      <Icon className="w-4 h-4" />
    </a>
  );
}

function ContactForm({ slug, accent }: { slug: string; accent: string }) {
  const submit = useServerFn(submitContactMessage);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
  });
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.message)
      return toast.error("Name and message required");
    setBusy(true);
    try {
      await submit({
        data: { tenantSlug: slug, ...form },
      });
      toast.success("Message sent");
      setForm({ name: "", email: "", phone: "", subject: "", message: "" });
    } catch (e) {
      toast.error(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="border rounded-lg p-5 space-y-3 bg-background"
    >
      <div className="grid grid-cols-2 gap-3">
        <Input
          placeholder="Your name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <Input
          placeholder="Email"
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input
          placeholder="Phone"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
        <Input
          placeholder="Subject"
          value={form.subject}
          onChange={(e) => setForm({ ...form, subject: e.target.value })}
        />
      </div>
      <Textarea
        rows={4}
        placeholder="How can we help?"
        value={form.message}
        onChange={(e) => setForm({ ...form, message: e.target.value })}
        required
      />
      <Button
        type="submit"
        disabled={busy}
        style={{ background: accent }}
        className="w-full"
      >
        {busy ? "Sending…" : "Send message"}
      </Button>
    </form>
  );
}

function NewsletterForm({ slug, accent }: { slug: string; accent: string }) {
  const submit = useServerFn(subscribeNewsletter);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!email) return;
        setBusy(true);
        try {
          await submit({ data: { tenantSlug: slug, email } });
          toast.success("Subscribed");
          setEmail("");
        } catch (e) {
          toast.error(String(e));
        } finally {
          setBusy(false);
        }
      }}
      className="flex gap-2"
    >
      <Input
        type="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <Button
        type="submit"
        disabled={busy}
        style={{ background: accent }}
        size="sm"
      >
        Join
      </Button>
    </form>
  );
}
