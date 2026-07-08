import type { MetadataRoute } from "next";

// Disallow all crawlers — this is a private internal dashboard.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", disallow: "/" }],
  };
}
