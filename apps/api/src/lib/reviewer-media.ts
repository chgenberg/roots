import { eq } from "drizzle-orm";
import { db } from "@roots/db";
import { reviewerMedia } from "@roots/db/schema";

const MEDIA_PREFIX = "/v1/reviewer/media/";
const MAX_BYTES = 3_500_000;
const ALLOWED = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"]);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function extFor(contentType: string): "png" | "jpg" | "webp" | "gif" | null {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("gif")) return "gif";
  return null;
}

function idFromUrl(url: string): string | null {
  const path = url.startsWith("http") ? new URL(url).pathname : url.split("?")[0];
  const idx = path.indexOf(MEDIA_PREFIX);
  if (idx === -1) return null;
  const id = path.slice(idx + MEDIA_PREFIX.length).split("/")[0] || "";
  if (!UUID_RE.test(id)) return null;
  return id;
}

export function isValidReviewerUrl(url: string): boolean {
  return typeof url === "string" && Boolean(idFromUrl(url));
}

export function reviewerMediaPath(id: string): string {
  return `${MEDIA_PREFIX}${id}`;
}

export async function putReviewerImage(params: {
  userId: string;
  buffer: Buffer;
  contentType: string;
}): Promise<string | null> {
  const contentType = params.contentType.toLowerCase().split(";")[0].trim();
  if (!ALLOWED.has(contentType)) return null;
  if (params.buffer.byteLength === 0 || params.buffer.byteLength > MAX_BYTES) {
    return null;
  }
  if (!extFor(contentType)) return null;

  const [row] = await db
    .insert(reviewerMedia)
    .values({
      userId: params.userId,
      contentType: contentType === "image/jpg" ? "image/jpeg" : contentType,
      bytes: params.buffer,
    })
    .returning({ id: reviewerMedia.id });
  if (!row) return null;
  return reviewerMediaPath(row.id);
}

export async function readReviewerImage(url: string): Promise<{
  bytes: Buffer;
  contentType: string;
  userId: string;
} | null> {
  const id = idFromUrl(url);
  if (!id) return null;
  const [row] = await db
    .select({
      bytes: reviewerMedia.bytes,
      contentType: reviewerMedia.contentType,
      userId: reviewerMedia.userId,
    })
    .from(reviewerMedia)
    .where(eq(reviewerMedia.id, id))
    .limit(1);
  if (!row) return null;
  const bytes = Buffer.isBuffer(row.bytes) ? row.bytes : Buffer.from(row.bytes);
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) return null;
  return { bytes, contentType: row.contentType, userId: row.userId };
}

export async function readReviewerImageById(id: string): Promise<{
  bytes: Buffer;
  contentType: string;
  userId: string;
} | null> {
  if (!UUID_RE.test(id)) return null;
  return readReviewerImage(reviewerMediaPath(id));
}
