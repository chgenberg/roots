export type LeadStatus =
  | "draft"
  | "approved"
  | "sending"
  | "sent"
  | "replied"
  | "meeting"
  | "declined"
  | "failed";

export type Sender = {
  id: string;
  name: string;
  title: string;
  phone: string | null;
  email: string;
  subjectTemplate: string;
  bodyTemplate: string;
  dailyCap: number;
  userId: string | null;
  sentToday: number;
  counts: Partial<Record<LeadStatus, number>>;
};

export type SendersResponse = {
  emailEnabled: boolean;
  canManage: boolean;
  statusLabels: Record<string, string>;
  senders: Sender[];
};

export type Lead = {
  id: string;
  orgName: string;
  contactName: string | null;
  email: string;
  website: string | null;
  memberCount: number | null;
  packagesPerMember: number;
  packagePriceKr: number;
  totalKr: number | null;
  associationKr: number | null;
  status: LeadStatus;
  hasOverride: boolean;
  note: string | null;
  missing: string[];
  proposalUrl: string;
  sentAt: string | null;
  approvedAt: string | null;
  lastError: string | null;
  proposalOpenCount: number;
  proposalOpenedAt: string | null;
};

export const STATUS_STYLE: Record<LeadStatus, string> = {
  draft: "bg-muted text-foreground",
  approved: "bg-brand-200/70 text-brand-900",
  sending: "bg-brand-200/70 text-brand-900",
  sent: "bg-success/15 text-success",
  replied: "bg-success/15 text-success",
  meeting: "bg-success text-success-foreground",
  declined: "bg-muted text-muted-foreground",
  failed: "bg-destructive/10 text-destructive",
};

export const kr = (n: number) => `${n.toLocaleString("sv-SE")} kr`;

export function formatWhen(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("sv-SE", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function hostOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return null;
  }
}
