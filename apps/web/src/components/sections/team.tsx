import Image from "next/image";
import { getRequestLocale } from "@/i18n/request-locale";
import { marketingUi } from "@/i18n/dictionaries/marketing-ui";

type TeamRoleKey =
  | "clubRep"
  | "networkSales"
  | "ceoSales"
  | "marketingHr"
  | "techProduct";

const TEAM: ReadonlyArray<{
  name: string;
  image: string;
  role: TeamRoleKey;
}> = [
  {
    name: "Kent Gustafson",
    image: "/personal/kent-gustafson.jpg",
    role: "clubRep",
  },
  {
    name: "Fredrik Lindqvist",
    image: "/personal/fredrik-lindqvist.jpg",
    role: "marketingHr",
  },
  {
    name: "Johan Lindqvist",
    image: "/personal/johan-lindqvist.jpg",
    role: "ceoSales",
  },
  {
    name: "Christopher Genberg",
    image: "/personal/christopher-genberg.jpg",
    role: "techProduct",
  },
  {
    name: "Ola Nordlund",
    image: "/personal/ola-nordlund.jpg",
    role: "networkSales",
  },
  {
    name: "Johan Fogell",
    image: "/personal/johan-fogell.jpg",
    role: "networkSales",
  },
  {
    name: "Niclas Corse",
    image: "/personal/niclas-corse.jpg",
    role: "clubRep",
  },
  {
    name: "Matilda Stukat Grauers",
    image: "/personal/matilda.jpg",
    role: "networkSales",
  },
];

export async function TeamSection() {
  const locale = await getRequestLocale();
  const t = marketingUi[locale].team;

  return (
    <section id="teamet" className="relative overflow-hidden py-20 md:py-28">
      {/* Soft brand atmosphere — sand wash + forest vignette, not flat fill */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(107,121,79,0.10),transparent_55%),radial-gradient(ellipse_at_80%_100%,rgba(193,191,153,0.18),transparent_50%),linear-gradient(180deg,#FAF6EF_0%,#FFFFFF_45%,#FAF6EF_100%)]"
      />

      <div className="relative mx-auto max-w-[1280px] px-6 md:px-10">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-brand-700">
            {t.badge}
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
            {t.title}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground md:text-lg">
            {t.body}
          </p>
        </div>

        {/* Group photo — edge-to-edge visual plane, no card chrome */}
        <figure className="group relative mx-auto mt-12 max-w-5xl overflow-hidden rounded-2xl md:mt-16">
          <div className="relative aspect-[4/5] w-full sm:aspect-[5/4] md:aspect-[16/10]">
            <Image
              src="/personal/gruppbild.jpg"
              alt={t.groupAlt}
              fill
              className="object-cover object-[center_32%] transition-transform duration-[1.1s] ease-out group-hover:scale-[1.02]"
              sizes="(max-width: 1024px) 100vw, 1024px"
              priority
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-brand-900/40 via-transparent to-brand-900/10" />
            <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-brand-900/10" />
          </div>
          <figcaption className="sr-only">
            {t.groupCaption}
          </figcaption>
        </figure>

        {/* Portrait frames — image-led, forest accent on interaction */}
        <ul className="mt-10 flex flex-wrap justify-center gap-3 sm:mt-12 sm:gap-4 md:gap-5">
          {TEAM.map((person, i) => (
            <li
              key={person.name}
              className="w-[calc(50%-0.375rem)] max-w-[220px] sm:w-[calc(33.333%-0.75rem)] lg:w-[calc(25%-1rem)] lg:max-w-[240px]"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <article className="group relative animate-slide-up overflow-hidden rounded-2xl bg-brand-100 shadow-[var(--shadow-card)] transition-[transform,box-shadow] duration-500 ease-out hover:-translate-y-1 hover:shadow-[var(--shadow-elevated)]">
                {/* Forest frame — grows in on hover */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 z-20 rounded-2xl ring-1 ring-inset ring-brand-900/10 transition-[box-shadow,ring-color] duration-500 group-hover:ring-2 group-hover:ring-brand-700/80"
                />
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 top-0 z-20 h-1 origin-left scale-x-0 bg-brand-700 transition-transform duration-500 ease-out group-hover:scale-x-100"
                />

                <div className="relative aspect-[4/5] overflow-hidden">
                  <Image
                    src={person.image}
                    alt={person.name}
                    fill
                    className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.045]"
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 240px"
                  />
                  {/* Name + role live on the image — no separate card footer */}
                  <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-brand-900/85 via-brand-900/35 to-transparent px-3.5 pb-3.5 pt-16 sm:px-4 sm:pb-4">
                    <h3 className="text-[0.95rem] font-semibold leading-tight tracking-tight text-white sm:text-base">
                      {person.name}
                    </h3>
                    <p className="mt-0.5 text-[11px] font-medium leading-snug tracking-wide text-brand-400 transition-opacity duration-300 sm:text-xs">
                      {t.roles[person.role]}
                    </p>
                  </div>
                </div>
              </article>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
