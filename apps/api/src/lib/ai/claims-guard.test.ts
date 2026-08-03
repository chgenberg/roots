import { describe, it, expect } from "vitest";
import {
  checkMedicalClaims,
  createClaimsStreamFilter,
} from "./claims-guard";

describe("checkMedicalClaims", () => {
  const blocked = [
    "Vårt schampo botar mjäll effektivt.",
    "Produkten behandlar eksem och psoriasis.",
    "Den tar bort svamp i hårbotten.",
    "Eksem behandlas bäst med vår conditioner.",
    "Det är kliniskt bevisad effekt mot håravfall.",
    "Du verkar ha seborroisk dermatit.",
    "Schampot förebygger håravfall.",
  ];

  for (const text of blocked) {
    it(`blockerar: ${text}`, () => {
      expect(checkMedicalClaims(text).ok).toBe(false);
    });
  }

  const allowed = [
    "Schampot är gjort för torr hårbotten och innehåller aloe vera.",
    "Har du känslig hud rekommenderar vi att du testar på en liten yta först.",
    "Balsamet gör håret mjukare och lättare att kamma.",
    "Vi har tre produkter: schampo, balsam och body wash.",
    "En flaska räcker ungefär två månader vid normal användning.",
    "Om du har problem med hårbotten är det bäst att prata med en frisör.",
  ];

  for (const text of allowed) {
    it(`släpper igenom: ${text}`, () => {
      expect(checkMedicalClaims(text).ok).toBe(true);
    });
  }

  it("hanterar tom sträng", () => {
    expect(checkMedicalClaims("").ok).toBe(true);
  });
});

describe("createClaimsStreamFilter", () => {
  it("håller tillbaka text till meningsslut", () => {
    const filter = createClaimsStreamFilter();
    expect(filter.push("Schampot ").emit).toBe("");
    expect(filter.push("är milt").emit).toBe("");
    const done = filter.push(". Nästa");
    expect(done.emit).toBe("Schampot är milt. ");
    expect(filter.flush().emit).toBe("Nästa");
  });

  it("blockerar innan ett påstående hinner ut", () => {
    const filter = createClaimsStreamFilter();
    expect(filter.push("Det botar mjäll").emit).toBe("");
    const result = filter.push(" helt. ");
    expect(result.blocked).toBe(true);
    expect(result.emit).toBe("");
  });

  it("förblir blockerad efter första träffen", () => {
    const filter = createClaimsStreamFilter();
    filter.push("Produkten behandlar eksem. ");
    expect(filter.push("Helt ofarligt. ").blocked).toBe(true);
    expect(filter.flush().blocked).toBe(true);
  });

  it("granskar även svansen utan avslutande punkt", () => {
    const filter = createClaimsStreamFilter();
    filter.push("Ja");
    expect(filter.push(", det botar psoriasis").emit).toBe("");
    expect(filter.flush().blocked).toBe(true);
  });
});
