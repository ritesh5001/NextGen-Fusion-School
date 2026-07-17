/**
 * Public Website / CMS server functions (Phase 9).
 *
 * All read endpoints are public and take a tenant slug. Write endpoints are
 * tenant-scoped and require auth via requireAuth middleware.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { and, asc, desc, eq } from "drizzle-orm";
import { requireAuth } from "./auth-middleware.server";

function tenantOf(context: { tenantId: string | null }) {
  if (!context.tenantId)
    throw new Response("Tenant scope required", { status: 400 });
  return context.tenantId;
}

/* ----------------------------- Public read ----------------------------- */

export const getPublicSite = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z.object({ slug: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { getDb } = await import("@/db/client.server");
    const {
      tenants,
      instituteSettings,
      siteMeta,
      siteSliders,
      siteTestimonials,
      siteGallery,
      siteFaqs,
      siteTimeline,
      notices,
      calendarEvents,
      teachers,
      classes,
    } = await import("@/db/schema");
    const db = getDb();

    const t = (
      await db.select().from(tenants).where(eq(tenants.slug, data.slug)).limit(1)
    )[0];
    if (!t) throw new Response("Not found", { status: 404 });

    const [
      inst,
      meta,
      sliders,
      testimonials,
      gallery,
      faqs,
      timeline,
      pinnedNotices,
      upcomingEvents,
      facultyRows,
      classRows,
    ] = await Promise.all([
      db
        .select()
        .from(instituteSettings)
        .where(eq(instituteSettings.tenantId, t.id))
        .limit(1),
      db.select().from(siteMeta).where(eq(siteMeta.tenantId, t.id)).limit(1),
      db
        .select()
        .from(siteSliders)
        .where(
          and(eq(siteSliders.tenantId, t.id), eq(siteSliders.isActive, true)),
        )
        .orderBy(asc(siteSliders.sortOrder)),
      db
        .select()
        .from(siteTestimonials)
        .where(
          and(
            eq(siteTestimonials.tenantId, t.id),
            eq(siteTestimonials.isActive, true),
          ),
        )
        .orderBy(asc(siteTestimonials.sortOrder)),
      db
        .select()
        .from(siteGallery)
        .where(eq(siteGallery.tenantId, t.id))
        .orderBy(asc(siteGallery.sortOrder))
        .limit(24),
      db
        .select()
        .from(siteFaqs)
        .where(and(eq(siteFaqs.tenantId, t.id), eq(siteFaqs.isActive, true)))
        .orderBy(asc(siteFaqs.sortOrder)),
      db
        .select()
        .from(siteTimeline)
        .where(eq(siteTimeline.tenantId, t.id))
        .orderBy(asc(siteTimeline.sortOrder)),
      db
        .select()
        .from(notices)
        .where(
          and(eq(notices.tenantId, t.id), eq(notices.isPublished, true)),
        )
        .orderBy(desc(notices.isPinned), desc(notices.createdAt))
        .limit(6),
      db
        .select()
        .from(calendarEvents)
        .where(eq(calendarEvents.tenantId, t.id))
        .orderBy(asc(calendarEvents.startDate))
        .limit(6),
      db
        .select({
          id: teachers.id,
          firstName: teachers.firstName,
          lastName: teachers.lastName,
          designation: teachers.designation,
          photoUrl: teachers.photoUrl,
          bio: teachers.bio,
        })
        .from(teachers)
        .where(
          and(eq(teachers.tenantId, t.id), eq(teachers.isActive, true)),
        )
        .limit(12),
      db
        .select({ id: classes.id, name: classes.name })
        .from(classes)
        .where(eq(classes.tenantId, t.id)),
    ]);

    return {
      tenant: {
        id: t.id,
        name: t.name,
        slug: t.slug,
        logoUrl: t.logoUrl,
        primaryColor: t.primaryColor,
      },
      institute: inst[0] ?? null,
      meta: meta[0] ?? null,
      sliders,
      testimonials,
      gallery,
      faqs,
      timeline,
      notices: pinnedNotices,
      events: upcomingEvents,
      faculty: facultyRows,
      classes: classRows,
    };
  });

