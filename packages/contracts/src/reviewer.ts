export const REVIEWER_EMAILS = ["feedback@roots.nu"] as const;

export const REVIEWER_HOME = "/feedback";

export function isReviewerEmail(email: string | null | undefined): boolean {
  return REVIEWER_EMAILS.includes(
    (email ?? "").trim().toLowerCase() as (typeof REVIEWER_EMAILS)[number]
  );
}
