import type { Locale } from "../config";

/** Page key → locale → copy block. */
export type PageLocalized<T> = Record<Locale, T>;

type FaqItem = { q: string; a: string };
type FaqSection = { id: string; title: string; items: FaqItem[] };
type LegalSection = {
  heading: string;
  paragraphs?: string[];
  bullets?: { label?: string; text: string }[];
  /** Optional note after bullets/paragraphs. */
  after?: string[];
};

export const pages = {
  produkter: {
    sv: {
      title: "Produkter",
      description:
        "Tre noggrant formulerade nordiska produkter med SyriCalm® och Pro-Vitamin B5 — var för sig eller som komplett paket. Sulfatsnålt, silikon- och parabenfritt.",
      heroTitle: "Våra produkter",
      heroBody:
        "Tre noggrant formulerade nordiska produkter med forskningsförankrade aktiver — var för sig eller som komplett paket. Sulfatsnålt, silikon- och parabenfritt.",
      itemListName: "Roots produkter",
      breadcrumbHome: "Hem",
      values: [
        "Forskningsförankrade aktiver",
        "Sulfatsnålt & silikonfritt",
        "Unisex — för alla",
      ],
      readMore: "Läs mer",
      ctaTitle: "Beställ via din förening",
      ctaBody:
        "Roots säljs genom föreningar och klubbar — en del av varje köp går direkt till laget.",
      ctaButton: "Så gör din förening",
      productSlugs: ["shampoo", "conditioner", "body-wash", "paket"] as const,
    },
    en: {
      title: "Products",
      description:
        "Three carefully formulated Nordic products with SyriCalm® and Pro-Vitamin B5 — individually or as a complete pack. Low-sulphate, silicone- and paraben-free.",
      heroTitle: "Our products",
      heroBody:
        "Three carefully formulated Nordic products with research-backed actives — individually or as a complete pack. Low-sulphate, silicone- and paraben-free.",
      itemListName: "Roots products",
      breadcrumbHome: "Home",
      values: [
        "Research-backed actives",
        "Low-sulphate & silicone-free",
        "Unisex — for everyone",
      ],
      readMore: "Learn more",
      ctaTitle: "Order through your club",
      ctaBody:
        "Roots is sold through sports clubs — a share of every purchase goes straight to the team.",
      ctaButton: "How your club gets started",
      productSlugs: ["shampoo", "conditioner", "body-wash", "paket"] as const,
    },
  },

  foreningsliv: {
    sv: {
      title: "Föreningsliv",
      description:
        "Stärk er förening med Roots. Sälj naturlig hårvård och generera intäkter till laget — enkelt, snabbt och utan startavgift.",
      badge: "För föreningar",
      heroTitleLead: "Gör föreningslivet",
      heroTitleAccent: "starkare",
      heroBody:
        "Roots är byggt för föreningar. Beställ naturlig hårvård direkt i vår portal, säkerställ att en del av vinsten går tillbaka till er klubb, och ge era medlemmar produkter de älskar.",
      heroImageAlt: "Roots produkter i föreningens omklädningsrum",
      ctaPrimary: "Anslut din förening",
      ctaSecondary: "Kontakta oss",
      stepsTitle: "Så här fungerar det",
      stepsSubtitle: "Från registrering till leverans — i fyra enkla steg.",
      steps: [
        {
          step: "01",
          title: "Anslut",
          description: "Registrera din förening — tar bara några minuter.",
        },
        {
          step: "02",
          title: "Beställ",
          description: "Välj antal paket direkt i vår portal. Inga minsta volymer.",
        },
        {
          step: "03",
          title: "Leverans",
          description: "Vi levererar direkt till er klubb eller era medlemmar.",
        },
        {
          step: "04",
          title: "Intäkt",
          description: "Del av vinsten går tillbaka till föreningslivet.",
        },
      ],
      midImageAlt: "Roots produkter i duschen — redo att användas",
      featuresTitle: "Vad ni får",
      features: [
        {
          title: "Ingen minimumbeställning",
          description: "Beställ det ni behöver, när ni behöver det.",
        },
        {
          title: "Egen portal",
          description: "Administrera beställningar och se statistik i realtid.",
        },
        {
          title: "Fri frakt över 500 kr",
          description: "Snabb leverans direkt till klubben.",
        },
        {
          title: "Intäktsrapport",
          description: "Full transparens över hur vinsten fördelas.",
        },
      ],
      bottomTitle: "Redo att börja?",
      bottomBody:
        "Anslut din förening idag och ge era medlemmar tillgång till naturlig, nordisk hårvård.",
      bottomCta: "Registrera din förening",
    },
    en: {
      title: "For clubs",
      description:
        "Strengthen your club with Roots. Sell natural hair care and generate revenue for the team — simple, fast and with no start-up fee.",
      badge: "For clubs",
      heroTitleLead: "Strengthen",
      heroTitleAccent: "sports clubs",
      heroBody:
        "Roots is built for clubs. Order natural hair care directly in our portal, keep a share of the revenue for your club, and give your members products they love.",
      heroImageAlt: "Roots products in the club changing room",
      ctaPrimary: "Register your club",
      ctaSecondary: "Contact us",
      stepsTitle: "How it works",
      stepsSubtitle: "From registration to delivery — in four simple steps.",
      steps: [
        {
          step: "01",
          title: "Join",
          description: "Register your club — it only takes a few minutes.",
        },
        {
          step: "02",
          title: "Order",
          description:
            "Choose how many packs you need in our portal. No minimum volumes.",
        },
        {
          step: "03",
          title: "Delivery",
          description: "We deliver straight to your club or your members.",
        },
        {
          step: "04",
          title: "Revenue",
          description: "A share of the profit goes back into club fundraising.",
        },
      ],
      midImageAlt: "Roots products in the shower — ready to use",
      featuresTitle: "What you get",
      features: [
        {
          title: "No minimum order",
          description: "Order what you need, when you need it.",
        },
        {
          title: "Your own portal",
          description: "Manage orders and see live statistics.",
        },
        {
          title: "Free shipping over SEK 500",
          description: "Fast delivery straight to the club.",
        },
        {
          title: "Revenue report",
          description: "Full transparency on how profit is shared.",
        },
      ],
      bottomTitle: "Ready to start?",
      bottomBody:
        "Register your club today and give your members access to natural, Nordic hair care.",
      bottomCta: "Register your club",
    },
  },

  saFungerarDet: {
    sv: {
      title: "Så fungerar det",
      description:
        "Se hur Roots fungerar för föreningar i tre enkla steg — och räkna ut vad försäljningen kan ge er förening. Inga pärmar, inga kontanter.",
      howToName: "Så fungerar Roots",
      howToDescription:
        "Hur Roots fungerar för föreningar i tre enkla steg — från start till försäljning.",
      badge: "För föreningar",
      heroTitle: "Så fungerar det",
      heroBody:
        "Tre enkla steg — från att föreningen kommer igång till att medlemmen säljer i mobilen. Se hur det går till och räkna ut vad det kan ge er förening.",
      ctaCalc: "Räkna på er förtjänst",
      ctaDemo: "Boka en demo",
      demoEyebrow: "Se det i praktiken",
      demoTitle: "Enkelt för alla — i varje steg",
      demoSubtitle:
        "Byt mellan rollerna och se hur lätt det är. Inga pärmar, inga kontanter — allt sker i mobilen.",
      roleTablistLabel: "Välj roll",
      steps: [
        {
          id: "forening",
          tab: "Föreningen",
          eyebrow: "Steg 1",
          title: "Föreningen kommer igång",
          description:
            "Föreningsansvarig loggar in, sätter ett mål och öppnar en säljperiod. Allt syns live i dashboarden — ni ser exakt hur långt ni har kvar.",
          bullets: [
            "Sätt mål per lag och per säljare",
            "Skapa säljperioder med start- och slutdatum",
            "Följ försäljningen i realtid mot målet",
          ],
        },
        {
          id: "lag",
          tab: "Lagledaren",
          eyebrow: "Steg 2",
          title: "Lagledaren bjuder in laget",
          description:
            "Tränaren eller föräldragruppen skickar en registreringslänk till spelarna och peppar laget via topplistan — utan att hålla i någon pärm.",
          bullets: [
            "Bjud in hela laget med en länk",
            "Topplista som driver lite vänskaplig tävling",
            "Chatt och uppföljning på ett ställe",
          ],
        },
        {
          id: "seller",
          tab: "Medlemmen",
          eyebrow: "Steg 3",
          title: "Medlemmen säljer",
          description:
            "Spelaren får sin egen personliga shop-länk. Hen delar den med släkt och vänner — som handlar med Swish eller kort på några sekunder.",
          bullets: [
            "Egen personlig webshop-sida",
            "Dela via SMS, sociala medier eller QR-kod",
            "Swish och kort direkt i mobilen",
          ],
        },
      ],
      calcEyebrow: "Räkna på er förtjänst",
      calcTitle: "Vad kan er förening tjäna?",
      calcBody:
        "Se hur enkelt det är att räkna — och prova själv direkt nedan. Dra i reglagen så uppdateras förtjänsten i realtid.",
      calcBullets: [
        "Justera antal säljare och snittförsäljning",
        "Se förtjänsten och hur långt ni når mot målet",
        "Dela resultatet — vi hjälper er igång",
      ],
      calcTryBelow: "Prova själv nedan",
      leadTitle: "Vill ni se vad det skulle ge er förening?",
      leadBody:
        "Lämna er mejl så skickar vi en sammanfattning och hjälper er igång. Inga förpliktelser.",
      leadEmailLabel: "E-post *",
      leadEmailPlaceholder: "namn@forening.se",
      leadNameLabel: "Namn (valfritt)",
      leadNamePlaceholder: "Ditt namn",
      leadMessageLabel: "Meddelande (valfritt)",
      leadMessagePlaceholder: "Berätta gärna lite om er förening",
      leadConsent:
        "Ja, ni får mejla mig om Roots för föreningar. Vi hanterar uppgifterna enligt vår integritetspolicy.",
      leadConsentPrivacyLink: "integritetspolicy",
      leadSubmit: "Skicka till mig",
      leadSubmitting: "Skickar…",
      leadThanksTitle: "Tack!",
      leadThanksBody:
        "Vi hör av oss med en sammanfattning och hjälper er igång. Under tiden kan du fortsätta räkna ovan.",
      leadErrorInvalidEmail: "Ange en giltig e-postadress.",
      leadErrorGeneric: "Något gick fel. Försök igen.",
    },
    en: {
      title: "How it works",
      description:
        "See how Roots works for clubs in three simple steps — and calculate what sales could bring your club. No paperwork, no cash handling.",
      howToName: "How Roots works",
      howToDescription:
        "How Roots works for clubs in three simple steps — from start to sales.",
      badge: "For clubs",
      heroTitle: "How it works",
      heroBody:
        "Three simple steps — from the club signing up to members selling on their phone. See how it works and calculate what it could mean for your club.",
      ctaCalc: "Calculate your earnings",
      ctaDemo: "Book a demo",
      demoEyebrow: "See it in action",
      demoTitle: "Simple for everyone — at every step",
      demoSubtitle:
        "Switch between roles and see how easy it is. No paperwork, no cash handling — everything happens on the phone.",
      roleTablistLabel: "Choose a role",
      steps: [
        {
          id: "forening",
          tab: "The club",
          eyebrow: "Step 1",
          title: "The club signs up",
          description:
            "The club admin logs in, sets a goal and opens a sales period. Progress updates live on the dashboard — you can see exactly how far you still have to go.",
          bullets: [
            "Set goals per team and per seller",
            "Create sales periods with start and end dates",
            "Track sales in real time against the goal",
          ],
        },
        {
          id: "lag",
          tab: "The team leader",
          eyebrow: "Step 2",
          title: "The team leader invites the team",
          description:
            "The coach or parent group sends a registration link to the players and motivates the team via the leaderboard — without paperwork.",
          bullets: [
            "Invite the whole team with one link",
            "A leaderboard that drives friendly competition",
            "Chat and follow-up in one place",
          ],
        },
        {
          id: "seller",
          tab: "The member",
          eyebrow: "Step 3",
          title: "The member sells",
          description:
            "The player gets their own personal shop link. They share it with family and friends — who pay with Swish or card in seconds.",
          bullets: [
            "A personal webshop page",
            "Share via SMS, social media or QR code",
            "Swish and card right on the phone",
          ],
        },
      ],
      calcEyebrow: "Calculate your earnings",
      calcTitle: "What could your club earn?",
      calcBody:
        "See how easy it is to calculate — and try it yourself below. Drag the sliders and earnings update in real time.",
      calcBullets: [
        "Adjust number of sellers and average sales",
        "See earnings and how close you are to the goal",
        "Share the result — we'll help you get started",
      ],
      calcTryBelow: "Try it yourself below",
      leadTitle: "Want to see what it could mean for your club?",
      leadBody:
        "Enter your email and we’ll send a summary and help you get started. No commitment.",
      leadEmailLabel: "Email *",
      leadEmailPlaceholder: "name@club.se",
      leadNameLabel: "Name (optional)",
      leadNamePlaceholder: "Your name",
      leadMessageLabel: "Message (optional)",
      leadMessagePlaceholder: "Tell us a little about your club",
      leadConsent:
        "Yes, you may email me about Roots for clubs. We handle the data according to our privacy policy.",
      leadConsentPrivacyLink: "privacy policy",
      leadSubmit: "Email me the summary",
      leadSubmitting: "Sending…",
      leadThanksTitle: "Thank you!",
      leadThanksBody:
        "We'll be in touch with a summary and help you get started. In the meantime you can keep calculating above.",
      leadErrorInvalidEmail: "Enter a valid email address.",
      leadErrorGeneric: "Something went wrong. Please try again.",
    },
  },

  omOss: {
    sv: {
      title: "Om oss",
      description:
        "Teamet bakom Roots — föreningsliv, teknik och naturlig hårvård utvecklad i Norden.",
      eyebrow: "Om oss",
      brand: "Roots",
      heroBody:
        "Naturlig hårvård som kanaliserar vardagsköp tillbaka till föreningslivet.",
      ctaContact: "Kontakta oss",
      storyEyebrow: "Historien",
      storyTitle: "Från en enkel insikt",
      storyParagraphs: [
        "Föreningslivet i Sverige ger så mycket till samhället, men får alldeles för lite tillbaka. Vi ville ändra på det.",
        "Med bakgrunder inom teknik, idrott och företagande satte vi oss ner och funderade: vad kan alla föreningar ha gemensamt? Svaret var enkelt. Alla duschar. Alla behöver hår- och hudvård.",
        "Så vi skapade Roots. Tre naturliga produkter, utvecklade i Norden, med en affärsmodell som kanaliserar intäkter tillbaka till föreningslivet.",
      ],
      storyImageAlt: "Nordisk känsla — ren och naturlig",
      valuesEyebrow: "Värderingar",
      valuesTitle: "Det vi står för",
      values: [
        {
          title: "Föreningsdriven",
          description:
            "Allt vi gör har ett mål: att föreningslivet i Sverige ska blomstra. Vårt företag är byggt från grunden med det perspektivet.",
        },
        {
          title: "Naturligt, inte perfekt",
          description:
            "Vi tror inte på 100% ekologiska certifieringar för certifieringens skull. Vi tror på ingredienser som fungerar och är så naturliga som möjligt.",
        },
        {
          title: "Transparens",
          description:
            "Från ingredienslista till prissättning — vi är öppna med allt. Det är så man bygger förtroende.",
        },
      ],
      pressEyebrow: "Press",
      pressTitle: "Bildmaterial och intervjuer",
      pressBodyBefore: "Kontakta oss på",
      pressEmail: "press@roots.se",
      jobsEyebrow: "Jobb",
      jobsTitle: "Jobba hos oss",
      jobsBodyBefore: "Skicka din ansökan till",
      jobsEmail: "jobb@roots.se",
    },
    en: {
      title: "About us",
      description:
        "The team behind Roots — sports clubs, technology and natural hair care developed in the Nordics.",
      eyebrow: "About us",
      brand: "Roots",
      heroBody:
        "Natural hair care that channels everyday spending back into club fundraising.",
      ctaContact: "Contact us",
      storyEyebrow: "The story",
      storyTitle: "From a simple insight",
      storyParagraphs: [
        "Sports clubs in Sweden give so much to society, but get far too little back. We wanted to change that.",
        "With backgrounds in technology, sport and entrepreneurship, we sat down and asked: what could every club have in common? The answer was simple. Everyone showers. Everyone needs hair and skin care.",
        "So we created Roots. Three natural products, developed in the Nordics, with a business model that directs revenue back into club fundraising.",
      ],
      storyImageAlt: "Nordic feel — clean and natural",
      valuesEyebrow: "Values",
      valuesTitle: "What we stand for",
      values: [
        {
          title: "Built for clubs",
          description:
            "Everything we do has one goal: for sports clubs in Sweden to thrive. Our company is built from the ground up with that perspective.",
        },
        {
          title: "Natural, not perfect",
          description:
            "We don't believe in 100% organic certifications for certification's sake. We believe in ingredients that work and are as natural as possible.",
        },
        {
          title: "Transparency",
          description:
            "From ingredient lists to pricing — we're open about everything. That's how you build trust.",
        },
      ],
      pressEyebrow: "Press",
      pressTitle: "Press images and interviews",
      pressBodyBefore: "Contact us at",
      pressEmail: "press@roots.se",
      jobsEyebrow: "Careers",
      jobsTitle: "Work with us",
      jobsBodyBefore: "Send your application to",
      jobsEmail: "jobb@roots.se",
    },
  },

  kontakt: {
    sv: {
      title: "Kontakt",
      description:
        "Kontakta Ourroots — vi hjälper er komma igång med föreningsförsäljning av naturlig hårvård.",
      heroTitle: "Kontakta oss",
      heroBody:
        "Har du frågor om våra produkter, ditt föreningssamarbete eller något annat? Hör av dig — vi svarar så snart vi kan.",
      form: {
        name: "Namn",
        namePlaceholder: "Ditt namn",
        email: "E-post",
        emailPlaceholder: "din@epost.se",
        subject: "Ämne",
        subjectPlaceholder: "Vad gäller ditt ärende?",
        message: "Meddelande",
        messagePlaceholder: "Beskriv ditt ärende...",
        submit: "Skicka meddelande",
        submitting: "Skickar...",
      },
      successTitle: "Tack för ditt meddelande",
      successBody:
        "Vi har mottagit ditt meddelande och återkommer så snart vi kan, vanligtvis inom 1–2 arbetsdagar.",
      errorGeneric: "Något gick fel.",
      errorSendFailed: "Kunde inte skicka meddelandet.",
      emailLabel: "E-post",
      email: "info@roots.nu",
      addressLabel: "Adress",
      orgNumberLabel: "Org.nr",
      responseTitle: "Svarstid",
      responseBody:
        'Vi besvarar alla meddelanden inom 1–2 arbetsdagar. För akuta ärenden, skriv "Brådskande" i ämnesraden.',
    },
    en: {
      title: "Contact",
      description:
        "Contact Ourroots — we help you get started with club fundraising through natural hair care.",
      heroTitle: "Contact us",
      heroBody:
        "Questions about our products, your club partnership or anything else? Get in touch — we'll reply as soon as we can.",
      form: {
        name: "Name",
        namePlaceholder: "Your name",
        email: "Email",
        emailPlaceholder: "you@email.com",
        subject: "Subject",
        subjectPlaceholder: "What is your enquiry about?",
        message: "Message",
        messagePlaceholder: "Describe your enquiry...",
        submit: "Send message",
        submitting: "Sending...",
      },
      successTitle: "Thank you for your message",
      successBody:
        "We've received your message and will get back to you as soon as we can, usually within 1–2 business days.",
      errorGeneric: "Something went wrong.",
      errorSendFailed: "Could not send the message.",
      emailLabel: "Email",
      email: "info@roots.nu",
      addressLabel: "Address",
      orgNumberLabel: "Org. no.",
      responseTitle: "Response time",
      responseBody:
        'We reply to all messages within 1–2 business days. For urgent matters, write "Urgent" in the subject line.',
    },
  },

  hjalp: {
    sv: {
      title: "Hjälp",
      badge: "Hjälp & support",
      heroTitle: "Vi hjälper dig komma igång",
      heroBody:
        "Vanliga frågor sorterade efter din roll. Hittar du inte svaret? Skicka in formuläret längst ned så svarar vi inom 24 timmar.",
      loggedInAs: "Inloggad som",
      roleLabel: "roll",
      backToPortal: "Tillbaka till portalen",
      questionsCount: "{n} frågor",
      yourRoleBadge: "Din roll",
      contactTitle: "Kontakta support",
      contactSubtitle: "Vi svarar normalt inom en arbetsdag.",
      contactSuccessTitle: "Meddelandet har skickats",
      contactSuccessBody: "Vi återkommer till {email}.",
      contactForm: {
        name: "Namn",
        email: "E-post",
        subject: "Ämne",
        subjectDefault: "Hjälp via portalen",
        message: "Meddelande",
        charCount: "{n}/5000 tecken",
        submit: "Skicka meddelande",
        submitting: "Skickar…",
        allFieldsRequired: "Alla fält måste fyllas i.",
        sendFailed: "Kunde inte skicka meddelandet.",
        networkError: "Nätverksfel. Försök igen.",
      },
      emailLabel: "E-post",
      email: "info@roots.nu",
      phoneLabel: "Telefon",
      phoneHours: "Vardagar 09–17 (via formulär ovan)",
      sections: [
        {
          id: "seller",
          title: "Säljare & egen shop",
          items: [
            {
              q: "Hur delar jag min shop?",
              a: "Gå till Min shop → kopiera länken eller använd QR-koden. Du kan dela direkt via SMS, e-post och sociala medier från delningssidan.",
            },
            {
              q: "Var ser jag mina beställningar?",
              a: "Klicka på Beställningar i vänsterspalten. Där kan du filtrera på status och datum, samt exportera till CSV.",
            },
            {
              q: "Hur byter jag lösenord?",
              a: "Inställningar → Byt lösenord. Demo-konton kan inte byta lösenord.",
            },
            {
              q: "Får jag pengarna direkt?",
              a: "Nej. Klarna-betalningarna går till föreningen och redovisas till lagansvarig vid kampanjens slut.",
            },
          ],
        },
        {
          id: "team-leader",
          title: "Lagansvarig",
          items: [
            {
              q: "Hur bjuder jag in säljare?",
              a: "Lag → Säljare → Bjud in. Du får en unik länk per säljare som de följer för att registrera sig.",
            },
            {
              q: "Kan jag sätta olika mål per säljare?",
              a: "Ja. På Säljar-listan klickar du på 'Sätt mål' eller 'Ändra' bredvid varje säljares progress-bar.",
            },
            {
              q: "Hur ser jag lagets totala försäljning?",
              a: "Översikten visar lagets samlade resultat, antal aktiva säljare och nuvarande genomsnitt per säljare.",
            },
          ],
        },
        {
          id: "association",
          title: "Förening & kampanjer",
          items: [
            {
              q: "Hur startar jag en ny kampanj?",
              a: "Förening → Ny kampanj. Ange namn, mål, marginal och datum så aktiveras kampanjen direkt.",
            },
            {
              q: "Hur lägger jag till ett nytt lag?",
              a: "Förening → Lag → Skapa nytt lag. Du genererar en inbjudningslänk som lagansvarig använder för att aktivera sig.",
            },
            {
              q: "Hur hanterar jag flera kampanjer samtidigt?",
              a: "Du kan ha en kampanj per lag aktiv. Skapa en kampanj per säsong; historiken behålls automatiskt.",
            },
          ],
        },
        {
          id: "club",
          title: "Klubb & abonnemang",
          items: [
            {
              q: "Var hittar jag mina fakturor?",
              a: "Portal → Fakturor. Filtrera på status (öppen, betald, makulerad) och datum. CSV-export finns för bokföring.",
            },
            {
              q: "Hur lägger jag till medlemmar?",
              a: "Portal → Medlemmar → Bjud in. Inbjudningar går via e-post och giltighetstid är 7 dagar.",
            },
            {
              q: "Hur ändrar jag mitt abonnemang?",
              a: "Kontakta din kontoansvariga säljare eller skicka in formuläret längst ned på denna sida.",
            },
          ],
        },
        {
          id: "sales",
          title: "Sälj-team & pipeline",
          items: [
            {
              q: "Hur skapar jag ett nytt lead?",
              a: "Portal → Pipeline → Nytt lead. Ange klubbnamn, källa och potential så hamnar leadet på dig direkt.",
            },
            {
              q: "Hur stänger jag en deal?",
              a: "Flytta leadet i Pipeline-vyn från QUALIFIED → WON. Då skapas automatiskt en organisation och första-kontakts-faktura.",
            },
            {
              q: "Hur ser jag min provision?",
              a: "Portal → Översikt visar dina aktuella deals, deras värde och förväntad provision.",
            },
          ],
        },
        {
          id: "internal",
          title: "Drift & administration",
          items: [
            {
              q: "Var hittar jag audit-loggen?",
              a: "Portal → Audit-log. Du kan filtrera på åtgärd, entitetstyp, användar-UUID och datumintervall.",
            },
            {
              q: "Hur ser jag systemhälsa?",
              a: "Portal → System visar API-uppetid, Sentry-event och senaste deployer.",
            },
            {
              q: "Hur återställs ett demokonto?",
              a: "Demo-konton återställs automatiskt varje natt via cron-jobbet seed-demo:nightly.",
            },
          ],
        },
        {
          id: "general",
          title: "Allmänt om Roots",
          items: [
            {
              q: "Vad är Roots?",
              a: "En plattform för insamlingskampanjer där föreningar säljer produkter via personliga shopar. Betalning via Klarna eller direkt till lagansvarig.",
            },
            {
              q: "Hur startar vi en kampanj?",
              a: "Besök kontakt-sidan eller boka demo. En av våra ASM:er kontaktar er inom 24 timmar.",
            },
            {
              q: "Vad kostar det?",
              a: "Roots tar inga uppstartsavgifter — vi finansieras via marginalen på sålda produkter. Kontakta sälj för aktuell prislista.",
            },
            {
              q: "Är det GDPR-säkert?",
              a: "Ja. All data lagras inom EU, betalningar hanteras av Klarna, och vi loggar alla användaråtgärder för spårbarhet.",
            },
            {
              q: "Vad är en personlig shop?",
              a: "Varje säljare får en egen shopsida med länk och QR-kod. Vänner och familj beställer därifrån — köpet räknas till rätt lag och säljare i portalen. Du behöver varken hantera kontanter eller bära runt på lådor.",
            },
            {
              q: "Hur mycket får föreningen?",
              a: "Föreningen behåller 35 % av försäljningen enligt en fast modell. Samma siffra syns i kalkylatorn, portalen och kommunikationen utåt, så att lagledare och säljare pratar samma språk.",
            },
            {
              q: "Hur fungerar leveransen?",
              a: "Kunden betalar online och produkten skickas hem (eller via samleverans till lagansvarig när det är valt). Säljaren delar bara länken eller QR-koden — ingen packning eller utkörning från laget.",
            },
            {
              q: "Vad skiljer Roots från godisförsäljning?",
              a: "Godis kräver ofta lager, bärande och manuell betalning. Med Roots är flödet digitalt: ingen föreningslager hos säljaren, betalning online och leverans till kunden. Premium hårvård kan dessutom bli en återkommande vana — inte bara en engångskampanj.",
            },
          ],
        },
      ] satisfies FaqSection[],
    },
    en: {
      title: "Help",
      badge: "Help & support",
      heroTitle: "We'll help you get started",
      heroBody:
        "Common questions sorted by your role. Can't find the answer? Submit the form at the bottom and we'll reply within 24 hours.",
      loggedInAs: "Signed in as",
      roleLabel: "role",
      backToPortal: "Back to the portal",
      questionsCount: "{n} questions",
      yourRoleBadge: "Your role",
      contactTitle: "Contact support",
      contactSubtitle: "We normally reply within one business day.",
      contactSuccessTitle: "Message sent",
      contactSuccessBody: "We'll get back to you at {email}.",
      contactForm: {
        name: "Name",
        email: "Email",
        subject: "Subject",
        subjectDefault: "Help via the portal",
        message: "Message",
        charCount: "{n}/5000 characters",
        submit: "Send message",
        submitting: "Sending…",
        allFieldsRequired: "All fields are required.",
        sendFailed: "Could not send the message.",
        networkError: "Network error. Please try again.",
      },
      emailLabel: "Email",
      email: "info@roots.nu",
      phoneLabel: "Phone",
      phoneHours: "Weekdays 09–17 (via the form above)",
      sections: [
        {
          id: "seller",
          title: "Sellers & personal shop",
          items: [
            {
              q: "How do I share my shop?",
              a: "Go to My shop → copy the link or use the QR code. You can share directly via SMS, email and social media from the share page.",
            },
            {
              q: "Where do I see my orders?",
              a: "Click Orders in the left sidebar. There you can filter by status and date, and export to CSV.",
            },
            {
              q: "How do I change my password?",
              a: "Settings → Change password. Demo accounts cannot change password.",
            },
            {
              q: "Do I receive the money straight away?",
              a: "No. Klarna payments go to the club and are settled with the team leader at the end of the campaign.",
            },
          ],
        },
        {
          id: "team-leader",
          title: "Team leader",
          items: [
            {
              q: "How do I invite sellers?",
              a: "Team → Sellers → Invite. You get a unique link per seller that they follow to register.",
            },
            {
              q: "Can I set different goals per seller?",
              a: "Yes. On the Sellers list, click 'Set goal' or 'Edit' next to each seller's progress bar.",
            },
            {
              q: "How do I see the team's total sales?",
              a: "The overview shows the team's combined results, number of active sellers and current average per seller.",
            },
          ],
        },
        {
          id: "association",
          title: "Club & campaigns",
          items: [
            {
              q: "How do I start a new campaign?",
              a: "Club → New campaign. Enter name, goal, margin and dates and the campaign activates immediately.",
            },
            {
              q: "How do I add a new team?",
              a: "Club → Teams → Create new team. You generate an invite link that the team leader uses to activate.",
            },
            {
              q: "How do I manage several campaigns at once?",
              a: "You can have one active campaign per team. Create one campaign per season; history is kept automatically.",
            },
          ],
        },
        {
          id: "club",
          title: "Club & subscriptions",
          items: [
            {
              q: "Where do I find my invoices?",
              a: "Portal → Invoices. Filter by status (open, paid, voided) and date. CSV export is available for bookkeeping.",
            },
            {
              q: "How do I add members?",
              a: "Portal → Members → Invite. Invitations go by email and are valid for 7 days.",
            },
            {
              q: "How do I change my subscription?",
              a: "Contact your account manager or submit the form at the bottom of this page.",
            },
          ],
        },
        {
          id: "sales",
          title: "Sales team & pipeline",
          items: [
            {
              q: "How do I create a new lead?",
              a: "Portal → Pipeline → New lead. Enter club name, source and potential and the lead is assigned to you immediately.",
            },
            {
              q: "How do I close a deal?",
              a: "Move the lead in Pipeline from Qualified → Won. A club record and an opening invoice are created automatically.",
            },
            {
              q: "How do I see my commission?",
              a: "Portal → Overview shows your current deals, their value and expected commission.",
            },
          ],
        },
        {
          id: "internal",
          title: "Operations & administration",
          items: [
            {
              q: "Where do I find the audit log?",
              a: "Portal → Audit log. You can filter by action, entity type, user UUID and date range.",
            },
            {
              q: "How do I see system health?",
              a: "Portal → System shows API uptime, Sentry events and recent deploys.",
            },
            {
              q: "How is a demo account reset?",
              a: "Demo accounts are reset automatically every night via the seed-demo:nightly cron job.",
            },
          ],
        },
        {
          id: "general",
          title: "About Roots in general",
          items: [
            {
              q: "What is Roots?",
              a: "A platform for fundraising campaigns where clubs sell products through personal shops. Payment via Klarna or directly to the team leader.",
            },
            {
              q: "How do we start a campaign?",
              a: "Visit the contact page or book a demo. One of our ASMs will contact you within 24 hours.",
            },
            {
              q: "What does it cost?",
              a: "Roots charges no start-up fees — we are funded through the margin on products sold. Contact sales for the current price list.",
            },
            {
              q: "Is it GDPR compliant?",
              a: "Yes. All data is stored within the EU, payments are handled by Klarna, and we log all user actions for traceability.",
            },
            {
              q: "What is a personal shop?",
              a: "Every seller gets their own shop page with a link and QR code. Friends and family order from there — the purchase is attributed to the right team and seller in the portal. You don't need to handle cash or carry boxes around.",
            },
            {
              q: "How much does the club keep?",
              a: "The club keeps 35% of sales under a fixed model. The same figure appears in the calculator, the portal and all external messaging, so team leaders and sellers stay aligned.",
            },
            {
              q: "How does delivery work?",
              a: "The customer pays online and the product is delivered to their address (or via consolidated delivery to the team leader when selected). The seller only shares the link or QR code — no packing or delivery from the team.",
            },
            {
              q: "How is Roots different from selling sweets?",
              a: "Sweets often require inventory, carrying and manual payment. With Roots the flow is digital: no club stock with the seller, online payment and delivery to the customer. Premium hair care can also become a recurring habit — not just a one-off campaign.",
            },
          ],
        },
      ] satisfies FaqSection[],
    },
  },

  integritet: {
    sv: {
      title: "Integritetspolicy",
      description: "Så hanterar Roots dina personuppgifter enligt GDPR.",
      updated: "Senast uppdaterad: 2 april 2026",
      companyName: "Ourroots AB",
      contactEmail: "info@roots.nu",
      sections: [
        {
          heading: "1. Personuppgiftsansvarig",
          paragraphs: [
            "Ourroots AB är personuppgiftsansvarig för behandlingen av dina personuppgifter.",
          ],
        },
        {
          heading: "2. Vilka uppgifter vi samlar in",
          paragraphs: [
            "Vi samlar in följande kategorier av personuppgifter:",
          ],
          bullets: [
            {
              label: "Kontaktuppgifter",
              text: "namn, e-postadress, telefonnummer och leveransadress vid köp eller kontaktformulär.",
            },
            {
              label: "Beställningsuppgifter",
              text: "ordernummer, produkter, belopp och betalningsreferens.",
            },
            {
              label: "Kontouppgifter",
              text: "e-post och lösenord (hashat) för klubb- och säljarportalen.",
            },
            {
              label: "Håranalys",
              text: "e-postadress, uppladdade bilder och svar på frågeformulär. Bilderna lagras enbart under analysens gång och raderas automatiskt efteråt.",
            },
            {
              label: "Teknisk data",
              text: "IP-adress, webbläsartyp och sidvisningar (via privacy-first-analys utan cookies).",
            },
          ],
        },
        {
          heading: "3. Ändamål och laglig grund",
          bullets: [
            {
              label: "Fullgöra avtal",
              text: "behandla beställningar, leveranser och kundservice (Art. 6.1 b GDPR).",
            },
            {
              label: "Berättigat intresse",
              text: "förbättra våra tjänster, analysera aggregerad användningsstatistik och förhindra missbruk (Art. 6.1 f GDPR).",
            },
            {
              label: "Samtycke",
              text: "skicka nyhetsbrev och marknadsföring. Du kan när som helst återkalla ditt samtycke (Art. 6.1 a GDPR).",
            },
            {
              label: "Rättslig förpliktelse",
              text: "bokföring och skattelagstiftning kräver att vi sparar vissa uppgifter (Art. 6.1 c GDPR).",
            },
          ],
        },
        {
          heading: "4. Hur länge vi sparar uppgifter",
          bullets: [
            { text: "Beställningsdata — 7 år (bokföringslagen)." },
            { text: "Kontouppgifter — tills kontot raderas." },
            { text: "Håranalysbilder — raderas direkt efter analys." },
            { text: "Nyhetsbrevsprenumeration — tills du avregistrerar dig." },
            { text: "Analysdata (aggregerad) — 26 månader." },
          ],
        },
        {
          heading: "5. Mottagare av uppgifter",
          paragraphs: [
            "Vi delar personuppgifter med följande kategorier av mottagare, alltid med lämpliga skyddsåtgärder:",
          ],
          bullets: [
            { text: "Betalningsleverantör — för att hantera transaktioner." },
            { text: "Fraktbolag — för leverans av fysiska produkter." },
            { text: "Fortnox — bokföring och fakturering." },
            {
              text: "OpenAI — håranalys samt AI-chatt (både publik chatt-widget och portal-assistent). Data skickas krypterat och lagras inte av OpenAI för träning enligt vår enterprise-konfig.",
            },
            { text: "Hosting-leverantör (Railway) — infrastruktur inom EU/EES." },
          ],
        },
        {
          heading: "6. Överföring utanför EU/EES",
          paragraphs: [
            "Vi strävar efter att hålla all data inom EU/EES. Vid överföring till tredje land (t.ex. OpenAI:s servrar i USA) säkerställer vi att det finns adekvata skyddsåtgärder, såsom EU-kommissionens standardavtalsklausuler (SCC) eller beslut om adekvat skyddsnivå.",
          ],
        },
        {
          heading: "7. Dina rättigheter",
          paragraphs: ["Enligt GDPR har du rätt att:"],
          bullets: [
            { text: "Få tillgång till dina personuppgifter (registerutdrag)." },
            { text: "Rätta felaktiga uppgifter." },
            { text: 'Radera uppgifter ("rätten att bli glömd").' },
            { text: "Begränsa behandlingen." },
            { text: "Invända mot behandling baserad på berättigat intresse." },
            {
              text: "Dataportabilitet — få ut dina uppgifter i maskinläsbart format.",
            },
            { text: "Återkalla samtycke för nyhetsbrev och marknadsföring." },
          ],
          after: [
            "Du kan utöva dina rättigheter på två sätt. Snabbast är att maila info@roots.nu från den e-postadress vi har registrerad på dig. För formella förfrågningar — t.ex. fullmakt eller om du vill att svaret ska postas — skicka brev till Ourroots AB, märk kuvertet \"Dataskydd\".",
            "Vi besvarar förfrågningar inom 30 dagar enligt GDPR Art. 12.3.",
          ],
        },
        {
          heading: "8. Cookies",
          paragraphs: [
            "Vi använder inga tredjepartscookies för spårning. Vår analysplattform är privacy-first och cookiefri. Nödvändiga sessionscookies används enbart för att hantera inloggning och kundvagn.",
          ],
        },
        {
          heading: "9. Säkerhet",
          paragraphs: [
            "Vi vidtar tekniska och organisatoriska åtgärder för att skydda dina uppgifter, inklusive kryptering (TLS), hashade lösenord (Argon2id), åtkomstkontroll och regelbunden säkerhetsöversyn.",
          ],
        },
        {
          heading: "10. Klagomål",
          paragraphs: [
            "Om du anser att vi hanterar dina personuppgifter felaktigt har du rätt att lämna klagomål till Integritetsskyddsmyndigheten (IMY), www.imy.se.",
          ],
        },
        {
          heading: "11. Ändringar",
          paragraphs: [
            "Vi kan uppdatera denna policy. Väsentliga ändringar meddelas via e-post eller på webbplatsen. Datumet längst upp visar senaste versionen.",
          ],
        },
      ] satisfies LegalSection[],
    },
    en: {
      title: "Privacy policy",
      description: "How Roots handles your personal data under the GDPR.",
      updated: "Last updated: 2 April 2026",
      companyName: "Ourroots AB",
      contactEmail: "info@roots.nu",
      sections: [
        {
          heading: "1. Data controller",
          paragraphs: [
            "Ourroots AB is the data controller for the processing of your personal data.",
          ],
        },
        {
          heading: "2. What data we collect",
          paragraphs: [
            "We collect the following categories of personal data:",
          ],
          bullets: [
            {
              label: "Contact details",
              text: "name, email address, phone number and delivery address when you purchase or use the contact form.",
            },
            {
              label: "Order details",
              text: "order number, products, amounts and payment reference.",
            },
            {
              label: "Account details",
              text: "email and password (hashed) for the club and seller portal.",
            },
            {
              label: "Hair analysis",
              text: "email address, uploaded images and questionnaire answers. Images are stored only for the duration of the analysis and are deleted automatically afterwards.",
            },
            {
              label: "Technical data",
              text: "IP address, browser type and page views (via privacy-first analytics without cookies).",
            },
          ],
        },
        {
          heading: "3. Purposes and legal basis",
          bullets: [
            {
              label: "Performance of a contract",
              text: "processing orders, deliveries and customer service (Art. 6.1 b GDPR).",
            },
            {
              label: "Legitimate interest",
              text: "improving our services, analysing aggregated usage statistics and preventing abuse (Art. 6.1 f GDPR).",
            },
            {
              label: "Consent",
              text: "sending newsletters and marketing. You may withdraw your consent at any time (Art. 6.1 a GDPR).",
            },
            {
              label: "Legal obligation",
              text: "bookkeeping and tax law require us to retain certain data (Art. 6.1 c GDPR).",
            },
          ],
        },
        {
          heading: "4. How long we keep data",
          bullets: [
            { text: "Order data — 7 years (Swedish Bookkeeping Act)." },
            { text: "Account details — until the account is deleted." },
            { text: "Hair analysis images — deleted immediately after analysis." },
            { text: "Newsletter subscription — until you unsubscribe." },
            { text: "Analytics data (aggregated) — 26 months." },
          ],
        },
        {
          heading: "5. Recipients of data",
          paragraphs: [
            "We share personal data with the following categories of recipients, always with appropriate safeguards:",
          ],
          bullets: [
            { text: "Payment provider — to process transactions." },
            { text: "Carriers — to deliver physical products." },
            { text: "Fortnox — bookkeeping and invoicing." },
            {
              text: "OpenAI — hair analysis and AI chat (both the public chat widget and the portal assistant). Data is sent encrypted and is not stored by OpenAI for training under our enterprise configuration.",
            },
            {
              text: "Hosting provider (Railway) — infrastructure within the EU/EEA.",
            },
          ],
        },
        {
          heading: "6. Transfers outside the EU/EEA",
          paragraphs: [
            "We aim to keep all data within the EU/EEA. When transferring to a third country (e.g. OpenAI's servers in the USA), we ensure adequate safeguards such as the European Commission's Standard Contractual Clauses (SCCs) or an adequacy decision.",
          ],
        },
        {
          heading: "7. Your rights",
          paragraphs: ["Under the GDPR you have the right to:"],
          bullets: [
            { text: "Access your personal data (subject access request)." },
            { text: "Rectify inaccurate data." },
            { text: 'Erase data ("the right to be forgotten").' },
            { text: "Restrict processing." },
            {
              text: "Object to processing based on legitimate interest.",
            },
            {
              text: "Data portability — receive your data in a machine-readable format.",
            },
            {
              text: "Withdraw consent for newsletters and marketing.",
            },
          ],
          after: [
            "You can exercise your rights in two ways. The fastest is to email info@roots.nu from the email address we have on file for you. For formal requests — e.g. power of attorney or if you want the reply by post — write to Ourroots AB and mark the envelope \"Data protection\".",
            "We respond to requests within 30 days under GDPR Art. 12.3.",
          ],
        },
        {
          heading: "8. Cookies",
          paragraphs: [
            "We do not use third-party cookies for tracking. Our analytics platform is privacy-first and cookie-free. Necessary session cookies are used only to manage login and the shopping cart.",
          ],
        },
        {
          heading: "9. Security",
          paragraphs: [
            "We take technical and organisational measures to protect your data, including encryption (TLS), hashed passwords (Argon2id), access control and regular security reviews.",
          ],
        },
        {
          heading: "10. Complaints",
          paragraphs: [
            "If you believe we handle your personal data incorrectly, you have the right to lodge a complaint with the Swedish Authority for Privacy Protection (IMY), www.imy.se.",
          ],
        },
        {
          heading: "11. Changes",
          paragraphs: [
            "We may update this policy. Material changes will be announced by email or on the website. The date at the top shows the latest version.",
          ],
        },
      ] satisfies LegalSection[],
    },
  },

  villkor: {
    sv: {
      title: "Köpvillkor",
      description:
        "Köpvillkor för Roots — ångerrätt, leverans, reklamation och mer.",
      updated: "Senast uppdaterad: 2 april 2026",
      companyName: "Ourroots AB",
      contactEmail: "info@roots.nu",
      sections: [
        {
          heading: "1. Allmänt",
          paragraphs: [
            'Dessa köpvillkor gäller för alla köp av produkter från Ourroots AB, nedan kallat "Roots", "vi" eller "oss". Genom att lägga en beställning godkänner du dessa villkor.',
            "För föreningsbeställningar via klubbportalen gäller dessa villkor i tillämpliga delar, tillsammans med eventuella separata föreningsavtal.",
          ],
        },
        {
          heading: "2. Priser och betalning",
          bullets: [
            { text: "Alla priser anges i svenska kronor (SEK) inklusive moms." },
            {
              text: "Eventuella fraktkostnader anges separat innan beställningen slutförs.",
            },
            {
              text: "Betalning sker via de betalningsmetoder som erbjuds i kassan.",
            },
            {
              text: "Det pris som visas vid beställningstillfället är det pris som faktureras. Eventuella prisändringar tillämpas endast för framtida beställningar och påverkar inte redan lagda order.",
            },
          ],
        },
        {
          heading: "3. Leverans",
          bullets: [
            { text: "Vi levererar inom Sverige." },
            { text: "Normal leveranstid är 2–5 arbetsdagar." },
            { text: "Fri frakt vid beställningar över 500 kr." },
            {
              text: "Vi ansvarar för varan tills du tagit emot den. Vid eventuell skada under transport — kontakta oss omgående.",
            },
          ],
        },
        {
          heading: "4. Ångerrätt",
          paragraphs: [
            "Enligt distansavtalslagen har du som konsument 14 dagars ångerrätt från det att du mottagit varan. Ångerrätten innebär att du kan returnera varan utan att ange något skäl.",
            "För att utöva ångerrätten, kontakta oss på info@roots.nu inom 14 dagar. Du kan också använda Konsumentverkets standardformulär för utövande av ångerrätten. Du ansvarar själv för fraktkostnaden vid retur.",
            "Undantag: Ångerrätten gäller inte för varor som av hälso- eller hygienskäl har brutits försegling på, t.ex. öppnade förpackningar av schampo, balsam eller body wash.",
          ],
        },
        {
          heading: "5. Reklamation",
          paragraphs: [
            "Du har 3 års reklamationsrätt enligt konsumentköplagen. Om en vara är felaktig ska du reklamera inom rimlig tid efter att du upptäckt felet. Kontakta oss på info@roots.nu med ordernummer och beskrivning av felet.",
            "Vid godkänd reklamation erbjuder vi i första hand ersättningsprodukt, i andra hand återbetalning.",
          ],
        },
        {
          heading: "6. Orderbekräftelse",
          paragraphs: [
            "Vid genomförd beställning skickas en orderbekräftelse till din e-postadress. Kontrollera att uppgifterna stämmer. Kontakta oss omgående om något är felaktigt.",
          ],
        },
        {
          heading: "7. Personuppgifter",
          paragraphs: [
            "Vi behandlar dina personuppgifter i enlighet med GDPR och vår integritetspolicy.",
          ],
        },
        {
          heading: "8. Force majeure",
          paragraphs: [
            "Roots ansvarar inte för förseningar orsakade av omständigheter utanför vår kontroll, såsom naturkatastrofer, pandemier, strejk, myndighetsbeslut eller andra force majeure-händelser.",
          ],
        },
        {
          heading: "9. Tvist",
          paragraphs: [
            "Vi följer Allmänna Reklamationsnämndens (ARN) rekommendationer. Vid tvist som vi inte kan lösa direkt kan du vända dig till ARN (www.arn.se) eller EU:s plattform för tvistlösning online (ec.europa.eu/consumers/odr).",
            "Svensk lag tillämpas på alla köp.",
          ],
        },
        {
          heading: "10. Kontaktuppgifter",
          paragraphs: [
            "Ourroots AB — kontakta oss på info@roots.nu. Fullständig adress och organisationsuppgifter visas på sidan.",
          ],
        },
      ] satisfies LegalSection[],
    },
    en: {
      title: "Terms of sale",
      description:
        "Terms of sale for Roots — right of withdrawal, delivery, complaints and more.",
      updated: "Last updated: 2 April 2026",
      companyName: "Ourroots AB",
      contactEmail: "info@roots.nu",
      sections: [
        {
          heading: "1. General",
          paragraphs: [
            'These terms of purchase apply to all purchases of products from Ourroots AB, hereinafter "Roots", "we" or "us". By placing an order you accept these terms.',
            "For club orders via the club portal, these terms apply where relevant, together with any separate club agreements.",
          ],
        },
        {
          heading: "2. Prices and payment",
          bullets: [
            {
              text: "All prices are stated in Swedish kronor (SEK) including VAT.",
            },
            {
              text: "Any shipping costs are shown separately before the order is completed.",
            },
            {
              text: "Payment is made using the payment methods offered at checkout.",
            },
            {
              text: "The price shown at the time of order is the price invoiced. Any price changes apply only to future orders and do not affect orders already placed.",
            },
          ],
        },
        {
          heading: "3. Delivery",
          bullets: [
            { text: "We deliver within Sweden." },
            { text: "Normal delivery time is 2–5 business days." },
            { text: "Free shipping on orders over SEK 500." },
            {
              text: "We are responsible for the goods until you have received them. In case of damage in transit — contact us immediately.",
            },
          ],
        },
        {
          heading: "4. Right of withdrawal",
          paragraphs: [
            "Under the Swedish Distance Contracts Act, as a consumer you have a 14-day right of withdrawal from the day you receive the goods. The right of withdrawal means you may return the goods without stating a reason.",
            "To exercise the right of withdrawal, contact us at info@roots.nu within 14 days. You may also use the Swedish Consumer Agency's standard withdrawal form. You are responsible for the return shipping cost.",
            "Exception: The right of withdrawal does not apply to goods where the seal has been broken for health or hygiene reasons, e.g. opened packages of shampoo, conditioner or body wash.",
          ],
        },
        {
          heading: "5. Complaints",
          paragraphs: [
            "You have a 3-year right to complain under the Swedish Consumer Sales Act. If goods are faulty you should complain within a reasonable time after discovering the fault. Contact us at info@roots.nu with the order number and a description of the fault.",
            "For an approved complaint we primarily offer a replacement product, and secondarily a refund.",
          ],
        },
        {
          heading: "6. Order confirmation",
          paragraphs: [
            "When an order is completed, an order confirmation is sent to your email address. Please check that the details are correct. Contact us immediately if anything is wrong.",
          ],
        },
        {
          heading: "7. Personal data",
          paragraphs: [
            "We process your personal data in accordance with the GDPR and our privacy policy.",
          ],
        },
        {
          heading: "8. Force majeure",
          paragraphs: [
            "Roots is not liable for delays caused by circumstances beyond our control, such as natural disasters, pandemics, strikes, government decisions or other force majeure events.",
          ],
        },
        {
          heading: "9. Disputes",
          paragraphs: [
            "We follow the recommendations of the Swedish National Board for Consumer Disputes (ARN). For disputes we cannot resolve directly you may turn to ARN (www.arn.se) or the EU Online Dispute Resolution platform (ec.europa.eu/consumers/odr).",
            "Swedish law applies to all purchases.",
          ],
        },
        {
          heading: "10. Contact details",
          paragraphs: [
            "Ourroots AB — contact us at info@roots.nu. Full address and organisation details are shown on the page.",
          ],
        },
      ] satisfies LegalSection[],
    },
  },

  guiderIndex: {
    sv: {
      title: "Guider",
      description:
        "Guider om föreningsförsäljning, sportlag, ingredienser och hårvård från Roots — premium, föreningsnära och på svenska.",
      breadcrumbHome: "Hem",
      heroTitle: "Guider",
      heroBody:
        "Kunskap för föreningar, lag och alla som vill förstå Roots hårvård — utan fluff och utan medicinska löften.",
      itemListName: "Roots guider",
      readGuide: "Läs guiden",
      categories: {
        forening: {
          label: "Förening",
          description: "Så fungerar Roots för klubbar, lag och säljare.",
        },
        sport: {
          label: "Sport",
          description: "Guider riktade till fotbolls- och ishockeylag.",
        },
        ingrediens: {
          label: "Ingredienser",
          description: "Vad som finns i produkterna — utan medicinska löften.",
        },
        harvard: {
          label: "Hårvård",
          description: "Rutiner och kunskap kring hår och hårbotten.",
        },
      },
    },
    en: {
      title: "Guides",
      description:
        "Guides on club fundraising, sports teams, ingredients and hair care from Roots — premium, club-focused and jargon-free.",
      breadcrumbHome: "Home",
      heroTitle: "Guides",
      heroBody:
        "Knowledge for clubs, teams and anyone who wants to understand Roots hair care — without fluff and without medical claims.",
      itemListName: "Roots guides",
      readGuide: "Read the guide",
      categories: {
        forening: {
          label: "Club",
          description: "How Roots works for clubs, teams and sellers.",
        },
        sport: {
          label: "Sport",
          description: "Guides aimed at football and ice hockey teams.",
        },
        ingrediens: {
          label: "Ingredients",
          description: "What's in the products — without medical claims.",
        },
        harvard: {
          label: "Hair care",
          description: "Routines and practical guidance for hair and scalp.",
        },
      },
    },
  },

  guiderArticle: {
    sv: {
      breadcrumbHome: "Hem",
      breadcrumbGuides: "Guider",
      updatedPrefix: "Uppdaterad",
      faqTitle: "Vanliga frågor",
      nextStepTitle: "Nästa steg",
      nextStepBody:
        "Vill ni ta det vidare med er förening eller förstå produkterna bättre? Vi hjälper er gärna.",
      relatedTitle: "Relaterade guider",
      allGuides: "← Alla guider",
      notFoundTitle: "Guiden hittades inte",
      notFoundDescription: "Guiden finns inte.",
    },
    en: {
      breadcrumbHome: "Home",
      breadcrumbGuides: "Guides",
      updatedPrefix: "Updated",
      faqTitle: "Frequently asked questions",
      nextStepTitle: "Next step",
      nextStepBody:
        "Want to take it further with your club or understand the products better? We're happy to help.",
      relatedTitle: "Related guides",
      allGuides: "← All guides",
      notFoundTitle: "Guide not found",
      notFoundDescription: "This guide does not exist.",
    },
  },

  haranalys: {
    sv: {
      title: "Håranalys",
      badge: "AI-driven håranalys",
      heroTitle: "Gratis håranalys online",
      heroBody:
        "Ladda upp två bilder, svara på några frågor och få en personlig håranalys — helt gratis. Powered by AI och nordiska ingredienser.",
      ctaStart: "Starta din håranalys",
      overviewSteps: [
        {
          title: "Ladda upp bilder",
          desc: "Två foton — bakifrån och uppifrån",
        },
        {
          title: "Svara på frågor",
          desc: "Korta frågor om dina vanor",
        },
        {
          title: "Få rekommendation",
          desc: "Personlig analys på under 2 min",
        },
      ],
      benefitsTitle: "Varför Roots håranalys?",
      benefitsSubtitle:
        "En komplett analys baserad på ditt hår, dina vanor och nordisk expertis.",
      benefits: [
        {
          title: "Personlig analys",
          desc: "AI analyserar dina bilder och svar för att ge rekommendationer anpassade just till dig.",
        },
        {
          title: "Nordiska ingredienser",
          desc: "Våra rekommendationer bygger på produkter med naturliga, nordiska råvaror utan sulfater.",
        },
        {
          title: "Kostnad: Helt gratis",
          desc: "Ingen betalning, inget abonnemang. Gör analysen hur många gånger du vill.",
        },
      ],
      howBadge: "Steg för steg",
      howTitle: "Så här fungerar det",
      howSteps: [
        {
          num: "1",
          title: "Ladda upp två bilder",
          desc: "Ta ett foto av ditt hår bakifrån och ett uppifrån. Torrt hår utan styling ger bäst resultat. Använd jämnt ljus och undvik blixt.",
        },
        {
          num: "2",
          title: "Besvara korta frågor",
          desc: "Berätta hur ofta du tvättar håret, om du använder värmeverktyg, kemiska behandlingar och din stressnivå. Tar ungefär 1 minut.",
        },
        {
          num: "3",
          title: "Få din personliga analys",
          desc: "Vår AI analyserar bilderna och dina svar, och ger dig en detaljerad bedömning med livsstils-, kost- och produktrekommendationer anpassade till ditt hår.",
        },
      ],
      ctaStartNow: "Starta din håranalys nu",
      socialProofCount: "500+",
      socialProofLabel: "analyser gjorda",
      faqTitle: "Vanliga frågor",
      faqSubtitle: "Allt du behöver veta om håranalysen.",
      faqs: [
        {
          q: "Är håranalysen verkligen gratis?",
          a: "Ja, helt gratis. Du behöver bara ange din e-postadress och ladda upp två bilder. Det finns inga dolda kostnader.",
        },
        {
          q: "Hur lång tid tar det?",
          a: "Hela processen tar under 2 minuter — bilduppladdning, frågor och analys inkluderat.",
        },
        {
          q: "Vad händer med mina bilder?",
          a: "Dina bilder analyseras av AI och raderas automatiskt efter att analysen är klar. Vi sparar inte dina bilder. Läs mer i vår integritetspolicy.",
        },
        {
          q: "Ersätter analysen ett besök hos frisör eller hudläkare?",
          a: "Nej, analysen är indikativ och ger vägledande rekommendationer. Vid ihållande besvär bör du alltid kontakta en professionell.",
        },
        {
          q: "Vilka produkter rekommenderas?",
          a: "Baserat på din analys föreslår vi produkter ur Roots sortiment — naturlig hårvård utan sulfater, silikoner eller parabener, med nordiska ingredienser.",
        },
      ],
      bottomTitle: "Redo att förstå ditt hår bättre?",
      bottomBody: "Det tar under 2 minuter och kostar ingenting.",
      bottomCta: "Starta gratis håranalys",
    },
    en: {
      title: "Hair analysis",
      badge: "AI-powered hair analysis",
      heroTitle: "Free hair analysis online",
      heroBody:
        "Upload two photos, answer a few questions and get a personal hair analysis — completely free. Powered by AI and Nordic ingredients.",
      ctaStart: "Start your hair analysis",
      overviewSteps: [
        {
          title: "Upload photos",
          desc: "Two photos — from behind and from above",
        },
        {
          title: "Answer questions",
          desc: "Short questions about your habits",
        },
        {
          title: "Get a recommendation",
          desc: "Personal analysis in under 2 minutes",
        },
      ],
      benefitsTitle: "Why Roots hair analysis?",
      benefitsSubtitle:
        "A complete analysis based on your hair, your habits and Nordic expertise.",
      benefits: [
        {
          title: "Personal analysis",
          desc: "AI analyses your photos and answers to give recommendations tailored to you.",
        },
        {
          title: "Nordic ingredients",
          desc: "Our recommendations are based on products with natural Nordic ingredients without sulphates.",
        },
        {
          title: "Completely free",
          desc: "No payment, no subscription. Take the analysis as many times as you like.",
        },
      ],
      howBadge: "Step by step",
      howTitle: "How it works",
      howSteps: [
        {
          num: "1",
          title: "Upload two photos",
          desc: "Take one photo of your hair from behind and one from above. Dry hair without styling gives the best result. Use even light and avoid flash.",
        },
        {
          num: "2",
          title: "Answer short questions",
          desc: "Tell us how often you wash your hair, whether you use heat tools, chemical treatments and your stress level. Takes about 1 minute.",
        },
        {
          num: "3",
          title: "Get your personal analysis",
          desc: "Our AI analyses the photos and your answers, and gives you a detailed assessment with lifestyle, diet and product recommendations tailored to your hair.",
        },
      ],
      ctaStartNow: "Start your hair analysis now",
      socialProofCount: "500+",
      socialProofLabel: "analyses completed",
      faqTitle: "Frequently asked questions",
      faqSubtitle: "Everything you need to know about the hair analysis.",
      faqs: [
        {
          q: "Is the hair analysis really free?",
          a: "Yes, completely free. You only need to enter your email address and upload two photos. There are no hidden costs.",
        },
        {
          q: "How long does it take?",
          a: "The whole process takes under 2 minutes — photo upload, questions and analysis included.",
        },
        {
          q: "What happens to my photos?",
          a: "Your photos are analysed by AI and deleted automatically after the analysis is complete. We do not store your photos. Read more in our privacy policy.",
        },
        {
          q: "Does the analysis replace a visit to a hairdresser or dermatologist?",
          a: "No. The analysis is indicative and offers general guidance. For ongoing concerns you should always consult a professional.",
        },
        {
          q: "Which products are recommended?",
          a: "Based on your analysis we suggest products from the Roots range — natural hair care without sulphates, silicones or parabens, with Nordic ingredients.",
        },
      ],
      bottomTitle: "Ready to understand your hair better?",
      bottomBody: "It takes under 2 minutes and costs nothing.",
      bottomCta: "Start free hair analysis",
    },
  },

  kalkylatorShare: {
    sv: {
      metaTitle: "Intäktskalkylator",
      metaDescription:
        "Räkna på vad föreningsförsäljning med Roots kan ge er förening.",
      legalNavAria: "Juridiskt",
      privacy: "Integritetspolicy",
      contact: "Kontakt",
      notFoundTitle: "Kalkylen hittades inte",
      notFoundBody:
        "Länken är felaktig eller borttagen. Kontakta din Roots-kontakt för en ny länk.",
      readMore: "Läs mer om Roots",
      badge: "Förtjänst-kalkyl för {name}",
      title: "Se hur mycket {name} kan tjäna",
      body: "Dra i reglagen och se direkt vad försäljningen kan ge er förening. Justera antalet säljare och hur mycket var och en säljer för.",
      leadTitle: "Vill ni komma igång eller få en sammanfattning?",
      leadBody:
        "Lämna er mejl så skickar vi en sammanfattning och hjälper er igång. Inga förpliktelser.",
      emailLabel: "E-post *",
      emailPlaceholder: "namn@forening.se",
      nameLabel: "Namn (valfritt)",
      namePlaceholder: "Ditt namn",
      messageLabel: "Meddelande (valfritt)",
      messagePlaceholder: "Berätta gärna lite om er förening",
      consentBefore:
        "Ja, ni får mejla mig om Roots för föreningar. Vi hanterar uppgifterna enligt vår ",
      privacyLink: "integritetspolicy",
      consentAfter: ".",
      submit: "Skicka till mig",
      submitting: "Skickar…",
      thanksTitle: "Tack!",
      thanksBody:
        "Vi hör av oss med en sammanfattning och nästa steg. Under tiden kan du fortsätta räkna ovan.",
      errorInvalidEmail: "Ange en giltig e-postadress.",
      errorGeneric: "Något gick fel. Försök igen.",
    },
    en: {
      metaTitle: "Revenue calculator",
      metaDescription:
        "Calculate what club fundraising with Roots could earn your club.",
      legalNavAria: "Legal",
      privacy: "Privacy policy",
      contact: "Contact",
      notFoundTitle: "Calculator not found",
      notFoundBody:
        "The link is incorrect or has been removed. Contact your Roots representative for a new link.",
      readMore: "Learn more about Roots",
      badge: "Earnings calculator for {name}",
      title: "See how much {name} could earn",
      body: "Drag the sliders and see instantly what sales could bring your club. Adjust the number of sellers and how much each one sells.",
      leadTitle: "Want to get started or receive a summary?",
      leadBody:
        "Enter your email and we will send a summary and help you get started. No commitment.",
      emailLabel: "Email *",
      emailPlaceholder: "name@club.se",
      nameLabel: "Name (optional)",
      namePlaceholder: "Your name",
      messageLabel: "Message (optional)",
      messagePlaceholder: "Tell us a little about your club",
      consentBefore:
        "Yes, you may email me about Roots for clubs. We handle the data according to our ",
      privacyLink: "privacy policy",
      consentAfter: ".",
      submit: "Email me the summary",
      submitting: "Sending…",
      thanksTitle: "Thank you!",
      thanksBody:
        "We will be in touch with a summary and next steps. In the meantime you can keep calculating above.",
      errorInvalidEmail: "Enter a valid email address.",
      errorGeneric: "Something went wrong. Please try again.",
    },
  },

  notFound: {
    sv: {
      title: "Sidan hittades inte",
      description: "Sidan du letar efter finns inte eller har flyttats.",
      code: "404",
      heading: "Sidan kunde inte hittas",
      body: "Sidan du letar efter finns inte eller har flyttats. Kontrollera adressen eller gå tillbaka till startsidan.",
      homeCta: "Till startsidan",
      helpCta: "Få hjälp",
    },
    en: {
      title: "Page not found",
      description: "The page you are looking for does not exist or has moved.",
      code: "404",
      heading: "We couldn't find that page",
      body: "The page you are looking for does not exist or has moved. Check the address or go back home.",
      homeCta: "Back to home",
      helpCta: "Get help",
    },
  },
} as const;
