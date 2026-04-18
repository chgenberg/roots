import type { EmailSender, EmailMessage } from "./types";
import { childLogger } from "../logger";

const log = childLogger("resend-email");

export class ResendEmailSender implements EmailSender {
  private apiKey: string;
  private fromAddress: string;

  constructor(apiKey: string, fromAddress = "Roots <hej@roots.se>") {
    this.apiKey = apiKey;
    this.fromAddress = fromAddress;
  }

  async sendEmail(message: EmailMessage): Promise<{ success: boolean; id?: string }> {
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
      });

      if (!res.ok) {
        const errBody = await res.text();
        log.error({ status: res.status, body: errBody }, "Failed to send email");
        return { success: false };
      }

      const data = await res.json();
      return { success: true, id: data.id };
    } catch (err) {
      log.error({ err }, "Error sending email");
      return { success: false };
    }
  }
}
