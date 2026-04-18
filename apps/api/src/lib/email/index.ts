import type { EmailSender } from "./types";
import { MockEmailSender } from "./mock-sender";
import { ResendEmailSender } from "./resend-sender";
import { childLogger } from "../logger";

export type { EmailSender, EmailMessage } from "./types";

const log = childLogger("email");

let _sender: EmailSender | null = null;

export function getEmailSender(): EmailSender {
  if (_sender) return _sender;

  const apiKey = process.env.RESEND_API_KEY;

  if (apiKey) {
    const from = process.env.RESEND_FROM_ADDRESS || "Roots <hej@roots.se>";
    _sender = new ResendEmailSender(apiKey, from);
    log.info("Using Resend provider");
  } else {
    _sender = new MockEmailSender();
    log.info("Using Mock provider (set RESEND_API_KEY to enable real emails)");
  }

  return _sender;
}

export function resetEmailSender(): void {
  _sender = null;
}
