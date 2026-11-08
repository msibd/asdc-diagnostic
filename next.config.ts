import type { NextConfig } from "next";

// Content-Security-Policy, sent in REPORT-ONLY mode: browsers log what it would block (in the
// developer console) but block nothing. Watch the console on every page, then switch the header
// name to "Content-Security-Policy" to enforce it. Inline scripts/styles are allowed because Next.js
// and the theme bootstrap use them; tightening that needs nonces.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self'",
  // Only Google Maps may be shown in a frame on our pages (the clinic map).
  "frame-src https://www.google.com https://maps.google.com",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  /* config options here */
  // Do not advertise the framework in a response header.
  poweredByHeader: false,
  allowedDevOrigins: ["192.168.68.104"],
  cacheComponents: true,
  // Keep the development badge out of the sidebar (it sat on top of the profile card).
  devIndicators: { position: "bottom-right" },
  // The old admin address still works for bookmarks; it is a redirect, not a page.
  async redirects() {
    return [
      { source: "/admin", destination: "/dashboard", permanent: false },
      // The gallery is managed inside Website content.
      { source: "/gallery", destination: "/website#gallery", permanent: false },
      // The dashboard pages live at the top level (/access, /security…); this is the address in the original brief.
      { source: "/dashboard/administration/email-settings", destination: "/email-settings", permanent: false },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          // The app is never meant to be shown inside another site's frame.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Content-Security-Policy-Report-Only", value: contentSecurityPolicy },
          // Browsers must use HTTPS for this site once they have seen it (production only; on a
          // local http address the header would be ignored anyway).
          ...(process.env.NODE_ENV === "production" ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
          // No page uses the camera, microphone or location. (The map is an embedded iframe, which
          // this policy does not affect.)
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
