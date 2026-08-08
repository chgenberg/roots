import type { Locale } from "@/i18n/config";

export type GuideCategory = "forening" | "ingrediens" | "harvard" | "sport";

export type GuideSection = { heading?: string; paragraphs: string[] };
export type GuideFaq = { question: string; answer: string };
export type GuideCta = { href: string; label: string };

export type GuideCopy = {
  title: string;
  description: string;
  sections: GuideSection[];
  faqs?: GuideFaq[];
  cta?: GuideCta;
};

export type GuideDefinition = {
  slug: string;
  publishedAt: string;
  updatedAt: string;
  category: GuideCategory;
  heroImage?: string;
  relatedSlugs?: string[];
  sv: GuideCopy;
  en: GuideCopy;
};

/** Resolved guide for a single locale — what pages render. */
export type Guide = {
  slug: string;
  title: string;
  description: string;
  publishedAt: string;
  updatedAt: string;
  category: GuideCategory;
  heroImage?: string;
  sections: GuideSection[];
  faqs?: GuideFaq[];
  relatedSlugs?: string[];
  cta?: GuideCta;
};

const CATEGORY_COPY: Record<
  Locale,
  Record<GuideCategory, { label: string; description: string }>
> = {
  sv: {
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
  en: {
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
      description: "Routines and knowledge around hair and scalp.",
    },
  },
};

export function getGuideCategories(
  locale: Locale = "sv"
): Record<GuideCategory, { label: string; description: string }> {
  return CATEGORY_COPY[locale];
}

/** Swedish default — prefer getGuideCategories(locale). */
export const GUIDE_CATEGORIES = getGuideCategories("sv");

