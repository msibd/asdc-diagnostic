import { revalidateTag } from "next/cache";

// Tags for the public website's cached data. Only non-sensitive, clinic-wide content is cached:
// no patient, appointment, billing, prescription, or session data.
export const publicCacheTags = {
  clinic: "public-clinic",
  doctors: "public-doctors",
  gallery: "public-gallery",
  reviews: "public-reviews",
} as const;

// Route Handlers cannot use updateTag, so expire immediately: the next public request refetches.
export function invalidatePublicCache(tag: (typeof publicCacheTags)[keyof typeof publicCacheTags]) {
  revalidateTag(tag, { expire: 0 });
}
