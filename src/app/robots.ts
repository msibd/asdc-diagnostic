import type { MetadataRoute } from "next";

const siteUrl = (process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");

// Search engines may read the public website; the staff area and the API are off limits.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/", "/login", "/forgot-password", "/dashboard", "/appointments", "/patients",
        "/services", "/billing", "/inventory", "/expenses", "/reports", "/website",
        "/reviews", "/access", "/email-settings", "/sms-settings", "/security", "/offline", "/orders", "/r/", "/verify",
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
