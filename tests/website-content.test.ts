import { beforeAll, describe, expect, it, vi } from "vitest";

// Next.js cache invalidation only works inside the running server; here we just record the calls.
const invalidations = vi.hoisted(() => [] as string[]);
vi.mock("@/lib/public-cache", () => ({
  publicCacheTags: { clinic: "public-clinic", gallery: "public-gallery", reviews: "public-reviews" },
  invalidatePublicCache: (tag: string) => { invalidations.push(tag); },
}));

import { GET as getContent, PUT as putContent } from "@/app/api/website-content/route";
import { GET as listServices, POST as createService } from "@/app/api/services/route";
import { PATCH as patchService } from "@/app/api/services/[id]/route";
import { prisma } from "@/lib/prisma";
import { readWebsiteContent } from "@/modules/website/queries/website-content";
import { emptyWebsiteContent } from "@/modules/website/schemas/website-content-schema";
import { LAYOUT_DEFAULTS, resolveLayout } from "@/modules/website/schemas/website-layout";
import { call, createSession, type TestUser } from "./helpers";

let admin: TestUser;
let receptionist: TestUser;

const valid = () => ({
  ...emptyWebsiteContent,
  clinicName: "Test Dental",
  heroTitleBn: "আপনার হাসিই আমাদের দায়িত্ব",
  heroTitleEn: "Your smile is our responsibility",
  doctorHighlightsEn: ["Trained in Dental Implant"],
  heroImageUrl: "https://example.com/hero.jpg",
});

const put = (body: unknown, cookie = admin.cookie) => call(putContent, "/api/website-content", { method: "PUT", body, cookie });

beforeAll(async () => {
  admin = await createSession("admin");
  receptionist = await createSession("receptionist");
});

describe("website content API", () => {
  it("is closed to anonymous visitors and to the receptionist", async () => {
    expect((await call(getContent, "/api/website-content", { cookie: "" })).status).toBe(401);
    expect((await call(getContent, "/api/website-content", { cookie: receptionist.cookie })).status).toBe(403);
    expect((await put(valid(), receptionist.cookie)).status).toBe(403);
  });

  it("returns empty defaults before anything is saved", async () => {
    const { status, json } = await call(getContent, "/api/website-content", { cookie: admin.cookie });
    expect(status).toBe(200);
    expect(json.content).toEqual(emptyWebsiteContent);
  });

  it("saves the centre's introduction, facts and photo, and rejects a non-https photo", async () => {
    const centre = { centreAboutEn: "A licensed diagnostic centre.", centreAboutBn: "একটি লাইসেন্সপ্রাপ্ত ডায়াগনস্টিক সেন্টার।", centreFactsEn: ["Established 2015"], centreFactsBn: [], centreImageUrl: "https://example.com/centre.jpg" };
    const saved = await put({ ...valid(), ...centre });
    expect(saved.status).toBe(200);
    const read = await readWebsiteContent();
    expect(read).toMatchObject({ ...centre });
    expect((await put({ ...valid(), centreImageUrl: "http://insecure.example/x.jpg" })).status).toBe(400);
    // An older client that does not send the new fields still saves, and the fields are cleared, not broken.
    const legacy: Record<string, unknown> = { ...valid(), ...centre };
    for (const key of Object.keys(centre)) delete legacy[key];
    expect((await put(legacy)).status).toBe(200);
    expect((await readWebsiteContent()).centreAboutEn).toBe("");
  });

  it("saves Bangla text, lists and image links, and the public site reads them", async () => {
    const { status, json } = await put(valid());
    expect(status).toBe(200);
    expect(json.content.heroTitleBn).toBe("আপনার হাসিই আমাদের দায়িত্ব"); // Bangla survives the round trip
    expect(json.content.doctorHighlightsEn).toEqual(["Trained in Dental Implant"]);
    const row = await prisma.clinicContent.findUniqueOrThrow({ where: { id: "primary" } });
    expect(row.heroImageUrl).toBe("https://example.com/hero.jpg");
    expect((await prisma.auditEvent.count({ where: { entity: "ClinicContent" } }))).toBeGreaterThan(0);
    // The public site caches this content, so saving must expire the clinic cache tag.
    expect(invalidations).toContain("public-clinic");
    expect((await readWebsiteContent()).clinicName).toBe("Test Dental");
  });

  it("stores empty image links as null and trims text", async () => {
    await put({ ...valid(), clinicName: "  Padded  ", heroImageUrl: "" });
    const row = await prisma.clinicContent.findUniqueOrThrow({ where: { id: "primary" } });
    expect(row.clinicName).toBe("Padded");
    expect(row.heroImageUrl).toBeNull();
  });

  it("rejects bad input with a message per field", async () => {
    const { status, json } = await put({
      ...valid(),
      heroTitleEn: "x".repeat(161),
      heroImageUrl: "http://insecure.example/a.png",
      doctorHighlightsEn: ["ok", ""],
      doctorHighlightsBn: Array.from({ length: 9 }, (_, i) => `line ${i}`),
    });
    expect(status).toBe(400);
    expect(Object.keys(json.fieldErrors).sort()).toEqual(["doctorHighlightsBn", "doctorHighlightsEn", "heroImageUrl", "heroTitleEn"]);
    expect(json.error).toBe(Object.values(json.fieldErrors)[0]);
    expect((await put({ ...valid(), heroImageUrl: "javascript:alert(1)" })).status).toBe(400);
    expect((await put({ ...valid(), clinicName: 42 })).status).toBe(400);
  });

  it("rejects a body that is not JSON", async () => {
    const request = new Request("http://localhost:3000/api/website-content", {
      method: "PUT",
      headers: { cookie: admin.cookie, "content-type": "application/json" },
      body: "{not json",
    });
    expect((await putContent(request)).status).toBe(400);
  });
});

