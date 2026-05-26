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
    // Scout fix 2026-05-26 (Integration CRIT-email): tidigare återföll
    // vi tyst till MockEmailSender även i prod, vilket gjorde att alla
    // transactional mail försvann med success=true. validate-env
    // markerar nu RESEND_API_KEY som REQUIRED i prod (boot failar
    // innan vi når hit) — men om någon ändå råkar reach:a hit i prod
    // gör vi fail-loud, inte fail-silent.
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "RESEND_API_KEY saknas i produktion. Mock-providern returnerar success utan att skicka mail — vi vägrar boota mail-pipen tyst."
      );
    }
    _sender = new MockEmailSender();
    log.info("Using Mock provider (set RESEND_API_KEY to enable real emails)");
  }

  return _sender;
}

export function resetEmailSender(): void {
  _sender = null;
}
