import { Hono } from "hono";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@roots/db";
import { reviewerMessages, reviewerThreads } from "@roots/db/schema";
import { requireReviewer } from "../lib/reviewer";
import { llmReviewerPrompt, llmReviewerTurn } from "../lib/reviewer-llm";
import {
  isValidReviewerUrl,
  putReviewerImage,
  readReviewerImageById,
} from "../lib/reviewer-media";
import { notifyFeedbackSubmitted } from "../lib/reviewer-notify";
import { reviewerClientIp, reviewerRateLimited } from "../lib/reviewer-rate-limit";
import { requireSession } from "../lib/http-session";
import { isReviewerEmail } from "@roots/contracts";
import { users } from "@roots/db/schema";
import { childLogger } from "../lib/logger";

const log = childLogger("reviewer");
const MAX_TEXT = 8000;
const MAX_IMAGES = 4;
const MAX_BYTES = 3_500_000;

export const reviewer = new Hono();

function parseUrls(raw: string): string[] {
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) ? v.filter((u): u is string => typeof u === "string") : [];
  } catch {
    return [];
  }
}

function titleFrom(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "Skärmdump";
  return clean.length > 48 ? `${clean.slice(0, 47)}…` : clean;
}

function serializeThread(thread: {
  id: string;
  title: string;
  status: string;
}) {
  return { id: thread.id, title: thread.title, status: thread.status };
}

reviewer.get("/thread", async (c) => {
  const user = await requireReviewer(c);
  if (!user) return c.json({ error: "FORBIDDEN" }, 403);

  const [thread] = await db
    .select()
    .from(reviewerThreads)
    .where(eq(reviewerThreads.userId, user.userId))
    .orderBy(desc(reviewerThreads.updatedAt))
    .limit(1);
  if (!thread) return c.json({ thread: null, messages: [] });

  const messages = await db
    .select()
    .from(reviewerMessages)
    .where(eq(reviewerMessages.threadId, thread.id))
    .orderBy(asc(reviewerMessages.createdAt));

  return c.json({
    thread: serializeThread(thread),
    messages: messages.map((m) => ({
      id: m.id,
      role: m.role,
      body: m.body,
      imageUrls: parseUrls(m.imageUrls),
    })),
  });
});

reviewer.post("/thread", async (c) => {
  const user = await requireReviewer(c);
  if (!user) return c.json({ error: "FORBIDDEN" }, 403);

  const [thread] = await db
    .insert(reviewerThreads)
    .values({ userId: user.userId })
    .returning();
  return c.json({
    thread: { id: thread.id, title: "", status: "gathering" },
    messages: [],
  });
});

reviewer.post("/turn", async (c) => {
  const user = await requireReviewer(c);
  if (!user) return c.json({ error: "FORBIDDEN" }, 403);
  if (reviewerRateLimited("reviewer-turn", user.userId || reviewerClientIp(c), 20)) {
    return c.json({ error: "RATE_LIMITED" }, 429);
  }

  const body = (await c.req.json().catch(() => null)) as {
    threadId?: unknown;
    text?: unknown;
    imageUrls?: unknown;
  } | null;
  if (!body) return c.json({ error: "INVALID_BODY" }, 400);

  const text = String(body.text ?? "").trim().slice(0, MAX_TEXT);
  const imageUrls = (Array.isArray(body.imageUrls) ? body.imageUrls : [])
    .filter((u): u is string => typeof u === "string" && isValidReviewerUrl(u))
    .slice(0, MAX_IMAGES);
  if (!text && imageUrls.length === 0) {
    return c.json({ error: "EMPTY" }, 400);
  }

  let thread =
    typeof body.threadId === "string" && body.threadId
      ? (
          await db
            .select()
            .from(reviewerThreads)
            .where(
              and(eq(reviewerThreads.id, body.threadId), eq(reviewerThreads.userId, user.userId))
            )
            .limit(1)
        )[0] ?? null
      : null;
  if (!thread || thread.status === "submitted" || thread.status === "done") {
    const [created] = await db
      .insert(reviewerThreads)
      .values({ userId: user.userId, title: titleFrom(text) })
      .returning();
    thread = created;
  } else if (!thread.title) {
    await db
      .update(reviewerThreads)
      .set({ title: titleFrom(text), updatedAt: new Date() })
      .where(eq(reviewerThreads.id, thread.id));
  }

  await db.insert(reviewerMessages).values({
    threadId: thread.id,
    role: "user",
    body: text,
    imageUrls: JSON.stringify(imageUrls),
  });

  const history = await db
    .select()
    .from(reviewerMessages)
    .where(eq(reviewerMessages.threadId, thread.id))
    .orderBy(asc(reviewerMessages.createdAt));

  const result = await llmReviewerTurn(
    history.map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      body: m.body,
      imageUrls: parseUrls(m.imageUrls),
    }))
  );

  const reply =
    result?.reply ||
    "Jag fick inte ihop det just nu. Kan du skriva om det med en mening om vilken sida det gäller och vad som ska hända istället?";
  const nextStatus =
    thread.status === "submitted" || thread.status === "done"
      ? thread.status
      : result?.phase === "ready"
        ? "ready"
        : "gathering";

  const [assistant] = await db
    .insert(reviewerMessages)
    .values({ threadId: thread.id, role: "assistant", body: reply })
    .returning();
  const [updated] = await db
    .update(reviewerThreads)
    .set({ status: nextStatus, updatedAt: new Date() })
    .where(eq(reviewerThreads.id, thread.id))
    .returning();

  return c.json({
    thread: {
      id: updated.id,
      title: updated.title || titleFrom(text),
      status: updated.status,
    },
    message: {
      id: assistant.id,
      role: "assistant",
      body: reply,
      imageUrls: [],
    },
    phase: result?.phase ?? "ask",
  });
});

