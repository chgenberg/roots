import { ClubCarousel } from "@/components/club-carousel";
import { connectedClubs } from "@/content/clubs";
import { getHome } from "@/i18n/get-dictionary";
import { getRequestLocale } from "@/i18n/request-locale";

export async function ClubLogos() {
  const locale = await getRequestLocale();
  const { clubs } = getHome(locale);

  return (
    <section
      aria-labelledby="klubbar-titel"
      className="overflow-hidden bg-[linear-gradient(180deg,#F7F3EA_0%,#FBF9F5_70%,transparent_100%)] pb-8 pt-16 md:pt-20"
    >
      <div className="mx-auto max-w-2xl px-6 text-center">
        <h2 id="klubbar-titel" className="text-3xl font-bold tracking-tight">
          {clubs.title}
        </h2>
        <p className="mt-3 text-lg text-muted-foreground">{clubs.body}</p>
      </div>
      <div className="mx-auto mt-8 max-w-[1400px] md:px-6">
        <ClubCarousel
          clubs={connectedClubs}
          listLabel={clubs.listLabel}
          nextTitle={clubs.nextTitle}
          nextCta={clubs.nextCta}
          prevLabel={clubs.prev}
          nextLabel={clubs.next}
        />
      </div>
    </section>
  );
}
