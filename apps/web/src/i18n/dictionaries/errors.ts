import type { Locale } from "../config";

export const errors = {
  sv: {
    eyebrow: "Något gick fel",
    title: "Ett oväntat fel uppstod",
    body: "Ladda om sidan och försök igen. Fungerar det inte, gå tillbaka till startsidan.",
    retry: "Försök igen",
    home: "Till startsidan",
    close: "Stäng",
    closeToast: "Stäng meddelande",
  },
  en: {
    eyebrow: "Something went wrong",
    title: "An unexpected error occurred",
    body: "Reload the page and try again. If that doesn't work, go back to the home page.",
    retry: "Try again",
    home: "Back to home",
    close: "Close",
    closeToast: "Dismiss message",
  },
} as const satisfies Record<Locale, Record<string, string>>;

export const cancelDeletion = {
  sv: {
    metaTitle: "Avbryt radering — Roots",
    metaDescription: "Avbryt pågående radering av ditt Roots-konto.",
    title: "Avbryt raderingen av ditt Roots-konto",
    body: "Klicka på knappen nedan så behåller du ditt konto.",
    successTitle: "Raderingen är avbruten.",
    successBody: "Ditt konto finns kvar och du kan logga in som vanligt.",
    expiredTitle: "Länken är inte längre giltig.",
    expiredBody:
      "Logga in på portalen och tryck på ”Avbryt radering” där. Om kontot redan är raderat, kontakta",
    cancelFailed: "Raderingen gick inte att avbryta ({status}). Försök igen.",
    genericError: "Något gick fel. Försök igen.",
    submitting: "Avbryter…",
    keepAccount: "Behåll mitt konto",
    backToLogin: "Tillbaka till inloggningen",
  },
  en: {
    metaTitle: "Cancel deletion — Roots",
    metaDescription: "Cancel a pending deletion of your Roots account.",
    title: "Cancel the deletion of your Roots account",
    body: "Click the button below to keep your account.",
    successTitle: "Deletion cancelled.",
    successBody: "Your account is still here and you can sign in as usual.",
    expiredTitle: "This link is no longer valid.",
    expiredBody:
      "Sign in to the portal and tap “Cancel deletion” there. If the account has already been deleted, contact",
    cancelFailed: "We couldn't cancel the deletion ({status}). Please try again.",
    genericError: "Something went wrong. Please try again.",
    submitting: "Cancelling…",
    keepAccount: "Keep my account",
    backToLogin: "Back to sign in",
  },
} as const satisfies Record<Locale, Record<string, string>>;
