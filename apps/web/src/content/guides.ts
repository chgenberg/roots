export type Guide = {
  slug: string;
  title: string;
  description: string;
  publishedAt: string;
  updatedAt: string;
  category: "forening" | "ingrediens" | "harvard" | "sport";
  heroImage?: string;
  sections: { heading?: string; paragraphs: string[] }[];
  faqs?: { question: string; answer: string }[];
  relatedSlugs?: string[];
  cta?: { href: string; label: string };
};

export const GUIDE_CATEGORIES: Record<
  Guide["category"],
  { label: string; description: string }
> = {
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
};

export const guides: Guide[] = [
  {
    slug: "foreningsforsaljning",
    title: "Vad är föreningsförsäljning — och varför premium hårvård?",
    description:
      "En guide till modern föreningsförsäljning: hur premium hårvård skiljer sig från godis, och varför fler klubbar väljer produkter människor faktiskt vill använda.",
    publishedAt: "2026-03-01",
    updatedAt: "2026-08-01",
    category: "forening",
    heroImage: "/images/sport-package.jpg",
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
    relatedSlugs: [
      "jamfor-godisforsaljning",
      "hur-mycket-tjanar-foreningen",
      "sa-fungerar-roots",
    ],
    cta: { href: "/foreningsliv", label: "Läs mer om föreningsliv" },
  },
  {
    slug: "sa-fungerar-roots",
    title: "Så fungerar Roots — steg för steg",
    description:
      "Från förening till lag, säljare och personlig shop: så går det till när er klubb säljer Roots.",
    publishedAt: "2026-03-01",
    updatedAt: "2026-08-01",
    category: "forening",
    heroImage: "/images/sport-hero.jpg",
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
    relatedSlugs: [
      "personlig-shop",
      "hur-mycket-tjanar-foreningen",
      "tips-till-saljare",
    ],
    cta: { href: "/sa-fungerar-det", label: "Se så fungerar det" },
  },
  {
    slug: "hur-mycket-tjanar-foreningen",
    title: "Hur mycket tjänar föreningen? 35 %-modellen förklarad",
    description:
      "Föreningen behåller 35 % av försäljningen. Här är räkneexempel, vad som ingår — och hur ni sätter realistiska mål.",
    publishedAt: "2026-03-05",
    updatedAt: "2026-08-01",
    category: "forening",
    heroImage: "/images/sport-m4.jpg",
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
    relatedSlugs: [
      "sa-fungerar-roots",
      "foreningsforsaljning",
      "jamfor-godisforsaljning",
    ],
    cta: { href: "/sa-fungerar-det", label: "Testa räknesnurran" },
  },
  {
    slug: "personlig-shop",
    title: "Personlig shopsida och QR — så funkar det",
    description:
      "Varje säljare får en egen shopsida med länk och QR-kod. Så delar ni den — och så ser köpet ut för kunden.",
    publishedAt: "2026-03-10",
    updatedAt: "2026-08-01",
    category: "forening",
    heroImage: "/images/sport-m2.jpg",
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
    relatedSlugs: [
      "tips-till-saljare",
      "sa-fungerar-roots",
      "for-fotbollslag",
    ],
    cta: { href: "/hjalp", label: "Hjälp för säljare" },
  },
  {
    slug: "tips-till-saljare",
    title: "Säljtips för ungdomar och föräldrar",
    description:
      "Praktiska, respektfulla tips för att dela din Roots-shop — utan press, utan pinsamma pitchar.",
    publishedAt: "2026-03-12",
    updatedAt: "2026-08-01",
    category: "forening",
    heroImage: "/images/sport-m1.jpg",
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
    relatedSlugs: [
      "personlig-shop",
      "hur-mycket-tjanar-foreningen",
      "jamfor-godisforsaljning",
    ],
    cta: { href: "/kontakt?intent=demo", label: "Fråga oss om er kampanj" },
  },
  {
    slug: "jamfor-godisforsaljning",
    title: "Godisförsäljning vs Roots — en ärlig jämförelse",
    description:
      "Traditionell godisförsäljning jämfört med digital försäljning av premium hårvård. Vad skiljer i tid, lager, image och intäkt?",
    publishedAt: "2026-03-15",
    updatedAt: "2026-08-01",
    category: "forening",
    heroImage: "/images/collection-2.jpg",
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
    relatedSlugs: [
      "foreningsforsaljning",
      "hur-mycket-tjanar-foreningen",
      "tips-till-saljare",
    ],
    cta: { href: "/foreningsliv", label: "Utforska föreningsliv" },
  },
  {
    slug: "for-fotbollslag",
    title: "Roots för fotbollslag",
    description:
      "Så kan fotbollslag använda Roots för cupresor, material och lagkassa — med personliga shoppar och tydlig 35 %-andel.",
    publishedAt: "2026-03-20",
    updatedAt: "2026-08-01",
    category: "sport",
    heroImage: "/images/sport-paddock.jpg",
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
    relatedSlugs: [
      "for-ishockeylag",
      "personlig-shop",
      "hur-mycket-tjanar-foreningen",
    ],
    cta: { href: "/kontakt?intent=demo", label: "Boka demo för laget" },
  },
  {
    slug: "for-ishockeylag",
    title: "Roots för ishockeylag",
    description:
      "Ishockey innebär slit, svett och täta duschar. Så kan laget samla in pengar med premiumvård — utan lager och kontanter.",
    publishedAt: "2026-03-20",
    updatedAt: "2026-08-01",
    category: "sport",
    heroImage: "/images/sport-hockey.jpg",
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
    relatedSlugs: [
      "for-fotbollslag",
      "rutin-efter-traning",
      "sa-fungerar-roots",
    ],
    cta: { href: "/foreningsliv", label: "Läs mer för föreningar" },
  },
  {
    slug: "syricalm",
    title: "SyriCalm® — Phragmites och Poria för en lugnare känsla",
    description:
      "Vad är SyriCalm® i Roots produkter? En kosmetisk guide till den nordiska aktiven av vass och svamp — utan medicinska löften.",
    publishedAt: "2026-04-01",
    updatedAt: "2026-08-01",
    category: "ingrediens",
    heroImage: "/images/sport-schampoo.jpg",
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
    relatedSlugs: [
      "harbotten",
      "multimoist",
      "naturlig-harvard-norden",
    ],
    cta: { href: "/produkter/shampoo", label: "Se Roots Schampoo" },
  },
  {
    slug: "multimoist",
    title: "MultiMoist-känsla och Beta Vulgaris — fukt som syns i spegeln",
    description:
      "Hur Beta Vulgaris (rödbetsextrakt) och fuktgivande komplex bidrar till mjukare, mer följsamt hår i Roots balsam — förklarat på kosmetiskt språk.",
    publishedAt: "2026-04-05",
    updatedAt: "2026-08-01",
    category: "ingrediens",
    heroImage: "/images/sport-conditioner.jpg",
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
    relatedSlugs: [
      "syricalm",
      "sulfatsnalt-schampo",
      "rutin-efter-traning",
    ],
    cta: { href: "/produkter/conditioner", label: "Se Roots Conditioner" },
  },
  {
    slug: "harbotten",
    title: "Hårbotten i balans — snällt språk, ärliga vanor",
    description:
      "En lugn guide till hårbottenvård: mild tvätt, mindre irritation i vardagen och när du bör söka annan hjälp än kosmetik.",
    publishedAt: "2026-04-10",
    updatedAt: "2026-08-01",
    category: "harvard",
    heroImage: "/images/schampoo-lifestyle.jpg",
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
    relatedSlugs: [
      "syricalm",
      "sulfatsnalt-schampo",
      "rutin-efter-traning",
    ],
    cta: { href: "/produkter", label: "Utforska produkterna" },
  },
  {
    slug: "sulfatsnalt-schampo",
    title: "Sulfatsnålt schampo — vad det betyder på riktigt",
    description:
      "En begriplig förklaring av sulfatsnål hårvård: varför många väljer mildare tvättämnen, och hur Roots Schampoo är tänkt att kännas.",
    publishedAt: "2026-04-12",
    updatedAt: "2026-08-01",
    category: "harvard",
    heroImage: "/images/sport-schampoo-lifestyle.jpg",
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
    relatedSlugs: [
      "harbotten",
      "syricalm",
      "naturlig-harvard-norden",
    ],
    cta: { href: "/produkter/shampoo", label: "Till Roots Schampoo" },
  },
  {
    slug: "naturlig-harvard-norden",
    title: "Naturlig hårvård i Norden",
    description:
      "Vad ”naturlig hårvård” betyder hos Roots: nordisk känsla, moderna aktiva, transparens — och en affärsmodell kopplad till föreningslivet.",
    publishedAt: "2026-04-15",
    updatedAt: "2026-08-01",
    category: "harvard",
    heroImage: "/images/collection-1.jpg",
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
    relatedSlugs: [
      "syricalm",
      "sulfatsnalt-schampo",
      "foreningsforsaljning",
    ],
    cta: { href: "/om-oss", label: "Om Roots" },
  },
  {
    slug: "rutin-efter-traning",
    title: "Hår- och hudrutin efter träning",
    description:
      "En enkel duschrutin efter träning och match: skonsam tvätt, fukt och vanor som funkar i föreningslivets tempo.",
    publishedAt: "2026-04-18",
    updatedAt: "2026-08-01",
    category: "harvard",
    heroImage: "/images/sport-body-wash-lifestyle.jpg",
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
    relatedSlugs: [
      "for-fotbollslag",
      "for-ishockeylag",
      "sulfatsnalt-schampo",
    ],
    cta: { href: "/produkter/paket", label: "Se komplett paket" },
  },
];

export function getGuide(slug: string): Guide | undefined {
  return guides.find((g) => g.slug === slug);
}

export const GUIDE_SLUGS: string[] = guides.map((g) => g.slug);
