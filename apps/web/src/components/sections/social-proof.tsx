import { getHome } from "@/i18n/get-dictionary";
import { getRequestLocale } from "@/i18n/request-locale";

export async function SocialProof() {
  const locale = await getRequestLocale();
  const { socialProof } = getHome(locale);

  return (
    <section className="bg-brand-50/40 py-20 md:py-24">
      <div className="mx-auto max-w-[1280px] px-6 md:px-10">
        <div className="flex flex-col items-center justify-center gap-8 md:flex-row md:gap-0 md:divide-x md:divide-border">
          {socialProof.principles.map((p) => (
            <div
              key={p.label}
              className="flex flex-col items-center text-center md:flex-1 md:px-8"
            >
              <p className="text-4xl font-bold tracking-tight md:text-5xl">
                {p.value}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">{p.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
