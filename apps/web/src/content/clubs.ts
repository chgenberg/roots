export type ClubLogo = {
  name: string;
  town: string;
  logo: string;
  width: number;
  height: number;
};

/** Klubbar som godkänt att synas på sajten. Lägg bara till klubbar som sagt ja. */
export const connectedClubs: ClubLogo[] = [
  {
    name: "Härnösands Racketklubb",
    town: "Härnösand",
    logo: "/images/klubbar/harnosands-racketklubb.png",
    width: 462,
    height: 480,
  },
  {
    name: "Sundsvalls Tennisklubb",
    town: "Sundsvall",
    logo: "/images/klubbar/sundsvalls-tennisklubb.png",
    width: 480,
    height: 201,
  },
  {
    name: "Brunflo IK",
    town: "Brunflo",
    logo: "/images/klubbar/brunflo-ik.png",
    width: 318,
    height: 317,
  },
  {
    name: "Örnsköldsviks Tennisklubb",
    town: "Örnsköldsvik",
    logo: "/images/klubbar/ornskoldsviks-tennisklubb.png",
    width: 444,
    height: 441,
  },
  {
    name: "Vännäs Ryttarförening",
    town: "Vännäs",
    logo: "/images/klubbar/vannas-ryttarforening.png",
    width: 304,
    height: 315,
  },
];