reviewer.post("/submit", async (c) => {
  const user = await requireReviewer(c);
  if (!user) return c.json({ error: "FORBIDDEN" }, 403);
  if (reviewerRateLimited("reviewer-submit", user.userId || reviewerClientIp(c), 8)) {
    return c.json({ error: "RATE_LIMITED" }, 429);
  }

  const body = (await c.req.json().catch(() => null)) as { threadId?: unknown } | null;
  const threadId = typeof body?.threadId === "string" ? body.threadId : "";
  if (!threadId) return c.json({ error: "MISSING_THREAD" }, 400);

  const [thread] = await db
    .select()
    .from(reviewerThreads)
    .where(and(eq(reviewerThreads.id, threadId), eq(reviewerThreads.userId, user.userId)))
    .limit(1);
  if (!thread) return c.json({ error: "NOT_FOUND" }, 404);
  if (thread.status === "submitted" || thread.status === "done") {
    return c.json({ thread: serializeThread(thread) });
  }

  const history = await db
    .select()
    .from(reviewerMessages)
    .where(eq(reviewerMessages.threadId, thread.id))
    .orderBy(asc(reviewerMessages.createdAt));
  if (!history.some((m) => m.role === "user")) {
    return c.json({ error: "EMPTY" }, 400);
  }

  const prompt = await llmReviewerPrompt(
    history.map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      body: m.body,
      imageUrls: parseUrls(m.imageUrls),
    }))
  );
  if (!prompt) return c.json({ error: "PROMPT_FAILED" }, 502);

  const thanks =
    "Skickat. Christopher ser det i sin översikt. Starta en ny chatt om något mer ska ändras.";
  const [assistant] = await db
    .insert(reviewerMessages)
    .values({ threadId: thread.id, role: "assistant", body: thanks })
    .returning();
  const [updated] = await db
    .update(reviewerThreads)
    .set({ status: "submitted", cursorPrompt: prompt, updatedAt: new Date() })
    .where(eq(reviewerThreads.id, thread.id))
    .returning();

  void notifyFeedbackSubmitted({
    fromName: user.name || "Feedback",
    title: updated.title,
  });

  return c.json({
    thread: serializeThread(updated),
    message: { id: assistant.id, role: "assistant", body: thanks, imageUrls: [] },
  });
});

reviewer.post("/upload", async (c) => {
  const user = await requireReviewer(c);
  if (!user) return c.json({ error: "FORBIDDEN" }, 403);
  if (reviewerRateLimited("reviewer-upload", user.userId || reviewerClientIp(c), 30)) {
    return c.json({ error: "RATE_LIMITED" }, 429);
  }

  const form = await c.req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return c.json({ error: "MISSING_FILE" }, 400);
  }
  if (file.size <= 0 || file.size > MAX_BYTES) {
    return c.json({ error: "FILE_TOO_LARGE" }, 400);
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const url = await putReviewerImage({
    userId: user.userId,
    buffer,
    contentType: file.type || "image/png",
  });
  if (!url) return c.json({ error: "INVALID_IMAGE" }, 400);
  return c.json({ url });
});

reviewer.get("/media/:id", async (c) => {
  const session = await requireSession(c);
  if (!session?.userId) return c.json({ error: "FORBIDDEN" }, 403);

  const [viewer] = await db
    .select({ email: users.email, role: users.role })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);
  const isAdmin = viewer?.role === "INTERNAL_ADMIN";
  const isReviewerUser = isReviewerEmail(viewer?.email);
  if (!isAdmin && !isReviewerUser) {
    return c.json({ error: "FORBIDDEN" }, 403);
  }

  const file = await readReviewerImageById(c.req.param("id"));
  if (!file) return c.json({ error: "NOT_FOUND" }, 404);
  if (!isAdmin && file.userId !== session.userId) {
    return c.json({ error: "FORBIDDEN" }, 403);
  }

  return new Response(new Uint8Array(file.bytes), {
    status: 200,
    headers: {
      "content-type": file.contentType,
      "cache-control": "private, max-age=86400",
    },
  });
});

reviewer.onError((err, c) => {
  log.error({ err, path: c.req.path }, "reviewer route error");
  return c.json({ error: "INTERNAL" }, 500);
});
