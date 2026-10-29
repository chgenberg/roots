(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const params = new URLSearchParams(location.search);
  const qa = document.documentElement.classList.contains('qa');

  /* Personlig version: ?forening=Umeå IK&kontakt=Niclas Corse&epost=…&telefon=… */
  const club = params.get('forening');
  if (club) {
    $$('[data-p="forening"]').forEach((el) => { el.textContent = club; });
    $$('[data-p="forening-in"]').forEach((el) => { el.textContent = club; });
    document.title = `Roots — Till ${club}`;
  }
  const who = params.get('kontakt');
  if (who) $$('[data-p="kontakt"]').forEach((el) => { el.textContent = `${who}, Roots`; });
  const mail = params.get('epost');
  if (mail) $$('[data-p="epost"]').forEach((el) => { el.textContent = mail; el.href = `mailto:${mail}`; });
  const tel = params.get('telefon');
  if (tel) $$('[data-p="telefon"]').forEach((el) => { el.textContent = tel; el.hidden = false; });

  /* Reveal */
  const rv = $$('.rv');
  const reveal = () => {
    const h = innerHeight * 0.92;
    for (const el of rv) if (!el.classList.contains('is-in') && el.getBoundingClientRect().top < h) el.classList.add('is-in');
  };
  if (qa) rv.forEach((el) => el.classList.add('is-in'));

  /* Läsframsteg och aktivt kapitel */
  const bar = $('#progress');
  const navLinks = $$('.mast__nav a');
  const NAV_OF = { ide: 'ide', flodet: 'flodet', siffror: 'siffror', plattformen: 'siffror', sortimentet: 'siffror', rakna: 'rakna', ansvar: 'rakna', nasta: 'nasta' };
  const ids = Object.keys(NAV_OF);
  const current = () => {
    let cur = null;
    const line = innerHeight * 0.35;
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el && el.getBoundingClientRect().top < line) cur = id;
    }
    return cur;
  };

  /* 02 Flödet: skottet är en försäljning som går genom stegen */
  const chain = $('#flodet');
  const dot = $('#chainDot');
  const fill = $('#chainFill');
  const stations = $$('.chain__st');
  const logItems = $$('#chainLog li');
  const narrow = () => matchMedia('(max-width: 760px)').matches;
  const setChain = (p) => {
    const steps = stations.length - 1;
    const pos = Math.max(0, Math.min(1, p)) * steps;
    const at = Math.round(pos);
    const line = $('#chainLine');
    const a = stations[Math.floor(pos)];
    const b = stations[Math.min(steps, Math.floor(pos) + 1)];
    const f = pos - Math.floor(pos);
    if (narrow()) {
      const y = a.offsetTop + (b.offsetTop - a.offsetTop) * f + 6;
      dot.style.left = '';
      dot.style.top = y - 12 + 'px';
      fill.style.height = y + 'px';
      fill.style.width = '';
    } else {
      const x = a.offsetLeft + (b.offsetLeft - a.offsetLeft) * f;
      dot.style.top = '';
      dot.style.left = x - 3 + 'px';
      fill.style.width = (x / line.clientWidth) * 100 + '%';
      fill.style.height = '';
    }
    stations.forEach((s, i) => {
      s.classList.toggle('is-past', i < pos - 0.02);
      s.classList.toggle('is-on', i === at);
    });
    logItems.forEach((li, i) => {
      li.classList.toggle('is-on', i <= at);
      li.classList.toggle('is-cur', i === at);
    });
  };
  const chainProgress = () => {
    if (qa) return +(params.get('chain') ?? 0.5);
    const r = chain.getBoundingClientRect();
    const total = chain.offsetHeight - innerHeight;
    return total > 0 ? -r.top / total : 0;
  };

  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      reveal();
      const max = document.documentElement.scrollHeight - innerHeight;
      bar.style.width = (max > 0 ? (scrollY / max) * 100 : 0) + '%';
      const cur = current();
      navLinks.forEach((a) => a.classList.toggle('is-on', !!cur && a.getAttribute('href') === '#' + NAV_OF[cur]));
      setChain(chainProgress());
    });
  };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  onScroll();

  /* 06 Räkna: samma antaganden som i föreningspresentationen */
  const PRICE = 399;
  const SHARE = 0.35;
  const kr = (n) => Math.round(n).toLocaleString('sv-SE').replace(/\s/g, '\u00a0');
  const nIn = $('#cN');
  const pIn = $('#cP');
  const calc = () => {
    const n = Math.max(0, Math.floor(+nIn.value || 0));
    const p = Math.max(0, Math.floor(+pIn.value || 0));
    const total = n * p * PRICE;
    $('#cPk').textContent = kr(n * p);
    $('#cTot').textContent = kr(total) + '\u00a0kr';
    $('#cClub').textContent = kr(total * SHARE) + '\u00a0kr';
  };
  nIn.addEventListener('input', calc);
  pIn.addEventListener('input', calc);
  if (params.get('deltagare')) nIn.value = params.get('deltagare');
  calc();
})();
