import type { UiLocale } from "./ui-locale";

/**
 * Zod schemas in @roots/contracts carry Swedish default messages (legacy).
 * When the UI locale is English, remap known strings before returning
 * `flatten()` field/form errors to the client.
 */
const SV_TO_EN: Record<string, string> = {
  "Lösenord måste vara minst 8 tecken":
    "Password must be at least 8 characters",
  "Lösenord måste vara minst 12 tecken":
    "Password must be at least 12 characters",
  "Föreningsnamn krävs": "Club name is required",
  "Föreningens namn krävs": "Club name is required",
  "Ogiltig e-postadress": "Invalid email address",
  "En giltig e-postadress krävs": "A valid email address is required",
  "Kontaktperson krävs": "Contact name is required",
  "Lagnamn krävs": "Team name is required",
  "Namn krävs": "Name is required",
  "Nuvarande lösenord krävs": "Current password is required",
  "Nytt lösenord måste vara minst 8 tecken":
    "New password must be at least 8 characters",
  "Nytt lösenord är för långt": "New password is too long",
  "Kampanjnamn krävs": "Campaign name is required",
  "Mål måste vara positivt": "Goal must be a positive number",
};

type Flattened = {
  formErrors: string[];
  fieldErrors: Record<string, string[] | undefined>;
};

export function localizeZodMessage(
  msg: string,
  locale: UiLocale
): string {
  if (locale !== "en") return msg;
  return SV_TO_EN[msg] ?? msg;
}

export function localizeZodFlatten<T extends Flattened>(
  flattened: T,
  locale: UiLocale
): T {
  if (locale !== "en") return flattened;

  const fieldErrors: Record<string, string[] | undefined> = {};
  for (const [key, msgs] of Object.entries(flattened.fieldErrors)) {
    fieldErrors[key] = msgs?.map((m) => localizeZodMessage(m, locale));
  }

  return {
    ...flattened,
    formErrors: flattened.formErrors.map((m) =>
      localizeZodMessage(m, locale)
    ),
    fieldErrors,
  };
}
