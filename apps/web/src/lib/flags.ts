/**
 * Client-side feature flags. Next.js only exposes env vars prefixed with
 * NEXT_PUBLIC_ to the browser, so browser-safe flag values MUST use that
 * prefix. Defaults match the API side so behaviour stays consistent if a
 * flag is rolled out across services together.
 */

const TRUTHY = new Set(["1", "true", "on", "yes"]);

function read(value: string | undefined): boolean | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return TRUTHY.has(String(value).trim().toLowerCase());
}

export const webFlags = {
  dataSourceBadge(): boolean {
    return read(process.env.NEXT_PUBLIC_FEATURE_DATA_SOURCE_BADGE) ?? true;
  },
  cartPersistence(): boolean {
    return read(process.env.NEXT_PUBLIC_FEATURE_CART_PERSISTENCE) ?? true;
  },
  chatHistoryPersistence(): boolean {
    return (
      read(process.env.NEXT_PUBLIC_FEATURE_CHAT_HISTORY_PERSISTENCE) ?? false
    );
  },
};
