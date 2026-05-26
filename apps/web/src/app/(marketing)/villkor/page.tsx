import { LegalIdentityBlock } from "@/components/legal-identity-block";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Köpvillkor",
  description: "Köpvillkor för Roots — ångerrätt, leverans, reklamation och mer.",
  path: "/villkor",
});

export default function VillkorPage() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-16 md:px-10 md:py-24">
      <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
        Köpvillkor
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Senast uppdaterad: 2 april 2026
      </p>

      <div className="mt-10 space-y-10 text-base leading-relaxed text-muted-foreground [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:tracking-tight [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1">
        <section>
          <h2>1. Allmänt</h2>
          <p className="mt-3">
            Dessa köpvillkor gäller för alla köp av produkter från Roots Nordic AB,
            nedan kallat &quot;Roots&quot;, &quot;vi&quot;
            eller &quot;oss&quot;. Genom att lägga en beställning godkänner du
            dessa villkor.
          </p>
          <p className="mt-2">
            För föreningsbeställningar via klubbportalen gäller dessa villkor i
            tillämpliga delar, tillsammans med eventuella separata
            föreningsavtal.
          </p>
        </section>

        <section>
          <h2>2. Priser och betalning</h2>
          <ul className="mt-3">
            <li>Alla priser anges i svenska kronor (SEK) inklusive moms.</li>
            <li>
              Eventuella fraktkostnader anges separat innan beställningen
              slutförs.
            </li>
            <li>
              Betalning sker via de betalningsmetoder som erbjuds i kassan.
            </li>
            <li>
              Det pris som visas vid beställningstillfället är det pris som
              faktureras. Eventuella prisändringar tillämpas endast för
              framtida beställningar och påverkar inte redan lagda order.
            </li>
          </ul>
        </section>

        <section>
          <h2>3. Leverans</h2>
          <ul className="mt-3">
            <li>Vi levererar inom Sverige.</li>
            <li>Normal leveranstid är 2–5 arbetsdagar.</li>
            <li>Fri frakt vid beställningar över 500 kr.</li>
            <li>
              Vi ansvarar för varan tills du tagit emot den. Vid eventuell
              skada under transport — kontakta oss omgående.
            </li>
          </ul>
        </section>

        <section>
          <h2>4. Ångerrätt</h2>
          <p className="mt-3">
            Enligt distansavtalslagen har du som konsument <strong className="text-foreground">14 dagars
            ångerrätt</strong> från det att du mottagit varan. Ångerrätten
            innebär att du kan returnera varan utan att ange något skäl.
          </p>
          <p className="mt-2">
            För att utöva ångerrätten, kontakta oss på{" "}
            <a href="mailto:hej@roots.se" className="underline hover:text-foreground">
              hej@roots.se
            </a>{" "}
            inom 14 dagar. Du kan också använda{" "}
            <a
              href="https://publikationer.konsumentverket.se/kontrakt-och-mallar/standardformular-for-utovande-av-angerratten"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              Konsumentverkets standardformulär för utövande av ångerrätten
            </a>
            . Du ansvarar själv för fraktkostnaden vid retur.
          </p>
          <p className="mt-2">
            <strong className="text-foreground">Undantag:</strong> Ångerrätten
            gäller inte för varor som av hälso- eller hygienskäl har brutits
            försegling på, t.ex. öppnade förpackningar av schampo, balsam eller
            body wash.
          </p>
        </section>

        <section>
          <h2>5. Reklamation</h2>
          <p className="mt-3">
            Du har <strong className="text-foreground">3 års reklamationsrätt</strong> enligt
            konsumentköplagen. Om en vara är felaktig ska du reklamera inom
            rimlig tid efter att du upptäckt felet. Kontakta oss på{" "}
            <a href="mailto:hej@roots.se" className="underline hover:text-foreground">
              hej@roots.se
            </a>{" "}
            med ordernummer och beskrivning av felet.
          </p>
          <p className="mt-2">
            Vid godkänd reklamation erbjuder vi i första hand ersättningsprodukt,
            i andra hand återbetalning.
          </p>
        </section>

        <section>
          <h2>6. Orderbekräftelse</h2>
          <p className="mt-3">
            Vid genomförd beställning skickas en orderbekräftelse till din
            e-postadress. Kontrollera att uppgifterna stämmer. Kontakta oss
            omgående om något är felaktigt.
          </p>
        </section>

        <section>
          <h2>7. Personuppgifter</h2>
          <p className="mt-3">
            Vi behandlar dina personuppgifter i enlighet med GDPR och vår{" "}
            <a href="/integritet" className="underline hover:text-foreground">
              integritetspolicy
            </a>
            .
          </p>
        </section>

        <section>
          <h2>8. Force majeure</h2>
          <p className="mt-3">
            Roots ansvarar inte för förseningar orsakade av omständigheter
            utanför vår kontroll, såsom naturkatastrofer, pandemier,
            strejk, myndighetsbeslut eller andra force majeure-händelser.
          </p>
        </section>

        <section>
          <h2>9. Tvist</h2>
          <p className="mt-3">
            Vi följer Allmänna Reklamationsnämndens (ARN) rekommendationer. Vid
            tvist som vi inte kan lösa direkt kan du vända dig till:
          </p>
          <ul className="mt-3">
            <li>
              <strong className="text-foreground">ARN</strong> —{" "}
              <a
                href="https://www.arn.se"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-foreground"
              >
                www.arn.se
              </a>
            </li>
            <li>
              <strong className="text-foreground">EU:s plattform för tvistlösning online</strong> —{" "}
              <a
                href="https://ec.europa.eu/consumers/odr"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-foreground"
              >
                ec.europa.eu/consumers/odr
              </a>
            </li>
          </ul>
          <p className="mt-3">
            Svensk lag tillämpas på alla köp.
          </p>
        </section>

        <section>
          <h2>10. Kontaktuppgifter</h2>
          <div className="mt-3">
            <LegalIdentityBlock variant="block" showContact className="not-italic leading-relaxed text-muted-foreground" />
          </div>
        </section>
      </div>
    </article>
  );
}
