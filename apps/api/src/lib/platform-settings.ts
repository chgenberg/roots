import { eq } from "drizzle-orm";
import { db } from "@roots/db";
import { platformSettings } from "@roots/db/schema";
import { parseShippingSettings, type ShippingSettings } from "@roots/contracts";

const SHIPPING_KEY = "shipping";

/**
 * Fraktinställningen läses vid varje anrop och cachas inte: kassan måste ta
 * betalt enligt det värde som gäller nu, även när flera API-instanser kör.
 */
export async function getShippingSettings(): Promise<ShippingSettings> {
  const [row] = await db
    .select({ value: platformSettings.value })
    .from(platformSettings)
    .where(eq(platformSettings.key, SHIPPING_KEY))
    .limit(1);
  return parseShippingSettings(row?.value);
}

export async function setShippingSettings(
  value: ShippingSettings,
  userId: string
): Promise<{ previous: ShippingSettings; current: ShippingSettings }> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ value: platformSettings.value })
      .from(platformSettings)
      .where(eq(platformSettings.key, SHIPPING_KEY))
      .for("update")
      .limit(1);
    const previous = parseShippingSettings(existing?.value);
    const now = new Date();
    await tx
      .insert(platformSettings)
      .values({ key: SHIPPING_KEY, value, updatedAt: now, updatedByUserId: userId })
      .onConflictDoUpdate({
        target: platformSettings.key,
        set: { value, updatedAt: now, updatedByUserId: userId },
      });
    return { previous, current: value };
  });
}

export async function getShippingSettingsMeta(): Promise<{
  settings: ShippingSettings;
  updatedAt: Date | null;
}> {
  const [row] = await db
    .select({ value: platformSettings.value, updatedAt: platformSettings.updatedAt })
    .from(platformSettings)
    .where(eq(platformSettings.key, SHIPPING_KEY))
    .limit(1);
  return {
    settings: parseShippingSettings(row?.value),
    updatedAt: row?.updatedAt ?? null,
  };
}