export const submitContactMessage = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        tenantSlug: z.string().min(1),
        name: z.string().min(1),
        email: z.string().email().optional().or(z.literal("")),
        phone: z.string().optional(),
        subject: z.string().optional(),
        message: z.string().min(3),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { getDb } = await import("@/db/client.server");
    const { tenants, contactMessages } = await import("@/db/schema");
    const db = getDb();
    const t = (
      await db
        .select({ id: tenants.id })
        .from(tenants)
        .where(eq(tenants.slug, data.tenantSlug))
        .limit(1)
    )[0];
    if (!t) throw new Response("Not found", { status: 404 });
    await db.insert(contactMessages).values({
      tenantId: t.id,
      name: data.name,
      email: data.email || null,
      phone: data.phone || null,
      subject: data.subject || null,
      message: data.message,
    });
    return { ok: true };
  });

export const subscribeNewsletter = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        tenantSlug: z.string().min(1),
        email: z.string().email(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { getDb } = await import("@/db/client.server");
    const { tenants, newsletterSubscribers } = await import("@/db/schema");
    const db = getDb();
    const t = (
      await db
        .select({ id: tenants.id })
        .from(tenants)
        .where(eq(tenants.slug, data.tenantSlug))
        .limit(1)
    )[0];
    if (!t) throw new Response("Not found", { status: 404 });
    try {
      await db.insert(newsletterSubscribers).values({
        tenantId: t.id,
        email: data.email,
      });
    } catch {
      // already subscribed — treat as success
    }
    return { ok: true };
  });

/* ------------------------------- Admin --------------------------------- */

export const getSiteMeta = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { siteMeta } = await import("@/db/schema");
    const db = getDb();
    const m = (
      await db.select().from(siteMeta).where(eq(siteMeta.tenantId, tid)).limit(1)
    )[0];
    return m ?? null;
  });

const siteMetaSchema = z.object({
  heroTitle: z.string().nullable().optional(),
  heroSubtitle: z.string().nullable().optional(),
  heroImageUrl: z.string().nullable().optional(),
  aboutHtml: z.string().nullable().optional(),
  missionHtml: z.string().nullable().optional(),
  visionHtml: z.string().nullable().optional(),
  footerText: z.string().nullable().optional(),
  logoUrl: z.string().nullable().optional(),
  faviconUrl: z.string().nullable().optional(),
  contactEmail: z.string().nullable().optional(),
  contactPhone: z.string().nullable().optional(),
  contactAddress: z.string().nullable().optional(),
  mapEmbed: z.string().nullable().optional(),
  socialFacebook: z.string().nullable().optional(),
  socialInstagram: z.string().nullable().optional(),
  socialTwitter: z.string().nullable().optional(),
  socialYoutube: z.string().nullable().optional(),
  socialLinkedin: z.string().nullable().optional(),
  googleAnalyticsId: z.string().nullable().optional(),
  language: z.string().default("en"),
  isPublished: z.boolean().default(true),
});

export const saveSiteMeta = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => siteMetaSchema.parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { siteMeta } = await import("@/db/schema");
    const db = getDb();
    const payload = {
      tenantId: tid,
      ...data,
      updatedAt: new Date(),
    };
    await db
      .insert(siteMeta)
      .values(payload)
      .onConflictDoUpdate({
        target: siteMeta.tenantId,
        set: { ...data, updatedAt: new Date() },
      });
    return { ok: true };
  });

/* --------------------------- Generic CRUD ------------------------------ */

const idOnly = z.object({ id: z.string().uuid() });

/* Sliders */
export const listSliders = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { siteSliders } = await import("@/db/schema");
    const db = getDb();
    return db
      .select()
      .from(siteSliders)
      .where(eq(siteSliders.tenantId, tid))
      .orderBy(asc(siteSliders.sortOrder));
  });

export const saveSlider = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        title: z.string().min(1),
        subtitle: z.string().nullable().optional(),
        imageUrl: z.string().min(1),
        ctaLabel: z.string().nullable().optional(),
        ctaUrl: z.string().nullable().optional(),
        sortOrder: z.number().default(0),
        isActive: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { siteSliders } = await import("@/db/schema");
    const db = getDb();
    if (data.id) {
      await db
        .update(siteSliders)
        .set({
          title: data.title,
          subtitle: data.subtitle ?? null,
          imageUrl: data.imageUrl,
          ctaLabel: data.ctaLabel ?? null,
          ctaUrl: data.ctaUrl ?? null,
          sortOrder: data.sortOrder,
          isActive: data.isActive,
        })
        .where(and(eq(siteSliders.id, data.id), eq(siteSliders.tenantId, tid)));
      return { id: data.id };
    }
    const [row] = await db
      .insert(siteSliders)
      .values({
        tenantId: tid,
        title: data.title,
        subtitle: data.subtitle ?? null,
        imageUrl: data.imageUrl,
        ctaLabel: data.ctaLabel ?? null,
        ctaUrl: data.ctaUrl ?? null,
        sortOrder: data.sortOrder,
        isActive: data.isActive,
      })
      .returning({ id: siteSliders.id });
    return { id: row.id };
  });

