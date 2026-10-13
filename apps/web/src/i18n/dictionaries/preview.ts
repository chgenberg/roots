import type { Locale } from "../config";

export const preview = {
  sv: {
    havePassword: "Jag har ett lösenord",
    passwordLabel: "Lösenord för förhandsvisning",
    unlockAria: "Lås upp",
    errorPasswordRequired: "Ange lösenord.",
    errorWrongPassword: "Fel lösenord.",
    errorConnect: "Kunde inte ansluta. Försök igen.",
  },
  en: {
    havePassword: "I have a password",
    passwordLabel: "Preview password",
    unlockAria: "Unlock",
    errorPasswordRequired: "Please enter the password.",
    errorWrongPassword: "Incorrect password.",
    errorConnect: "Could not connect. Please try again.",
  },
} as const satisfies Record<Locale, Record<string, string>>;
