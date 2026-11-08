import { describe, expect, it } from "vitest";
import { layoutOverridesSchema, resolveLayout } from "@/modules/website/schemas/website-layout";

const parse = (announcements: unknown) => layoutOverridesSchema.safeParse({ announcements });

describe("news and offers strip", () => {
  it("shows nothing until the clinic adds news", () => {
    expect(resolveLayout({}).announcements).toEqual([]);
    expect(resolveLayout(undefined).announcements).toEqual([]);
  });

  it("shows only visible items with text, in order, and fills a missing language", () => {
    const layout = layoutOverridesSchema.parse({
      announcements: [
        { en: "Free sugar test on Friday", bn: "শুক্রবার বিনামূল্যে সুগার টেস্ট", link: "/#appointment" },
        { en: "Paused offer", bn: "", visible: false },
        { en: "", bn: "শুধু বাংলা খবর" },
        { en: "Holiday notice", bn: "ছুটির নোটিশ", link: "https://example.com/notice" },
      ],
    });
    const shown = resolveLayout(layout).announcements;
    expect(shown.map((item) => item.text.en)).toEqual(["Free sugar test on Friday", "শুধু বাংলা খবর", "Holiday notice"]);
    expect(shown[1].text).toEqual({ en: "শুধু বাংলা খবর", bn: "শুধু বাংলা খবর" });
    expect(shown.map((item) => item.href)).toEqual(["/#appointment", "", "https://example.com/notice"]);
  });

  it("rejects an empty item, an unsafe link, too long a text and too many items", () => {
    expect(parse([{ en: "", bn: "" }]).success).toBe(false);
    for (const link of ["javascript:alert(1)", "//evil.example", "http://plain.example", "data:text/html,x", "ftp://x.example"]) {
      expect(parse([{ en: "Offer", bn: "অফার", link }]).success, link).toBe(false);
    }
    expect(parse([{ en: "x".repeat(201), bn: "" }]).success).toBe(false);
    expect(parse(Array.from({ length: 9 }, () => ({ en: "Offer", bn: "অফার" }))).success).toBe(false);
  });

  it("accepts a page of this site, an https link, or no link", () => {
    expect(parse([{ en: "A", bn: "ক", link: "/#appointment" }, { en: "B", bn: "খ", link: "https://example.com/x" }, { en: "C", bn: "গ", link: "" }]).success).toBe(true);
  });
});
