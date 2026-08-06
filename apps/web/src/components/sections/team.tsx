import Image from "next/image";

const TEAM = [
  {
    name: "Kent Gustafson",
    image: "/personal/kent-gustafson.jpg",
  },
  {
    name: "Fredrik Lindqvist",
    image: "/personal/fredrik-lindqvist.jpg",
  },
  {
    name: "Christopher Genberg",
    image: "/personal/christopher-genberg.jpg",
  },
  {
    name: "Ola Nordlund",
    image: "/personal/ola-nordlund.jpg",
  },
  {
    name: "Johan Fogell",
    image: "/personal/johan-fogell.jpg",
  },
  {
    name: "Niclas Corse",
    image: "/personal/niclas-corse.jpg",
  },
] as const;

export function TeamSection() {
  return (
    <section id="teamet" className="bg-brand-50/50 py-24 md:py-32">
      <div className="mx-auto max-w-[1280px] px-6 md:px-10">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-brand-700">
            Teamet
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
            Människorna bakom Roots
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Grannar med bakgrund i föreningsliv, teknik och produkt — samma mål:
            mer kraft till föreningen.
          </p>
        </div>

        <div className="mx-auto mt-12 max-w-4xl overflow-hidden rounded-2xl border border-brand-200/80 bg-white shadow-[var(--shadow-card)]">
          <div className="relative aspect-[3/4] w-full sm:aspect-[4/5] md:aspect-[3/2]">
            <Image
              src="/personal/gruppbild.jpg"
              alt="Roots teamet samlat utomhus"
              fill
              className="object-cover object-[center_35%]"
              sizes="(max-width: 896px) 100vw, 896px"
              priority
            />
            <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-brand-900/5" />
            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-brand-900/35 to-transparent" />
          </div>
        </div>

        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TEAM.map((person) => (
            <li key={person.name}>
              <article className="group relative w-full overflow-hidden rounded-2xl border border-brand-200/90 bg-white text-left shadow-[var(--shadow-card)] transition-[border-color,box-shadow,transform] duration-300 ease-out hover:-translate-y-0.5 hover:border-brand-700/70 hover:shadow-[var(--shadow-elevated)]">
                <span
                  aria-hidden
                  className="absolute inset-x-0 top-0 h-[3px] bg-brand-700 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                />
                <div className="relative aspect-[4/5] overflow-hidden bg-brand-100">
                  <Image
                    src={person.image}
                    alt={person.name}
                    fill
                    className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                  <div className="absolute inset-0 bg-brand-900/0 transition-colors duration-300 group-hover:bg-brand-900/[0.06]" />
                </div>
                <div className="flex items-center justify-between gap-3 px-5 py-4">
                  <div>
                    <h3 className="font-semibold tracking-tight text-foreground">
                      {person.name}
                    </h3>
                    <p className="mt-0.5 text-sm text-muted-foreground">Roots</p>
                  </div>
                  <span
                    aria-hidden
                    className="h-2 w-2 scale-100 rounded-full bg-brand-700 transition-transform duration-300 group-hover:scale-110"
                  />
                </div>
              </article>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
