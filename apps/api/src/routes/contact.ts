import { Hono } from "hono";
import { getEmailSender } from "../lib/email";
import { checkRateLimit } from "../lib/rate-limit";
import { childLogger } from "../lib/logger";

const log = childLogger("contact");

export const contact = new Hono();

contact.post("/", async (c) => {
  let body: { name: string; email: string; subject: string; message: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Ogiltigt format" }, 400);
  }

  const { name, email, subject, message } = body;
  if (!name?.trim() || !email?.trim() || !subject?.trim() || !message?.trim()) {
    return c.json({ error: "Alla fält måste fyllas i." }, 400);
  }

  if (name.length > 200 || email.length > 254 || subject.length > 300 || message.length > 5000) {
    return c.json({ error: "Ett eller flera fält överskrider maxlängden." }, 400);
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return c.json({ error: "Ogiltig e-postadress." }, 400);
  }

  const ip = c.req.header("x-forwarded-for") || "unknown";
  const rateCheck = await checkRateLimit(`contact:${ip}`, 5, 3600);
  if (!rateCheck.allowed) {
    return c.json({ error: "För många förfrågningar. Försök igen senare." }, 429);
  }

  try {
    const sender = getEmailSender();
    const recipientEmail = process.env.CONTACT_FORM_EMAIL || "hej@roots.se";

    // Connection-audit P1 #14: previously we ignored sender.sendEmail's
    // `{ success }` return value, so a Resend rejection (rate-limit,
    // invalid sender, 4xx) returned `{ok:true}` to the visitor while the
    // mail silently vanished.
    const result = await sender.sendEmail({
      to: recipientEmail,
      subject: `Kontaktformulär: ${subject}`,
      html: `
        <h2>Nytt meddelande via kontaktformuläret</h2>
        <p><strong>Namn:</strong> ${name}</p>
        <p><strong>E-post:</strong> ${email}</p>
        <p><strong>Ämne:</strong> ${subject}</p>
        <hr />
        <p>${message.replace(/\n/g, "<br />")}</p>
      `,
      text: `Namn: ${name}\nE-post: ${email}\nÄmne: ${subject}\n\n${message}`,
    });

    if (!result.success) {
      log.warn("Contact form email rejected by provider");
      return c.json(
        { error: "Kunde inte skicka meddelandet just nu. Försök igen senare." },
        502
      );
    }

    return c.json({ ok: true });
  } catch (err) {
    log.error({ err }, "Failed to send contact email");
    return c.json({ error: "Kunde inte skicka meddelandet. Försök igen." }, 500);
  }
});
