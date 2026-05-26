export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

// Scout fix 2026-05-26 (Integration CRIT-email): expose `error` så
// callers kan särskilja success-utan-id (mock) från provider-failures
// (Resend 4xx/5xx) och rollback:a side-effects som sent-at-claims.
export interface SendEmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

export interface EmailSender {
  sendEmail(message: EmailMessage): Promise<SendEmailResult>;
}
