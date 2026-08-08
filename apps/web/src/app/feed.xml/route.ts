import { getGuides } from "@/content/guides";

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://roots.se"
).replace(/\/$/, "");

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const locale = url.searchParams.get("lang") === "en" ? "en" : "sv";
  const guides = getGuides(locale);
  const prefix = locale === "en" ? "/en" : "";

  const items = [...guides]
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .map((guide) => {
      const link = `${SITE_URL}${prefix}/guider/${guide.slug}`;
      const pubDate = new Date(
        `${guide.publishedAt}T00:00:00.000Z`
      ).toUTCString();
      return `    <item>
      <title>${escapeXml(guide.title)}</title>
      <description>${escapeXml(guide.description)}</description>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${pubDate}</pubDate>
    </item>`;
    })
    .join("\n");

  const channelTitle =
    locale === "en" ? "Roots Guides" : "Roots Guider";
  const channelDescription =
    locale === "en"
      ? "Guides on club fundraising, hair care and Roots products."
      : "Guider om föreningsförsäljning, hårvård och Roots produkter.";
  const language = locale === "en" ? "en-GB" : "sv-SE";

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(channelTitle)}</title>
    <link>${SITE_URL}${prefix}</link>
    <description>${escapeXml(channelDescription)}</description>
    <language>${language}</language>
${items}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600",
    },
  });
}
