// All UI-text som flödena tappar/skriver, samt titelkort-copy, per språk.
// Byt locale-argument för att spela in fler språk — matcha specialtecken exakt.

export const L10N = {
  sv: {
    // Inloggning
    login: {
      emailSel: "#email",
      passwordSel: "#password",
      submit: "Logga in",
    },
    // Mobil-navigering
    nav: {
      open: "Öppna meny",
    },
    // Textremsor per roll (overlay nedtill, kort)
    captions: {
      seller: {
        loginSubmit: "Logga in",
        dashboardShown: "Allt på ett ställe",
        shareShown: "Din egen länk + QR",
        shareTapped: "Dela på en sekund",
        orderRegistered: "Sålt på dörren? Två tap.",
        statsShown: "Se din kurva växa",
      },
      forening: {
        loginSubmit: "Logga in",
        dashboardShown: "Översikt direkt",
        campaignFormFilled: "Ny kampanj på minuter",
        campaignCreated: "Aktiv direkt",
        teamsShown: "Bjud in lagen",
        settlementShown: "Pengarna räknas åt er",
      },
      lag: {
        loginSubmit: "Logga in",
        dashboardShown: "Lagets läge direkt",
        inviteShown: "En länk till spelarna",
        importShown: "Importera hela laget",
        broadcastSent: "Peppa hela laget",
        statsShown: "Följ topplistan",
      },
      calculator: {
        calcShown: "Räkna på er förtjänst",
        valuesSet: "Dra i reglagen",
        earningsShown: "Se förtjänsten direkt",
        goalShown: "Hur långt når ni mot målet?",
      },
    },
    // Titelkort (intro/outro) + desktop-sidotext
    titles: {
      seller: {
        kicker: "SÄLJARE",
        intro: ["Din egen shop.", "På 30 sekunder."],
        outro: ["Du säljer.", "Föreningen tjänar."],
        side: "Sälj med Roots",
        sideSub: "En länk. En QR-kod. Rakt in i kassan.",
      },
      forening: {
        kicker: "FÖRENING",
        intro: ["Hela föreningen.", "Ett verktyg."],
        outro: ["Allt i realtid.", "Pengar till kassan."],
        side: "Starta en kampanj",
        sideSub: "På minuter — inte veckor.",
      },
      lag: {
        kicker: "LAGLEDARE",
        intro: ["Led laget.", "Mindre krångel."],
        outro: ["Mindre admin.", "Mer försäljning."],
        side: "Coacha laget",
        sideSub: "Bjud in, peppa, följ topplistan.",
      },
      calculator: {
        kicker: "FÖR FÖRENINGAR",
        intro: ["Se vad ni", "kan tjäna."],
        outro: ["Räkna själva.", "Kom igång idag."],
        side: "Räkna på förtjänsten",
        sideSub: "Dra i reglagen — se förtjänsten direkt.",
      },
    },
  },
};

export function t(locale) {
  return L10N[locale] || L10N.sv;
}
