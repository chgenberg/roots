import { guides } from "@/content/guides";

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

export async function GET() {
  const items = [...guides]
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .map((guide) => {
      const link = `${SITE_URL}/guider/${guide.slug}`;
      const pubDate = new Date(`${guide.publishedAt}T00:00:00.000Z`).toUTCString();
      return `    <item>
      <title>${escapeXml(guide.title)}</title>
      <description>${escapeXml(guide.description)}</description>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${pubDate}</pubDate>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Roots Guider</title>
    <link>${SITE_URL}</link>
    <description>Guider om föreningsförsäljning, hårvård och Roots produkter.</description>
    <language>sv-SE</language>
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
