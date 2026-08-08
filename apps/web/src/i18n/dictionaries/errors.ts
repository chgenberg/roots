import type { Locale } from "../config";

export const errors = {
  sv: {
    eyebrow: "Något gick fel",
    title: "Ett oväntat fel uppstod",
    body: "Vi beklagar besväret. Försök att ladda om sidan eller gå tillbaka till startsidan.",
    retry: "Försök igen",
    home: "Till startsidan",
    close: "Stäng",
    closeToast: "Stäng meddelande",
  },
  en: {
    eyebrow: "Something went wrong",
    title: "An unexpected error occurred",
    body: "Sorry about that. Please try reloading the page or go back to the home page.",
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
    title: "Avbryt radering av ditt Roots-konto",
    body: "Klicka på knappen nedan för att behålla ditt konto.",
    successTitle: "Raderingen är avbruten.",
    successBody: "Du kan logga in som vanligt — allt är som vanligt.",
    expiredTitle: "Länken är inte längre giltig.",
    expiredBody:
      'Logga in på portalen och tryck på "Avbryt radering" där. Om kontot redan är raderat — kontakta',
    cancelFailed: "Kunde inte avbryta ({status}).",
    genericError: "Något gick fel.",
    submitting: "Avbryter…",
    keepAccount: "Behåll mitt konto",
    backToLogin: "Tillbaka till inloggning",
  },
  en: {
    metaTitle: "Cancel deletion — Roots",
    metaDescription: "Cancel a pending deletion of your Roots account.",
    title: "Cancel deletion of your Roots account",
    body: "Click the button below to keep your account.",
    successTitle: "Deletion cancelled.",
    successBody: "You can sign in as usual — everything is back to normal.",
    expiredTitle: "This link is no longer valid.",
    expiredBody:
      'Sign in to the portal and tap "Cancel deletion" there. If the account has already been deleted — contact',
    cancelFailed: "Could not cancel ({status}).",
    genericError: "Something went wrong.",
    submitting: "Cancelling…",
    keepAccount: "Keep my account",
    backToLogin: "Back to sign in",
  },
} as const satisfies Record<Locale, Record<string, string>>;
