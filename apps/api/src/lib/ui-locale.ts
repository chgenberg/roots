import type { Context } from "hono";

export type UiLocale = "sv" | "en";

/** Resolve UI locale from body, header, or Accept-Language. */
export function resolveUiLocaleFromHeaders(
  getHeader: (name: string) => string | undefined | null,
  bodyLocale?: unknown
): UiLocale {
  if (bodyLocale === "en" || bodyLocale === "sv") return bodyLocale;
  const header = getHeader("x-roots-locale");
  if (header === "en" || header === "sv") return header;
  const accept = getHeader("accept-language")?.toLowerCase() ?? "";
  if (accept.startsWith("en")) return "en";
  return "sv";
}

export function resolveUiLocale(
  c: Context,
  bodyLocale?: unknown
): UiLocale {
  return resolveUiLocaleFromHeaders((n) => c.req.header(n), bodyLocale);
}

type Pair = { sv: string; en: string };

const ERRORS = {
  invalidJson: {
    sv: "Ogiltig JSON i request body.",
    en: "Invalid JSON in the request body.",
  },
  invalidJsonShort: {
    sv: "Ogiltig JSON",
    en: "Invalid JSON",
  },
  invalidFormat: { sv: "Ogiltigt format", en: "Invalid format" },
  invalidFields: { sv: "Ogiltiga fält", en: "Invalid fields" },
  rateLimited: {
    sv: "För många försök. Försök igen senare.",
    en: "Too many attempts. Please try again later.",
  },
  rateLimitedShort: {
    sv: "För många försök. Försök igen om en stund.",
    en: "Too many attempts. Please try again in a moment.",
  },
  rateLimitedWait: {
    sv: "För många försök. Vänta en stund.",
    en: "Too many attempts. Please wait a moment.",
  },
  rateLimitedWaitMinutes: {
    sv: "För många försök. Vänta några minuter och försök igen.",
    en: "Too many attempts. Please wait a few minutes and try again.",
  },
  notLoggedIn: {
    sv: "Ej inloggad",
    en: "Not signed in",
  },
  notLoggedInPeriod: {
    sv: "Ej inloggad.",
    en: "Not signed in.",
  },
  userNotFound: {
    sv: "Användare hittades inte",
    en: "User not found",
  },
  userNotFoundPeriod: {
    sv: "Användare hittades inte.",
    en: "User not found.",
  },
  permissionDenied: {
    sv: "Behörighet saknas",
    en: "Permission denied",
  },
  somethingWrong: {
    sv: "Något gick fel.",
    en: "Something went wrong.",
  },
  // Auth — login / session
  emailPasswordRequired: {
    sv: "E-post och lösenord krävs.",
    en: "Email and password are required.",
  },
  badCredentials: {
    sv: "Felaktig e-post eller lösenord.",
    en: "Incorrect email or password.",
  },
  loginRateLimited: {
    sv: "För många inloggningsförsök. Försök igen senare.",
    en: "Too many sign-in attempts. Please try again later.",
  },
  loginUnavailable: {
    sv: "Inloggning är tillfälligt otillgänglig.",
    en: "Sign-in is temporarily unavailable.",
  },
  sessionUnavailable: {
    sv: "Sessionshantering otillgänglig.",
    en: "Session handling is unavailable.",
  },
  loginExpired: {
    sv: "Inloggningen har gått ut. Börja om från början.",
    en: "Sign-in has expired. Please start again.",
  },
  enterAppCode: {
    sv: "Ange koden från din app.",
    en: "Enter the code from your app.",
  },
  mfaInvalid: {
    sv: "Koden stämmer inte. Försök igen.",
    en: "That code is incorrect. Please try again.",
  },
  mfaCodeIncorrect: {
    sv: "Koden stämmer inte.",
    en: "That code is incorrect.",
  },
  mfaNotEnabled: {
    sv: "Tvåfaktor är inte aktiverad för kontot.",
    en: "Two-factor authentication is not enabled for this account.",
  },
  mfaNotEnabledShort: {
    sv: "Tvåfaktor är inte aktiverad.",
    en: "Two-factor authentication is not enabled.",
  },
  mfaAlreadyEnabled: {
    sv: "Tvåfaktor är redan aktiverad.",
    en: "Two-factor authentication is already enabled.",
  },
  mfaScanQrFirst: {
    sv: "Börja med att skanna QR-koden.",
    en: "Start by scanning the QR code.",
  },
  mfaRebindNeedsCode: {
    sv: "Ange en kod från din nuvarande app för att byta till en ny.",
    en: "Enter a code from your current app to switch to a new one.",
  },
  mfaRoleRequires: {
    sv:
      "Din roll kräver tvåfaktor. Byt till en ny app istället — det gör " +
      "du under Tvåfaktor i portalen, med lösenord och en kod härifrån.",
    en:
      "Your role requires two-factor authentication. Switch to a new app " +
      "instead — you can do this under Two-factor in the portal, with your " +
      "password and a code from your current app.",
  },
  demoCannotChangeMfa: {
    sv: "Demoläget kan inte ändra tvåfaktor.",
    en: "Demo mode cannot change two-factor authentication.",
  },
  demoCannotChangePassword: {
    sv: "Demo-konton kan inte byta lösenord. Skapa ett riktigt konto.",
    en: "Demo accounts cannot change password. Please create a real account.",
  },
  demoCannotDelete: {
    sv: "Demo-konton kan inte raderas — de saknar persistent data.",
    en: "Demo accounts cannot be deleted — they have no persistent data.",
  },
  // Auth — password
  passwordMissing: {
    sv: "Lösenord saknas.",
    en: "Password is required.",
  },
  passwordTooShort: {
    sv: "Lösenordet måste vara minst 12 tecken.",
    en: "Password must be at least 12 characters.",
  },
  passwordTooLong: {
    sv: "Lösenordet är för långt (max 128 tecken).",
    en: "Password is too long (maximum 128 characters).",
  },
  enterYourPassword: {
    sv: "Ange ditt lösenord.",
    en: "Please enter your password.",
  },
  passwordRequired: {
    sv: "Lösenord krävs.",
    en: "Password is required.",
  },
  bothFieldsRequired: {
    sv: "Båda fälten krävs.",
    en: "Both fields are required.",
  },
  passwordSameAsOld: {
    sv: "Nytt lösenord får inte vara samma som det gamla.",
    en: "The new password must be different from the current one.",
  },
  passwordCannotVerify: {
    sv: "Lösenordet kan inte verifieras för det här kontot.",
    en: "The password cannot be verified for this account.",
  },
  wrongCurrentPassword: {
    sv: "Fel nuvarande lösenord.",
    en: "Incorrect current password.",
  },
  changePasswordFailed: {
    sv: "Kunde inte byta lösenord just nu.",
    en: "Could not change the password right now.",
  },
  resetPasswordFailed: {
    sv: "Kunde inte återställa lösenordet just nu.",
    en: "Could not reset the password right now.",
  },
  linkInvalidOrExpired: {
    sv: "Länken är ogiltig eller har gått ut.",
    en: "The link is invalid or has expired.",
  },
  // Auth — account deletion
  confirmDeleteWord: {
    sv: 'Bekräftelse-fältet måste innehålla ordet "RADERA".',
    en: 'The confirmation field must contain the word "DELETE".',
  },
  accountAlreadyDeleted: {
    sv: "Kontot är redan raderat.",
    en: "The account has already been deleted.",
  },
  accountAlreadyDeletedGone: {
    sv: "Kontot är redan raderat och kan inte återställas.",
    en: "The account has already been deleted and cannot be restored.",
  },
  deletionRequestFailed: {
    sv: "Kunde inte registrera begäran just nu.",
    en: "Could not register the request right now.",
  },
  cancelDeletionFailed: {
    sv: "Kunde inte avbryta raderingen just nu.",
    en: "Could not cancel the deletion right now.",
  },
  // Auth — registration
  registrationRateLimited: {
    sv: "För många registreringar från denna IP. Försök igen senare.",
    en: "Too many registrations from this IP. Please try again later.",
  },
  emailAlreadyRegistered: {
    sv: "E-postadressen är redan registrerad.",
    en: "This email address is already registered.",
  },
  registrationFailed: {
    sv: "Registreringen misslyckades.",
    en: "Registration failed.",
  },
  useTeamInvite: {
    sv: "För att gå med i en befintlig förening, använd ett team-invite från föreningens admin.",
    en: "To join an existing club, use a team invite from the club administrator.",
  },
  enterBirthYear: {
    sv: "Ange ditt födelseår.",
    en: "Please enter your year of birth.",
  },
  guardianConsentRequired: {
    sv: "Är du under 18 år måste en vårdnadshavare godkänna att du säljer.",
    en: "If you are under 18, a guardian must approve that you sell.",
  },
  enterGuardianName: {
    sv: "Ange vårdnadshavarens namn.",
    en: "Please enter the guardian's name.",
  },
  enterGuardianEmail: {
    sv: "Ange vårdnadshavarens e-postadress.",
    en: "Please enter the guardian's email address.",
  },
  guardianEmailMustDiffer: {
    sv: "Vårdnadshavarens e-post måste vara en annan än säljarens egen.",
    en: "The guardian's email must be different from the seller's own.",
  },
  invalidInviteLink: {
    sv: "Ogiltig inbjudningslänk.",
    en: "Invalid invitation link.",
  },
  inviteLinkExpired: {
    sv: "Inbjudningslänken har gått ut. Be lagledaren skapa en ny.",
    en: "The invitation link has expired. Ask the team leader to create a new one.",
  },
  inviteLinkExhausted: {
    sv: "Inbjudningslänken är förbrukad. Be lagledaren skapa en ny.",
    en: "The invitation link has been used up. Ask the team leader to create a new one.",
  },
  // Contact
  allFieldsRequired: {
    sv: "Alla fält måste fyllas i.",
    en: "All fields are required.",
  },
  fieldTooLong: {
    sv: "Ett eller flera fält överskrider maxlängden.",
    en: "One or more fields exceed the maximum length.",
  },
  invalidEmail: {
    sv: "Ogiltig e-postadress.",
    en: "Invalid email address.",
  },
  contactSendFailed: {
    sv: "Kunde inte skicka meddelandet just nu. Försök igen senare.",
    en: "Could not send the message right now. Please try again later.",
  },
  contactSendFailedRetry: {
    sv: "Kunde inte skicka meddelandet. Försök igen.",
    en: "Could not send the message. Please try again.",
  },
  // Preview
  gateDisabled: {
    sv: "Gaten är inaktiverad.",
    en: "The gate is disabled.",
  },
  enterPassword: {
    sv: "Ange lösenord.",
    en: "Please enter the password.",
  },
  wrongPassword: {
    sv: "Fel lösenord.",
    en: "Incorrect password.",
  },
  previewMisconfigured: {
    sv: "Förhandsvisningen är felkonfigurerad.",
    en: "Preview is misconfigured.",
  },
  enterValidEmail: {
    sv: "Ange en giltig e-postadress.",
    en: "Please enter a valid email address.",
  },
  couldNotSave: {
    sv: "Kunde inte spara just nu. Försök igen.",
    en: "Could not save right now. Please try again.",
  },
  // Checkout
  checkoutRateLimited: {
    sv: "För många kassa-försök från denna IP. Försök igen om en stund.",
    en: "Too many checkout attempts from this IP. Please try again in a moment.",
  },
  requiredFields: {
    sv: "Alla obligatoriska fält krävs.",
    en: "All required fields must be completed.",
  },
  requiredFieldsMustFill: {
    sv: "Alla obligatoriska fält måste fyllas i.",
    en: "All required fields must be completed.",
  },
  mustAcceptTerms: {
    sv: "Du måste godkänna köpvillkoren och integritetspolicyn.",
    en: "You must accept the terms of purchase and the privacy policy.",
  },
  sellerNotFound: {
    sv: "Säljare hittades inte.",
    en: "Seller not found.",
  },
  sellerNotAccepting: {
    sv: "Säljaren tar inte längre emot beställningar.",
    en: "This seller is no longer accepting orders.",
  },
  teamNotFound: {
    sv: "Laget kunde inte hittas.",
    en: "The team could not be found.",
  },
  campaignInactive: {
    sv: "Kampanjen är inte aktiv.",
    en: "The campaign is not active.",
  },
  shopNotAccepting: {
    sv: "Butiken tar inte emot beställningar just nu.",
    en: "The shop is not accepting orders right now.",
  },
  emptyCart: {
    sv: "Varukorgen är tom eller innehåller ogiltiga produkter.",
    en: "The basket is empty or contains invalid products.",
  },
  paymentInitFailed: {
    sv: "Betalningen kunde inte initieras.",
    en: "Payment could not be started.",
  },
  checkoutFailed: {
    sv: "Något gick fel vid kassan.",
    en: "Something went wrong at checkout.",
  },
  orderNotFound: {
    sv: "Order hittades inte.",
    en: "Order not found.",
  },
  orderConfirmFailed: {
    sv: "Kunde inte bekräfta ordern.",
    en: "Could not confirm the order.",
  },
  invalidOrExpiredLink: {
    sv: "Ogiltig eller utgången länk.",
    en: "Invalid or expired link.",
  },
  orderStatusFailed: {
    sv: "Kunde inte hämta orderstatus.",
    en: "Could not fetch order status.",
  },
  invalidQty: {
    sv: "Ogiltig vara: qty måste vara ett heltal mellan 1 och 100.",
    en: "Invalid item: quantity must be a whole number between 1 and 100.",
  },
  sellerSlugRequired: {
    sv: "sellerSlug krävs.",
    en: "sellerSlug is required.",
  },
  idempotencyConflict: {
    sv: "Idempotency-Key används redan av en annan request. Använd ett unikt värde.",
    en: "Idempotency-Key is already used by another request. Use a unique value.",
  },
  // Shop
  shopNotFound: {
    sv: "Shop hittades inte.",
    en: "Shop not found.",
  },
  // Calculator
  calculatorFetchFailed: {
    sv: "Kunde inte hämta kalkylen",
    en: "Could not fetch the calculator",
  },
  calculatorNotFound: {
    sv: "Kalkylen hittades inte.",
    en: "Calculator not found.",
  },
  invalidLink: {
    sv: "Ogiltig länk",
    en: "Invalid link",
  },
  leadNotConfigured: {
    sv: "Lead-mottagning är inte konfigurerad. Försök igen senare.",
    en: "Lead intake is not configured. Please try again later.",
  },
  sendFailedRetry: {
    sv: "Kunde inte skicka. Försök igen.",
    en: "Could not send. Please try again.",
  },
  serviceOverloaded: {
    sv: "Tjänsten är tillfälligt överbelastad. Försök igen om en stund.",
    en: "The service is temporarily overloaded. Please try again in a moment.",
  },
  tooManyRequests: {
    sv: "Du har skickat för många förfrågningar. Försök igen senare.",
    en: "You have sent too many requests. Please try again later.",
  },
  // Portal / fundraising / chat / sales / settlement
  noOrganisation: { sv: "Ingen organisation", en: "No organisation" },
  noOrganisationOnSession: { sv: "Ingen organisation kopplad till sessionen.", en: "No organisation linked to this session." },
  clubContextMissing: { sv: "Klubbkontext saknas", en: "Club context is missing" },
  couldNotFetchData: { sv: "Kunde inte hämta data", en: "Could not fetch data" },
  couldNotFetchProducts: { sv: "Kunde inte hämta produkter", en: "Could not fetch products" },
  couldNotFetchOrders: { sv: "Kunde inte hämta beställningar", en: "Could not fetch orders" },
  invalidOrderId: { sv: "Ogiltigt order-ID.", en: "Invalid order ID." },
  couldNotFetchOrder: { sv: "Kunde inte hämta order", en: "Could not fetch the order" },
  demoCannotCreateOrders: { sv: "Demo-konton kan inte skapa ordrar.", en: "Demo accounts cannot create orders." },
  orderRequiresClubContext: { sv: "Beställning kräver klubbkontext", en: "An order requires club context" },
  noProductsSelected: { sv: "Inga produkter valda", en: "No products selected" },
  tooManyOrderLines: { sv: "För många rader i beställningen.", en: "Too many lines in the order." },
  invalidOrderLineProductQty: { sv: "Ogiltig rad: productId måste vara UUID och qty 1–100.", en: "Invalid line: productId must be a UUID and quantity 1–100." },
  productsNotFoundPrefix: { sv: "En eller flera produkter hittades inte: ", en: "One or more products were not found: " },
  couldNotCreateOrder: { sv: "Kunde inte skapa beställning", en: "Could not create the order" },
  couldNotFetchClubs: { sv: "Kunde inte hämta klubbar", en: "Could not fetch clubs" },
  couldNotFetchMembers: { sv: "Kunde inte hämta medlemmar", en: "Could not fetch members" },
  demoCannotSendRealInvites: { sv: "Demoläget kan inte skicka riktiga inbjudningar.", en: "Demo mode cannot send real invitations." },
  nameTooLong: { sv: "Namnet är för långt", en: "The name is too long" },
  couldNotInviteMember: { sv: "Kunde inte bjuda in medlem", en: "Could not invite the member" },
  couldNotFetchSellers: { sv: "Kunde inte hämta säljare", en: "Could not fetch sellers" },
  couldNotFetchQuotes: { sv: "Kunde inte hämta offerter", en: "Could not fetch quotes" },
  demoCannotChangeQuotes: { sv: "Demoläget kan inte ändra riktiga offerter.", en: "Demo mode cannot change real quotes." },
  invalidQuoteId: { sv: "Ogiltigt offert-ID.", en: "Invalid quote ID." },
  statusMustBeOneOfPrefix: { sv: "status måste vara en av: ", en: "status must be one of: " },
  quoteNotFound: { sv: "Offerten hittades inte", en: "Quote not found" },
  couldNotMoveQuote: { sv: "Kunde inte flytta offerten", en: "Could not move the quote" },
  demoCannotCreateQuotes: { sv: "Demoläget kan inte skapa riktiga offerter.", en: "Demo mode cannot create real quotes." },
  orgIdRequiredUuid: { sv: "orgId krävs (uuid)", en: "orgId is required (uuid)" },
  atLeastOneLineRequired: { sv: "Minst en rad krävs", en: "At least one line is required" },
  max50LinesPerQuote: { sv: "Max 50 rader per offert", en: "Maximum 50 lines per quote" },
  invalidLine: { sv: "Ogiltig rad", en: "Invalid line" },
  invalidProductId: { sv: "Ogiltigt productId", en: "Invalid productId" },
  qtyMustBe1To10000: { sv: "qty måste vara 1–10000", en: "qty must be 1–10000" },
  associationNotFound: { sv: "Förening hittades inte", en: "Organisation not found" },
  associationNotFoundThe: { sv: "Föreningen hittades inte", en: "The organisation was not found" },
  unknownProductPrefix: { sv: "Okänd produkt: ", en: "Unknown product: " },
  couldNotCreateQuote: { sv: "Kunde inte skapa offert", en: "Could not create the quote" },
  couldNotFetchStats: { sv: "Kunde inte hämta statistik", en: "Could not fetch statistics" },
  couldNotFetchRevenue: { sv: "Kunde inte hämta intäkter", en: "Could not fetch revenue" },
  couldNotFetchPipeline: { sv: "Kunde inte hämta pipeline", en: "Could not fetch the pipeline" },
  kindMustBeLeadOrQuote: { sv: "kind måste vara 'lead' eller 'quote'", en: "kind must be 'lead' or 'quote'" },
  invalidId: { sv: "Ogiltigt ID.", en: "Invalid ID." },
  couldNotFetchDeal: { sv: "Kunde inte hämta affären", en: "Could not fetch the deal" },
  noSellerProfile: { sv: "Ingen säljar-profil", en: "No seller profile" },
  couldNotFetchMessages: { sv: "Kunde inte hämta meddelanden", en: "Could not fetch messages" },
  demoCannotSendMessages: { sv: "Demoläget kan inte skicka meddelanden.", en: "Demo mode cannot send messages." },
  messageEmpty: { sv: "Meddelandet är tomt.", en: "The message is empty." },
  messageTooLong: { sv: "Meddelandet är för långt.", en: "The message is too long." },
  teamNotFoundShort: { sv: "Lag hittades inte", en: "Team not found" },
  couldNotSendMessage: { sv: "Kunde inte skicka meddelandet", en: "Could not send the message" },
  couldNotUpdateReadStatus: { sv: "Kunde inte uppdatera lässtatus", en: "Could not update read status" },
  couldNotFetchThreads: { sv: "Kunde inte hämta trådar", en: "Could not fetch threads" },
  recipientNotOnTeam: { sv: "Mottagaren tillhör inte laget.", en: "The recipient does not belong to the team." },
  sellerIdRequired: { sv: "sellerId krävs", en: "sellerId is required" },
  demoCannotCreateProspects: { sv: "Demoläget kan inte skapa riktiga prospects.", en: "Demo mode cannot create real prospects." },
  clubNameLength: { sv: "Klubbnamn måste vara 2–255 tecken.", en: "Club name must be 2–255 characters." },
  invalidLeadSourcePrefix: { sv: "Ogiltig lead-källa. Tillåtna: ", en: "Invalid lead source. Allowed: " },
  potentialScoreRange: { sv: "potentialScore måste vara 0–100.", en: "potentialScore must be 0–100." },
  invalidOrgNumber: { sv: "Ogiltigt organisationsnummer.", en: "Invalid organisation number." },
  orgNumberExists: { sv: "Organisationsnumret finns redan.", en: "That organisation number already exists." },
  couldNotCreateLead: { sv: "Kunde inte skapa lead just nu.", en: "Could not create the lead right now." },
  couldNotFetchCalendar: { sv: "Kunde inte hämta kalendern.", en: "Could not fetch the calendar." },
  campaignNotFound: { sv: "Kampanj hittades inte", en: "Campaign not found" },
  campaignNotFoundThe: { sv: "Kampanjen hittades inte", en: "The campaign was not found" },
  campaignNotFoundPeriod: { sv: "Kampanjen hittades inte.", en: "The campaign was not found." },
  permissionDeniedForCampaign: { sv: "Behörighet saknas för denna kampanj", en: "Permission denied for this campaign" },
  campaignMustBeEndedForSettlement: { sv: "Kampanjen måste vara avslutad innan avräkning kan genereras", en: "The campaign must be ended before a payout statement can be created" },
  settlementFailed: { sv: "Avräkning misslyckades", en: "Could not create the payout statement" },
  couldNotFetchSettlement: { sv: "Kunde inte hämta avräkning", en: "Could not load the payout statement" },
  payoutNotFound: { sv: "Utbetalning hittades inte", en: "Payout not found" },
  payoutNotFoundPeriod: { sv: "Utbetalning hittades inte.", en: "Payout not found." },
  payoutCannotInvoiceStatusPrefix: { sv: "Utbetalningen kan inte faktureras i status ", en: "The payout cannot be invoiced in status " },
  invoiceAlreadyCreating: { sv: "Faktura skapas redan — vänta några sekunder och försök igen.", en: "An invoice is already being created — wait a few seconds and try again." },
  invoiceCreatedNotSaved: { sv: "Faktura skapades hos leverantören men kunde inte sparas. Kontakta ops.", en: "The invoice was created with the provider but could not be saved. Contact ops." },
  invoiceCreateFailed: { sv: "Faktura kunde inte skapas", en: "Invoice could not be created" },
  couldNotFetchPayouts: { sv: "Kunde inte hämta utbetalningar.", en: "Could not fetch payouts." },
  demoCannotChangePayouts: { sv: "Demoläget kan inte ändra riktiga utbetalningar.", en: "Demo mode cannot change real payouts." },
  referenceMax64: { sv: "Referens får vara max 64 tecken.", en: "Reference may be at most 64 characters." },
  couldNotUpdatePayout: { sv: "Kunde inte uppdatera utbetalningen.", en: "Could not update the payout." },
  payoutMarkInvoicedFromPendingPrefix: { sv: "Kan bara markera INVOICED från PENDING (är: ", en: "Can only mark INVOICED from PENDING (is: " },
  payoutMustBeInvoicedBeforePaidPrefix: { sv: "Utbetalning måste vara INVOICED innan den kan markeras PAID (är: ", en: "Payout must be INVOICED before it can be marked PAID (is: " },
  payoutMarkPaidFromPrefix: { sv: "Kan bara markera PAID från PENDING/INVOICED (är: ", en: "Can only mark PAID from PENDING/INVOICED (is: " },
  organisationNotFoundPeriod: { sv: "Organisation hittades inte.", en: "Organisation not found." },
  couldNotFetchOnboarding: { sv: "Kunde inte hämta onboarding-status.", en: "Could not fetch onboarding status." },
  demoCannotCreateInvites: { sv: "Demo-konton kan inte skapa inbjudningar.", en: "Demo accounts cannot create invitations." },
  invalidCampaignId: { sv: "Ogiltigt kampanj-ID.", en: "Invalid campaign ID." },
  invalidCampaignIdLower: { sv: "Ogiltigt kampanj-id.", en: "Invalid campaign ID." },
  teamNameLength: { sv: "Lagnamn måste vara 2–255 tecken.", en: "Team name must be 2–255 characters." },
  couldNotCreateInvite: { sv: "Kunde inte skapa inbjudan just nu.", en: "Could not create the invitation right now." },
  inviteNotFound: { sv: "Inbjudan hittades inte.", en: "Invitation not found." },
  inviteAlreadyUsed: { sv: "Inbjudan är redan använd.", en: "The invitation has already been used." },
  inviteExpired: { sv: "Inbjudan har gått ut.", en: "The invitation has expired." },
  couldNotFetchInvite: { sv: "Kunde inte hämta inbjudan just nu.", en: "Could not fetch the invitation right now." },
  nameRequired: { sv: "Namn krävs.", en: "Name is required." },
  couldNotCompleteInvite: { sv: "Kunde inte slutföra inbjudan just nu.", en: "Could not complete the invitation right now." },
  demoCannotSendInvitesAccounts: { sv: "Demo-konton kan inte skicka inbjudningar.", en: "Demo accounts cannot send invitations." },
  inviteResendRateLimited: { sv: "För många försök att skicka om denna inbjudan. Vänta en stund.", en: "Too many attempts to resend this invitation. Please wait a moment." },
  inviteAlreadyAccepted: { sv: "Inbjudan är redan accepterad.", en: "The invitation has already been accepted." },
  inviteExpiredCreateNew: { sv: "Inbjudan har gått ut — skapa en ny istället.", en: "The invitation has expired — create a new one instead." },
  inviteNoEmail: { sv: "Ingen e-postadress angiven på inbjudan.", en: "No email address is set on the invitation." },
  couldNotSendInvite: { sv: "Kunde inte skicka inbjudan just nu.", en: "Could not send the invitation right now." },
  demoCannotCreateCampaigns: { sv: "Demo-konton kan inte skapa kampanjer.", en: "Demo accounts cannot create campaigns." },
  campaignNameLength: { sv: "Kampanjnamn måste vara 3–255 tecken.", en: "Campaign name must be 3–255 characters." },
  startEndDatesRequired: { sv: "Start- och slutdatum krävs (YYYY-MM-DD).", en: "Start and end dates are required (YYYY-MM-DD)." },
  endDateAfterStart: { sv: "Slutdatum måste vara efter startdatum.", en: "End date must be after start date." },
  deliveryDateFormat: { sv: "Leveransdatum måste vara YYYY-MM-DD.", en: "Delivery date must be YYYY-MM-DD." },
  couldNotCreateCampaign: { sv: "Kunde inte skapa kampanj just nu.", en: "Could not create the campaign right now." },
  couldNotFetchAssociationDetails: { sv: "Kunde inte hämta föreningsuppgifter.", en: "Could not fetch organisation details." },
  demoCannotChangeAssociation: { sv: "Demo-konton kan inte ändra föreningsuppgifter.", en: "Demo accounts cannot change organisation details." },
  orgNumberFormat: { sv: "Organisationsnummer måste vara i formatet 556677-8899.", en: "Company registration number must be in the format 556677-8899." },
  postalCodeFiveDigits: { sv: "Postnummer måste vara fem siffror.", en: "Postcode must be five digits." },
  couldNotSaveAssociation: { sv: "Kunde inte spara föreningsuppgifter.", en: "Could not save organisation details." },
  demoCannotEndCampaigns: { sv: "Demo-konton kan inte avsluta kampanjer.", en: "Demo accounts cannot end campaigns." },
  campaignCannotEndStatusPrefix: { sv: "Kampanjen kan inte avslutas i status ", en: "The campaign cannot be ended in status " },
  couldNotEndCampaign: { sv: "Kunde inte avsluta kampanjen.", en: "Could not end the campaign." },
  demoCannotChangeTeamGoals: { sv: "Demo-konton kan inte ändra lagmål.", en: "Demo accounts cannot change team goals." },
  teamIdAndCampaignIdRequired: { sv: "teamId och campaignId krävs", en: "teamId and campaignId are required" },
  goalValuePositive: { sv: "goalValue måste vara ett positivt tal", en: "goalValue must be a positive number" },
  teamNotFoundThe: { sv: "Laget hittades inte", en: "The team was not found" },
  teamNotInCampaign: { sv: "Laget tillhör inte den angivna kampanjen.", en: "The team does not belong to the given campaign." },
  couldNotSaveGoal: { sv: "Kunde inte spara målet", en: "Could not save the goal" },
  noTeamFound: { sv: "Inget lag hittades", en: "No team found" },
  demoCannotChangeSellers: { sv: "Demoläget kan inte ändra riktiga säljare.", en: "Demo mode cannot change real sellers." },
  invalidSellerId: { sv: "Ogiltigt säljar-ID.", en: "Invalid seller ID." },
  individualGoalOrStatusRequired: { sv: "individualGoal eller status krävs.", en: "individualGoal or status is required." },
  individualGoalRange: { sv: "individualGoal måste vara ett heltal mellan 0 och 10 000 000 kr.", en: "individualGoal must be a whole number between 0 and 10,000,000 SEK." },
  statusActiveOrInactive: { sv: "status måste vara ACTIVE eller INACTIVE.", en: "status must be ACTIVE or INACTIVE." },
  couldNotUpdateSeller: { sv: "Kunde inte uppdatera säljaren", en: "Could not update the seller" },
  demoCannotCreateSellers: { sv: "Demoläget kan inte skapa riktiga säljare.", en: "Demo mode cannot create real sellers." },
  nameEmailPasswordRequired: { sv: "Namn, e-post och lösenord krävs.", en: "Name, email and password are required." },
  couldNotCreateSeller: { sv: "Kunde inte skapa säljare.", en: "Could not create the seller." },
  demoCannotImportSellers: { sv: "Demoläget kan inte importera säljare.", en: "Demo mode cannot import sellers." },
  invalidTeamId: { sv: "Ogiltigt lag-ID.", en: "Invalid team ID." },
  noRowsToImport: { sv: "Inga rader att importera.", en: "No rows to import." },
  max2000ImportRows: { sv: "Max 2000 rader per import.", en: "Maximum 2000 rows per import." },
  couldNotImportSellers: { sv: "Kunde inte importera säljare.", en: "Could not import sellers." },
  demoCannotRotateInviteTokens: { sv: "Demoläget kan inte rotera riktiga invite-tokens.", en: "Demo mode cannot rotate real invite tokens." },
  expiresInDaysRange: { sv: "expiresInDays måste vara 0–365 (0 = ingen utgång).", en: "expiresInDays must be 0–365 (0 = no expiry)." },
  maxUsesRange: { sv: "maxUses måste vara mellan 1 och 10000 (eller utelämnat).", en: "maxUses must be between 1 and 10000 (or omitted)." },
  couldNotRotateInviteLink: { sv: "Kunde inte rotera inbjudningslänken just nu.", en: "Could not rotate the invitation link right now." },
  demoCannotRegisterOrders: { sv: "Demoläget kan inte registrera riktiga ordrar.", en: "Demo mode cannot register real orders." },
  atLeastOneItemRequired: { sv: "Minst en vara krävs.", en: "At least one item is required." },
  sellerProfileInactive: { sv: "Din säljprofil är inte aktiv.", en: "Your seller profile is not active." },
  salesPeriodInactive: {
    sv: "Försäljningsperioden är inte aktiv just nu. Beställningar tas emot under angiven säljperiod.",
    en: "The sales period is not active right now. Orders are accepted during the stated sales period.",
  },
  productNotFoundPrefix: { sv: "Produkt hittades inte: ", en: "Product not found: " },
  homeDeliveryFieldsRequired: {
    sv: "Vid hemleverans måste {fields} fyllas i.",
    en: "For home delivery, please fill in {fields}.",
  },
  fieldRequired: { sv: "obligatorisk", en: "required" },
  fieldAddress: { sv: "adress", en: "address" },
  fieldCity: { sv: "ort", en: "town/city" },
  fieldPostalCode: { sv: "postnummer", en: "postcode" },
  campaignBulkDeliveryOnly: {
    sv: "Den här kampanjen levererar samlat till föreningen — hemleverans är inte tillgänglig.",
    en: "This campaign delivers collected to the club — home delivery is not available.",
  },
  campaignDirectDeliveryOnly: {
    sv: "Den här kampanjen kräver hemleverans till köparen.",
    en: "This campaign requires home delivery to the buyer.",
  },
  importNameEmailRequired: {
    sv: "Namn och e-post krävs",
    en: "Name and email are required",
  },
  importInvalidEmail: { sv: "Ogiltig e-post", en: "Invalid email" },
  importDuplicateInFile: {
    sv: "Dubblett i filen",
    en: "Duplicate in the file",
  },
  importEmailAlreadyRegistered: {
    sv: "E-post redan registrerad",
    en: "Email already registered",
  },
  importCreateFailed: {
    sv: "Kunde inte skapa kontot",
    en: "Could not create the account",
  },
  klarnaRefundManualStep: {
    sv: "Återbetalningen måste också utföras i Klarnas portal.",
    en: "The refund must also be completed in Klarna’s portal.",
  },
  settlementInvoiceLine: {
    sv: "Roots-andel kampanj {name} (avtalad fee)",
    en: "Roots share — campaign {name} (agreed fee)",
  },
  settlementInvoiceCreateFailed: {
    sv: "Faktura kunde inte skapas hos leverantören",
    en: "Invoice could not be created with the supplier",
  },
  cartEmpty: { sv: "Varukorgen är tom.", en: "The basket is empty." },
  couldNotRegisterOrder: { sv: "Kunde inte registrera ordern.", en: "Could not register the order." },
  demoCannotChangeDelivery: { sv: "Demoläget kan inte ändra leveransstatus.", en: "Demo mode cannot change delivery status." },
  statusShippedDeliveredPaid: { sv: "status måste vara SHIPPED, DELIVERED eller PAID.", en: "status must be SHIPPED, DELIVERED or PAID." },
  onlyPaidOrdersShipDeliver: { sv: "Endast betalda ordrar kan markeras som skickade/levererade.", en: "Only paid orders can be marked as shipped/delivered." },
  couldNotUpdateDelivery: { sv: "Kunde inte uppdatera leveransstatus.", en: "Could not update delivery status." },
  demoCannotConfirmOrders: { sv: "Demoläget kan inte bekräfta ordrar.", en: "Demo mode cannot confirm orders." },
  onlyManualOrdersNeedConfirm: { sv: "Bara manuella ordrar behöver bekräftas.", en: "Only manual orders need confirmation." },
  orderCancelledCannotConfirm: { sv: "Ordern är avbokad och kan inte bekräftas.", en: "The order is cancelled and cannot be confirmed." },
  cannotConfirmOwnOrder: { sv: "Du kan inte bekräfta en order du själv har registrerat.", en: "You cannot confirm an order you registered yourself." },
  demoCannotCancelOrders: { sv: "Demoläget kan inte avboka ordrar.", en: "Demo mode cannot cancel orders." },
  enterReasonMin3: { sv: "Ange ett skäl (minst 3 tecken).", en: "Please enter a reason (at least 3 characters)." },
  reasonMax500: { sv: "Skälet får vara högst 500 tecken.", en: "The reason may be at most 500 characters." },
  statusCancelledOrRefunded: { sv: "status måste vara CANCELLED eller REFUNDED.", en: "status must be CANCELLED or REFUNDED." },
  orderCancelledOrRefundedLocked: { sv: "Ordern är avbokad eller återbetald och kan inte ändras. Registrera en ny order istället.", en: "The order is cancelled or refunded and cannot be changed. Register a new order instead." },
  orderPaidUseRefund: { sv: "Ordern är betald via Klarna. Använd återbetalning istället för avbokning.", en: "The order is paid via Klarna. Use a refund instead of cancellation." },
  teamPayoutAlreadyInvoicedCancel: {
    sv: "Lagets utbetalning är redan fakturerad eller genomförd. Ordern räknades in i den, så avbokningen måste hanteras manuellt i bokföringen också.",
    en: "The team's payout is already invoiced or completed. The order was included, so the cancellation must also be handled manually in the accounts.",
  },
  orderChangedByOther: { sv: "Ordern ändrades av någon annan. Ladda om och försök igen.", en: "The order was changed by someone else. Reload and try again." },
  couldNotCancelOrder: { sv: "Kunde inte avboka ordern.", en: "Could not cancel the order." },
  couldNotMarkDelivery: { sv: "Kunde inte markera leverans.", en: "Could not mark delivery." },
  settlementAlreadyRunning: { sv: "Avräkning körs redan för denna kampanj. Vänta ett par minuter och försök igen.", en: "A payout statement is already being created for this campaign. Wait a couple of minutes and try again." },
  settlementLockUnavailable: {
    sv: "Avräkningen kan inte köras just nu (låstjänsten är otillgänglig). Försök igen om några minuter.",
    en: "The payout statement cannot run right now (the lock service is unavailable). Try again in a few minutes.",
  },
  orgMissingOrgNumberInvoice: {
    sv: "Föreningen saknar organisationsnummer — fyll i det i inställningar innan fakturering.",
    en: "The club is missing a company registration number — add it under settings before invoicing.",
  },
  fortnoxNotEnabledInvoice: {
    sv: "Fortnox är inte aktiverat. Sätt FORTNOX_ENABLED=true och giltig FORTNOX_ACCESS_TOKEN innan utbetalningsfaktura skapas.",
    en: "Fortnox is not enabled. Set FORTNOX_ENABLED=true and a valid FORTNOX_ACCESS_TOKEN before creating a payout invoice.",
  },
  payoutMissingFortnoxPaid: {
    sv: "Utbetalningen saknar Fortnox-fakturanummer och kan inte markeras PAID. Kör create-invoice först.",
    en: "The payout is missing a Fortnox invoice number and cannot be marked PAID. Run create-invoice first.",
  },
  payoutInvoicedMissingFortnoxId: {
    sv: "Utbetalningen är markerad som fakturerad men saknar Fortnox-ID. Kontakta support innan ny faktura skapas.",
    en: "The payout is marked as invoiced but is missing a Fortnox ID. Contact support before creating a new invoice.",
  },
  useSettlementCreateInvoice: {
    sv: "Använd POST /v1/settlement/create-invoice/:payoutId för att markera INVOICED — manuell PATCH stänger ute Fortnox-fakturan.",
    en: "Use POST /v1/settlement/create-invoice/:payoutId to mark INVOICED — a manual PATCH bypasses the Fortnox invoice.",
  },
  enterPaymentReference: {
    sv: "Ange betalningsreferens (t.ex. banköverföringens OCR/meddelande) när Fortnox inte är aktiverat.",
    en: "Enter a payment reference (e.g. the bank transfer OCR/message) when Fortnox is not enabled.",
  },
  orgNotApprovedForPublicSales: {
    sv: "Föreningen är inte godkänd för publik försäljning ännu. Vi hör av oss så snart vi granskat uppgifterna.",
    en: "The organisation is not yet approved for public sales. We will get in touch once we have reviewed the details.",
  },
  // Calculator admin / shareable links
  demoCannotCreateShareableLinks: {
    sv: "Demo-konton kan inte skapa delbara länkar.",
    en: "Demo accounts cannot create shareable links.",
  },
  couldNotCreateLink: {
    sv: "Kunde inte skapa länken",
    en: "Could not create the link",
  },
  couldNotFetchLinks: {
    sv: "Kunde inte hämta länkar",
    en: "Could not fetch links",
  },
  demoCannotChangeLinks: {
    sv: "Demo-konton kan inte ändra länkar.",
    en: "Demo accounts cannot change links.",
  },
  linkNotFound: {
    sv: "Länken hittades inte",
    en: "The link was not found",
  },
  couldNotUpdateLink: {
    sv: "Kunde inte uppdatera länken",
    en: "Could not update the link",
  },
  demoCannotDeleteLinks: {
    sv: "Demo-konton kan inte ta bort länkar.",
    en: "Demo accounts cannot delete links.",
  },
  couldNotDeleteLink: {
    sv: "Kunde inte ta bort länken",
    en: "Could not delete the link",
  },
  couldNotFetchLeads: {
    sv: "Kunde inte hämta leads",
    en: "Could not fetch leads",
  },
  // Admin
  couldNotFetchAuditLog: {
    sv: "Kunde inte hämta audit-log",
    en: "Could not fetch the audit log",
  },
  couldNotFetchActionList: {
    sv: "Kunde inte hämta åtgärds-lista",
    en: "Could not fetch the action list",
  },
  couldNotFetchOrgsToReview: {
    sv: "Kunde inte hämta föreningar att granska",
    en: "Could not fetch organisations to review",
  },
  invalidOrgId: {
    sv: "Ogiltigt organisations-id.",
    en: "Invalid organisation ID.",
  },
  associationNotFoundPeriod: {
    sv: "Föreningen hittades inte.",
    en: "The organisation was not found.",
  },
  couldNotUpdateAssociation: {
    sv: "Kunde inte uppdatera föreningen",
    en: "Could not update the organisation",
  },
  // BankID
  bankIdRateLimited: {
    sv: "För många BankID-försök. Försök igen om en stund.",
    en: "Too many BankID attempts. Please try again in a moment.",
  },
  bankIdStartFailed: {
    sv: "Kunde inte starta BankID-identifiering",
    en: "Could not start BankID identification",
  },
  orderRefRequired: {
    sv: "orderRef krävs",
    en: "orderRef is required",
  },
  bankIdFailed: {
    sv: "BankID-identifiering misslyckades",
    en: "BankID identification failed",
  },
  bankIdCancelFailed: {
    sv: "Cancel misslyckades",
    en: "Cancel failed",
  },
  // Display fallbacks
  unknownProduct: {
    sv: "Okänd produkt",
    en: "Unknown product",
  },
  unknownOrganisation: {
    sv: "Okänd förening",
    en: "Unknown organisation",
  },
  unknownCampaign: {
    sv: "Okänd kampanj",
    en: "Unknown campaign",
  },
  requestTooLarge: {
    sv: "Förfrågan är för stor.",
    en: "The request is too large.",
  },
  // tRPC campaigns / teams
  permissionDeniedForTeam: {
    sv: "Behörighet saknas för detta lag",
    en: "Permission denied for this team",
  },
  teamNotFoundOrNoPermission: {
    sv: "Laget hittades inte eller saknar behörighet",
    en: "The team was not found or you lack permission",
  },
  demoCannotPerformAction: {
    sv: "Demo-konton kan inte utföra denna åtgärd.",
    en: "Demo accounts cannot perform this action.",
  },
  // tRPC AI chat
  aiTooManyQuestionsWait: {
    sv: "För många frågor på kort tid. Vänta {seconds}s.",
    en: "Too many questions in a short time. Wait {seconds}s.",
  },
  aiDailyCapReached: {
    sv: "AI-assistenten har nått dagens kapacitetstak. Försök igen efter midnatt.",
    en: "The AI assistant has reached today's capacity. Please try again after midnight.",
  },
  aiNotActivated: {
    sv: "AI-assistenten är inte aktiverad just nu. Kontakta support för hjälp.",
    en: "The AI assistant is not activated right now. Contact support for help.",
  },
  aiUnavailableTryAgain: {
    sv: "AI-assistenten är inte tillgänglig just nu. Försök igen eller maila hej@roots.se.",
    en: "The AI assistant is unavailable right now. Try again or email hej@roots.se.",
  },
  aiGeneratedDisclaimer: {
    sv: "AI-genererat svar — verifiera viktig information",
    en: "AI-generated reply — please verify important information",
  },
  mfaEnrollmentRequired: {
    sv: "Din roll kräver tvåfaktorsautentisering. Registrera en autentiseringsapp under Inställningar för att fortsätta.",
    en: "Your role requires two-factor authentication. Register an authenticator app under Settings to continue.",
  },
  unknownTeam: {
    sv: "Okänt lag",
    en: "Unknown team",
  },
} as const satisfies Record<string, Pair>;

export type ErrorKey = keyof typeof ERRORS;

export function uiError(locale: UiLocale, key: ErrorKey): string {
  return ERRORS[key][locale];
}

/** Replace `{name}`-style placeholders in a localized error string. */
export function uiErrorFill(
  locale: UiLocale,
  key: ErrorKey,
  vars: Record<string, string>
): string {
  let text = ERRORS[key][locale];
  for (const [name, value] of Object.entries(vars)) {
    text = text.replaceAll(`{${name}}`, value);
  }
  return text;
}
