import type { Locale } from "../config";

export type HowItWorksFlow =
  | "plan"
  | "shops"
  | "share"
  | "delivery"
  | "result"
  | "repeat";

type Step = {
  flow: HowItWorksFlow;
  title: string;
  lead: string;
  body: string[];
  cta?: { label: string; href: string };
  options?: { title: string; body: string }[];
  note?: string;
};

type HowItWorksCopy = {
  metaTitle: string;
  metaDescription: string;
  title: string;
  lead: string;
  body: string;
  heroCta: string;
  stripLabel: string;
  stripShort: Record<HowItWorksFlow, string>;
  steps: Step[];
  flowLabels: {
    goal: string;
    goalExamples: string[];
    period: string;
    contact: string;
    club: string;
    seller: string;
    link: string;
    audiences: string[];
    pays: string;
    order: string;
    collected: string;
    collectedSub: string;
    home: string;
    homeSub: string;
    report: string;
    teamA: string;
    teamB: string;
    teamC: string;
    payout: string;
    daily: string;
    refill: string;
    support: string;
    between: string;
  };
  allTheWayTitle: string;
  allTheWayBody: string;
  allTheWayCta: string;
  tipsTitle: string;
  tipsIntro: string;
  tips: { title: string; body: string }[];
  messageTitle: string;
  message: string;
  copy: string;
  copied: string;
  faqTitle: string;
  faqs: { question: string; answer: string }[];
};

