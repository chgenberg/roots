import type { EmailSender, EmailMessage, SendEmailResult } from "./types";
import { childLogger } from "../logger";

const log = childLogger("resend-email");

export class ResendEmailSender implements EmailSender {
  private apiKey: string;
  private fromAddress: string;

  constructor(apiKey: string, fromAddress = "Roots <info@roots.nu>") {
    this.apiKey = apiKey;
    this.fromAddress = fromAddress;
  }

  async sendEmail(message: EmailMessage): Promise<SendEmailResult> {
    // Connection-audit P1 #15: bound outbound HTTP — a stalled Resend
    // socket previously held a Node event-loop task indefinitely.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: this.fromAddress,
          to: [message.to],
          subject: message.subject,
          html: message.html,
          text: message.text,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errBody = await res.text();
        log.error({ status: res.status, body: errBody }, "Failed to send email");
        return { success: false, error: `Resend ${res.status}: ${errBody.slice(0, 200)}` };
      }

      const data = await res.json();
      return { success: true, id: data.id };
    } catch (err) {
      log.error({ err }, "Error sending email");
      return { success: false, error: (err as Error)?.message };
    } finally {
      clearTimeout(timeout);
    }
  }
}