export const guideDefinitions: GuideDefinition[] = [
  {
    slug: "foreningsforsaljning",
    publishedAt: "2026-03-01",
    updatedAt: "2026-08-01",
    category: "forening",
    heroImage: "/images/sport-package.jpg",
    sv: {
      title: "Vad är föreningsförsäljning — och varför premium hårvård?",
      description:
        "En guide till modern föreningsförsäljning: hur premium hårvård skiljer sig från godis, och varför fler klubbar väljer produkter människor faktiskt vill använda.",
      sections: [
        {
          heading: "Föreningsförsäljning i korthet",
          paragraphs: [
            "Föreningsförsäljning är när en klubb, ett lag eller en ideell förening säljer produkter för att finansiera verksamheten — cupresor, material, träningsavgifter eller lokalhyra. Modellen är välbekant i Sverige: medlemmar och föräldrar hjälper till, och intäkten går tillbaka till laget.",
            "Det som förändrats är *vad* som säljs. Traditionellt har det handlat om godis, kakor eller lotter. Idag letar många efter alternativ som känns mer relevanta i vardagen — och som inte kräver att man bär runt på lådor eller hanterar kontanter.",
          ],
        },
        {
          heading: "Varför premium hårvård passar föreningar",
          paragraphs: [
            "Hårvård är något de flesta redan köper. När föreningen erbjuder [Roots Schampoo](/produkter/shampoo), [Roots Conditioner](/produkter/conditioner) och [Roots Body Wash](/produkter/body-wash) säljer ni något människor har användning för — inte något som äts upp på en eftermiddag.",
            "Premium betyder inte lyx för lyxens skull. Det betyder tydlig formulering, nordiska ingredienser och en produkt som går att stå för när man tipsar en kollega eller en granne. Det gör samtalet lättare för både ungdomar och föräldrar.",
          ],
        },
        {
          heading: "Godis vs produkter man återkommer till",
          paragraphs: [
            "Godisförsäljning kan ge snabb omsättning, men den bygger sällan lojalitet. Premiumvård kan bli en återkommande vana: samma person som köpte via lagets shop kan komma tillbaka nästa säsong. Det är mer hållbart för både föreningen och den som säljer.",
            "Roots är byggt för just den typen av försäljning — digital shop, QR-kod och utbetalning till föreningen. Läs mer under [Föreningsliv](/foreningsliv) eller se flödet i [Så fungerar det](/sa-fungerar-det).",
          ],
        },
        {
          heading: "Vad ni behöver tänka på innan ni startar",
          paragraphs: [
            "Välj ett erbjudande som speglar föreningens värderingar. Sätt ett tydligt mål (cupresa, nytt material, lägre träningsavgift). Ge säljarna en enkel pitch och en personlig länk. Och kommunicera öppet hur intäkten fördelas — transparens bygger engagemang.",
            "Vill ni se hur det skulle landa hos er klubb? Boka en genomgång via [kontaktformuläret](/kontakt?intent=demo).",
          ],
        },
        {
          heading: "En modern insamling som känns bra att dela",
          paragraphs: [
            "En lyckad kampanj ska fungera även en stressig tisdag mellan skola, jobb och träning. Därför är Roots byggt kring en enkel digital shop i stället för kartonger i hallen. Säljaren kan dela sin personliga länk när det passar, medan kunden väljer produkter och får dem levererade hem.",
            "Det betyder inte att relationen försvinner. Tvärtom blir den tydligare: ett köp kan vara en konkret vardagsprodukt, ett stöd till laget och en vänlig rekommendation på samma gång. I [guiden om personlig shop](/guider/personlig-shop) finns idéer för hur länken blir enkel att använda utan att någon känner sig pressad.",
          ],
        },
      ],
      faqs: [
        {
          question: "Är föreningsförsäljning samma sak som MLM?",
          answer:
            "Nej. Roots är föreningsförsäljning via klubbens egna säljare och shoppar — inte ett nätverksförsäljningssystem. Intäkten går till föreningen enligt den avtalade modellen.",
        },
        {
          question: "Behöver vi lagra produkter själva?",
          answer:
            "Nej. Beställningar hanteras digitalt och levereras till kunden. Ni behöver inte ha lager i klubbstugan.",
        },
        {
          question: "Passar det bara idrott?",
          answer:
            "Nej. Modellen fungerar för idrottslag, kulturföreningar och andra ideella verksamheter som vill samla in pengar på ett mer modernt sätt.",
        },
      ],
      cta: { href: "/foreningsliv", label: "Läs mer om föreningsliv" },
    },
    en: {
      title: "What is club fundraising — and why premium hair care?",
      description:
        "A guide to modern club fundraising: how premium hair care differs from candy, and why more clubs choose products people actually want to use.",
      sections: [
        {
          heading: "Club fundraising in brief",
          paragraphs: [
            "Club fundraising is when a club, team or non-profit sells products to fund its activities — tournament trips, kit, training fees or venue hire. The model is familiar across the Nordics: members and parents help out, and the revenue goes back to the team.",
            "What has changed is *what* is sold. Traditionally it has been candy, cakes or raffle tickets. Today many look for alternatives that feel more relevant day to day — and that do not require carrying boxes around or handling cash.",
          ],
        },
        {
          heading: "Why premium hair care fits clubs",
          paragraphs: [
            "Hair care is something most people already buy. When the club offers [Roots Schampoo](/produkter/shampoo), [Roots Conditioner](/produkter/conditioner) and [Roots Body Wash](/produkter/body-wash), you sell something people will use — not something eaten in an afternoon.",
            "Premium does not mean luxury for luxury's sake. It means a clear formula, Nordic ingredients and a product you can stand behind when you recommend it to a colleague or a neighbour. That makes the conversation easier for both young sellers and parents.",
          ],
        },
        {
          heading: "Candy vs products people come back for",
          paragraphs: [
            "Candy sales can drive quick turnover, but they rarely build loyalty. Premium care can become a recurring habit: the same person who bought through the team's shop may return next season. That is more sustainable for both the club and the seller.",
            "Roots is built for exactly that kind of selling — digital shop, QR code and payout to the club. Read more under [For clubs](/foreningsliv) or see the flow in [How it works](/sa-fungerar-det).",
          ],
        },
        {
          heading: "What to think about before you start",
          paragraphs: [
            "Choose an offer that reflects the club's values. Set a clear goal (tournament trip, new kit, lower training fees). Give sellers a simple pitch and a personal link. And communicate openly how revenue is shared — transparency builds engagement.",
            "Want to see how it would work for your club? Book a walkthrough via the [contact form](/kontakt?intent=demo).",
          ],
        },
        {
          heading: "A modern fundraiser that feels good to share",
          paragraphs: [
            "A successful campaign should work even on a stressful Tuesday between school, work and training. That is why Roots is built around a simple digital shop instead of cardboard boxes in the hallway. The seller can share their personal link when it suits them, while the customer chooses products and has them delivered to their address.",
            "That does not mean the relationship disappears. On the contrary, it becomes clearer: a purchase can be an everyday product, support for the team and a friendly recommendation at the same time. In the [guide to the personal shop](/guider/personlig-shop) you will find ideas for how the link becomes easy to use without anyone feeling pressured.",
          ],
        },
      ],
      faqs: [
        {
          question: "Is club fundraising the same as MLM?",
          answer:
            "No. Roots is club fundraising through the club's own sellers and shops — not a network marketing system. Revenue goes to the club according to the agreed model.",
        },
        {
          question: "Do we need to store products ourselves?",
          answer:
            "No. Orders are handled digitally and delivered to the customer. You do not need stock in the clubhouse.",
        },
        {
          question: "Does it only suit sports?",
          answer:
            "No. The model works for sports teams, cultural clubs and other non-profits that want to raise money in a more modern way.",
        },
      ],
      cta: { href: "/foreningsliv", label: "Read more about club fundraising" },
    },
    relatedSlugs: [
      "jamfor-godisforsaljning",
      "hur-mycket-tjanar-foreningen",
      "sa-fungerar-roots",
    ],
  },
  {
    slug: "sa-fungerar-roots",
    publishedAt: "2026-03-01",
    updatedAt: "2026-08-01",
    category: "forening",
    heroImage: "/images/sport-hero.jpg",
    sv: {
      title: "Så fungerar Roots — steg för steg",
      description:
        "Från förening till lag, säljare och personlig shop: så går det till när er klubb säljer Roots.",
      sections: [
        {
          heading: "Översikt: fyra nivåer",
          paragraphs: [
            "Roots är uppbyggt så att ansvar och synlighet matchar hur föreningar faktiskt fungerar. Högst upp finns föreningen. Under den finns lag eller grupper. Sedan kommer säljarna — ofta spelare eller föräldrar — och sist den personliga shoppen där köpet sker.",
            "Ni behöver inte förstå hela plattformen på dag ett. Börja med att ansluta föreningen, bjud in lagledare och låt säljarna dela sin länk. Resten syns i portalen.",
          ],
        },
        {
          heading: "1. Föreningen ansluter",
          paragraphs: [
            "En ansvarig i klubben registrerar föreningen och får tillgång till portalen. Där sätts grundläggande uppgifter, lagstruktur och mål. Ingen startavgift krävs för att komma igång — ni aktiverar försäljningen när ni är redo.",
            "Vill ni hellre få en genomgång först? Använd [kontakt med demo-intent](/kontakt?intent=demo) så visar vi flödet live.",
          ],
        },
        {
          heading: "2. Lag och ledare",
          paragraphs: [
            "Inom föreningen skapas lag eller grupper. Lagledare kan följa försäljning, stötta säljare och se hur ni ligger mot målet. Det gör att en stor klubb kan hålla ordning utan att allt landar på en enda person.",
            "En bra lagledare behöver inte göra allt själv. Uppgiften är snarare att skapa en enkel start, svara på de vanligaste frågorna och se till att alla vet var de hittar sin länk. Då behåller varje säljare friheten att bidra i sin egen takt.",
          ],
        },
        {
          heading: "3. Säljaren får sin shop",
          paragraphs: [
            "Varje säljare får en personlig shopsida med länk och QR-kod. Därifrån kan vänner, familj och kollegor beställa [produkterna](/produkter) — schampo, balsam, body wash eller komplett paket. Säljaren behöver inte ta betalt kontant eller bära runt på lådor.",
            "Tips för hur man delar shoppen finns i guiden [Tips till säljare](/guider/tips-till-saljare) och mer om QR i [Personlig shop](/guider/personlig-shop).",
          ],
        },
        {
          heading: "4. Order, leverans och intäkt",
          paragraphs: [
            "Kunden betalar online. Produkten skickas hem. Föreningens andel räknas enligt den fasta 35 %-modellen — mer om det i [Hur mycket tjänar föreningen?](/guider/hur-mycket-tjanar-foreningen). Ni följer läget i portalen och får utbetalning enligt överenskommelse.",
            "Vill ni se kalkylen live? Gå till [Så fungerar det](/sa-fungerar-det) och testa räknesnurran.",
          ],
        },
        {
          heading: "Ett flöde som är lätt att äga tillsammans",
          paragraphs: [
            "Det bästa upplägget är ofta det som fördelar små uppgifter tydligt. Föreningsansvarig sätter ramarna, ledaren samlar laget och varje säljare delar sin egen shop. Ingen behöver bli butikschef, och ingen behöver gissa vart en order hör hemma.",
            "Inför starten kan ni bestämma kampanjens mål, period och hur ni berättar om den. Följ sedan resultatet med lugn och fokus på gemensam rörelse framåt. [Föreningsliv](/foreningsliv) beskriver modellen på övergripande nivå, medan [tips till säljare](/guider/tips-till-saljare) hjälper varje person med nästa lilla steg.",
          ],
        },
      ],
      faqs: [
        {
          question: "Hur lång tid tar det att komma igång?",
          answer:
            "Själva registreringen tar några minuter. De flesta klubbar har säljare igång samma vecka när lagledare och länkar är på plats.",
        },
        {
          question: "Behöver varje säljare ett lager?",
          answer:
            "Nej. Shoppen är digital. Kunden beställer och får leverans — säljaren delar bara länken eller QR-koden.",
        },
      ],
      cta: { href: "/sa-fungerar-det", label: "Se så fungerar det" },
    },
    en: {
      title: "How Roots works — step by step",
      description:
        "From club to team, seller and personal shop: how it works when your club sells Roots.",
      sections: [
        {
          heading: "Overview: four levels",
          paragraphs: [
            "Roots is structured so that responsibility and visibility match how clubs actually work. At the top is the club. Under that are teams or groups. Then come the sellers — often players or parents — and finally the personal shop where the purchase happens.",
            "You do not need to understand the whole platform on day one. Start by connecting the club, invite team leaders and let sellers share their link. The rest shows up in the portal.",
          ],
        },
        {
          heading: "1. The club joins",
          paragraphs: [
            "Someone responsible in the club registers the club and gets access to the portal. There you set basic details, team structure and goals. No start-up fee is required to get going — you activate sales when you are ready.",
            "Prefer a walkthrough first? [Book a demo](/kontakt?intent=demo) and we’ll show you the flow live.",
          ],
        },
        {
          heading: "2. Teams and leaders",
          paragraphs: [
            "Within the club you create teams or groups. Team leaders can follow sales, support sellers and see how you are tracking against the goal. That lets a larger club stay organised without everything landing on one person.",
            "A good team leader does not need to do everything themselves. The role is rather to create a simple start, answer the most common questions and make sure everyone knows where to find their link. Then each seller keeps the freedom to contribute at their own pace.",
          ],
        },
        {
          heading: "3. The seller gets their shop",
          paragraphs: [
            "Each seller gets a personal shop page with a link and QR code. From there friends, family and colleagues can order the [products](/produkter) — shampoo, conditioner, body wash or the Complete pack. The seller does not need to take cash or carry boxes around.",
            "Tips for sharing the shop are in the guide [Tips for sellers](/guider/tips-till-saljare) and more on QR in [Personal shop](/guider/personlig-shop).",
          ],
        },
        {
          heading: "4. Order, delivery and revenue",
          paragraphs: [
            "The customer pays online. The product is shipped home. The club's share is calculated according to the fixed 35% model — more on that in [How much does the club earn?](/guider/hur-mycket-tjanar-foreningen). You follow progress in the portal and receive payout according to agreement.",
            "Want to see the numbers live? Go to [How it works](/sa-fungerar-det) and try the calculator.",
          ],
        },
        {
          heading: "A flow that is easy to own together",
          paragraphs: [
            "The best setup often distributes small tasks clearly. The club lead sets the frame, the leader gathers the team and each seller shares their own shop. Nobody needs to become a store manager, and nobody needs to guess where an order belongs.",
            "Before kick-off you can decide the campaign goal, period and how you talk about it. Then follow the result calmly with a focus on shared progress. [For clubs](/foreningsliv) describes the model at a high level, while [tips for sellers](/guider/tips-till-saljare) helps each person with the next small step.",
          ],
        },
      ],
      faqs: [
        {
          question: "How long does it take to get started?",
          answer:
            "Registration itself takes a few minutes. Most clubs have sellers up and running the same week once team leaders and links are in place.",
        },
        {
          question: "Does every seller need inventory?",
          answer:
            "No. The shop is digital. The customer orders and receives delivery — the seller only shares the link or QR code.",
        },
      ],
      cta: { href: "/sa-fungerar-det", label: "See how it works" },
    },
    relatedSlugs: [
      "personlig-shop",
      "hur-mycket-tjanar-foreningen",
      "tips-till-saljare",
    ],
  },
  {
    slug: "hur-mycket-tjanar-foreningen",
    publishedAt: "2026-03-05",
    updatedAt: "2026-08-01",
    category: "forening",
    heroImage: "/images/sport-m4.jpg",
    sv: {
      title: "Hur mycket tjänar föreningen? 35 %-modellen förklarad",
      description:
        "Föreningen behåller 35 % av försäljningen. Här är räkneexempel, vad som ingår — och hur ni sätter realistiska mål.",
      sections: [
        {
          heading: "Den fasta modellen: 35 %",
          paragraphs: [
            "Hos Roots är föreningens marginal en fast affärsterm: **föreningen behåller 35 % av försäljningen**. Det är samma siffra i kalkylatorn, i portalen och i kommunikationen utåt — så att lagledare och säljare pratar samma språk.",
            "Ni behöver inte förhandla fram en egen procentsats för att förstå erbjudandet. Fokusera i stället på antal aktiva säljare och hur mycket varje säljare i snitt omsätter under kampanjen.",
          ],
        },
        {
          heading: "Räkneexempel",
          paragraphs: [
            "Exempel 1: Ett lag med 20 säljare där varje säljare i snitt säljer för 1 500 kr. Bruttoförsäljning: 30 000 kr. Föreningens andel (35 %): 10 500 kr.",
            "Exempel 2: En större klubb med 40 säljare och 2 000 kr i snitt per säljare. Brutto: 80 000 kr. Föreningens andel: 28 000 kr.",
            "Exempel 3: En kortare kampanj inför en cupresa — 15 säljare × 1 000 kr = 15 000 kr brutto → 5 250 kr till föreningen. Siffrorna är illustrationer; er faktiska försäljning beror på engagemang, timing och hur enkelt det är att dela shoppen.",
          ],
        },
        {
          heading: "Vad påverkar resultatet mest?",
          paragraphs: [
            "Tre saker: hur många som faktiskt delar sin länk, hur tydligt målet är (t.ex. ”cupresa i påsk”) och om produkten känns relevant. Premiumvård som [komplett paket](/produkter/paket) är lättare att tipsa om än engångsvaror — särskilt till vuxna i nätverket.",
            "Använd gärna räknesnurran på [Så fungerar det](/sa-fungerar-det) för att testa egna antaganden innan ni sätter mål internt.",
          ],
        },
        {
          heading: "Transparens bygger förtroende",
          paragraphs: [
            "Berätta öppet för medlemmar och föräldrar hur 35 %-modellen fungerar. När alla förstår att köpet både ger en bra produkt och stödjer laget blir samtalet enklare — och säljarna mer trygga.",
            "Mer om helheten finns under [Föreningsliv](/foreningsliv). Vill ni gå igenom siffrorna tillsammans? [Boka en demo](/kontakt?intent=demo).",
          ],
        },
        {
          heading: "Planera med ett mål som laget tror på",
          paragraphs: [
            "Ett rimligt mål gör kampanjen lättare att samlas kring. Börja med vad pengarna ska möjliggöra, räkna baklänges med 35 %-modellen och dela upp målet i hanterbara delar. Då blir det tydligt att även en enskild delning eller order faktiskt bidrar.",
            "Låt ändå prognosen vara just en prognos. Försäljning varierar mellan säsonger och nätverk, och det är bättre att följa utvecklingen öppet än att lova ett visst belopp. Använd [Så fungerar det](/sa-fungerar-det) för att prova era egna förutsättningar och se aktuellt pris på produktsidan när ni planerar kommunikationen.",
          ],
        },
      ],
      faqs: [
        {
          question: "Är 35 % på bruttoförsäljningen?",
          answer:
            "Ja. Föreningens andel beräknas som 35 % av försäljningen enligt den låsta marginalmodellen i Roots kalkylator och avräkning.",
        },
        {
          question: "Kan vi ändra procenten?",
          answer:
            "I det publika erbjudandet och kalkylatorn är 35 % låst så att alla ser samma modell. Kontakta oss om ni har frågor kring er förenings avräkning.",
        },
        {
          question: "När får vi pengarna?",
          answer:
            "Utbetalning sker enligt överenskommen avräkning när kampanj eller period avslutas. Detaljerna syns i portalen för föreningsansvariga.",
        },
      ],
      cta: { href: "/sa-fungerar-det", label: "Testa räknesnurran" },
    },
    en: {
      title: "How much does the club earn? The 35% model explained",
      description:
        "The club keeps 35% of sales. Here are examples, what is included — and how you set realistic goals.",
      sections: [
        {
          heading: "The fixed model: 35%",
          paragraphs: [
            "At Roots the club's margin is a fixed business term: **the club keeps 35% of sales**. It is the same figure in the calculator, the portal and all external messaging — so team leaders and sellers stay aligned.",
            "You do not need to negotiate your own percentage to understand the offer. Focus instead on how many active sellers you have and how much each seller turns over on average during the campaign.",
          ],
        },
        {
          heading: "Worked examples",
          paragraphs: [
            "Example 1: A team with 20 sellers where each seller averages SEK 1,500 in sales. Gross sales: SEK 30,000. Club share (35%): SEK 10,500.",
            "Example 2: A larger club with 40 sellers and SEK 2,000 average per seller. Gross: SEK 80,000. Club share: SEK 28,000.",
            "Example 3: A shorter campaign ahead of a tournament trip — 15 sellers × SEK 1,000 = SEK 15,000 gross → SEK 5,250 to the club. The figures are illustrations; your actual sales depend on engagement, timing and how easy it is to share the shop.",
          ],
        },
        {
          heading: "What affects the result most?",
          paragraphs: [
            "Three things: how many people actually share their link, how clear the goal is (e.g. “tournament trip at Easter”) and whether the product feels relevant. Premium care like the [Complete pack](/produkter/paket) is easier to recommend than one-off goods — especially to adults in the network.",
            "You can use the calculator on [How it works](/sa-fungerar-det) to test your own assumptions before you set goals internally.",
          ],
        },
        {
          heading: "Transparency builds trust",
          paragraphs: [
            "Tell members and parents openly how the 35% model works. When everyone understands that a purchase both delivers a good product and supports the team, the conversation gets easier — and sellers feel more confident.",
            "For the full picture, see [For clubs](/foreningsliv). Want to go through the numbers together? [Book a demo](/kontakt?intent=demo).",
          ],
        },
        {
          heading: "Plan with a goal the team believes in",
          paragraphs: [
            "A reasonable goal makes the campaign easier to rally around. Start with what the money should enable, work backwards with the 35% model and break the goal into manageable parts. Then it becomes clear that even a single share or order actually contributes.",
            "Still treat the forecast as a forecast. Sales vary between seasons and networks, and it is better to follow progress openly than to promise a specific amount. Use [How it works](/sa-fungerar-det) to try your own conditions and check current prices on the product page when you plan communication.",
          ],
        },
      ],
      faqs: [
        {
          question: "Is 35% of gross sales?",
          answer:
            "Yes. The club's share is calculated as 35% of sales according to the locked margin model in Roots' calculator and settlement.",
        },
        {
          question: "Can we change the percentage?",
          answer:
            "In the public offer and calculator, 35% is locked so everyone sees the same model. Contact us if you have questions about your club's settlement.",
        },
        {
          question: "When do we get the money?",
          answer:
            "Payout happens according to agreed settlement when the campaign or period ends. Details appear in the portal for club admins.",
        },
      ],
      cta: { href: "/sa-fungerar-det", label: "Try the calculator" },
    },
    relatedSlugs: [
      "sa-fungerar-roots",
      "foreningsforsaljning",
      "jamfor-godisforsaljning",
    ],
  },
  {
    slug: "personlig-shop",
    publishedAt: "2026-03-10",
    updatedAt: "2026-08-01",
    category: "forening",
    heroImage: "/images/sport-m2.jpg",
    sv: {
      title: "Personlig shopsida och QR — så funkar det",
      description:
        "Varje säljare får en egen shopsida med länk och QR-kod. Så delar ni den — och så ser köpet ut för kunden.",
      sections: [
        {
          heading: "En shop per säljare",
          paragraphs: [
            "När du är säljare i en Roots-ansluten förening får du en personlig shopsida. Den är knuten till dig och ditt lag, så att köp som sker via din länk räknas till rätt ställe i portalen.",
            "Kunden behöver inte skapa konto hos föreningen för att handla. De öppnar länken, väljer produkter och betalar — ungefär som i vilken modern webbshop som helst.",
          ],
        },
        {
          heading: "Länk och QR-kod",
          paragraphs: [
            "I portalen kan du kopiera din shop-länk eller visa en QR-kod. QR fungerar bra i omklädningsrum, på anslagstavlan, i matchprogram eller när någon vill scanna direkt från din telefon.",
            "Länken passar SMS, Messenger, Instagram-stories och mail till släkten. Många kombinerar båda: QR lokalt, länk digitalt.",
          ],
        },
        {
          heading: "Vad kunden ser",
          paragraphs: [
            "I shoppen finns Roots sortiment — bland annat [schampo](/produkter/shampoo), [balsam](/produkter/conditioner), [body wash](/produkter/body-wash) och [komplett paket](/produkter/paket). Aktuella priser syns alltid på produktsidorna och i shoppen.",
            "Kunden får en tydlig checkout och leverans hem. Du som säljare behöver inte ta emot pengar eller packa ordrar.",
          ],
        },
        {
          heading: "Bra vanor för delning",
          paragraphs: [
            "Uppdatera gärna profilbilden och en kort text om lagets mål. Dela när det finns en anledning — inför cup, säsongsstart eller ”sista chansen den här veckan”. Undvik att spamma samma grupp varje dag; några genomtänkta påminnelser räcker längre.",
            "Fler praktiska tips finns i [Tips till säljare](/guider/tips-till-saljare). Övergripande flöde: [Så fungerar Roots](/guider/sa-fungerar-roots).",
          ],
        },
        {
          heading: "Gör det enkelt för den som vill stötta",
          paragraphs: [
            "En bra shopsida ska svara på de frågor kunden annars hade ställt i en chatt: vad produkterna är, varför laget samlar in pengar och hur köpet går till. Därför är det klokt att dela länken tillsammans med en kort, personlig rad om ert mål.",
            "Tänk på QR-koden som en genväg, inte som hela budskapet. Vid en match eller ett klubbarrangemang kan en skylt med QR fungera utmärkt när någon samtidigt berättar om laget. Digitalt passar länken bättre. Se [tips till säljare](/guider/tips-till-saljare) för formuleringar som känns respektfulla.",
            "Håll gärna informationen uppdaterad under kampanjen. Om lagets mål ändras eller en aktivitet närmar sig kan en kort ny förklaring ge länken ny relevans, utan att du behöver skicka samma budskap om och om igen.",
          ],
        },
      ],
      faqs: [
        {
          question: "Kan flera i samma familj ha egen shop?",
          answer:
            "Ja, varje säljare har sin egen länk. Det gör det enkelt att följa vem som bidragit — utan att blanda ihop ordrar.",
        },
        {
          question: "Fungerar QR utan app?",
          answer:
            "Ja. Mobilkameran öppnar länken direkt i webbläsaren. Kunden behöver inte ladda ner något extra.",
        },
      ],
      cta: { href: "/hjalp", label: "Hjälp för säljare" },
    },
    en: {
      title: "Personal shop page and QR — how it works",
      description:
        "Every seller gets their own shop page with a link and QR code. How you share it — and what the purchase looks like for the customer.",
      sections: [
        {
          heading: "One shop per seller",
          paragraphs: [
            "When you are a seller in a Roots-connected club you get a personal shop page. It is tied to you and your team, so purchases via your link are counted in the right place in the portal.",
            "The customer does not need to create an account with the club to shop. They open the link, choose products and pay — much like any modern web shop.",
          ],
        },
        {
          heading: "Link and QR code",
          paragraphs: [
            "In the portal you can copy your shop link or show a QR code. QR works well in the changing room, on the noticeboard, in the match programme or when someone wants to scan straight from your phone.",
            "The link suits SMS, Messenger, Instagram Stories and email to relatives. Many combine both: QR locally, link digitally.",
          ],
        },
        {
          heading: "What the customer sees",
          paragraphs: [
            "The shop carries the Roots range — including [shampoo](/produkter/shampoo), [conditioner](/produkter/conditioner), [body wash](/produkter/body-wash) and the [Complete pack](/produkter/paket). Current prices always appear on the product pages and in the shop.",
            "The customer gets a clear checkout and home delivery. As a seller you do not need to take money or pack orders.",
          ],
        },
        {
          heading: "Good habits for sharing",
          paragraphs: [
            "Consider updating the profile image and a short note about the team's goal. Share when there is a reason — before a tournament, season start or “last chance this week”. Avoid spamming the same group every day; a few thoughtful reminders go further.",
            "More practical tips are in [Tips for sellers](/guider/tips-till-saljare). Overall flow: [How Roots works](/guider/sa-fungerar-roots).",
          ],
        },
        {
          heading: "Make it easy for people who want to support",
          paragraphs: [
            "A good shop page should answer the questions the customer would otherwise have asked in a chat: what the products are, why the team is fundraising and how the purchase works. That is why it is smart to share the link together with a short, personal line about your goal.",
            "Think of the QR code as a shortcut, not the whole message. At a match or club event a sign with QR works well when someone also talks about the team. Digitally the link fits better. See [tips for sellers](/guider/tips-till-saljare) for wording that feels respectful.",
            "Keep the information updated during the campaign. If the team's goal changes or an activity is approaching, a short new explanation can give the link fresh relevance — without you sending the same message over and over.",
          ],
        },
      ],
      faqs: [
        {
          question: "Can several people in the same family have their own shop?",
          answer:
            "Yes, each seller has their own link. That makes it easy to see who contributed — without mixing up orders.",
        },
        {
          question: "Does QR work without an app?",
          answer:
            "Yes. The phone camera opens the link straight in the browser. The customer does not need to download anything extra.",
        },
      ],
      cta: { href: "/hjalp", label: "Help for sellers" },
    },
    relatedSlugs: [
      "tips-till-saljare",
      "sa-fungerar-roots",
      "for-fotbollslag",
    ],
  },
  {
    slug: "tips-till-saljare",
    publishedAt: "2026-03-12",
    updatedAt: "2026-08-01",
    category: "forening",
    heroImage: "/images/sport-m1.jpg",
    sv: {
      title: "Säljtips för ungdomar och föräldrar",
      description:
        "Praktiska, respektfulla tips för att dela din Roots-shop — utan press, utan pinsamma pitchar.",
      sections: [
        {
          heading: "Sälj med syfte, inte skuld",
          paragraphs: [
            "Det starkaste argumentet är lagets mål. ”Vi samlar till cupresan” eller ”Vi vill sänka träningsavgiften” är tydligare än ”Köp av mig”. När mottagaren förstår *varför* blir det lättare att säga ja — eller nej utan dåligt samvete.",
            "Roots är premiumvård, inte en tiggarrunda. Du erbjuder en produkt många redan behöver, och en del av köpet går till föreningen.",
          ],
        },
        {
          heading: "En mening som funkar",
          paragraphs: [
            "Håll det kort: vem du är, vad laget samlar till, vad produkten är, och länken. Exempel: ”Hej! Jag säljer Roots hårvård till lagets cupresa — sulfatsnålt schampo och balsam. Här är min shop om du vill kika.”",
            "Lägg gärna till att aktuellt pris syns i shoppen och på [produktsidorna](/produkter). Det sparar frågor.",
          ],
        },
        {
          heading: "Välj rätt kanal",
          paragraphs: [
            "Föräldrar: klassföräldragruppen, jobbet, grannarna. Ungdomar: story, gruppchatt, QR i klubbhuset. Undvik att posta samma text i tio trådar samma kväll — det slår tillbaka.",
            "Personlig shop och QR förklaras i [Personlig shop](/guider/personlig-shop).",
          ],
        },
        {
          heading: "Vanliga misstag",
          paragraphs: [
            "Att lova medicinska effekter. Roots är kosmetisk hår- och kroppsvård — prata om känsla, doft, rutin och formulering, inte om att ”bota” något.",
            "Att skämmas för priset. Premium är en del av erbjudandet. Pekar någon på priset: hänvisa till innehållet, till [SyriCalm®](/guider/syricalm) och till att föreningen får 35 %.",
            "Att glömma uppföljning. En vänlig påminnelse efter en vecka räcker ofta. Tacka alltid den som köpt — det bygger nästa säsong.",
          ],
        },
        {
          heading: "För lagledare",
          paragraphs: [
            "Sätt ett gemensamt mål, dela en gemensam pitch och fira milstolpar. Gör det socialt utan att peka ut den som sålt minst. Mer om flödet: [Så fungerar Roots](/guider/sa-fungerar-roots) och [Föreningsliv](/foreningsliv).",
            "Gör informationen lätt att hitta även efter uppstarten. En fast post i lagets grupp med mål, tidsperiod och länk till hjälp minskar onödiga följdfrågor. Det ger också nya familjer en trygg väg in utan att någon behöver känna sig sen eller utpekad.",
          ],
        },
        {
          heading: "Bygg förtroende i varje kontakt",
          paragraphs: [
            "Den bästa försäljningen börjar ofta med att lyssna. Fråga om personen redan använder hårvård de trivs med, berätta kort om lagets mål och lämna länken utan krav. Då blir Roots ett erbjudande som mottagaren kan titta på i egen takt, snarare än ett samtal som behöver avslutas med ett ja.",
            "Var också noga med det du inte vet. Du behöver inte svara på frågor om exakta ingredienser, leverans eller aktuellt pris på rak arm; hänvisa till [produktsidorna](/produkter) och din shop. Det skapar en trygg, proffsig upplevelse för både dig, kunden och föreningen.",
          ],
        },
      ],
      faqs: [
        {
          question: "Vad säger jag om någon frågar om pris?",
          answer:
            "Hänvisa till shoppen eller produktsidan — där syns alltid aktuellt pris. Du behöver inte memorera siffror.",
        },
        {
          question: "Hur ofta får jag påminna?",
          answer:
            "Hellre få, tydliga tillfällen (kickoff, mitt i kampanjen, sista dagarna) än dagliga påminnelser i samma chatt.",
        },
        {
          question: "Kan jag sälja till personer utanför föreningen?",
          answer:
            "Ja. Din shop är öppen för alla som får länken — vänner, släkt, kollegor och grannar.",
        },
      ],
      cta: { href: "/kontakt?intent=demo", label: "Fråga oss om er kampanj" },
    },
    en: {
      title: "Sales tips for young people and parents",
      description:
        "Practical, respectful tips for sharing your Roots shop — without pressure, without awkward pitches.",
      sections: [
        {
          heading: "Sell with purpose, not guilt",
          paragraphs: [
            "The strongest argument is the team's goal. “We're raising for the tournament trip” or “We want to lower the training fee” is clearer than “Buy from me”. When the recipient understands *why*, it is easier to say yes — or no without a bad conscience.",
            "Roots is premium care, not a begging round. You offer a product many people already need, and part of the purchase goes to the club.",
          ],
        },
        {
          heading: "One sentence that works",
          paragraphs: [
            "Keep it short: who you are, what the team is raising for, what the product is, and the link. Example: “Hi! I'm selling Roots hair care for the team's tournament trip — low-sulphate shampoo and conditioner. Here's my shop if you want to take a look.”",
            "You can add that current prices appear in the shop and on the [product pages](/produkter). That saves questions.",
          ],
        },
        {
          heading: "Choose the right channel",
          paragraphs: [
            "Parents: class parent group, work, neighbours. Young people: Stories, group chat, QR in the clubhouse. Avoid posting the same text in ten threads the same evening — it backfires.",
            "Personal shop and QR are explained in [Personal shop](/guider/personlig-shop).",
          ],
        },
        {
          heading: "Common mistakes",
          paragraphs: [
            "Promising medical effects. Roots is cosmetic hair and body care — talk about feel, scent, routine and formula, not about “curing” anything.",
            "Being embarrassed about the price. Premium is part of the offer. If someone points at the price: refer to the contents, to [SyriCalm®](/guider/syricalm) and to the fact that the club gets 35%.",
            "Forgetting follow-up. A friendly reminder after a week is often enough. Always thank anyone who bought — that builds next season.",
          ],
        },
        {
          heading: "For team leaders",
          paragraphs: [
            "Set a shared goal, share a shared pitch and celebrate milestones. Make it social without calling out whoever sold the least. More about the flow: [How Roots works](/guider/sa-fungerar-roots) and [For clubs](/foreningsliv).",
            "Make the information easy to find even after kick-off. A pinned post in the team's group with goal, time period and a link to help reduces unnecessary follow-up questions. It also gives new families a safe way in without anyone feeling late or singled out.",
          ],
        },
        {
          heading: "Build trust in every contact",
          paragraphs: [
            "The best selling often starts with listening. Ask whether the person already uses hair care they like, briefly explain the team's goal and leave the link without pressure. Then Roots becomes an offer the recipient can look at at their own pace, rather than a conversation that needs to end with a yes.",
            "Also be careful about what you do not know. You do not need to answer questions about exact ingredients, delivery or current price off the cuff; point to the [product pages](/produkter) and your shop. That creates a calm, professional experience for you, the customer and the club.",
          ],
        },
      ],
      faqs: [
        {
          question: "What do I say if someone asks about price?",
          answer:
            "Point to the shop or product page — current price always shows there. You do not need to memorise figures.",
        },
        {
          question: "How often may I remind people?",
          answer:
            "Prefer a few clear moments (kick-off, mid-campaign, final days) over daily reminders in the same chat.",
        },
        {
          question: "Can I sell to people outside the club?",
          answer:
            "Yes. Your shop is open to anyone who gets the link — friends, family, colleagues and neighbours.",
        },
      ],
      cta: { href: "/kontakt?intent=demo", label: "Ask us about your campaign" },
    },
    relatedSlugs: [
      "personlig-shop",
      "hur-mycket-tjanar-foreningen",
      "jamfor-godisforsaljning",
    ],
  },
  {
    slug: "jamfor-godisforsaljning",
    publishedAt: "2026-03-15",
    updatedAt: "2026-08-01",
    category: "forening",
    heroImage: "/images/collection-2.jpg",
    sv: {
      title: "Godisförsäljning vs Roots — en ärlig jämförelse",
      description:
        "Traditionell godisförsäljning jämfört med digital försäljning av premium hårvård. Vad skiljer i tid, lager, image och intäkt?",
      sections: [
        {
          heading: "Två sätt att samla in pengar",
          paragraphs: [
            "Många föreningar har växt upp med godislådor, kakburkar och dörrknackning. Det fungerar fortfarande i vissa miljöer — men det tar tid, kräver logistik och passar inte alla familjer.",
            "Roots är ett alternativ där säljaren delar en länk eller QR, kunden beställer online och föreningen får sin andel. Jämförelsen nedan är till för att hjälpa er välja med öppna ögon.",
          ],
        },
        {
          heading: "Lager, tid och kontanter",
          paragraphs: [
            "Godis: någon måste beställa, lagra, bära hem, räkna och ofta hantera kontanter eller Swish manuellt. Roots: inget föreningslager hos säljaren, digital betalning, leverans till kunden.",
            "Det frigör tid för träning och familjeliv — särskilt märkbart i lag med många småbarnsföräldrar.",
          ],
        },
        {
          heading: "Image och återköp",
          paragraphs: [
            "Godis är impuls. Hårvård är rutin. En förälder som gillar [Roots Schampoo](/produkter/shampoo) kan komma tillbaka nästa säsong. Det ger föreningen en mer långsiktig intäktskälla än en engångskampanj med påsar som tar slut.",
            "Premiumpositionen gör också att fler vuxna i nätverket känner att köpet är relevant — inte bara en ”stötta laget”-plikt.",
          ],
        },
        {
          heading: "Intäkt och transparens",
          paragraphs: [
            "Med Roots gäller den tydliga 35 %-modellen för föreningen. Ni kan räkna innan ni sätter mål — se [Hur mycket tjänar föreningen?](/guider/hur-mycket-tjanar-foreningen) och [Så fungerar det](/sa-fungerar-det).",
            "Godismarginaler varierar kraftigt mellan leverantörer. Oavsett modell: var öppna internt om vad som faktiskt landar i klubbkassan.",
          ],
        },
        {
          heading: "När godis fortfarande kan passa",
          paragraphs: [
            "Korta, lokala evenemang där folk förväntar sig något ätbart kan fortfarande fungera. Många klubbar kör hybrid: godis på matchdagen, Roots som säsongens huvudkampanj. Det viktiga är att välja medvetet — inte av vana.",
            "Läs mer om föreningsmodellen under [Föreningsliv](/foreningsliv) eller [kontakta oss för en demo](/kontakt?intent=demo).",
          ],
        },
        {
          heading: "Välj efter er vardag, inte efter vana",
          paragraphs: [
            "Det finns ingen universell modell som passar alla lag. Ett litet lag med ett återkommande lokalt evenemang kan uppskatta den fysiska närvaron i traditionell försäljning, medan en större förening ofta vinner mycket på digital översikt och hemleverans. Jämför därför arbetsinsatsen lika noga som den möjliga intäkten.",
            "Roots kan vara ett sätt att bredda föreningens verktyg utan att värdera ner det ni redan gör. När produkten känns relevant, flödet är enkelt och 35 %-andelen är tydlig blir det lättare för fler att vilja delta. Läs [vad föreningsförsäljning innebär](/guider/foreningsforsaljning) innan ni bestämmer nästa kampanj.",
          ],
        },
      ],
      faqs: [
        {
          question: "Måste vi sluta med godis helt?",
          answer:
            "Nej. Många kombinerar. Roots ersätter den tunga, lagerkrävande delen — inte nödvändigtvis varje fikabord.",
        },
        {
          question: "Är Roots svårare att sälja till ungdomar?",
          answer:
            "Ungdomar säljer ofta till vuxna i sitt nätverk. Produkten riktar sig till vardagsrutinen hos den som faktiskt betalar — vilket ofta gör pitchen enklare.",
        },
      ],
      cta: { href: "/foreningsliv", label: "Utforska föreningsliv" },
    },
    en: {
      title: "Candy sales vs Roots — an honest comparison",
      description:
        "Traditional candy sales compared with digital sales of premium hair care. What differs in time, stock, image and revenue?",
      sections: [
        {
          heading: "Two ways to raise money",
          paragraphs: [
            "Many clubs grew up with candy boxes, cake tins and door knocking. It still works in some settings — but it takes time, needs logistics and does not suit every family.",
            "Roots is an alternative where the seller shares a link or QR, the customer orders online and the club gets its share. The comparison below is meant to help you choose with open eyes.",
          ],
        },
        {
          heading: "Stock, time and cash",
          paragraphs: [
            "Candy: someone must order, store, carry home, count and often handle cash or mobile payments manually. Roots: no club stock with the seller, digital payment, delivery to the customer.",
            "That frees time for training and family life — especially noticeable in teams with many parents of young children.",
          ],
        },
        {
          heading: "Image and repeat purchases",
          paragraphs: [
            "Candy is impulse. Hair care is routine. A parent who likes [Roots Schampoo](/produkter/shampoo) may come back next season. That gives the club a more long-term revenue source than a one-off campaign with bags that run out.",
            "The premium position also means more adults in the network feel the purchase is relevant — not only a “support the team” duty.",
          ],
        },
        {
          heading: "Revenue and transparency",
          paragraphs: [
            "With Roots the clear 35% model applies for the club. You can calculate before you set goals — see [How much does the club earn?](/guider/hur-mycket-tjanar-foreningen) and [How it works](/sa-fungerar-det).",
            "Candy margins vary widely between suppliers. Whatever the model: be open internally about what actually lands in the club kitty.",
          ],
        },
        {
          heading: "When candy can still fit",
          paragraphs: [
            "Short, local events where people expect something edible can still work. Many clubs run a hybrid: candy on match day, Roots as the season's main campaign. The important thing is to choose deliberately — not out of habit.",
            "Read more about the club model under [For clubs](/foreningsliv) or [contact us for a demo](/kontakt?intent=demo).",
          ],
        },
        {
          heading: "Choose for your everyday life, not out of habit",
          paragraphs: [
            "There is no universal model that suits every team. A small team with a recurring local event may appreciate the physical presence of traditional sales, while a larger club often gains a lot from digital overview and home delivery. Compare the effort as carefully as the possible revenue.",
            "Roots can be a way to broaden the club's toolkit without dismissing what you already do. When the product feels relevant, the flow is simple and the 35% share is clear, more people want to take part. Read [what club fundraising means](/guider/foreningsforsaljning) before you decide on the next campaign.",
          ],
        },
      ],
      faqs: [
        {
          question: "Do we have to stop candy completely?",
          answer:
            "No. Many combine. Roots replaces the heavy, stock-heavy part — not necessarily every cake table.",
        },
        {
          question: "Is Roots harder to sell to young people?",
          answer:
            "Young people often sell to adults in their network. The product speaks to the everyday routine of the person who actually pays — which often makes the pitch simpler.",
        },
      ],
      cta: { href: "/foreningsliv", label: "Explore club fundraising" },
    },
    relatedSlugs: [
      "foreningsforsaljning",
      "hur-mycket-tjanar-foreningen",
      "tips-till-saljare",
    ],
  },
  {
    slug: "for-fotbollslag",
    publishedAt: "2026-03-20",
    updatedAt: "2026-08-01",
    category: "sport",
    heroImage: "/images/sport-paddock.jpg",
    sv: {
      title: "Roots för fotbollslag",
      description:
        "Så kan fotbollslag använda Roots för cupresor, material och lagkassa — med personliga shoppar och tydlig 35 %-andel.",
      sections: [
        {
          heading: "Fotbollens verklighet: alltid något att finansiera",
          paragraphs: [
            "Cupresor, nya bollar, domaravgifter, träningsläger — fotbollslag har en jämn ström av kostnader. Traditionell försäljning tar tid från planen. Roots är tänkt att sitta i fickan: varje spelare eller förälder delar sin shop mellan träningarna.",
            "Sätt gärna en ansvarig vuxen som fångar upp praktiska frågor, men låt själva budskapet vara lagets. När spelare och föräldrar kan berätta med egna ord varför ni samlar in pengar blir kampanjen mer trovärdig och mindre som ännu en administrativ uppgift.",
          ],
        },
        {
          heading: "Varför hårvård funkar i fotbollsmiljön",
          paragraphs: [
            "Efter match och träning duschar nästan alla. [Schampo](/produkter/shampoo), [balsam](/produkter/conditioner) och [body wash](/produkter/body-wash) är konkret i den vardagen — särskilt med en sulfatsnål, sportnära formulering.",
            "Det gör samtalet naturligt: ”Vi säljer det vi själva använder efter träning” snarare än ”Vill du ha en påse godis?”.",
          ],
        },
        {
          heading: "Så rullar ni ut det i laget",
          paragraphs: [
            "1) Sätt ett mål (t.ex. höstcupen). 2) Bjud in säljare via portalen. 3) Dela QR i omklädningsrummet och länk i föräldrachatten. 4) Följ upp milstolpar utan att peka ut någon.",
            "Steg-för-steg finns i [Så fungerar Roots](/guider/sa-fungerar-roots). Säljtips: [Tips till säljare](/guider/tips-till-saljare).",
          ],
        },
        {
          heading: "Räkna på lagkassan",
          paragraphs: [
            "Med 18 spelare/föräldrar som säljare och 1 500 kr i snitt per person landar bruttoförsäljningen på 27 000 kr. Föreningens andel på 35 % blir 9 450 kr — ofta ett meningsfullt bidrag till en cupresa.",
            "Testa egna tal i [räknesnurran](/sa-fungerar-det) och läs mer under [Föreningsliv](/foreningsliv).",
          ],
        },
        {
          heading: "Från föräldramöte till avspark",
          paragraphs: [
            "I fotbollslag fungerar en tydlig kickoff ofta bäst. Avsätt några minuter på ett föräldramöte eller efter träningen, visa hur den personliga shoppen fungerar och koppla kampanjen till något alla kan se framför sig. Då börjar ni gemensamt, men varje familj kan bidra på sitt eget sätt.",
            "Håll sedan kommunikationen rytmisk och enkel: en påminnelse i början, en mitt i perioden och en när målet närmar sig. Använd [personlig shop och QR](/guider/personlig-shop) för det praktiska och [35 %-guiden](/guider/hur-mycket-tjanar-foreningen) när ni vill förklara hur försäljningen stärker lagkassan.",
            "Gör också plats för frågor vid sidlinjen. När någon förälder har genomfört ett köp eller förstått flödet kan den personen ofta hjälpa nästa familj, vilket gör att kampanjen blir ett gemensamt lagarbete.",
          ],
        },
      ],
      faqs: [
        {
          question: "Passar det pojklag, flicklag och seniorer?",
          answer:
            "Ja. Modellen är densamma. Anpassa bara pitch och kanaler efter ålder och föräldraengagemang.",
        },
        {
          question: "Kan hela föreningen köra samtidigt?",
          answer:
            "Ja. Föreningen kan ha flera lag igång parallellt, med egen uppföljning per lag i portalen.",
        },
      ],
      cta: { href: "/kontakt?intent=demo", label: "Boka demo för laget" },
    },
    en: {
      title: "Roots for football teams",
      description:
        "How football teams can use Roots for tournament trips, kit and team funds — with personal shops and a clear 35% share.",
      sections: [
        {
          heading: "Football reality: always something to fund",
          paragraphs: [
            "Tournament trips, new balls, referee fees, training camps — football teams have a steady stream of costs. Traditional selling takes time away from the pitch. Roots is meant to sit in your pocket: each player or parent shares their shop between sessions.",
            "Consider appointing a responsible adult who catches practical questions, but let the message itself belong to the team. When players and parents can explain in their own words why you are fundraising, the campaign feels more credible and less like another admin task.",
          ],
        },
        {
          heading: "Why hair care works in a football setting",
          paragraphs: [
            "After matches and training almost everyone showers. [Shampoo](/produkter/shampoo), [conditioner](/produkter/conditioner) and [body wash](/produkter/body-wash) are concrete in that everyday life — especially with a low-sulphate, sport-near formula.",
            "That makes the conversation natural: “We sell what we use ourselves after training” rather than “Want a bag of candy?”.",
          ],
        },
        {
          heading: "How you roll it out in the team",
          paragraphs: [
            "1) Set a goal (e.g. the autumn tournament). 2) Invite sellers via the portal. 3) Share QR in the changing room and the link in the parent chat. 4) Follow milestones without calling anyone out.",
            "Step by step is in [How Roots works](/guider/sa-fungerar-roots). Sales tips: [Tips for sellers](/guider/tips-till-saljare).",
          ],
        },
        {
          heading: "Calculate the team fund",
          paragraphs: [
            "With 18 players/parents as sellers and SEK 1,500 average per person, gross sales land at SEK 27,000. The club's 35% share becomes SEK 9,450 — often a meaningful contribution to a tournament trip.",
            "Test your own numbers in the [calculator](/sa-fungerar-det) and read more under [For clubs](/foreningsliv).",
          ],
        },
        {
          heading: "From parents' meeting to kick-off",
          paragraphs: [
            "In football teams a clear kick-off often works best. Set aside a few minutes at a parents' meeting or after training, show how the personal shop works and tie the campaign to something everyone can picture. Then you start together, but each family can contribute in their own way.",
            "Then keep communication rhythmic and simple: a reminder at the start, one mid-period and one as the goal approaches. Use [personal shop and QR](/guider/personlig-shop) for the practical bits and the [35% guide](/guider/hur-mycket-tjanar-foreningen) when you want to explain how sales strengthen the team fund.",
            "Also make room for questions on the sideline. When one parent has completed a purchase or understood the flow, that person can often help the next family — so the campaign becomes shared team work.",
          ],
        },
      ],
      faqs: [
        {
          question: "Does it suit boys' teams, girls' teams and seniors?",
          answer:
            "Yes. The model is the same. Just adapt pitch and channels to age and parent engagement.",
        },
        {
          question: "Can the whole club run at once?",
          answer:
            "Yes. The club can have several teams running in parallel, with separate follow-up per team in the portal.",
        },
      ],
      cta: { href: "/kontakt?intent=demo", label: "Book a demo for the team" },
    },
    relatedSlugs: [
      "for-ishockeylag",
      "personlig-shop",
      "hur-mycket-tjanar-foreningen",
    ],
  },
  {
    slug: "for-ishockeylag",
    publishedAt: "2026-03-20",
    updatedAt: "2026-08-01",
    category: "sport",
    heroImage: "/images/sport-hockey.jpg",
    sv: {
      title: "Roots för ishockeylag",
      description:
        "Ishockey innebär slit, svett och täta duschar. Så kan laget samla in pengar med premiumvård — utan lager och kontanter.",
      sections: [
        {
          heading: "Ishockeyns kostnader är höga — tiden är knappare",
          paragraphs: [
            "Utrustning, ishyror och resor gör ishockey till en av de dyraste ungdomsidrotterna. Samtidigt är scheman packade. En försäljningsmodell som kräver lager och kvällsknackning konkurrerar med det laget egentligen vill göra: träna och spela.",
            "Roots flyttar försäljningen till en länk och en QR-kod. Lagledaren ser läget i portalen; säljaren delar shoppen när det passar.",
          ],
        },
        {
          heading: "En produkt som hör hemma i duschen efter isen",
          paragraphs: [
            "Efter match är hår och hud utsatta för svett, hjälm och kyla. En skonsam rutin med [Roots Schampoo](/produkter/shampoo) och [Body Wash](/produkter/body-wash) är lätt att förklara för både spelare och föräldrar.",
            "Läs gärna [Rutin efter träning](/guider/rutin-efter-traning) för tips kring just den stunden.",
          ],
        },
        {
          heading: "Kampanjupplägg som funkar i hockey",
          paragraphs: [
            "Kör gärna kampanjer kring säsongsstart, julcup eller vårens slutspel. Sätt QR i båset eller i klubbhusets entré. Be föräldrar dela i jobbnätverket — där sitter ofta köpkraften.",
            "Föreningen behåller 35 % av försäljningen. Räkneexempel och mål finns i [Hur mycket tjänar föreningen?](/guider/hur-mycket-tjanar-foreningen).",
          ],
        },
        {
          heading: "Från A-lag till ungdom",
          paragraphs: [
            "Samma plattform fungerar oavsett nivå. Skillnaden är tonen: ungdomslag pratar cup och material, seniorer kan prata lagkassa och gemensamma aktiviteter. Se helheten på [Föreningsliv](/foreningsliv) eller [boka en demo](/kontakt?intent=demo).",
            "Oavsett om ni är ett ungdomslag eller spelar på seniornivå blir det tydligare när kampanjens syfte är gemensamt och kommunicerat. Låt laget välja ett konkret mål och återkoppla löpande, så att försäljningen känns som en del av lagets plan snarare än ett sidospår.",
          ],
        },
        {
          heading: "Låt kampanjen passa säsongen",
          paragraphs: [
            "Hockeyåret har redan sina naturliga hållpunkter: uppstart, cuper, lov och slutspel. Välj en period när laget kan fokusera i två eller tre veckor, i stället för att låta en insamling bli ännu en sak som pågår i bakgrunden hela säsongen.",
            "En gemensam ambition fungerar bäst när alla känner sig inkluderade. Fördela inte press efter antal sålda produkter; fira hellre att laget når delmål och att fler har delat sin shop. [Så fungerar Roots](/guider/sa-fungerar-roots) visar hur rollerna hänger ihop från förening till säljare.",
            "Förankra upplägget i god tid före en kostnad som laget vill möta. När familjer vet om målbilden, exempelvis en resa eller utrustning, blir det lättare att planera sin delning. En tydlig deadline hjälper utan att skapa onödig stress. Samla gärna vanliga frågor i ett enda lagmeddelande så att informationen blir konsekvent och enkel att återvända till.",
          ],
        },
      ],
      faqs: [
        {
          question: "Fungerar det för både pojk- och damlag?",
          answer:
            "Ja. Shop, QR och 35 %-modellen är desamma. Anpassa budskapet efter lagets mål.",
        },
        {
          question: "Kan vi sälja i samband med matcher?",
          answer:
            "Ja — QR på programblad, i kiosken eller via speaker. Själva köpet sker digitalt, så ni slipper kontanthantering vid sargen.",
        },
      ],
      cta: { href: "/foreningsliv", label: "Läs mer för föreningar" },
    },
    en: {
      title: "Roots for ice hockey teams",
      description:
        "Ice hockey means wear, sweat and frequent showers. How the team can raise money with premium care — without stock and cash.",
      sections: [
        {
          heading: "Hockey costs are high — time is tighter",
          paragraphs: [
            "Equipment, ice hire and travel make ice hockey one of the more expensive youth sports. At the same time schedules are packed. A sales model that needs stock and evening door-knocking competes with what the team actually wants to do: train and play.",
            "Roots moves selling to a link and a QR code. The team leader sees status in the portal; the seller shares the shop when it suits them.",
          ],
        },
        {
          heading: "A product that belongs in the shower after the ice",
          paragraphs: [
            "After a game hair and skin face sweat, helmet and cold. A gentle routine with [Roots Schampoo](/produkter/shampoo) and [Body Wash](/produkter/body-wash) is easy to explain to both players and parents.",
            "You may also read [Routine after training](/guider/rutin-efter-traning) for tips around that moment.",
          ],
        },
        {
          heading: "Campaign setups that work in hockey",
          paragraphs: [
            "Run campaigns around season start, Christmas tournaments or spring play-offs. Put QR in the bench area or at the clubhouse entrance. Ask parents to share in their work network — that is often where purchasing power sits.",
            "The club keeps 35% of sales. Examples and goals are in [How much does the club earn?](/guider/hur-mycket-tjanar-foreningen).",
          ],
        },
        {
          heading: "From first team to youth",
          paragraphs: [
            "The same platform works at every level. The difference is tone: youth teams talk tournaments and kit, seniors can talk team funds and shared activities. See the full picture on [For clubs](/foreningsliv) or [book a demo](/kontakt?intent=demo).",
            "Whether you are a youth team or play at senior level, it gets clearer when the campaign purpose is shared and communicated. Let the team choose a concrete goal and report back regularly, so selling feels like part of the team's plan rather than a side track.",
          ],
        },
        {
          heading: "Let the campaign fit the season",
          paragraphs: [
            "The hockey year already has natural checkpoints: start-up, tournaments, holidays and play-offs. Choose a period when the team can focus for two or three weeks, instead of letting a fundraiser become another thing humming in the background all season.",
            "A shared ambition works best when everyone feels included. Do not distribute pressure by number of products sold; celebrate reaching milestones and that more people have shared their shop. [How Roots works](/guider/sa-fungerar-roots) shows how the roles connect from club to seller.",
            "Anchor the setup well before a cost the team wants to meet. When families know the goal picture — for example a trip or equipment — it is easier to plan their sharing. A clear deadline helps without creating unnecessary stress. Gather common questions in a single team message so the information stays consistent and easy to return to.",
          ],
        },
      ],
      faqs: [
        {
          question: "Does it work for both boys' and women's teams?",
          answer:
            "Yes. Shop, QR and the 35% model are the same. Adapt the message to the team's goal.",
        },
        {
          question: "Can we sell in connection with matches?",
          answer:
            "Yes — QR on programmes, in the kiosk or via the PA. The purchase itself is digital, so you avoid cash handling by the boards.",
        },
      ],
      cta: { href: "/foreningsliv", label: "Read more for clubs" },
    },
    relatedSlugs: [
      "for-fotbollslag",
      "rutin-efter-traning",
      "sa-fungerar-roots",
    ],
  },
  {
    slug: "syricalm",
    publishedAt: "2026-04-01",
    updatedAt: "2026-08-01",
    category: "ingrediens",
    heroImage: "/images/sport-schampoo.jpg",
    sv: {
      title: "SyriCalm® — Phragmites och Poria för en lugnare känsla",
      description:
        "Vad är SyriCalm® i Roots produkter? En kosmetisk guide till den nordiska aktiven av vass och svamp — utan medicinska löften.",
      sections: [
        {
          heading: "Vad är SyriCalm®?",
          paragraphs: [
            "SyriCalm® är en forskningsförankrad aktiv som bygger på extrakt från vass (*Phragmites Communis*) och svampen *Poria Cocos*. I Roots sortiment används den för att ge en lugnande, behaglig känsla på hårbotten och hud — inom ramen för kosmetisk vård.",
            "Du hittar den i [schampo](/produkter/shampoo), [balsam](/produkter/conditioner) och [body wash](/produkter/body-wash). Tanken är en röd tråd genom hela rutinen.",
          ],
        },
        {
          heading: "Vad vi menar med ”lugnar”",
          paragraphs: [
            "I kosmetiskt språk handlar det om komfort: att hårbotten och hud ska kännas mindre irriterade av vardagens påfrestningar som tvätt, svett och väder. Det är inte samma sak som att behandla sjukdom, eksem eller andra medicinska tillstånd.",
            "Har du besvär som inte går över bör du kontakta vårdpersonal. Roots ersätter inte medicinsk rådgivning.",
          ],
        },
        {
          heading: "Varför nordiska råvaror?",
          paragraphs: [
            "Vass och Poria ger en tydlig nordisk/asiatiskt inspirerad story som passar Roots position: naturlig känsla, modern formulering, föreningsnära varumärke. Vi undviker stora ord om ”mirakel” — hellre ärlig funktion i duschen.",
            "Mer om helheten finns i [Naturlig hårvård i Norden](/guider/naturlig-harvard-norden).",
          ],
        },
        {
          heading: "Hur du märker det i praktiken",
          paragraphs: [
            "Många beskriver resultatet som rent hår och en hårbotten som känns i balans efter tvätt — särskilt tillsammans med sulfatsnåla tvättämnen. Se också guiderna [Hårbotten i balans](/guider/harbotten) och [Sulfatsnålt schampo](/guider/sulfatsnalt-schampo).",
            "Aktuellt pris finns alltid på respektive produktsida.",
          ],
        },
        {
          heading: "Kosmetisk omsorg utan stora löften",
          paragraphs: [
            "Ingrediensnamn kan låta tekniska, men användningen ska vara enkel: schamponera, skölj och följ upp med balsam när längderna behöver det. SyriCalm® är en del av den samlade sensoriska upplevelsen i Roots produkter, där rengöring, fukt och komfort får samspela.",
            "Reaktioner och behov varierar alltid mellan personer. Läs ingrediensförteckningen om du vet att du är känslig för något och avbryt användningen vid obehag. Vid kvarstående eller uttalade besvär ska du söka professionell rådgivning. För produktöversikt, börja på [Roots produkter](/produkter).",
            "Det mest användbara sättet att utvärdera en produkt är att utgå från din egen vardag: hur den doftar, löddrar, sköljs ur och vilken känsla den lämnar efteråt. Sådana kosmetiska upplevelser kan vara personliga och behöver inte se likadana ut för alla.",
          ],
        },
      ],
      faqs: [
        {
          question: "Är SyriCalm® ett läkemedel?",
          answer:
            "Nej. Det är en kosmetisk aktiv i hår- och hudvård. Roots produkter är inte avsedda att diagnosticera, behandla eller bota sjukdom.",
        },
        {
          question: "Finns SyriCalm® i alla Roots produkter?",
          answer:
            "Ja, den går igenom schampo, balsam och body wash i det nuvarande sortimentet.",
        },
      ],
      cta: { href: "/produkter/shampoo", label: "Se Roots Schampoo" },
    },
    en: {
      title: "SyriCalm® — Phragmites and Poria for a calmer feel",
      description:
        "What is SyriCalm® in Roots products? A cosmetic guide to the Nordic active from reed and mushroom — without medical claims.",
      sections: [
        {
          heading: "What is SyriCalm®?",
          paragraphs: [
            "SyriCalm® is a research-anchored active based on extracts from reed (*Phragmites Communis*) and the mushroom *Poria Cocos*. In the Roots range it is used to give a soothing, pleasant feel on scalp and skin — within the frame of cosmetic care.",
            "You will find it in [shampoo](/produkter/shampoo), [conditioner](/produkter/conditioner) and [body wash](/produkter/body-wash). The idea is a common thread through the whole routine.",
          ],
        },
        {
          heading: "What we mean by “soothes”",
          paragraphs: [
            "In cosmetic language it is about comfort: that scalp and skin should feel less irritated by everyday strain such as washing, sweat and weather. That is not the same as treating disease, eczema or other medical conditions.",
            "If you have issues that do not settle, contact a healthcare professional. Roots does not replace medical advice.",
          ],
        },
        {
          heading: "Why Nordic raw materials?",
          paragraphs: [
            "Reed and Poria give a clear Nordic/Asian-inspired story that fits Roots' position: natural feel, modern formulation, club-focused brand. We avoid big words about “miracles” — prefer honest function in the shower.",
            "For the full picture, see [Natural hair care in the Nordics](/guider/naturlig-harvard-norden).",
          ],
        },
        {
          heading: "How you notice it in practice",
          paragraphs: [
            "Many describe the result as clean hair and a scalp that feels in balance after washing — especially together with low-sulphate surfactants. See also the guides [Scalp in balance](/guider/harbotten) and [Low-sulphate shampoo](/guider/sulfatsnalt-schampo).",
            "Current prices are always on each product page.",
          ],
        },
        {
          heading: "Cosmetic care without big promises",
          paragraphs: [
            "Ingredient names can sound technical, but use should be simple: shampoo, rinse and follow with conditioner when the lengths need it. SyriCalm® is part of the overall sensory experience in Roots products, where cleansing, moisture and comfort work together.",
            "Reactions and needs always vary between people. Read the ingredient list if you know you are sensitive to something and stop use if you feel discomfort. For persistent or pronounced issues, seek professional advice. For a product overview, start at [Roots products](/produkter).",
            "The most useful way to evaluate a product is to start from your own everyday life: how it smells, lathers, rinses and what feel it leaves afterwards. Such cosmetic experiences can be personal and do not need to look the same for everyone.",
          ],
        },
      ],
      faqs: [
        {
          question: "Is SyriCalm® a medicine?",
          answer:
            "No. It is a cosmetic active in hair and skin care. Roots products are not intended to diagnose, treat or cure disease.",
        },
        {
          question: "Is SyriCalm® in all Roots products?",
          answer:
            "Yes, it runs through shampoo, conditioner and body wash in the current range.",
        },
      ],
      cta: { href: "/produkter/shampoo", label: "See Roots Schampoo" },
    },
    relatedSlugs: [
      "harbotten",
      "multimoist",
      "naturlig-harvard-norden",
    ],
  },
  {
    slug: "multimoist",
    publishedAt: "2026-04-05",
    updatedAt: "2026-08-01",
    category: "ingrediens",
    heroImage: "/images/sport-conditioner.jpg",
    sv: {
      title: "MultiMoist-känsla och Beta Vulgaris — fukt som syns i spegeln",
      description:
        "Hur Beta Vulgaris (rödbetsextrakt) och fuktgivande komplex bidrar till mjukare, mer följsamt hår i Roots balsam — förklarat på kosmetiskt språk.",
      sections: [
        {
          heading: "Fukt är mer än ”blött hår”",
          paragraphs: [
            "När vi pratar fukt i hårvård menar vi hur hårstrået känns och beter sig när det torkat: mjukhet, elasticitet och hur lätt det är att reda ut. Torrhetskänsla kan komma från väder, hård tvätt, styling eller helt enkelt en rutin som tar mer än den ger tillbaka.",
            "I [Roots Conditioner](/produkter/conditioner) finns bland annat *Beta Vulgaris Root Extract* (rödbetsextrakt) tillsammans med fuktstödjande ingredienser som Panthenol (pro-vitamin B5).",
          ],
        },
        {
          heading: "Beta Vulgaris i kosmetisk kontext",
          paragraphs: [
            "Rödbetsextrakt används i moderna formuleringar för sin fuktrelaterade profil. Vi beskriver det som en del av balsamets förmåga att lämna håret mer följsamt — inte som ett botemedel mot hårsjukdomar eller medicinska brister.",
            "Tillsammans med ett lätt emollient-komplex ska resultatet kännas närande utan att tynga, vilket passar både vardag och träning.",
          ],
        },
        {
          heading: "Så bygger du en fuktig rutin",
          paragraphs: [
            "1) Rengör skonsamt med [sulfatsnålt schampo](/guider/sulfatsnalt-schampo). 2) Tillför fukt och lyster med balsam. 3) Låt inte hett vatten och dubbeltvätt bli standard om håret redan känns torrt.",
            "Efter träning: se [Rutin efter träning](/guider/rutin-efter-traning). För hårbottenkomfort: [SyriCalm®](/guider/syricalm).",
          ],
        },
        {
          heading: "Paket vs enstaka produkt",
          paragraphs: [
            "Många som handlar via förening väljer [komplett paket](/produkter/paket) för att få samma språk genom hela duschen. Aktuellt pris ser du alltid på produktsidan — vi låser inte kampanjpriser i den här guiden.",
            "Välj mängd efter hårets längd och täthet, och koncentrera balsamet på längderna där det ofta gör mest nytta. En kort verkningstid medan du tvättar kroppen kan räcka för att göra steget enkelt att få in i vardagen.",
          ],
        },
        {
          heading: "Följsamhet är en del av helheten",
          paragraphs: [
            "Hur håret känns efter duschen avgörs inte av en enda ingrediens. Tvättfrekvens, vattentemperatur, borstning och hur länge balsamet får verka spelar också roll. Beta Vulgaris och andra fuktstödjande ingredienser är därför en del av en genomtänkt kosmetisk formulering, inte ett löfte om samma resultat för alla.",
            "Börja gärna enkelt och utvärdera rutinen över tid. Om längderna känns torra kan [Roots Conditioner](/produkter/conditioner) vara ett naturligt nästa steg efter schampo; om du vill samla rutinen finns [komplett paket](/produkter/paket). Se aktuellt pris på respektive produktsida.",
          ],
        },
      ],
      faqs: [
        {
          question: "Gör Beta Vulgaris att håret växer snabbare?",
          answer:
            "Nej, det är inte så vi kommunicerar ingrediensen. Fokus ligger på fukt, mjukhet och följsamhet i kosmetisk mening.",
        },
        {
          question: "Kan jag använda balsamet utan schampo?",
          answer:
            "Balsam är formulerat som komplement efter tvätt. En del använder små mängder som leave-in på längderna — känn efter vad som passar ditt hår.",
        },
      ],
      cta: { href: "/produkter/conditioner", label: "Se Roots Conditioner" },
    },
    en: {
      title: "MultiMoist feel and Beta Vulgaris — moisture you see in the mirror",
      description:
        "How Beta Vulgaris (beetroot extract) and moisturising complexes contribute to softer, more manageable hair in Roots conditioner — explained in cosmetic language.",
      sections: [
        {
          heading: "Moisture is more than “wet hair”",
          paragraphs: [
            "When we talk moisture in hair care we mean how the hair strand feels and behaves once dry: softness, elasticity and how easy it is to detangle. A dry feel can come from weather, harsh washing, styling or simply a routine that takes more than it gives back.",
            "In [Roots Conditioner](/produkter/conditioner) you will find among other things *Beta Vulgaris Root Extract* (beetroot extract) together with moisture-supporting ingredients such as Panthenol (pro-vitamin B5).",
          ],
        },
        {
          heading: "Beta Vulgaris in a cosmetic context",
          paragraphs: [
            "Beetroot extract is used in modern formulations for its moisture-related profile. We describe it as part of the conditioner's ability to leave hair more manageable — not as a cure for hair disease or medical deficiencies.",
            "Together with a light emollient complex the result should feel nourishing without weighing hair down, which suits both everyday life and training.",
          ],
        },
        {
          heading: "How you build a moisturising routine",
          paragraphs: [
            "1) Cleanse gently with [low-sulphate shampoo](/guider/sulfatsnalt-schampo). 2) Add moisture and shine with conditioner. 3) Do not let hot water and double washing become the default if hair already feels dry.",
            "After training: see [Routine after training](/guider/rutin-efter-traning). For scalp comfort: [SyriCalm®](/guider/syricalm).",
          ],
        },
        {
          heading: "Set vs single product",
          paragraphs: [
            "Many who shop via club choose the [Complete pack](/produkter/paket) to get the same language through the whole shower. Current prices are always on the product page — we do not lock campaign prices in this guide.",
            "Choose amount by hair length and density, and concentrate conditioner on the lengths where it often helps most. A short leave-on time while you wash your body can be enough to make the step easy to fit into everyday life.",
          ],
        },
        {
          heading: "Manageability is part of the whole",
          paragraphs: [
            "How hair feels after the shower is not decided by a single ingredient. Wash frequency, water temperature, brushing and how long conditioner is left on also matter. Beta Vulgaris and other moisture-supporting ingredients are therefore part of a considered cosmetic formula, not a promise of the same result for everyone.",
            "Start simply and evaluate the routine over time. If lengths feel dry, [Roots Conditioner](/produkter/conditioner) can be a natural next step after shampoo; if you want to gather the routine there is the [Complete pack](/produkter/paket). See current prices on each product page.",
          ],
        },
      ],
      faqs: [
        {
          question: "Does Beta Vulgaris make hair grow faster?",
          answer:
            "No, that is not how we communicate the ingredient. Focus is on moisture, softness and manageability in a cosmetic sense.",
        },
        {
          question: "Can I use the conditioner without shampoo?",
          answer:
            "Conditioner is formulated as a complement after washing. Some use small amounts as leave-in on the lengths — feel out what suits your hair.",
        },
      ],
      cta: { href: "/produkter/conditioner", label: "See Roots Conditioner" },
    },
    relatedSlugs: [
      "syricalm",
      "sulfatsnalt-schampo",
      "rutin-efter-traning",
    ],
  },
  {
    slug: "harbotten",
    publishedAt: "2026-04-10",
    updatedAt: "2026-08-01",
    category: "harvard",
    heroImage: "/images/schampoo-lifestyle.jpg",
    sv: {
      title: "Hårbotten i balans — snällt språk, ärliga vanor",
      description:
        "En lugn guide till hårbottenvård: mild tvätt, mindre irritation i vardagen och när du bör söka annan hjälp än kosmetik.",
      sections: [
        {
          heading: "Hårbotten är hud",
          paragraphs: [
            "Hårbotten är hud med hårsäckar — den påverkas av samma saker som ansiktet: tvätt, svett, kyla, mössor och produkter. Att den ”kliar ibland” eller känns stram efter en hård schampotvätt är vanligt, men det betyder inte automatiskt sjukdom.",
            "Målet med en bra rutin är komfort och balans, inte att jaga medicinska diagnoser i badrumsskåpet.",
          ],
        },
        {
          heading: "Vanor som ofta hjälper",
          paragraphs: [
            "Välj ett [sulfatsnålt schampo](/guider/sulfatsnalt-schampo) om du tvättar ofta. Massera in produkten med fingertopparna, inte naglarna. Skölj ordentligt. Undvik att lägga tung styling direkt på botten om du redan upplever obehag.",
            "[Roots Schampoo](/produkter/shampoo) är formulerat med SyriCalm® för en lugnande känsla — se [SyriCalm®-guiden](/guider/syricalm).",
          ],
        },
        {
          heading: "Sport, hjälm och mössa",
          paragraphs: [
            "Hjälm, keps och mössa skapar värme och fukt. Efter träning: skölj eller tvätta när det behövs, men överdriv inte med hett vatten och dubbeltvätt varje gång. Mer i [Rutin efter träning](/guider/rutin-efter-traning).",
            "Efter svettiga pass kan det vara skönt att låta hår och hårbotten torka ordentligt innan mössa eller hjälm åker på igen. Små vanor som rena handdukar och att inte dela borstar kan också göra duschrutinen mer behaglig.",
          ],
        },
        {
          heading: "När kosmetik inte räcker",
          paragraphs: [
            "Om du har kraftig rodnad, sår, håravfall i fläckar eller besvär som inte ger med sig — kontakta vård eller hudterapeut. Roots produkter är kosmetiska och ersätter inte medicinsk bedömning.",
            "Vill du hellre förstå produkterna först? Börja på [Produkter](/produkter) eller [Naturlig hårvård i Norden](/guider/naturlig-harvard-norden).",
          ],
        },
        {
          heading: "Låt rutinen vara enkel att hålla",
          paragraphs: [
            "Många byter produkter för snabbt när hårbotten känns annorlunda en dag. Prova i stället att justera en sak i taget: mindre produktmängd, ordentlig sköljning eller lite lägre vattentemperatur. Det gör det lättare att förstå vad som känns bra för just dig.",
            "Kosmetisk hårvård har en tydlig men begränsad roll: den kan bidra till en ren och behaglig vardagsrutin. Den ska inte användas för att självdiagnostisera eller behandla medicinska besvär. Läs [Sulfatsnålt schampo](/guider/sulfatsnalt-schampo) om du vill fördjupa dig i mild rengöring.",
            "Om du provar en ny rutin, ge den lite tid och skriv gärna ned vad du ändrat. Då slipper du blanda ihop effekten av schampo, styling, väder och träningsmängd på en gång.",
          ],
        },
      ],
      faqs: [
        {
          question: "Kan schampo bota mjäll?",
          answer:
            "Vi lovar inte medicinska resultat. Vid ihållande mjällbesvär bör du rådgöra med apotek eller vård — kosmetisk vård kan kännas skonsam men är inte behandling.",
        },
        {
          question: "Hur ofta ska jag tvätta hårbotten?",
          answer:
            "Det varierar med hårtyp, träning och klimat. Många som tränar ofta tvättar oftare — då blir milda tvättämnen särskilt viktiga.",
        },
      ],
      cta: { href: "/produkter", label: "Utforska produkterna" },
    },
    en: {
      title: "Scalp in balance — kind language, honest habits",
      description:
        "A calm guide to scalp care: gentle washing, less everyday irritation and when you should seek help beyond cosmetics.",
      sections: [
        {
          heading: "The scalp is skin",
          paragraphs: [
            "The scalp is skin with hair follicles — it is affected by the same things as the face: washing, sweat, cold, hats and products. That it “itches sometimes” or feels tight after a harsh shampoo wash is common, but it does not automatically mean disease.",
            "The goal of a good routine is comfort and balance, not chasing medical diagnoses in the bathroom cabinet.",
          ],
        },
        {
          heading: "Habits that often help",
          paragraphs: [
            "Choose a [low-sulphate shampoo](/guider/sulfatsnalt-schampo) if you wash often. Massage the product in with fingertips, not nails. Rinse thoroughly. Avoid putting heavy styling straight on the scalp if you already feel discomfort.",
            "[Roots Schampoo](/produkter/shampoo) is formulated with SyriCalm® for a soothing feel — see the [SyriCalm® guide](/guider/syricalm).",
          ],
        },
        {
          heading: "Sport, helmet and hat",
          paragraphs: [
            "Helmet, cap and hat create heat and moisture. After training: rinse or wash when needed, but do not overdo hot water and double washing every time. More in [Routine after training](/guider/rutin-efter-traning).",
            "After sweaty sessions it can feel good to let hair and scalp dry properly before hat or helmet go back on. Small habits like clean towels and not sharing brushes can also make the shower routine more pleasant.",
          ],
        },
        {
          heading: "When cosmetics are not enough",
          paragraphs: [
            "If you have strong redness, sores, patchy hair loss or issues that do not ease — contact healthcare or a skin therapist. Roots products are cosmetic and do not replace medical assessment.",
            "Prefer to understand the products first? Start at [Products](/produkter) or [Natural hair care in the Nordics](/guider/naturlig-harvard-norden).",
          ],
        },
        {
          heading: "Keep the routine easy to stick with",
          paragraphs: [
            "Many switch products too quickly when the scalp feels different one day. Instead try adjusting one thing at a time: less product, thorough rinsing or slightly lower water temperature. That makes it easier to understand what feels good for you.",
            "Cosmetic hair care has a clear but limited role: it can support a clean, pleasant everyday routine. It should not be used to self-diagnose or treat medical issues. Read [Low-sulphate shampoo](/guider/sulfatsnalt-schampo) if you want to go deeper on gentle cleansing.",
            "If you try a new routine, give it a little time and note what you changed. Then you avoid mixing up the effect of shampoo, styling, weather and training volume all at once.",
          ],
        },
      ],
      faqs: [
        {
          question: "Can shampoo cure dandruff?",
          answer:
            "We do not promise medical results. For persistent dandruff, consult a pharmacy or healthcare — cosmetic care can feel gentle but is not treatment.",
        },
        {
          question: "How often should I wash my scalp?",
          answer:
            "It varies with hair type, training and climate. Many who train often wash more often — then milder surfactants become especially important.",
        },
      ],
      cta: { href: "/produkter", label: "Explore the products" },
    },
    relatedSlugs: [
      "syricalm",
      "sulfatsnalt-schampo",
      "rutin-efter-traning",
    ],
  },
  {
    slug: "sulfatsnalt-schampo",
    publishedAt: "2026-04-12",
    updatedAt: "2026-08-01",
    category: "harvard",
    heroImage: "/images/sport-schampoo-lifestyle.jpg",
    sv: {
      title: "Sulfatsnålt schampo — vad det betyder på riktigt",
      description:
        "En begriplig förklaring av sulfatsnål hårvård: varför många väljer mildare tvättämnen, och hur Roots Schampoo är tänkt att kännas.",
      sections: [
        {
          heading: "Vad är sulfater i schampo?",
          paragraphs: [
            "Sulfater (t.ex. SLS/SLES) är kraftfulla tensider som skapar mycket lödder och effektiv avfettning. De är vanliga — men kan lämna hår och hårbotten med en torr eller stram känsla, särskilt om du tvättar ofta.",
            "”Sulfatsnålt” betyder att formuleringen prioriterar mildare tvättämnen och undviker den hårdaste sulfatprofilen. Det är ett kosmetiskt val kring komfort, inte ett medicinskt påstående.",
          ],
        },
        {
          heading: "Sockerbaserade tvättämnen",
          paragraphs: [
            "I [Roots Schampoo](/produkter/shampoo) används bland annat sockerbaserade och andra milda tensider för att lösa smuts och fett utan att känslan ska bli ”skurad”. Målet är rent, lätt hår och en hårbotten som får vara i ro.",
            "Tillsammans med [SyriCalm®](/guider/syricalm) blir helheten: rengöring + behaglig känsla.",
          ],
        },
        {
          heading: "Vem har mest nytta av sulfatsnålt?",
          paragraphs: [
            "Du som tvättar ofta efter träning, du som upplever att vanliga schampon lämnar håret elet, och du som vill ha en mer återhållsam vardagsrutin. Det ersätter inte specialschampo som förskrivits av vården.",
            "Komplettera gärna med [balsam](/produkter/conditioner) för längderna — se [MultiMoist / fukt](/guider/multimoist).",
          ],
        },
        {
          heading: "Så testar du i praktiken",
          paragraphs: [
            "Ge en ny rutin ett par veckor. Anpassa mängd efter hårets längd. Skölj ordentligt. Notera känslan dag 1 och dag 14 — inte bara lodret i duschen.",
            "Handla via din förenings shop eller läs mer på [Produkter](/produkter). Aktuellt pris syns på produktsidan.",
          ],
        },
        {
          heading: "Milt betyder inte att det inte rengör",
          paragraphs: [
            "Ett schampo behöver fortfarande lösa upp vardagens svett, talg och stylingrester. Skillnaden ligger i hur formulan är sammansatt och vilken känsla den lämnar efteråt. En mildare profil kan passa bra för regelbunden tvätt, men mängd, sköljning och egen hårtyp spelar alltid in.",
            "Använd tillräckligt med vatten innan du applicerar schampot och massera lugnt i hårbotten. Längderna får ofta rengöring när skummet sköljs ur. Avsluta med [Roots Conditioner](/produkter/conditioner) om ditt hår mår bra av mer följsamhet, eller läs [hårbotten i balans](/guider/harbotten) för fler vardagsvanor.",
            "Det är helt rimligt att anpassa efter säsong. Efter många träningspass eller dagar med styling kan håret behöva mer rengöring än under en lugn ledighet, medan upplevelsen ändå kan vara mjuk och behaglig.",
          ],
        },
      ],
      faqs: [
        {
          question: "Är sulfatfritt alltid bättre?",
          answer:
            "Inte nödvändigtvis för alla. Det handlar om vad din hårbotten och ditt hår tål, och hur ofta du tvättar. Sulfatsnålt är ett skonsamt vardagsval för många — inte en universell sanning.",
        },
        {
          question: "Ger mildare schampo mindre lödder?",
          answer:
            "Ibland, ja. Lödder är inte samma sak som renhet. Många vänjer sig snabbt vid en krämigare, mindre ”skummig” känsla.",
        },
      ],
      cta: { href: "/produkter/shampoo", label: "Till Roots Schampoo" },
    },
    en: {
      title: "Low-sulphate shampoo — what it really means",
      description:
        "A clear explanation of low-sulphate hair care: why many choose milder surfactants, and how Roots Schampoo is meant to feel.",
      sections: [
        {
          heading: "What are sulphates in shampoo?",
          paragraphs: [
            "Sulphates (e.g. SLS/SLES) are powerful surfactants that create a lot of lather and effective degreasing. They are common — but can leave hair and scalp with a dry or tight feel, especially if you wash often.",
            "“Low-sulphate” means the formula prioritises milder surfactants and avoids the harshest sulphate profile. It is a cosmetic choice around comfort, not a medical claim.",
          ],
        },
        {
          heading: "Sugar-based surfactants",
          paragraphs: [
            "In [Roots Schampoo](/produkter/shampoo) sugar-based and other mild surfactants are used among other things to lift dirt and oil without the feel becoming “scrubbed”. The goal is clean, light hair and a scalp that gets to rest.",
            "Together with [SyriCalm®](/guider/syricalm) the whole becomes: cleansing + pleasant feel.",
          ],
        },
        {
          heading: "Who benefits most from low-sulphate?",
          paragraphs: [
            "You who wash often after training, you who find ordinary shampoos leave hair squeaky, and you who want a more restrained everyday routine. It does not replace specialist shampoo prescribed by healthcare.",
            "You can pair it with [conditioner](/produkter/conditioner) for the lengths — see [MultiMoist / moisture](/guider/multimoist).",
          ],
        },
        {
          heading: "How you try it in practice",
          paragraphs: [
            "Give a new routine a couple of weeks. Adapt amount to hair length. Rinse thoroughly. Note the feel on day 1 and day 14 — not only the lather in the shower.",
            "Shop via your club's shop or read more at [Products](/produkter). Current price shows on the product page.",
          ],
        },
        {
          heading: "Mild does not mean it does not cleanse",
          paragraphs: [
            "A shampoo still needs to dissolve everyday sweat, sebum and styling residue. The difference lies in how the formula is composed and what feel it leaves afterwards. A milder profile can suit regular washing well, but amount, rinsing and your own hair type always play a part.",
            "Use enough water before you apply shampoo and massage calmly into the scalp. The lengths often get cleansed as the foam rinses out. Finish with [Roots Conditioner](/produkter/conditioner) if your hair benefits from more manageability, or read [scalp in balance](/guider/harbotten) for more everyday habits.",
            "It is entirely reasonable to adapt by season. After many training sessions or days with styling, hair may need more cleansing than during a quiet break, while the experience can still feel soft and pleasant.",
          ],
        },
      ],
      faqs: [
        {
          question: "Is sulphate-free always better?",
          answer:
            "Not necessarily for everyone. It depends on what your scalp and hair tolerate, and how often you wash. Low-sulphate is a gentle everyday choice for many — not a universal truth.",
        },
        {
          question: "Does milder shampoo give less lather?",
          answer:
            "Sometimes, yes. Lather is not the same as cleanliness. Many quickly get used to a creamier, less “foamy” feel.",
        },
      ],
      cta: { href: "/produkter/shampoo", label: "View Roots Schampoo" },
    },
    relatedSlugs: [
      "harbotten",
      "syricalm",
      "naturlig-harvard-norden",
    ],
  },
  {
    slug: "naturlig-harvard-norden",
    publishedAt: "2026-04-15",
    updatedAt: "2026-08-01",
    category: "harvard",
    heroImage: "/images/collection-1.jpg",
    sv: {
      title: "Naturlig hårvård i Norden",
      description:
        "Vad ”naturlig hårvård” betyder hos Roots: nordisk känsla, moderna aktiva, transparens — och en affärsmodell kopplad till föreningslivet.",
      sections: [
        {
          heading: "Naturlig — utan fluff",
          paragraphs: [
            "Ordet ”naturlig” används lättvindigt i skönhetsbranschen. För Roots betyder det konkreta val: sulfatsnåla tvättämnen där det passar, inga silikoner eller parabener i vår kommunikation kring sortimentet, och aktiva som [SyriCalm®](/guider/syricalm) med tydligt ursprung i vass och Poria.",
            "Vi lovar inte att allt i flaskan är ”100 % vildplockat”. Vi lovar en formulering som känns ärlig i spegeln och i omklädningsrummet.",
          ],
        },
        {
          heading: "Nordisk vardag, nordisk rutin",
          paragraphs: [
            "Kallt klimat, mössa halva året, inomhusluft och träning — nordisk vardag är hård mot hår och hud. Därför ligger fokus på balans och fukt snarare än på aggressiv ”detox” varje morgon.",
            "Se [Hårbotten i balans](/guider/harbotten) och [Rutin efter träning](/guider/rutin-efter-traning).",
          ],
        },
        {
          heading: "Föreningslivet är en del av produkten",
          paragraphs: [
            "Roots säljs genom föreningar. En del av varje köp går tillbaka till laget enligt 35 %-modellen. Det gör hårvården till mer än en flaska i duschen — den blir också ett sätt att stötta lokalt idrotts- och föreningsliv.",
            "Läs [Föreningsliv](/foreningsliv) eller [Vad är föreningsförsäljning?](/guider/foreningsforsaljning).",
          ],
        },
        {
          heading: "Så väljer du i sortimentet",
          paragraphs: [
            "Börja med [schampo](/produkter/shampoo) och [balsam](/produkter/conditioner), lägg till [body wash](/produkter/body-wash) om du vill ha samma språk på huden, eller ta [komplett paket](/produkter/paket). Priser uppdateras på produktsidorna.",
            "Nyfiken på ingredienserna? Fortsätt till [MultiMoist / Beta Vulgaris](/guider/multimoist).",
          ],
        },
        {
          heading: "Transparens före trender",
          paragraphs: [
            "Bra hårvårdskommunikation gör det lättare att fatta ett genomtänkt val. Därför beskriver Roots ingredienser och produktupplevelse med kosmetiska ord som rengöring, fukt och komfort, i stället för att låna medicinska löften. Det är också mer förenligt med hur en produkt faktiskt används i vardagen.",
            "När du väljer produkt kan du börja med din rutin, inte en etikett. [Schampo](/produkter/shampoo) passar tvättsteget, [balsam](/produkter/conditioner) kompletterar längderna och [body wash](/produkter/body-wash) hör hemma i kroppsduschen. Vill du stötta ett lag samtidigt får du den kopplingen via föreningens shop.",
            "Nordisk känsla handlar för oss även om återhållsamhet: tydliga val, få överdrifter och produkter som är lätta att använda efter vardag, arbete och träning. Läs alltid produktinformationen om du vill veta exakt vad som ingår i den rutin du väljer. Se aktuellt pris på produktsidan när du vill jämföra alternativen.",
          ],
        },
      ],
      faqs: [
        {
          question: "Är Roots ekologiskt certifierat?",
          answer:
            "Vi kommunicerar formulering och känsla utifrån våra valda ingredienser. För certifieringsfrågor — kontakta oss så hänvisar vi till aktuell produktdokumentation.",
        },
        {
          question: "Passar produkterna barn?",
          answer:
            "Sortimentet är framtaget som vardagsvård för den som tränar och duschar ofta. Vid känslig hud eller osäkerhet: följ märkning och rådfråga apotek vid behov.",
        },
      ],
      cta: { href: "/om-oss", label: "Om Roots" },
    },
    en: {
      title: "Natural hair care in the Nordics",
      description:
        "What “natural hair care” means at Roots: Nordic feel, modern actives, transparency — and a business model tied to club fundraising.",
      sections: [
        {
          heading: "Natural — without fluff",
          paragraphs: [
            "The word “natural” is used lightly in beauty. For Roots it means concrete choices: low-sulphate surfactants where they fit, no silicones or parabens in how we talk about the range, and actives like [SyriCalm®](/guider/syricalm) with a clear origin in reed and Poria.",
            "We do not promise that everything in the bottle is “100% wild-harvested”. We promise a formula that feels honest in the mirror and in the changing room.",
          ],
        },
        {
          heading: "Nordic everyday life, Nordic routine",
          paragraphs: [
            "Cold climate, hats half the year, indoor air and training — Nordic everyday life is hard on hair and skin. That is why the focus is on balance and moisture rather than aggressive “detox” every morning.",
            "See [Scalp in balance](/guider/harbotten) and [Routine after training](/guider/rutin-efter-traning).",
          ],
        },
        {
          heading: "Club fundraising is part of the product",
          paragraphs: [
            "Roots is sold through clubs. Part of every purchase goes back to the team according to the 35% model. That makes hair care more than a bottle in the shower — it also becomes a way to support local sport and community clubs.",
            "Read [For clubs](/foreningsliv) or [What is club fundraising?](/guider/foreningsforsaljning).",
          ],
        },
        {
          heading: "How you choose in the range",
          paragraphs: [
            "Start with [shampoo](/produkter/shampoo) and [conditioner](/produkter/conditioner), add [body wash](/produkter/body-wash) if you want the same language on the skin, or take the [Complete pack](/produkter/paket). Prices are updated on the product pages.",
            "Curious about the ingredients? Continue to [MultiMoist / Beta Vulgaris](/guider/multimoist).",
          ],
        },
        {
          heading: "Transparency before trends",
          paragraphs: [
            "Good hair-care communication makes it easier to make a considered choice. That is why Roots describes ingredients and product experience with cosmetic words like cleansing, moisture and comfort, instead of borrowing medical claims. It is also more consistent with how a product is actually used day to day.",
            "When you choose a product you can start from your routine, not a label. [Shampoo](/produkter/shampoo) fits the wash step, [conditioner](/produkter/conditioner) complements the lengths and [body wash](/produkter/body-wash) belongs in the body shower. If you want to support a team at the same time, you get that link via the club's shop.",
            "Nordic feel for us also means restraint: clear choices, few exaggerations and products that are easy to use after everyday life, work and training. Always read the product information if you want to know exactly what is in the routine you choose. See current prices on the product page when you want to compare options.",
          ],
        },
      ],
      faqs: [
        {
          question: "Is Roots organically certified?",
          answer:
            "We communicate formula and feel based on our chosen ingredients. For certification questions — contact us and we will point you to current product documentation.",
        },
        {
          question: "Do the products suit children?",
          answer:
            "The range is developed as everyday care for people who train and shower often. For sensitive skin or uncertainty: follow labelling and ask a pharmacy if needed.",
        },
      ],
      cta: { href: "/om-oss", label: "About Roots" },
    },
    relatedSlugs: [
      "syricalm",
      "sulfatsnalt-schampo",
      "foreningsforsaljning",
    ],
  },
  {
    slug: "rutin-efter-traning",
    publishedAt: "2026-04-18",
    updatedAt: "2026-08-01",
    category: "harvard",
    heroImage: "/images/sport-body-wash-lifestyle.jpg",
    sv: {
      title: "Hår- och hudrutin efter träning",
      description:
        "En enkel duschrutin efter träning och match: skonsam tvätt, fukt och vanor som funkar i föreningslivets tempo.",
      sections: [
        {
          heading: "Varför efter träning är ett eget kapitel",
          paragraphs: [
            "Svett, salt, solskydd, hjälm och tvätt i hast — efter träning är både hårbotten och hud mer utsatta. En bra rutin behöver vara snabb nog att faktiskt bli av, och snäll nog att orka upprepas flera gånger i veckan.",
            "Torka håret försiktigt genom att krama med handduken i stället för att gnugga hårt. Det är en enkel detalj som många upplever ger en mjukare känsla, särskilt när dusch och träning är återkommande delar av veckan.",
          ],
        },
        {
          heading: "Tre steg i duschen",
          paragraphs: [
            "1) [Body wash](/produkter/body-wash) på kroppen — krämigt lödder, ingen känsla av uttorkning. 2) [Schampo](/produkter/shampoo) i hårbotten, massera kort, skölj. 3) [Balsam](/produkter/conditioner) på längderna om håret behöver det; botten behöver sällan lika mycket.",
            "Aktuellt pris och storlekar syns på produktsidorna. Många lag säljer [komplett paket](/produkter/paket) just för den här rutinen.",
          ],
        },
        {
          heading: "Temperatur, tid och frekvens",
          paragraphs: [
            "Ljummet vatten räcker ofta. Skållhett vatten kan förstärka torrhetskänsla. Om du tränar dagligen: överväg om varje pass verkligen kräver full schampotvätt, eller om sköljning + body wash räcker vissa dagar.",
            "Mer om mild tvätt: [Sulfatsnålt schampo](/guider/sulfatsnalt-schampo). Mer om botten: [Hårbotten i balans](/guider/harbotten).",
          ],
        },
        {
          heading: "Kopplingen till laget",
          paragraphs: [
            "När hela laget pratar samma rutin blir försäljningen mer naturlig — särskilt i [fotboll](/guider/for-fotbollslag) och [ishockey](/guider/for-ishockeylag). Du delar din [personliga shop](/guider/personlig-shop), laget får sin andel, och produkten används på riktigt.",
            "Kom igång via [Föreningsliv](/foreningsliv) eller [boka demo](/kontakt?intent=demo).",
          ],
        },
        {
          heading: "Gör rutinen möjlig även på trötta dagar",
          paragraphs: [
            "Efter ett sent träningspass är det sällan rätt tillfälle för en avancerad ritual. Förbered i stället väskan med det du använder och bestäm en enkel ordning som fungerar i hallens dusch. Det viktigaste är att du lämnar träningen ren och bekväm, utan att överbehandla hår eller hud.",
            "På vilodagar kan samma produkter fortfarande vara en del av vardagen, men behovet kan se annorlunda ut. Anpassa mängd och frekvens efter din träning, ditt hår och din hud. För en sammanhållen rutin, utforska [Roots produkter](/produkter) eller [komplett paket](/produkter/paket).",
          ],
        },
      ],
      faqs: [
        {
          question: "Måste jag använda balsam efter varje träning?",
          answer:
            "Nej. Anpassa efter hårets längd och känsla. Kort hår behöver ofta mindre; långt eller färgat hår mer.",
        },
        {
          question: "Kan jag ha produkterna i väskan till hallen?",
          answer:
            "Ja, 250 ml-formatet är praktiskt i träningsväskan. Tänk på hallens regler kring glas/plast i duschen.",
        },
        {
          question: "Ersätter body wash ansiktstvätt?",
          answer:
            "Body wash är tänkt för kroppen. Ansiktet har ofta egna behov — använd det som passar din hud.",
        },
      ],
      cta: { href: "/produkter/paket", label: "Se komplett paket" },
    },
    en: {
      title: "Hair and skin routine after training",
      description:
        "A simple shower routine after training and matches: gentle cleansing, moisture and habits that work at the pace of club sport.",
      sections: [
        {
          heading: "Why after training is its own chapter",
          paragraphs: [
            "Sweat, salt, sunscreen, helmet and washing in a hurry — after training both scalp and skin are more exposed. A good routine needs to be quick enough to actually happen, and kind enough to repeat several times a week.",
            "Dry hair gently by squeezing with the towel instead of rubbing hard. It is a simple detail many find leaves a softer feel, especially when shower and training are recurring parts of the week.",
          ],
        },
        {
          heading: "Three steps in the shower",
          paragraphs: [
            "1) [Body wash](/produkter/body-wash) on the body — creamy lather, no stripped feel. 2) [Shampoo](/produkter/shampoo) on the scalp, massage briefly, rinse. 3) [Conditioner](/produkter/conditioner) on the lengths if hair needs it; the scalp rarely needs as much.",
            "Current prices and sizes show on the product pages. Many teams sell the [Complete pack](/produkter/paket) exactly for this routine.",
          ],
        },
        {
          heading: "Temperature, time and frequency",
          paragraphs: [
            "Lukewarm water is often enough. Scalding hot water can amplify a dry feel. If you train daily: consider whether every session really needs a full shampoo wash, or whether rinsing + body wash is enough some days.",
            "More on gentle washing: [Low-sulphate shampoo](/guider/sulfatsnalt-schampo). More on the scalp: [Scalp in balance](/guider/harbotten).",
          ],
        },
        {
          heading: "The link to the team",
          paragraphs: [
            "When the whole team talks the same routine, selling becomes more natural — especially in [football](/guider/for-fotbollslag) and [ice hockey](/guider/for-ishockeylag). You share your [personal shop](/guider/personlig-shop), the team gets its share, and the product is used for real.",
            "Get started through [For clubs](/foreningsliv) or [book a demo](/kontakt?intent=demo).",
          ],
        },
        {
          heading: "Make the routine possible even on tired days",
          paragraphs: [
            "After a late training session it is rarely the right time for an advanced ritual. Instead pack your bag with what you use and decide a simple order that works in the hall shower. The most important thing is that you leave training clean and comfortable, without over-treating hair or skin.",
            "On rest days the same products can still be part of everyday life, but the need may look different. Adapt amount and frequency to your training, hair and skin. For a coherent routine, explore [Roots products](/produkter) or the [Complete pack](/produkter/paket).",
          ],
        },
      ],
      faqs: [
        {
          question: "Do I have to use conditioner after every training?",
          answer:
            "No. Adapt to hair length and feel. Short hair often needs less; long or coloured hair more.",
        },
        {
          question: "Can I keep the products in the bag for the hall?",
          answer:
            "Yes, the 250 ml format is practical in a training bag. Mind hall rules around glass/plastic in the shower.",
        },
        {
          question: "Does body wash replace face wash?",
          answer:
            "Body wash is intended for the body. The face often has its own needs — use what suits your skin.",
        },
      ],
      cta: { href: "/produkter/paket", label: "See the Complete pack" },
    },
    relatedSlugs: [
      "for-fotbollslag",
      "for-ishockeylag",
      "sulfatsnalt-schampo",
    ],
  },
];

function localizeGuide(def: GuideDefinition, locale: Locale): Guide {
  const copy = def[locale];
  return {
    slug: def.slug,
    publishedAt: def.publishedAt,
    updatedAt: def.updatedAt,
    category: def.category,
    heroImage: def.heroImage,
    relatedSlugs: def.relatedSlugs,
    title: copy.title,
    description: copy.description,
    sections: copy.sections,
    faqs: copy.faqs,
    cta: copy.cta,
  };
}

export function getGuides(locale: Locale = "sv"): Guide[] {
  return guideDefinitions.map((def) => localizeGuide(def, locale));
}

export function getGuide(
  slug: string,
  locale: Locale = "sv"
): Guide | undefined {
  const def = guideDefinitions.find((g) => g.slug === slug);
  return def ? localizeGuide(def, locale) : undefined;
}

/** Swedish guides — prefer getGuides(locale) for locale-aware pages. */
export const guides: Guide[] = getGuides("sv");

export const GUIDE_SLUGS: string[] = guideDefinitions.map((g) => g.slug);
