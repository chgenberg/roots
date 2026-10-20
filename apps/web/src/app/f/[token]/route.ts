import { getBackendBase } from "@/lib/proxy-to-backend";
import { DEMO_GOALS_KR } from "@/i18n/dictionaries/demo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ token: string }> };

/**
 * Förslagslänken i lead-mejlen. Räknar att förslaget öppnats och skickar
 * vidare till demoshoppen med föreningens namn, webbplats (för logotypen)
 * och räkneexemplets belopp som mål.
 */
export async function GET(req: Request, ctx: Ctx) {
  const { token } = await ctx.params;
  const target = new URLSearchParams();
  try {
    const res = await fetch(`${getBackendBase()}/v1/outreach/p/${encodeURIComponent(token)}`, {
      headers: { "user-agent": req.headers.get("user-agent") ?? "" },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = (await res.json()) as {
        orgName?: string;
        website?: string | null;
        goalKr?: number | null;
      };
      if (data.orgName) target.set("forening", data.orgName.slice(0, 60));
      if (data.website) target.set("webb", data.website.slice(0, 120));
      if (data.goalKr) {
        const goal = DEMO_GOALS_KR.reduce((best, g) =>
          Math.abs(g - data.goalKr!) < Math.abs(best - data.goalKr!) ? g : best
        );
        target.set("mal", String(goal));
      }
    }
  } catch {
    /* länken ska alltid landa någonstans */
  }
  const qs = target.toString();
  return new Response(null, {
    status: 302,
    headers: { Location: qs ? `/prova?${qs}` : "/prova", "Cache-Control": "no-store" },
  });
}
