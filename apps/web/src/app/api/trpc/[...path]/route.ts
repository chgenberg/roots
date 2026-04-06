import type { NextRequest } from "next/server";
import { proxyRequestToBackend } from "@/lib/proxy-to-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ path?: string[] }> };

async function handle(req: NextRequest, ctx: Ctx) {
  const { path = [] } = await ctx.params;
  const suffix = path.length ? path.join("/") : "";
  const backendPath = suffix ? `/trpc/${suffix}` : "/trpc";
  return proxyRequestToBackend(req, backendPath);
}

export async function GET(req: NextRequest, ctx: Ctx) {
  return handle(req, ctx);
}

export async function POST(req: NextRequest, ctx: Ctx) {
  return handle(req, ctx);
}