describe("website layout (menu, headings, cards)", () => {
  const withLayout = (layout: unknown) => ({ ...valid(), layout });

  it("resolves to the built-in wording when nothing is changed", () => {
    expect(resolveLayout({})).toEqual({ ...LAYOUT_DEFAULTS, facebookUrl: "" });
    expect(resolveLayout(undefined).nav.home.label.bn).toBe("হোম");
  });

  it("saves news and offers from the admin panel, keeps them in order, and refuses an unsafe link", async () => {
    const news = [{ en: "Free sugar test", bn: "বিনামূল্যে সুগার টেস্ট", link: "/#appointment" }, { en: "Paused", bn: "বন্ধ", visible: false }];
    const saved = await put(withLayout({ announcements: news }));
    expect(saved.status).toBe(200);
    expect(resolveLayout((await readWebsiteContent()).layout).announcements).toEqual([{ text: { en: "Free sugar test", bn: "বিনামূল্যে সুগার টেস্ট" }, href: "/#appointment" }]);
    // The tag on the strip is editable; each language falls back to the built-in wording.
    expect(resolveLayout({}).announcementLabel).toEqual({ en: "News & offers", bn: "নিউজ ও অফার" });
    expect((await put(withLayout({ announcementLabel: { en: "Notice board" }, announcements: news }))).status).toBe(200);
    expect(resolveLayout((await readWebsiteContent()).layout).announcementLabel).toEqual({ en: "Notice board", bn: "নিউজ ও অফার" });
    expect((await put(withLayout({ announcementLabel: { en: "x".repeat(41) } }))).status).toBe(400);
    expect((await put(withLayout({ announcements: [{ en: "Offer", bn: "অফার", link: "javascript:alert(1)" }] }))).status).toBe(400);
    // Clearing the list removes the strip again.
    expect((await put(withLayout({ announcements: [] }))).status).toBe(200);
    expect(resolveLayout((await readWebsiteContent()).layout).announcements).toEqual([]);
  });

  it("falls back per language and per field", () => {
    const layout = resolveLayout({
      nav: { about: { label: { bn: "আমাদের কথা" } } },
      sections: { services: { title: { en: "Our treatments" } } },
    });
    expect(layout.nav.about.label).toEqual({ en: "About", bn: "আমাদের কথা" });
    expect(layout.sections.services.title).toEqual({ en: "Our treatments", bn: "পরীক্ষা ও সেবা" });
    expect(layout.sections.services.badge).toEqual(LAYOUT_DEFAULTS.sections.services.badge);
  });

  it("hiding a section also removes it from the menu, and only some sections can be hidden", () => {
    const layout = resolveLayout({ sections: { gallery: { visible: false }, services: { visible: false } } });
    expect(layout.sections.gallery.visible).toBe(false);
    expect(layout.nav.gallery.visible).toBe(false);
    expect(layout.sections.services.visible).toBe(true); // services cannot be hidden
    expect(resolveLayout({ nav: { about: { visible: false } } }).nav.about.visible).toBe(false);
  });

  it("shows a one-language card in both languages, and keeps custom card order", () => {
    const layout = resolveLayout({
      whyCards: [
        { icon: "heart", title: { en: "", bn: "যত্ন" }, text: { en: "Gentle", bn: "" } },
        { icon: "clock", title: { en: "Hours", bn: "সময়" }, text: { en: "", bn: "" } },
      ],
    });
    expect(layout.whyCards.map((card) => card.icon)).toEqual(["heart", "clock"]);
    expect(layout.whyCards[0].title).toEqual({ en: "যত্ন", bn: "যত্ন" });
    expect(layout.whyCards[0].text).toEqual({ en: "Gentle", bn: "Gentle" });
  });

  it("saves the layout, including Bangla text, and returns it", async () => {
    const layout = {
      nav: { gallery: { visible: false }, home: { label: { bn: "মূলপাতা" } } },
      sections: { services: { title: { bn: "আমাদের চিকিৎসা" } } },
      heroChips: [{ en: "Open six days", bn: "সপ্তাহে ছয় দিন খোলা" }],
      aboutCards: [{ icon: "heart", title: { en: "Care", bn: "যত্ন" }, text: { en: "We care", bn: "আমরা যত্ন নিই" } }],
      footerNote: { bn: "আপনার হাসিই আমাদের দায়িত্ব" },
      facebookUrl: "https://www.facebook.com/example",
    };
    const { status, json } = await put(withLayout(layout));
    expect(status).toBe(200);
    expect(json.content.layout).toEqual(layout);
    const row = await prisma.clinicContent.findUniqueOrThrow({ where: { id: "primary" } });
    expect((row.layout as { nav: { home: { label: { bn: string } } } }).nav.home.label.bn).toBe("মূলপাতা");
    expect((await readWebsiteContent()).layout).toEqual(layout);
  });

  it("clears the layout when an empty one is sent", async () => {
    await put(withLayout({ heroBadge: { en: "Custom" } }));
    expect((await put(withLayout({}))).json.content.layout).toEqual({});
  });

  it("rejects bad layout input, naming each field by its path", async () => {
    const { status, json } = await put(withLayout({
      nav: { home: { label: { en: "x".repeat(41) } } },
      sections: { services: { subtitle: { bn: "y".repeat(301) } } },
      aboutCards: [{ icon: "rocket", title: { en: "ok", bn: "" }, text: { en: "", bn: "" } }],
      whyCards: Array.from({ length: 7 }, () => ({ icon: "heart", title: { en: "t", bn: "" }, text: { en: "", bn: "" } })),
      heroChips: [{ en: "", bn: "" }],
      facebookUrl: "http://facebook.com/page",
    }));
    expect(status).toBe(400);
    expect(Object.keys(json.fieldErrors).sort()).toEqual([
      "layout.aboutCards.0.icon",
      "layout.facebookUrl",
      "layout.heroChips.0.en",
      "layout.nav.home.label.en",
      "layout.sections.services.subtitle.bn",
      "layout.whyCards",
    ]);
    expect((await put(withLayout({ aboutCards: [{ icon: "heart", title: { en: "", bn: "" }, text: { en: "a", bn: "" } }] }))).json.error).toMatch(/title/);
  });

  it("ignores a stored layout that no longer fits the schema instead of breaking the site", async () => {
    await prisma.clinicContent.update({ where: { id: "primary" }, data: { layout: { aboutCards: "not a list" } } });
    expect((await readWebsiteContent()).layout).toEqual({});
  });
});