export const deleteSlider = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => idOnly.parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { siteSliders } = await import("@/db/schema");
    const db = getDb();
    await db
      .delete(siteSliders)
      .where(and(eq(siteSliders.id, data.id), eq(siteSliders.tenantId, tid)));
    return { ok: true };
  });

/* Testimonials */
export const listTestimonials = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { siteTestimonials } = await import("@/db/schema");
    const db = getDb();
    return db
      .select()
      .from(siteTestimonials)
      .where(eq(siteTestimonials.tenantId, tid))
      .orderBy(asc(siteTestimonials.sortOrder));
  });

export const saveTestimonial = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        authorName: z.string().min(1),
        authorRole: z.string().nullable().optional(),
        quote: z.string().min(1),
        avatarUrl: z.string().nullable().optional(),
        rating: z.number().min(1).max(5).default(5),
        isActive: z.boolean().default(true),
        sortOrder: z.number().default(0),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { siteTestimonials } = await import("@/db/schema");
    const db = getDb();
    if (data.id) {
      await db
        .update(siteTestimonials)
        .set({
          authorName: data.authorName,
          authorRole: data.authorRole ?? null,
          quote: data.quote,
          avatarUrl: data.avatarUrl ?? null,
          rating: data.rating,
          isActive: data.isActive,
          sortOrder: data.sortOrder,
        })
        .where(
          and(
            eq(siteTestimonials.id, data.id),
            eq(siteTestimonials.tenantId, tid),
          ),
        );
      return { id: data.id };
    }
    const [row] = await db
      .insert(siteTestimonials)
      .values({
        tenantId: tid,
        authorName: data.authorName,
        authorRole: data.authorRole ?? null,
        quote: data.quote,
        avatarUrl: data.avatarUrl ?? null,
        rating: data.rating,
        isActive: data.isActive,
        sortOrder: data.sortOrder,
      })
      .returning({ id: siteTestimonials.id });
    return { id: row.id };
  });

export const deleteTestimonial = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => idOnly.parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { siteTestimonials } = await import("@/db/schema");
    const db = getDb();
    await db
      .delete(siteTestimonials)
      .where(
        and(
          eq(siteTestimonials.id, data.id),
          eq(siteTestimonials.tenantId, tid),
        ),
      );
    return { ok: true };
  });

/* Gallery */
export const listGallery = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { siteGallery } = await import("@/db/schema");
    const db = getDb();
    return db
      .select()
      .from(siteGallery)
      .where(eq(siteGallery.tenantId, tid))
      .orderBy(asc(siteGallery.sortOrder));
  });

export const saveGalleryItem = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        title: z.string().nullable().optional(),
        imageUrl: z.string().min(1),
        category: z.string().default("general"),
        sortOrder: z.number().default(0),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { siteGallery } = await import("@/db/schema");
    const db = getDb();
    if (data.id) {
      await db
        .update(siteGallery)
        .set({
          title: data.title ?? null,
          imageUrl: data.imageUrl,
          category: data.category,
          sortOrder: data.sortOrder,
        })
        .where(and(eq(siteGallery.id, data.id), eq(siteGallery.tenantId, tid)));
      return { id: data.id };
    }
    const [row] = await db
      .insert(siteGallery)
      .values({
        tenantId: tid,
        title: data.title ?? null,
        imageUrl: data.imageUrl,
        category: data.category,
        sortOrder: data.sortOrder,
      })
      .returning({ id: siteGallery.id });
    return { id: row.id };
  });

export const deleteGalleryItem = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => idOnly.parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { siteGallery } = await import("@/db/schema");
    const db = getDb();
    await db
      .delete(siteGallery)
      .where(and(eq(siteGallery.id, data.id), eq(siteGallery.tenantId, tid)));
    return { ok: true };
  });

