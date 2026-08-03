import { eq } from "drizzle-orm";
import { db } from "@roots/db";
import { organizations } from "@roots/db/schema";
import { childLogger } from "./logger";

const log = childLogger("org-approval");

/**
 * Får den här föreningen sälja till allmänheten?
 *
 * Bakgrunden är att /v1/auth/register/association är helt öppen: vem som
 * helst fyller i ett namn och får ASSOCIATION_ADMIN över en ny organisation
 * i samma sekund. För en förening som bara vill titta runt är det bra — det
 * är hela poängen med att kunna prova produkten.
 *
 * Problemet är steget efter. Ingenting hindrade samma person från att skriva
 * "IFK Göteborg" i namnfältet, starta en kampanj, publicera en säljshop och
 * börja ta emot pengar från supportrar i en riktig förenings namn. Pengarna
 * går sedan till de utbetalningsuppgifter som personen själv angett. Det är
 * inte ett dataläckage — en ASSOCIATION_ADMIN ser bara sin egen
 * organisation — utan bedrägeri mot tredje part med vår plattform som verktyg.
 *
 * Kolumnen `organizations.verified` fanns redan i schemat sedan första
 * migrationen men lästes inte på ett enda ställe. Här blir den den spärr den
 * alltid var tänkt att vara: registrering och uppsättning är fri, men steget
 * där allmänheten kan betala kräver att någon hos oss har tittat på
 * föreningen.
 *
 * Spärren sitter medvetet på två ställen: när kampanjen aktiveras (så att
 * felmeddelandet kommer där användaren står) och i kassan (så att en
 * kampanj som blivit aktiv på något annat sätt fortfarande inte kan ta emot
 * pengar). Den andra är den som faktiskt skyddar.
 */

export const ORG_NOT_APPROVED_MESSAGE =
  "Föreningen är inte godkänd för publik försäljning ännu. Vi hör av oss så snart vi granskat uppgifterna.";

export async function isOrgApprovedForPublicSales(
  orgId: string | null | undefined
): Promise<boolean> {
  if (!orgId) return false;
  try {
    const [org] = await db
      .select({ verified: organizations.verified })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);
    return !!org?.verified;
  } catch (err) {
    // Fail closed. En databashicka ska inte öppna kassan för en förening vi
    // inte hunnit granska — det är precis det scenariot spärren finns för.
    log.error({ err, orgId }, "kunde inte läsa godkännandestatus");
    return false;
  }
}
