import type { Locale } from "@/i18n/config";

type ClubCopy = {
  sport: string;
  summary: string;
  body: string[];
  facts: string[];
};

export type ClubLogo = {
  slug: string;
  name: string;
  town: string;
  logo: string;
  width: number;
  height: number;
  website: string;
  copy: Record<Locale, ClubCopy>;
};

/**
 * Klubbar som godkänt att synas på sajten. Lägg bara till klubbar som sagt ja.
 * Texterna bygger på klubbarnas egna webbplatser (hämtade oktober 2026).
 */
export const connectedClubs: ClubLogo[] = [
  {
    slug: "harnosands-racketklubb",
    name: "Härnösands Racketklubb",
    town: "Härnösand",
    logo: "/images/klubbar/harnosands-racketklubb.png",
    width: 462,
    height: 480,
    website: "https://harnosandsracketklubb.se/",
    copy: {
      sv: {
        sport: "Tennis, badminton och fler racketsporter",
        summary:
          "En racketklubb som både fyller och äger sin egen anläggning, Öbacka Sportcenter i Härnösand.",
        body: [
          "Härnösands Racketklubb bildades 2021 när VåRö Tennisklubb och Badmintonklubben gick ihop. I dag samlar klubben tennis, badminton, bordtennis, padel, pickleball och touchtennis under samma tak.",
          "Det som gör klubben lite annorlunda är att medlemmarna äger hallen. En anställd tennistränare och ett stort gäng ideella driver träningar, kurser och tävlingar, från Racketskolan för de minsta till klubbmästerskap och VåRö Open.",
        ],
        facts: [
          "Äger och driver Öbacka Sportcenter",
          "Racketskola för barn 4–9 år",
          "Juniorträning i tennis och badminton",
          "Kurser för vuxna, från nybörjare till avancerad",
        ],
      },
      en: {
        sport: "Tennis, badminton and more racket sports",
        summary:
          "A racket club that both fills and owns its own venue, Öbacka Sportcenter in Härnösand.",
        body: [
          "Härnösands Racketklubb was formed in 2021 when VåRö Tennisklubb and the local badminton club merged. Today the club brings tennis, badminton, table tennis, padel, pickleball and touch tennis together under one roof.",
          "What sets the club apart is that the members own the hall. A full-time tennis coach and a large group of volunteers run training, courses and tournaments, from the racket school for the youngest to the club championships and VåRö Open.",
        ],
        facts: [
          "Owns and runs Öbacka Sportcenter",
          "Racket school for children aged 4–9",
          "Junior training in tennis and badminton",
          "Adult courses from beginner to advanced",
        ],
      },
    },
  },
  {
    slug: "sundsvalls-tennisklubb",
    name: "Sundsvalls Tennisklubb",
    town: "Sundsvall",
    logo: "/images/klubbar/sundsvalls-tennisklubb.png",
    width: 480,
    height: 201,
    website: "https://www.baldershallen.se/stk/start",
    copy: {
      sv: {
        sport: "Tennis och padel",
        summary:
          "En av Sveriges äldsta tennisklubbar, grundad 1921, med hemmaplan i Baldershallen.",
        body: [
          "Sundsvalls Tennisklubb är en tennis- och padelklubb för alla, oavsett ålder och ambition. Här finns allt från tennisskola för barn till träningsgrupper för vuxna och spelare som vill tävla.",
          "Klubben äger Baldershallen vid Baldershovs idrottsplats, en av landets största racket- och idrottshallar. Där finns sex tennisbanor och tre padelbanor, och hallen är byggd som en mötesplats där barn och unga kan träna, plugga och umgås.",
        ],
        facts: [
          "Grundad 1921",
          "Äger Baldershallen med 6 tennis- och 3 padelbanor",
          "Tennisskola från 4 år: Multiskills, Mini, Midi och Maxi",
          "Arrangerar tävlingar som SO-Tour och Vintertouren",
        ],
      },
      en: {
        sport: "Tennis and padel",
        summary:
          "One of Sweden's oldest tennis clubs, founded in 1921, with Baldershallen as its home.",
        body: [
          "Sundsvalls Tennisklubb is a tennis and padel club for everyone, whatever their age or ambition. It runs everything from a tennis school for children to training groups for adults and competitive players.",
          "The club owns Baldershallen at Baldershov sports ground, one of the country's largest racket and sports halls. It has six tennis courts and three padel courts, and is built as a meeting place where children and young people can train, study and hang out.",
        ],
        facts: [
          "Founded in 1921",
          "Owns Baldershallen with 6 tennis and 3 padel courts",
          "Tennis school from age 4: Multiskills, Mini, Midi and Maxi",
          "Hosts tournaments such as SO-Tour and Vintertouren",
        ],
      },
    },
  },
  {
    slug: "brunflo-ik",
    name: "Brunflo IK",
    town: "Brunflo",
    logo: "/images/klubbar/brunflo-ik.png",
    width: 318,
    height: 317,
    website: "https://www.brunfloik.se/",
    copy: {
      sv: {
        sport: "Ishockey",
        summary: "Ishockeyförening i Brunflo utanför Östersund, bildad 1975.",
        body: [
          "Brunflo IK är ortens hockeyklubb och har sin hemmais i Klanghallen. Föreningen lägger stor vikt vid ungdomshockeyn, så att barn och unga kan spela i Brunflo hela vägen upp.",
          "Varje säsong driver klubben Tre Kronors Hockeyskola för barn som vill lära sig åka skridskor och prova på ishockey, med certifierade ledare och fika efter träningen. Nu bygger klubben också ett U18-lag så att de äldsta juniorerna kan fortsätta spela tillsammans.",
        ],
        facts: [
          "Bildad 1975",
          "Hemmais i Klanghallen, Brunflo",
          "Tre Kronors Hockeyskola för de yngsta",
          "Bygger ett U18-lag för spelare födda 2009–2010",
        ],
      },
      en: {
        sport: "Ice hockey",
        summary: "Ice hockey club in Brunflo outside Östersund, founded in 1975.",
        body: [
          "Brunflo IK is the town's hockey club, with Klanghallen as its home rink. The club puts youth hockey first, so that children and teenagers can keep playing in Brunflo all the way up.",
          "Every season the club runs Tre Kronors Hockeyskola for children who want to learn to skate and try ice hockey, with certified coaches and a snack after practice. The club is now also building an U18 team so that its oldest juniors can keep playing together.",
        ],
        facts: [
          "Founded in 1975",
          "Home rink: Klanghallen, Brunflo",
          "Tre Kronors Hockeyskola for the youngest",
          "Building an U18 team for players born 2009–2010",
        ],
      },
    },
  },
  {
    slug: "ornskoldsviks-tennisklubb",
    name: "Örnsköldsviks Tennisklubb",
    town: "Örnsköldsvik",
    logo: "/images/klubbar/ornskoldsviks-tennisklubb.png",
    width: 444,
    height: 441,
    website: "https://www.oviktk.se/",
    copy: {
      sv: {
        sport: "Tennis",
        summary:
          "Utsedd till Årets idrottsförening i Sverige 2024 av Folkspel och Riksidrottsförbundet.",
        body: [
          "Öviks Tennisklubb grundades 1984 och har sedan dess drivit tennisens utveckling i Örnsköldsvik. Klubben har verksamhet för alla åldrar och nivåer, från nybörjare till tävlingsspelare, och jobbar medvetet med en god värdegrund och trygga idrottsmiljöer.",
          "Klubben håller till i Mattsborgens tennishall i Domsjö med fyra inomhusbanor och tre grusbanor utomhus. Där finns tennisskola, motions- och tävlingsträning, läger, seriespel och samarbete med skolor.",
        ],
        facts: [
          "Grundad 1984",
          "Årets idrottsförening i Sverige 2024",
          "Mattsborgens tennishall: 4 inne- och 3 utebanor",
          "Tennisskola, läger, seriespel och skolsamverkan",
        ],
      },
      en: {
        sport: "Tennis",
        summary:
          "Named Sweden's Sports Club of the Year 2024 by Folkspel and the Swedish Sports Confederation.",
        body: [
          "Öviks Tennisklubb was founded in 1984 and has driven the growth of tennis in Örnsköldsvik ever since. The club has activities for all ages and levels, from beginners to competitive players, and works deliberately on shared values and safe sports environments.",
          "The club is based at Mattsborgen tennis hall in Domsjö, with four indoor courts and three outdoor clay courts. It runs a tennis school, recreational and competitive training, camps, league play and partnerships with schools.",
        ],
        facts: [
          "Founded in 1984",
          "Sweden's Sports Club of the Year 2024",
          "Mattsborgen tennis hall: 4 indoor and 3 outdoor courts",
          "Tennis school, camps, league play and school partnerships",
        ],
      },
    },
  },
  {
    slug: "vannas-ryttarforening",
    name: "Vännäs Ryttarförening",
    town: "Vännäs",
    logo: "/images/klubbar/vannas-ryttarforening.png",
    width: 304,
    height: 315,
    website: "https://vannasrf.com/",
    copy: {
      sv: {
        sport: "Ridsport",
        summary:
          "En inkluderande ridklubb med ridskola, tävlingsridning och cirka 400 medlemmar.",
        body: [
          "Vännäs Ryttarförening har funnits sedan 1980 och håller till på Norrmalm, strax utanför Vännäs intill Umeälven. Anläggningen har två ridhus, flera stall, hagar och utebanor, och nära till ridslingorna på tallheden i Pengfors.",
          "Ridskolan är basen i föreningen, med omkring 125 ridande elever och 14 hästar och ponnier. Här finns Hästis för de minsta, nybörjargrupper för barn och vuxna, satsningsgrupper i dressyr och hoppning och anpassad ridning. Föreningen har också tävlingsryttare, western och working equitation.",
        ],
        facts: [
          "Grundad 1980, cirka 400 medlemmar",
          "Ridskola med 14 hästar och ponnier",
          "Hästis för barn 4–6 år och anpassad ridning",
          "Hoppning, dressyr, western och working equitation",
        ],
      },
      en: {
        sport: "Equestrian",
        summary:
          "An inclusive riding club with a riding school, competition riding and around 400 members.",
        body: [
          "Vännäs Ryttarförening has existed since 1980 and is based at Norrmalm, just outside Vännäs by the Ume river. The facility has two indoor arenas, several stables, paddocks and outdoor arenas, close to the riding trails in Pengfors.",
          "The riding school is the heart of the club, with around 125 riders and 14 horses and ponies. There are pony sessions for the youngest, beginner groups for children and adults, dressage and jumping groups and adapted riding. The club also has competition riders, western and working equitation.",
        ],
        facts: [
          "Founded in 1980, around 400 members",
          "Riding school with 14 horses and ponies",
          "Pony sessions for ages 4–6 and adapted riding",
          "Jumping, dressage, western and working equitation",
        ],
      },
    },
  },
  {
    slug: "umea-ryttarforening",
    name: "Umeå Ryttarförening",
    town: "Umeå",
    logo: "/images/klubbar/umea-ryttarforening.png",
    width: 475,
    height: 480,
    website: "https://www.hippologum.se/",
    copy: {
      sv: {
        sport: "Ridsport",
        summary:
          "En av Sveriges större ridklubbar, med cirka 750 medlemmar och rötter tillbaka till 1925.",
        body: [
          "Umeå Ryttarförening håller till på Hippologum, fem kilometer utanför Umeå, med ridterräng runt knuten. Historien börjar 1925 med Umeå Fältrittarklubb på K4, och 1967 bildades föreningen som den heter i dag.",
          "Ridskolan tar ryttare från nybörjare till avancerade hopp- och dressyrgrupper, och här finns också anpassad ridning och voltige. Föreningen samarbetar med Forslundagymnasiet och har en aktiv tävlingssektion i hoppning, dressyr och körning, som gör den till en av landets flitigaste tävlingsarrangörer.",
        ],
        facts: [
          "Cirka 750 medlemmar",
          "Anläggningen Hippologum utanför Umeå",
          "Ridskola, anpassad ridning och voltige",
          "Tävlingar i hoppning, dressyr och körning",
        ],
      },
      en: {
        sport: "Equestrian",
        summary:
          "One of Sweden's larger riding clubs, with around 750 members and roots going back to 1925.",
        body: [
          "Umeå Ryttarförening is based at Hippologum, five kilometres outside Umeå, with riding trails right on the doorstep. Its history starts in 1925 with Umeå Fältrittarklubb at the K4 regiment, and the club took its current name in 1967.",
          "The riding school takes riders from beginners to advanced jumping and dressage groups, alongside adapted riding and vaulting. The club works with Forslundagymnasiet and has an active competition section in jumping, dressage and driving, making it one of the country's busiest competition organisers.",
        ],
        facts: [
          "Around 750 members",
          "Hippologum facility outside Umeå",
          "Riding school, adapted riding and vaulting",
          "Competitions in jumping, dressage and driving",
        ],
      },
    },
  },
];

export function getClub(slug: string): ClubLogo | undefined {
  return connectedClubs.find((c) => c.slug === slug);
}
