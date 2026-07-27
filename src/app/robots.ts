import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tradelog.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Authenticated + API surfaces have no public content to index.
      // /tiktok-demo is a review-only utility page, not a marketing surface.
      disallow: ["/dashboard", "/setups", "/paper-lab", "/api", "/tiktok-demo"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
