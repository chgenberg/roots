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

export async function TeamPortraits() {
  const locale = await getRequestLocale();
  const t = marketingUi[locale].team;

  return (
    <ul className="flex flex-wrap justify-center gap-3 sm:gap-4 md:gap-5">
      {TEAM.map((person, i) => (
        <li
          key={person.name}
          className="w-[calc(50%-0.375rem)] max-w-[220px] sm:w-[calc(33.333%-0.75rem)] lg:w-[calc(25%-1rem)] lg:max-w-[240px]"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <article className="group relative animate-slide-up overflow-hidden rounded-2xl bg-brand-100 shadow-[var(--shadow-card)] transition-[transform,box-shadow] duration-500 ease-out hover:-translate-y-1 hover:shadow-[var(--shadow-elevated)]">
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
  );
}

export async function TeamGroupPhoto({ className }: { className?: string }) {
  const locale = await getRequestLocale();
  const t = marketingUi[locale].team;

  return (
    <figure className={className}>
      <div className="group relative overflow-hidden rounded-2xl">
        <div className="relative aspect-[4/5] w-full sm:aspect-[4/3] lg:aspect-[16/9]">
          <Image
            src="/personal/gruppbild.jpg"
            alt={t.groupAlt}
            fill
            className="object-cover object-[center_22%] transition-transform duration-700 ease-out group-hover:scale-[1.02]"
            sizes="(max-width: 768px) 100vw, 768px"
          />
          <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-brand-900/10" />
        </div>
      </div>
      <figcaption className="sr-only">{t.groupCaption}</figcaption>
    </figure>
  );
}
