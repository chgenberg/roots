import type { EmailSender, EmailMessage } from "./types";
import { childLogger } from "../logger";

const log = childLogger("mock-email");

export class MockEmailSender implements EmailSender {
  private sent: EmailMessage[] = [];

  async sendEmail(message: EmailMessage): Promise<{ success: boolean; id?: string }> {
    this.sent.push(message);
    log.info(
      { to: message.to, subject: message.subject },
      `→ ${message.to} | ${message.subject} | ${message.html.slice(0, 80)}…`
    );
    return { success: true, id: `mock_${Date.now()}` };
  }

  getSentEmails(): EmailMessage[] {
    return this.sent;
  }
}
