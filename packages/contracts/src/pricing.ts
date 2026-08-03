/**
 * En enda sanning för moms och avrundning.
 *
 * Tidigare räknades momsen på tre olika sätt: `total - total / 1.25` per
 * orderrad i kassan, samma formel på ordertotalen i orderbekräftelsen, och
 * `total * 25 / 125` i kassa-UI:t. De skiljer sig på ören, vilket räcker för
 * att kunden ser en summa, Klarna får en annan och bokföringen en tredje.
 *
 * Alla priser på Roots är angivna INKLUSIVE moms. Momsen räknas därför ut
 * baklänges ur bruttobeloppet, per rad, och ordertotalens moms är summan av
 * radernas — annars stämmer inte Klarnas radspecifikation mot totalen.
 */

/** Svensk standardmoms i basenheter (2500 = 25,00 %), Klarnas format. */
export const VAT_RATE_BASIS_POINTS = 2500;

/** 25 % → 0,25. */
export const VAT_RATE = VAT_RATE_BASIS_POINTS / 10000;

/** Momsdelen av ett bruttobelopp i öre. */
export function vatOfGrossOre(grossOre: number): number {
  return Math.round(
    (grossOre * VAT_RATE_BASIS_POINTS) / (10000 + VAT_RATE_BASIS_POINTS)
  );
}

/** Bruttobelopp minus moms, i öre. */
export function exVatOre(grossOre: number): number {
  return grossOre - vatOfGrossOre(grossOre);
}

/**
 * Momsen för en hel order: summan av radernas moms, inte momsen på totalen.
 * Skillnaden är några ören men den är systematisk, och det är den som gör
 * att radspecifikationen inte summerar till totalen.
 */
export function vatOfLinesOre(grossLineTotalsOre: number[]): number {
  return grossLineTotalsOre.reduce((sum, line) => sum + vatOfGrossOre(line), 0);
}