describe("Bangla service text", () => {
  it("saves nameBn and descriptionBn, and leaves them alone when omitted", async () => {
    const body = { code: "BN-T", name: "Bn Test", category: "General", description: null, standardPrice: 0, durationMinutes: 30, nameBn: "পরীক্ষা", descriptionBn: "বিবরণ" };
    const created = await call(createService, "/api/services", { method: "POST", body, cookie: admin.cookie });
    expect(created.status).toBe(201);
    expect(created.json.service.nameBn).toBe("পরীক্ষা");
    const list = await call(listServices, "/api/services?includeInactive=true", { cookie: admin.cookie });
    expect(list.json.services.find((s: { code: string }) => s.code === "BN-T").descriptionBn).toBe("বিবরণ");
  });

  const base = { code: "PUB-T", name: "Public Fields Test", category: "General", description: null, standardPrice: 1000, durationMinutes: 30 };
  const postService = (body: Record<string, unknown>) => call(createService, "/api/services", { method: "POST", body: { ...base, ...body }, cookie: admin.cookie });

  it("saves the website presentation fields and returns the fee as text", async () => {
    const { status, json } = await postService({
      code: "PUB-1", name: "Presentation One", categoryBn: "সাধারণ", iconKey: "endodontics", badgeEn: "Same day", timeTextBn: "৪৫ মিনিট",
      feeMax: 1500, detailsBn: "বিস্তারিত", stepsEn: ["First", "Second"],
    });
    expect(status).toBe(201);
    expect(json.service).toMatchObject({ categoryBn: "সাধারণ", iconKey: "endodontics", badgeEn: "Same day", timeTextBn: "৪৫ মিনিট", feeMax: "1500", detailsBn: "বিস্তারিত", stepsEn: ["First", "Second"] });
  });

  it("keeps the presentation fields when only the active flag changes, and clears them on request", async () => {
    const created = (await postService({ code: "PUB-2", name: "Presentation Two", badgeEn: "Keep me", stepsEn: ["A"], feeMax: 2000 })).json.service;
    const id = created.id as string;
    // The active toggle sends the core fields only; presentation fields are absent.
    const toggle = await call(patchService, `/api/services/${id}`, {
      method: "PATCH", cookie: admin.cookie, params: { id },
      body: { code: "PUB-2", name: "Presentation Two", category: "General", description: null, standardPrice: 1000, durationMinutes: 30, isActive: false },
    });
    expect(toggle.status).toBe(200);
    expect(toggle.json.service).toMatchObject({ isActive: false, badgeEn: "Keep me", stepsEn: ["A"], feeMax: "2000" });
    const cleared = await call(patchService, `/api/services/${id}`, {
      method: "PATCH", cookie: admin.cookie, params: { id },
      body: { code: "PUB-2", name: "Presentation Two", category: "General", description: null, standardPrice: 1000, durationMinutes: 30, isActive: true, badgeEn: "", stepsEn: [], feeMax: null },
    });
    expect(cleared.json.service).toMatchObject({ badgeEn: null, stepsEn: [], feeMax: null });
  });

  it("rejects bad presentation input", async () => {
    expect((await postService({ code: "PUB-3", name: "Bad Fee", feeMax: 500 })).json.error).toMatch(/at least the standard price/);
    expect((await postService({ code: "PUB-4", name: "Bad Icon", iconKey: "rocket" })).status).toBe(400);
    expect((await postService({ code: "PUB-5", name: "Many Steps", stepsEn: Array.from({ length: 13 }, (_, i) => `step ${i}`) })).json.error).toMatch(/at most 12/);
    expect((await postService({ code: "PUB-6", name: "Empty Step", stepsBn: ["ok", ""] })).status).toBe(400);
    expect((await postService({ code: "PUB-7", name: "Long Badge", badgeEn: "x".repeat(81) })).status).toBe(400);
  });
});