/* FAQs */
export const listFaqs = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { siteFaqs } = await import("@/db/schema");
    const db = getDb();
    return db
      .select()
      .from(siteFaqs)
      .where(eq(siteFaqs.tenantId, tid))
      .orderBy(asc(siteFaqs.sortOrder));
  });

export const saveFaq = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        question: z.string().min(1),
        answer: z.string().min(1),
        category: z.string().default("general"),
        sortOrder: z.number().default(0),
        isActive: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { siteFaqs } = await import("@/db/schema");
    const db = getDb();
    if (data.id) {
      await db
        .update(siteFaqs)
        .set({
          question: data.question,
          answer: data.answer,
          category: data.category,
          sortOrder: data.sortOrder,
          isActive: data.isActive,
        })
        .where(and(eq(siteFaqs.id, data.id), eq(siteFaqs.tenantId, tid)));
      return { id: data.id };
    }
    const [row] = await db
      .insert(siteFaqs)
      .values({
        tenantId: tid,
        question: data.question,
        answer: data.answer,
        category: data.category,
        sortOrder: data.sortOrder,
        isActive: data.isActive,
      })
      .returning({ id: siteFaqs.id });
    return { id: row.id };
  });

export const deleteFaq = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => idOnly.parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { siteFaqs } = await import("@/db/schema");
    const db = getDb();
    await db
      .delete(siteFaqs)
      .where(and(eq(siteFaqs.id, data.id), eq(siteFaqs.tenantId, tid)));
    return { ok: true };
  });

/* Timeline */
export const listTimeline = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { siteTimeline } = await import("@/db/schema");
    const db = getDb();
    return db
      .select()
      .from(siteTimeline)
      .where(eq(siteTimeline.tenantId, tid))
      .orderBy(asc(siteTimeline.sortOrder));
  });

export const saveTimelineItem = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        yearLabel: z.string().min(1),
        title: z.string().min(1),
        description: z.string().nullable().optional(),
        sortOrder: z.number().default(0),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { siteTimeline } = await import("@/db/schema");
    const db = getDb();
    if (data.id) {
      await db
        .update(siteTimeline)
        .set({
          yearLabel: data.yearLabel,
          title: data.title,
          description: data.description ?? null,
          sortOrder: data.sortOrder,
        })
        .where(
          and(eq(siteTimeline.id, data.id), eq(siteTimeline.tenantId, tid)),
        );
      return { id: data.id };
    }
    const [row] = await db
      .insert(siteTimeline)
      .values({
        tenantId: tid,
        yearLabel: data.yearLabel,
        title: data.title,
        description: data.description ?? null,
        sortOrder: data.sortOrder,
      })
      .returning({ id: siteTimeline.id });
    return { id: row.id };
  });

export const deleteTimelineItem = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => idOnly.parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { siteTimeline } = await import("@/db/schema");
    const db = getDb();
    await db
      .delete(siteTimeline)
      .where(
        and(eq(siteTimeline.id, data.id), eq(siteTimeline.tenantId, tid)),
      );
    return { ok: true };
  });

/* Inbox */
export const listContactMessages = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { contactMessages } = await import("@/db/schema");
    const db = getDb();
    return db
      .select()
      .from(contactMessages)
      .where(eq(contactMessages.tenantId, tid))
      .orderBy(desc(contactMessages.createdAt))
      .limit(200);
  });

export const markContactRead = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), isRead: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { contactMessages } = await import("@/db/schema");
    const db = getDb();
    await db
      .update(contactMessages)
      .set({ isRead: data.isRead })
      .where(
        and(
          eq(contactMessages.id, data.id),
          eq(contactMessages.tenantId, tid),
        ),
      );
    return { ok: true };
  });

export const deleteContactMessage = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => idOnly.parse(d))
  .handler(async ({ data, context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { contactMessages } = await import("@/db/schema");
    const db = getDb();
    await db
      .delete(contactMessages)
      .where(
        and(
          eq(contactMessages.id, data.id),
          eq(contactMessages.tenantId, tid),
        ),
      );
    return { ok: true };
  });

/* Newsletter */
export const listSubscribers = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const tid = tenantOf(context);
    const { getDb } = await import("@/db/client.server");
    const { newsletterSubscribers } = await import("@/db/schema");
    const db = getDb();
    return db
      .select()
      .from(newsletterSubscribers)
      .where(eq(newsletterSubscribers.tenantId, tid))
      .orderBy(desc(newsletterSubscribers.createdAt))
      .limit(500);
  });
