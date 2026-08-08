import { Hono } from "hono";
import { getEmailSender } from "../lib/email";
import { checkRateLimit } from "../lib/rate-limit";
import { childLogger } from "../lib/logger";
import { resolveUiLocale, uiError } from "../lib/ui-locale";

const log = childLogger("contact");

export const contact = new Hono();

// P3.24 (audit 2026-05-26): tidigare interpolerades användarens
// fritext rakt in i HTML-mailet till staffen — submittern kunde
// injecta <script>/<a>/etc i operations-inbox.
function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

contact.post("/", async (c) => {
  let body: {
    name: string;
    email: string;
    subject: string;
    message: string;
    locale?: string;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: uiError(resolveUiLocale(c), "invalidFormat") }, 400);
  }

  const locale = resolveUiLocale(c, body.locale);
  const { name, email, subject, message } = body;
  if (!name?.trim() || !email?.trim() || !subject?.trim() || !message?.trim()) {
    return c.json({ error: uiError(locale, "allFieldsRequired") }, 400);
  }

  if (
    name.length > 200 ||
    email.length > 254 ||
    subject.length > 300 ||
    message.length > 5000
  ) {
    return c.json({ error: uiError(locale, "fieldTooLong") }, 400);
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return c.json({ error: uiError(locale, "invalidEmail") }, 400);
  }

  const ip = c.req.header("x-forwarded-for") || "unknown";
  const rateCheck = await checkRateLimit(`contact:${ip}`, 5, 3600);
  if (!rateCheck.allowed) {
    return c.json({ error: uiError(locale, "rateLimited") }, 429);
  }

  try {
    const sender = getEmailSender();
    const recipientEmail = process.env.CONTACT_FORM_EMAIL || "hej@roots.se";

    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safeSubject = escapeHtml(subject);
    const safeMessage = escapeHtml(message).replace(/\n/g, "<br />");
    const result = await sender.sendEmail({
      to: recipientEmail,
      subject: `Kontaktformulär: ${safeSubject}`,
      html: `
        <h2>Nytt meddelande via kontaktformuläret</h2>
        <p><strong>Namn:</strong> ${safeName}</p>
        <p><strong>E-post:</strong> ${safeEmail}</p>
        <p><strong>Ämne:</strong> ${safeSubject}</p>
        <hr />
        <p>${safeMessage}</p>
      `,
      text: `Namn: ${name}\nE-post: ${email}\nÄmne: ${subject}\n\n${message}`,
    });

    if (!result.success) {
      log.warn("Contact form email rejected by provider");
      return c.json(
        { error: uiError(locale, "contactSendFailed") },
        502
      );
    }

    return c.json({ ok: true });
  } catch (err) {
    log.error({ err }, "Failed to send contact email");
    return c.json(
      { error: uiError(locale, "contactSendFailedRetry") },
      500
    );
  }
});
