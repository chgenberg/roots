export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailSender {
  sendEmail(message: EmailMessage): Promise<{ success: boolean; id?: string }>;
}
