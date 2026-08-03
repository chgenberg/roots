/**
 * Versionsmärkning av de villkor kunden godkänner i kassan.
 *
 * Datumet ska bumpas när /villkor eller /integritet ändras i sak. Ordern
 * sparar strängen, så vi kan svara på "vad godkände den här kunden?" även
 * efter att sidorna skrivits om.
 */
export const TERMS_VERSION = "2026-08-01";

/**
 * Version av målsmanssamtycket för säljare under 18. Samma resonemang:
 * texten kan ändras, men ett lämnat samtycke pekar på den text som visades.
 */
export const GUARDIAN_CONSENT_VERSION = "2026-08-01";

/** Under den här åldern krävs målsmans samtycke för att sälja. */
export const GUARDIAN_CONSENT_AGE = 18;