export const howItWorks: Record<Locale, HowItWorksCopy> = {
  sv: {
    metaTitle: "Så här går det till",
    metaDescription:
      "Från första samtalet till leverans och utbetalning. Så säljer föreningen, laget eller klassen Roots, steg för steg.",
    title: "Så här går det till",
    lead: "Mer till gemenskapen. Mindre att administrera.",
    body: "Att tjäna pengar till föreningen, laget eller klassen ska vara enkelt. Därför hjälper Roots er genom hela försäljningen – med premiumprodukter, personliga webbshoppar, tydlig information och en kontaktperson som finns med hela vägen.",
    heroCta: "Se vad ni kan tjäna",
    stripLabel: "Hela flödet i sex steg",
    stripShort: {
      plan: "Planera",
      shops: "Webbshop",
      share: "Dela länken",
      delivery: "Leverans",
      result: "Förtjänst",
      repeat: "Återköp",
    },
    steps: [
      {
        flow: "plan",
        title: "Vi planerar tillsammans",
        lead: "Vad vill ni samla in pengar till?",
        body: [
          "En cup, en klassresa eller mer utrymme för den dagliga verksamheten? Tillsammans bestämmer vi mål och säljperiod. Ni utser en kontaktperson som samordnar och peppar gruppen. Roots hjälper till med upplägg, information och uppföljning.",
        ],
        cta: { label: "Anmäl intresse", href: "/intresseanmalan" },
      },
      {
        flow: "shops",
        title: "Alla får en egen webbshop",
        lead: "Vi hjälper er att bli redo.",
        body: [
          "Vi sätter upp försäljningen och hjälper er att ansluta deltagarna. Varje säljare får en personlig webbshop med en länk att dela. Ni får information, guider och material som gör det lätt att komma igång och få alla med på tåget.",
        ],
      },
      {
        flow: "share",
        title: "Dela länken – låt försäljningen börja",
        lead: "Nå familj, vänner, grannar och kollegor.",
        body: [
          "Berätta vad ni samlar till och dela er personliga länk via sms, mejl och sociala medier. Kunden väljer sina produkter och betalar direkt i webbshoppen. Ni slipper samla in beställningslistor och jaga betalningar.",
          "Under säljperioden hjälper vi er med tips och uppföljning. Er kontaktperson på Roots finns nära till hands.",
        ],
        cta: { label: "Tips för en lyckad försäljning", href: "#tips" },
      },
      {
        flow: "delivery",
        title: "Leverans som passar er och era kunder",
        lead: "Samlat till er eller direkt hem till kunden.",
        body: ["Vi erbjuder två leveransalternativ:"],
        options: [
          {
            title: "Samlad leverans till föreningen, laget eller klassen",
            body: "Vi packar produkterna sorterade per lag och säljare och skickar dem till er gemensamma leveransadress. Tydliga leveransunderlag gör det enkelt för säljarna att dela ut rätt produkter till sina kunder.",
          },
          {
            title: "Direkt hem till kunden",
            body: "Kunden kan också välja att få sin beställning hemskickad. Då sköter Roots packning och leverans hela vägen – och ni får färre paket att dela ut.",
          },
        ],
        note: "Oavsett leveransalternativ beställer och betalar kunden direkt i webbshoppen.",
      },
      {
        flow: "result",
        title: "Se resultatet och få er förtjänst",
        lead: "Tillsammans har ni skapat nya möjligheter.",
        body: [
          "Vi sammanställer försäljningen och betalar ut er förtjänst. Ni får tydliga ekonomiska rapporter per lag och säljare, så att ni kan följa resultatet och fördela pengarna inom föreningen.",
          "Nu är ni närmare det ni samlade till – och har något att vara stolta över tillsammans.",
        ],
      },
      {
        flow: "repeat",
        title: "Låt vardagens återköp fortsätta göra nytta",
        lead: "En avslutad säljperiod kan bli början på mer.",
        body: [
          "Schampo, balsam och body wash är produkter som används varje dag och behöver fyllas på. När kunderna handlar igen genom Roots återköpsupplägg kan de fortsätta stötta er förening, ert lag eller er klass – även mellan säljperioderna.",
        ],
      },
    ],
    flowLabels: {
      goal: "Ert mål",
      goalExamples: ["Cup", "Klassresa", "Verksamheten"],
      period: "Säljperiod",
      contact: "Kontaktperson",
      club: "Föreningen",
      seller: "Säljare",
      link: "Egen länk",
      audiences: ["Familj", "Vänner", "Grannar", "Kollegor"],
      pays: "Betalar i webbshoppen",
      order: "Beställning",
      collected: "Samlad leverans",
      collectedSub: "Sorterat per lag och säljare",
      home: "Hem till kunden",
      homeSub: "Roots packar och skickar",
      report: "Rapport per lag",
      teamA: "P12",
      teamB: "F11",
      teamC: "P14",
      payout: "Utbetalning",
      daily: "Används varje dag",
      refill: "Kunden handlar igen",
      support: "Stöttar er igen",
      between: "Även mellan säljperioderna",
    },
    allTheWayTitle: "Vi är med er hela vägen",
    allTheWayBody:
      "Från första samtalet till leverans, uppföljning och nästa försäljning. Vi använder modern teknik för att förenkla arbetet och personlig kontakt för att hjälpa er framåt.",
    allTheWayCta: "Kom igång med Roots",
    tipsTitle: "Tips för en lyckad försäljning",
    tipsIntro:
      "Det börjar med ett gemensamt mål och en länk som fler får se. Här är några enkla sätt att komma igång och hålla engagemanget uppe under säljperioden.",
    tips: [
      {
        title: "Berätta vad ni samlar till",
        body: "Gör målet konkret. En cup, en klassresa eller nya matchställ gör det lättare för kunden att förstå vad köpet bidrar till.",
      },
      {
        title: "Hjälp alla att komma igång",
        body: "Se till att varje deltagare har sin personliga länk och vet hur den delas. Ta gärna några minuter tillsammans vid en träning eller samling.",
      },
      {
        title: "Börja med dem ni känner",
        body: "Skicka ett personligt meddelande till familj, vänner, grannar och kollegor. Berätta varför ni säljer och bifoga länken till webbshoppen.",
      },
      {
        title: "Visa produkterna och dela länken",
        body: "Berätta om schampo, balsam och body wash som kunden kan använda i vardagen. Använd materialet från Roots och låt länken finnas med i inlägg och meddelanden.",
      },
      {
        title: "Påminn och följ upp",
        body: "Dela hur försäljningen går och påminn innan säljperioden är slut. Lyft deltagarnas insatser och visa hur varje köp hjälper er närmare målet.",
      },
      {
        title: "Tacka dem som handlar",
        body: "Ett personligt tack gör skillnad. Berätta gärna efteråt vad ni har kunnat genomföra med pengarna.",
      },
    ],
    messageTitle: "Exempel på ett meddelande att dela",
    message:
      "Hej! Vi i [föreningen/laget/klassen] samlar pengar till [ert mål]. Genom vår webbshop hos Roots kan du köpa schampo, balsam och body wash och samtidigt stötta oss. Beställ och betala enkelt här: [din personliga länk]. Tack för att du hjälper oss närmare målet!",
    copy: "Kopiera",
    copied: "Kopierat",
    faqTitle: "Vanliga frågor",
    faqs: [
      {
        question: "Hur kommer vi igång?",
        answer:
          "Anmäl ert intresse så kontaktar vi er. Tillsammans planerar vi försäljningen, bestämmer mål och säljperiod och hjälper er att ansluta deltagarna.",
      },
      {
        question: "Hur lång är en säljperiod?",
        answer:
          "Vi kommer överens om säljperioden när vi planerar er försäljning. Ni får ett tydligt startdatum och slutdatum att kommunicera till deltagare och kunder.",
      },
      {
        question: "Vad behöver vår kontaktperson göra?",
        answer:
          "Kontaktpersonen samordnar gruppen, förmedlar information och hjälper till att hålla engagemanget uppe. Roots hjälper till med upplägg, material och uppföljning och finns till hands genom hela processen.",
      },
      {
        question: "Hur fungerar betalningen?",
        answer:
          "Kunden beställer och betalar direkt i webbshoppen. Säljarna behöver därför inte samla in betalningar från kunderna.",
      },
      {
        question: "Hur får kunden sina produkter?",
        answer:
          "Vi erbjuder samlad leverans till föreningen, laget eller klassen för utdelning av säljarna. Kunden kan också välja att få sin beställning hemskickad.",
      },
      {
        question: "Hur får vi överblick över resultatet?",
        answer:
          "Roots sammanställer försäljningen och ger er tydliga ekonomiska rapporter per lag och säljare. Underlagen hjälper er att följa resultatet och fördela förtjänsten inom föreningen.",
      },
      {
        question: "Vem hjälper oss om vi har frågor?",
        answer:
          "Ni har en personlig kontakt på Roots som hjälper er från planering och säljstart till leverans och uppföljning.",
      },
    ],
  },
  en: {
    metaTitle: "How it works",
    metaDescription:
      "From the first call to delivery and payout. How your club, team or class sells Roots, step by step.",
    title: "How it works",
    lead: "More for the community. Less to administer.",
    body: "Raising money for your club, team or class should be easy. That is why Roots helps you through the whole sale – with premium products, personal web shops, clear information and a contact person who is with you all the way.",
    heroCta: "See what you can earn",
    stripLabel: "The whole flow in six steps",
    stripShort: {
      plan: "Plan",
      shops: "Web shop",
      share: "Share the link",
      delivery: "Delivery",
      result: "Earnings",
      repeat: "Repeat orders",
    },
    steps: [
      {
        flow: "plan",
        title: "We plan together",
        lead: "What do you want to raise money for?",
        body: [
          "A tournament, a class trip or more room for everyday activities? Together we set the goal and the sales period. You pick a contact person who coordinates and cheers on the group. Roots helps with the set-up, information and follow-up.",
        ],
        cta: { label: "Register interest", href: "/intresseanmalan" },
      },
      {
        flow: "shops",
        title: "Everyone gets their own web shop",
        lead: "We help you get ready.",
        body: [
          "We set up the sale and help you bring the participants on board. Every seller gets a personal web shop with a link to share. You get information, guides and material that make it easy to get started and get everyone on board.",
        ],
      },
      {
        flow: "share",
        title: "Share the link – let the selling begin",
        lead: "Reach family, friends, neighbours and colleagues.",
        body: [
          "Tell people what you are raising money for and share your personal link by text, email and social media. The customer picks their products and pays directly in the web shop. No order lists to collect and no payments to chase.",
          "During the sales period we help you with tips and follow-up. Your contact person at Roots is close at hand.",
        ],
        cta: { label: "Tips for a successful sale", href: "#tips" },
      },
      {
        flow: "delivery",
        title: "Delivery that suits you and your customers",
        lead: "Collected to you or straight to the customer's door.",
        body: ["We offer two delivery options:"],
        options: [
          {
            title: "Collected delivery to the club, team or class",
            body: "We pack the products sorted by team and seller and send them to your shared delivery address. Clear delivery notes make it easy for sellers to hand out the right products to their customers.",
          },
          {
            title: "Straight to the customer",
            body: "The customer can also choose home delivery. Then Roots handles packing and delivery all the way – and you have fewer parcels to hand out.",
          },
        ],
        note: "Whichever option, the customer orders and pays directly in the web shop.",
      },
      {
        flow: "result",
        title: "See the result and get your earnings",
        lead: "Together you have created new opportunities.",
        body: [
          "We compile the sales and pay out your earnings. You get clear financial reports per team and seller, so you can follow the result and share the money within the club.",
          "Now you are closer to what you were raising money for – and have something to be proud of together.",
        ],
      },
      {
        flow: "repeat",
        title: "Let everyday repeat orders keep doing good",
        lead: "A finished sales period can be the start of more.",
        body: [
          "Shampoo, conditioner and body wash are used every day and need refilling. When customers buy again through Roots repeat orders they can keep supporting your club, team or class – even between sales periods.",
        ],
      },
    ],
    flowLabels: {
      goal: "Your goal",
      goalExamples: ["Tournament", "Class trip", "Activities"],
      period: "Sales period",
      contact: "Contact person",
      club: "The club",
      seller: "Seller",
      link: "Own link",
      audiences: ["Family", "Friends", "Neighbours", "Colleagues"],
      pays: "Pays in the web shop",
      order: "Order",
      collected: "Collected delivery",
      collectedSub: "Sorted by team and seller",
      home: "To the customer",
      homeSub: "Roots packs and ships",
      report: "Report per team",
      teamA: "U12",
      teamB: "G11",
      teamC: "U14",
      payout: "Payout",
      daily: "Used every day",
      refill: "Customer buys again",
      support: "Supports you again",
      between: "Even between sales periods",
    },
    allTheWayTitle: "We are with you all the way",
    allTheWayBody:
      "From the first call to delivery, follow-up and the next sale. We use modern technology to make the work simpler and personal contact to help you forward.",
    allTheWayCta: "Get started with Roots",
    tipsTitle: "Tips for a successful sale",
    tipsIntro:
      "It starts with a shared goal and a link that more people see. Here are a few simple ways to get started and keep the energy up during the sales period.",
    tips: [
      {
        title: "Say what you are raising money for",
        body: "Make the goal concrete. A tournament, a class trip or new kits make it easier for the customer to see what the purchase contributes to.",
      },
      {
        title: "Help everyone get started",
        body: "Make sure every participant has their personal link and knows how to share it. Take a few minutes together at a practice or meeting.",
      },
      {
        title: "Start with people you know",
        body: "Send a personal message to family, friends, neighbours and colleagues. Say why you are selling and include the link to the web shop.",
      },
      {
        title: "Show the products and share the link",
        body: "Tell people about the shampoo, conditioner and body wash they can use every day. Use the material from Roots and include the link in posts and messages.",
      },
      {
        title: "Remind and follow up",
        body: "Share how the sale is going and send a reminder before the sales period ends. Highlight the participants' efforts and show how every purchase brings you closer to the goal.",
      },
      {
        title: "Thank those who buy",
        body: "A personal thank-you makes a difference. Afterwards, tell people what you were able to do with the money.",
      },
    ],
    messageTitle: "An example message to share",
    message:
      "Hi! We in [the club/team/class] are raising money for [your goal]. Through our Roots web shop you can buy shampoo, conditioner and body wash and support us at the same time. Order and pay easily here: [your personal link]. Thank you for helping us get closer to our goal!",
    copy: "Copy",
    copied: "Copied",
    faqTitle: "Frequently asked questions",
    faqs: [
      {
        question: "How do we get started?",
        answer:
          "Register your interest and we will contact you. Together we plan the sale, set the goal and sales period and help you bring the participants on board.",
      },
      {
        question: "How long is a sales period?",
        answer:
          "We agree on the sales period when we plan your sale. You get a clear start and end date to share with participants and customers.",
      },
      {
        question: "What does our contact person need to do?",
        answer:
          "The contact person coordinates the group, passes on information and helps keep the energy up. Roots helps with the set-up, material and follow-up and is available throughout.",
      },
      {
        question: "How does payment work?",
        answer:
          "The customer orders and pays directly in the web shop. Sellers therefore do not need to collect payments from customers.",
      },
      {
        question: "How does the customer get their products?",
        answer:
          "We offer collected delivery to the club, team or class for the sellers to hand out. The customer can also choose home delivery.",
      },
      {
        question: "How do we get an overview of the result?",
        answer:
          "Roots compiles the sales and gives you clear financial reports per team and seller. They help you follow the result and share the earnings within the club.",
      },
      {
        question: "Who helps us if we have questions?",
        answer:
          "You have a personal contact at Roots who helps you from planning and launch to delivery and follow-up.",
      },
    ],
  },
};
