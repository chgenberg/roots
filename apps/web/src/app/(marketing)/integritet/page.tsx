import { LegalIdentityBlock } from "@/components/legal-identity-block";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Integritetspolicy",
  description: "Så hanterar Roots dina personuppgifter enligt GDPR.",
  path: "/integritet",
});

export default function IntegritetPage() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-16 md:px-10 md:py-24">
      <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
        Integritetspolicy
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Senast uppdaterad: 2 april 2026
      </p>

      <div className="mt-10 space-y-10 text-base leading-relaxed text-muted-foreground [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:tracking-tight [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1">
        <section>
          <h2>1. Personuppgiftsansvarig</h2>
          <p className="mt-3">
            Roots Nordic AB är personuppgiftsansvarig för behandlingen av dina
            personuppgifter.
          </p>
          <div className="mt-3">
            <LegalIdentityBlock variant="block" showContact className="not-italic leading-relaxed text-muted-foreground" />
          </div>
        </section>

        <section>
          <h2>2. Vilka uppgifter vi samlar in</h2>
          <p className="mt-3">Vi samlar in följande kategorier av personuppgifter:</p>
          <ul className="mt-3">
            <li>
              <strong className="text-foreground">Kontaktuppgifter</strong> — namn,
              e-postadress, telefonnummer och leveransadress vid köp eller
              kontaktformulär.
            </li>
            <li>
              <strong className="text-foreground">Beställningsuppgifter</strong> — ordernummer,
              produkter, belopp och betalningsreferens.
            </li>
            <li>
              <strong className="text-foreground">Kontouppgifter</strong> — e-post och
              lösenord (hashat) för klubb- och säljarportalen.
            </li>
            <li>
              <strong className="text-foreground">Håranalys</strong> — e-postadress,
              uppladdade bilder och svar på frågeformulär. Bilderna lagras enbart
              under analysens gång och raderas automatiskt efteråt.
            </li>
            <li>
              <strong className="text-foreground">Teknisk data</strong> — IP-adress,
              webbläsartyp och sidvisningar (via privacy-first-analys utan cookies).
            </li>
          </ul>
        </section>

        <section>
          <h2>3. Ändamål och laglig grund</h2>
          <ul className="mt-3">
            <li>
              <strong className="text-foreground">Fullgöra avtal</strong> — behandla
              beställningar, leveranser och kundservice (Art. 6.1 b GDPR).
            </li>
            <li>
              <strong className="text-foreground">Berättigat intresse</strong> — förbättra
              våra tjänster, analysera aggregerad användningsstatistik och
              förhindra missbruk (Art. 6.1 f GDPR).
            </li>
            <li>
              <strong className="text-foreground">Samtycke</strong> — skicka nyhetsbrev
              och marknadsföring. Du kan när som helst återkalla ditt samtycke
              (Art. 6.1 a GDPR).
            </li>
            <li>
              <strong className="text-foreground">Rättslig förpliktelse</strong> — bokföring
              och skattelagstiftning kräver att vi sparar vissa uppgifter (Art.
              6.1 c GDPR).
            </li>
          </ul>
        </section>

        <section>
          <h2>4. Hur länge vi sparar uppgifter</h2>
          <ul className="mt-3">
            <li>Beställningsdata — 7 år (bokföringslagen).</li>
            <li>Kontouppgifter — tills kontot raderas.</li>
            <li>Håranalysbilder — raderas direkt efter analys.</li>
            <li>Nyhetsbrevsprenumeration — tills du avregistrerar dig.</li>
            <li>Analysdata (aggregerad) — 26 månader.</li>
          </ul>
        </section>

        <section>
          <h2>5. Mottagare av uppgifter</h2>
          <p className="mt-3">
            Vi delar personuppgifter med följande kategorier av mottagare, alltid
            med lämpliga skyddsåtgärder:
          </p>
          <ul className="mt-3">
            <li>Betalningsleverantör — för att hantera transaktioner.</li>
            <li>Fraktbolag — för leverans av fysiska produkter.</li>
            <li>Fortnox — bokföring och fakturering.</li>
            <li>OpenAI — håranalys (data skickas krypterat och lagras inte av
              OpenAI för träning).</li>
            <li>Hosting-leverantör (Railway) — infrastruktur inom EU/EES.</li>
          </ul>
        </section>

        <section>
          <h2>6. Överföring utanför EU/EES</h2>
          <p className="mt-3">
            Vi strävar efter att hålla all data inom EU/EES. Vid överföring till
            tredje land (t.ex. OpenAI:s servrar i USA) säkerställer vi att det
            finns adekvata skyddsåtgärder, såsom EU-kommissionens
            standardavtalsklausuler (SCC) eller beslut om adekvat skyddsnivå.
          </p>
        </section>

        <section>
          <h2>7. Dina rättigheter</h2>
          <p className="mt-3">Enligt GDPR har du rätt att:</p>
          <ul className="mt-3">
            <li>Få tillgång till dina personuppgifter (registerutdrag).</li>
            <li>Rätta felaktiga uppgifter.</li>
            <li>Radera uppgifter ("rätten att bli glömd").</li>
            <li>Begränsa behandlingen.</li>
            <li>Invända mot behandling baserad på berättigat intresse.</li>
            <li>Dataportabilitet — få ut dina uppgifter i maskinläsbart format.</li>
            <li>Återkalla samtycke för nyhetsbrev och marknadsföring.</li>
          </ul>
          <p className="mt-3">
            Du kan utöva dina rättigheter på två sätt. Snabbast är att maila{" "}
            <a href="mailto:hej@roots.se" className="underline hover:text-foreground">
              hej@roots.se
            </a>{" "}
            från den e-postadress vi har registrerad på dig. För formella
            förfrågningar — t.ex. fullmakt eller om du vill att svaret ska
            postas — skicka brev till nedanstående adress, märk kuvertet{" "}
            <em className="not-italic text-foreground">&quot;Dataskydd&quot;</em>.
          </p>
          <div className="mt-3 rounded-lg border border-border bg-muted/30 p-4">
            <LegalIdentityBlock
              variant="block"
              showContact
              className="not-italic leading-relaxed text-muted-foreground"
            />
          </div>
          <p className="mt-3">
            Vi besvarar förfrågningar inom 30 dagar enligt GDPR Art. 12.3.
          </p>
        </section>

        <section>
          <h2>8. Cookies</h2>
          <p className="mt-3">
            Vi använder inga tredjepartscookies för spårning. Vår analysplattform
            är privacy-first och cookiefri. Nödvändiga sessionscookies används
            enbart för att hantera inloggning och kundvagn.
          </p>
        </section>

        <section>
          <h2>9. Säkerhet</h2>
          <p className="mt-3">
            Vi vidtar tekniska och organisatoriska åtgärder för att skydda dina
            uppgifter, inklusive kryptering (TLS), hashade lösenord (Argon2id),
            åtkomstkontroll och regelbunden säkerhetsöversyn.
          </p>
        </section>

        <section>
          <h2>10. Klagomål</h2>
          <p className="mt-3">
            Om du anser att vi hanterar dina personuppgifter felaktigt har du
            rätt att lämna klagomål till Integritetsskyddsmyndigheten (IMY),{" "}
            <a
              href="https://www.imy.se"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              www.imy.se
            </a>.
          </p>
        </section>

        <section>
          <h2>11. Ändringar</h2>
          <p className="mt-3">
            Vi kan uppdatera denna policy. Väsentliga ändringar meddelas via
            e-post eller på webbplatsen. Datumet längst upp visar senaste
            versionen.
          </p>
        </section>
      </div>
    </article>
  );
}
