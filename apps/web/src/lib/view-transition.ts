/**
 * Klubbloggan glider från kortet till klubbsidan med View Transitions API.
 * Webbläsare utan stöd, och besökare som valt minskad rörelse, får en vanlig
 * navigering.
 */

const NAME = "club-logo";
const MAX_WAIT_MS = 1500;

type StartViewTransition = (update: () => Promise<void>) => {
  finished: Promise<void>;
  ready: Promise<void>;
};

/**
 * Webbläsaren pausar ritningen medan övergången väntar, så requestAnimationFrame
 * körs aldrig här — vi pollar med setTimeout.
 */
function waitForTarget(slug: string): Promise<void> {
  return new Promise((resolve) => {
    const started = performance.now();
    const check = () => {
      const img = document.querySelector<HTMLImageElement>(`[data-club-logo-target="${CSS.escape(slug)}"]`);
      if ((img && img.complete) || performance.now() - started > MAX_WAIT_MS) {
        resolve();
        return;
      }
      window.setTimeout(check, 16);
    };
    check();
  });
}

/**
 * Navigerar till klubbsidan med en morf av loggan. Returnerar false om
 * övergången inte kan köras — då ska länken göra sin vanliga sak.
 */
export function morphToClub(
  anchor: HTMLAnchorElement,
  slug: string,
  push: (href: string) => void
): boolean {
  const start = (document as Document & { startViewTransition?: StartViewTransition }).startViewTransition;
  if (typeof start !== "function") return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  const href = anchor.getAttribute("href");
  const logo = anchor.querySelector<HTMLElement>("[data-morph-logo]");
  if (!href || !logo) return false;

  // Bara ett element i taget får bära namnet, annars avbryts övergången.
  document
    .querySelectorAll<HTMLElement>("[data-club-logo-target]")
    .forEach((el) => (el.style.viewTransitionName = "none"));
  logo.style.viewTransitionName = NAME;

  const transition = start.call(document, () => {
    push(href);
    return waitForTarget(slug);
  });
  // Avbruten övergång (t.ex. flik i bakgrunden) — navigeringen sker ändå.
  transition.ready.catch(() => {});
  transition.finished
    .catch(() => {})
    .finally(() => {
      logo.style.viewTransitionName = "";
    });
  return true;
}
