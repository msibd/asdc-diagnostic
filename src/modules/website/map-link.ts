import { isSafeMapEmbed } from "@/modules/website/schemas/website-layout";

// Turns whatever the clinic pastes from Google Maps into a link the website can embed.
//
// Accepted: a share link (https://maps.app.goo.gl/…), the full address-bar link of a place, or the
// <iframe> code from "Share > Embed a map". A short link cannot be shown in a frame itself, so it
// is opened once, on the server, when the setting is saved: we follow its redirects to the full
// link, read the place's coordinates, and store a plain embed address built from them.
//
// The server only ever talks to Google's own map hosts (checked on every redirect hop), so this
// cannot be used to make the server fetch arbitrary addresses.

export class MapLinkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MapLinkError";
  }
}

const SHORT_HOSTS = /^(maps\.app\.goo\.gl|goo\.gl)$/i;
const GOOGLE_HOSTS = /^(www\.|maps\.)?google\.[a-z]{2,3}(\.[a-z]{2})?$/i;
const MAX_HOPS = 5;
const TIMEOUT_MS = 6000;

const isAllowedHost = (host: string) => SHORT_HOSTS.test(host) || GOOGLE_HOSTS.test(host);

/** The link inside pasted text: the src of an <iframe>, or the first https address. */
export function extractMapUrl(input: string) {
  const text = input.trim();
  const iframe = /<iframe[^>]*\ssrc=["']([^"']+)["']/i.exec(text);
  const candidate = (iframe?.[1] ?? text).replace(/&amp;/g, "&").trim();
  // An apostrophe is allowed: Google puts one in place names (".../place/Dr+Ovi's+Dental+Care/...").
  const match = /https:\/\/[^\s"<>]+/i.exec(candidate);
  return match?.[0] ?? null;
}

export type MapLocation = { lat: string; lng: string; name?: string } | { query: string };

/** Reads the place out of a full Google Maps address. */
export function parseMapLocation(url: URL): MapLocation | null {
  const href = decodeURIComponent(url.href.replace(/\+/g, " "));
  // "!3d<lat>!4d<lng>" is the pin itself; "@lat,lng" is only where the map was centred.
  const pin = /!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/.exec(href);
  const centre = /@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/.exec(href);
  const param = /[?&](?:q|query|ll|destination)=(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/.exec(href);
  const name = /\/maps\/place\/([^/@?]+)/.exec(href)?.[1]?.trim();
  const found = pin ?? param ?? centre;
  if (found) return { lat: found[1], lng: found[2], ...(name ? { name } : {}) };
  const query = url.searchParams.get("q") ?? url.searchParams.get("query") ?? name;
  return query?.trim() ? { query: query.trim().slice(0, 200) } : null;
}

export function buildEmbedUrl(location: MapLocation) {
  const place = "query" in location ? location.query : `${location.lat},${location.lng}`;
  return `https://www.google.com/maps?q=${encodeURIComponent(place)}&z=17&output=embed`;
}

/**
 * Follows a Google Maps link to its final address and returns what to store: the link as the
 * admin gave it, and the embeddable address built from it.
 */
export async function resolveMapLink(input: string, fetchImpl: typeof fetch = fetch): Promise<{ mapUrl: string; embedUrl: string }> {
  const extracted = extractMapUrl(input);
  if (!extracted) throw new MapLinkError("Paste a Google Maps link (https://…), or the embed code from Google Maps.");
  let current: URL;
  try {
    current = new URL(extracted);
  } catch {
    throw new MapLinkError("That is not a valid link.");
  }
  if (current.protocol !== "https:" || !isAllowedHost(current.hostname)) {
    throw new MapLinkError("Use a link from Google Maps (maps.app.goo.gl or google.com/maps).");
  }
  // Pasted embed code or an embed address is already embeddable. An ordinary place link is not
  // (Google refuses to show those in a frame), so it goes on to be turned into an embed address.
  const isEmbedAddress = current.pathname.startsWith("/maps/embed") || current.searchParams.get("output") === "embed";
  if (isEmbedAddress && isSafeMapEmbed(current.href)) return { mapUrl: extracted, embedUrl: current.href };
  if (GOOGLE_HOSTS.test(current.hostname) && !current.pathname.startsWith("/maps")) {
    throw new MapLinkError("That Google link is not a map. Open the place in Google Maps and copy its link.");
  }

  const original = extracted;
  for (let hop = 0; SHORT_HOSTS.test(current.hostname) && hop < MAX_HOPS; hop += 1) {
    let response: Response;
    try {
      response = await fetchImpl(current.href, {
        method: "GET",
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { "User-Agent": "Mozilla/5.0 (compatible; ClinicWebsite/1.0)", Accept: "text/html" },
      });
    } catch {
      throw new MapLinkError("Google Maps could not be reached to read this link. Try again, or paste the full link from the address bar.");
    }
    const location = response.headers.get("location");
    if (response.status < 300 || response.status >= 400 || !location) {
      throw new MapLinkError("This short link did not lead to a place. Open it in a browser and paste the full address-bar link instead.");
    }
    let next: URL;
    try {
      next = new URL(location, current);
    } catch {
      throw new MapLinkError("This link redirected somewhere that could not be read.");
    }
    if (next.protocol !== "https:" || !isAllowedHost(next.hostname)) {
      throw new MapLinkError("This link leads outside Google Maps, so it was not accepted.");
    }
    current = next;
  }
  if (SHORT_HOSTS.test(current.hostname)) throw new MapLinkError("This link redirects too many times.");

  const location = parseMapLocation(current);
  if (!location) {
    throw new MapLinkError("A place could not be found in this link. Search for the clinic in Google Maps, open it, and copy the link.");
  }
  return { mapUrl: original, embedUrl: buildEmbedUrl(location) };
}
