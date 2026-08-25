import { getEmailSender } from "./email";
import { childLogger } from "./logger";

const log = childLogger("reviewer-notify");

function notifyEmail(): string {
  return (process.env.REVIEWER_NOTIFY_EMAIL || "ch.genberg@gmail.com").trim();
}

function inboxUrl(): string {
  const base = (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    "https://roots.nu"
  ).replace(/\/$/, "");
  return `${base}/portal/feedback`;
}

export async function notifyFeedbackSubmitted(args: {
  fromName: string;
  title: string;
}): Promise<void> {
  const to = notifyEmail();
  if (!to) return;
  const inbox = inboxUrl();
  const subject = `Ny feedback från ${args.fromName}`;
  const text = [
    `${args.fromName} har skickat en ändring${args.title ? ` — ${args.title}` : ""}.`,
    "",
    "Öppna admin → Feedback och kopiera promptet:",
    inbox,
  ].join("\n");
  try {
    const result = await getEmailSender().sendEmail({
      to,
      subject,
      text,
      html: `<p>${escapeHtml(args.fromName)} har skickat en ändring${
        args.title ? ` — ${escapeHtml(args.title)}` : ""
      }.</p><p>Öppna <a href="${escapeHtml(inbox)}">admin → Feedback</a> och kopiera promptet.</p>`,
    });
    if (!result.success) {
      log.error({ error: result.error }, "reviewer notify email failed");
    }
  } catch (err) {
    log.error({ err }, "reviewer notify email threw");
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
