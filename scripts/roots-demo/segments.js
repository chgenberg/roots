// Hastighets-plan per roll. Varje steg beskriver intervallet som SLUTAR vid
// `mark`. spec = tal (hastighetsfaktor) eller { dur } (komprimera till N sek).
// Saknade markörer (en överhoppad beat) hoppas över utan att klippet spricker.

const PLAN = {
  seller: [
    { mark: "loginSubmit", spec: 1.15 }, // intro + skrivande, läsbart
    { mark: "dashboardShown", spec: { dur: 2.4 } }, // låt dashboarden andas
    { mark: "shareShown", spec: 1.1 }, // mjuk scroll
    { mark: "shareTapped", spec: 1.05 },
    { mark: "orderRegistered", spec: { dur: 4.0 } }, // dialog + skrivande
    { mark: "statsShown", spec: { dur: 3.2 } }, // visa graferna
  ],
  forening: [
    { mark: "loginSubmit", spec: 1.15 },
    { mark: "dashboardShown", spec: { dur: 2.6 } },
    { mark: "campaignFormFilled", spec: { dur: 4.0 } },
    { mark: "campaignCreated", spec: { dur: 2.0 } },
    { mark: "teamsShown", spec: { dur: 2.6 } },
    { mark: "settlementShown", spec: { dur: 2.6 } },
    { mark: "statsShown", spec: { dur: 3.2 } }, // avsluta på graferna
  ],
  lag: [
    { mark: "loginSubmit", spec: 1.15 },
    { mark: "dashboardShown", spec: { dur: 2.6 } },
    { mark: "inviteShown", spec: 1.1 },
    { mark: "importShown", spec: { dur: 3.0 } },
    { mark: "broadcastSent", spec: { dur: 3.6 } },
    { mark: "statsShown", spec: { dur: 3.2 } },
  ],
  // Publik räknesnurra: scrolla till kalkylatorn, dra i reglagen, visa
  // förtjänsten och mätaren mot målet.
  calculator: [
    { mark: "calcShown", spec: { dur: 2.2 } },
    { mark: "valuesSet", spec: { dur: 4.2 } },
    { mark: "earningsShown", spec: { dur: 2.8 } },
    { mark: "goalShown", spec: { dur: 3.4 } },
  ],
};

const TAIL_SPEED = 1.15; // realtid-ish: visa sista vyn lugnt

/**
 * @returns {{segs: Array<{a:number,b:number,speed:number,dur:number}>, bodyDur:number}}
 */
export function buildSegments(role, marks, videoDur) {
  const m = {};
  for (const x of marks) m[x.name] = x.t;

  const plan = PLAN[role] || [];
  const segs = [];
  let prev = 0;

  const push = (a, b, spec) => {
    if (b <= a + 0.05) return;
    let speed;
    if (typeof spec === "number") speed = spec;
    else speed = Math.max(0.5, (b - a) / spec.dur);
    const dur = (b - a) / speed;
    segs.push({ a: +a.toFixed(3), b: +b.toFixed(3), speed: +speed.toFixed(4), dur });
  };

  for (const step of plan) {
    const t = m[step.mark];
    if (t == null) continue;
    push(prev, t, step.spec);
    prev = t;
  }
  // Svans: sista markören → videoslut, realtid-ish.
  if (videoDur > prev + 0.1) push(prev, videoDur, TAIL_SPEED);

  const bodyDur = segs.reduce((s, x) => s + x.dur, 0);
  return { segs, bodyDur: +bodyDur.toFixed(3) };
}
