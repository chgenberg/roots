/**
 * Origin for copy-paste public links (seller invites, shop URLs).
 * Prefer the current browser origin so local ports and preview hosts
 * don't bake in a stale NEXT_PUBLIC_SITE_URL (e.g. :3000 vs :3004).
 */
export function getPublicSiteUrl(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_SITE_URL || "https://roots.nu";
}
