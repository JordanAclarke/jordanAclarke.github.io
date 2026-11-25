(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* theme */
  const root = document.documentElement;
  const saved = localStorage.getItem('theme');
  if (saved) root.dataset.theme = saved;
  $('#theme').addEventListener('click', () => {
    const next = root.dataset.theme === 'light' ? 'dark' : 'light';
    root.dataset.theme = next;
    localStorage.setItem('theme', next);
  });

  /* nav state */
  const nav = $('.nav');
  const onScroll = () => nav.classList.toggle('scrolled', scrollY > 8);
  onScroll(); addEventListener('scroll', onScroll, { passive: true });

  const links = $$('.nav ul a');
  const spy = new IntersectionObserver(es => {
    es.forEach(e => {
      if (e.isIntersecting) links.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  $$('main section[id]').forEach(s => spy.observe(s));

  /* reveal on scroll */
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { threshold: .12 });
  $$('.reveal').forEach((el, i) => { el.style.transitionDelay = (i % 4) * 60 + 'ms'; io.observe(el); });

  /* hero agent trace: plays once, then loops gently */
  const lines = $$('.tl');
  const play = () => {
    lines.forEach(l => l.classList.remove('on'));
    lines.forEach((l, i) => setTimeout(() => l.classList.add('on'), reduce ? 0 : 500 + i * 780));
  };
  play();
  if (!reduce) setInterval(play, 500 + lines.length * 780 + 6500);

  /* pipeline: highlight the node the packet is passing */
  const nodes = $$('.pipe-svg .node');
  if (nodes.length && !reduce) {
    let i = 0;
    setInterval(() => { nodes.forEach((n, j) => n.classList.toggle('hot', j === i)); i = (i + 1) % nodes.length; }, 1500);
  }

  /* hovering skills, tags or the current role makes the 3D agent network react */
  let lastPulse = 0;
  $$('.chips li, .tag, .era.featured').forEach(el => el.addEventListener('pointerenter', () => {
    const n = performance.now();
    if (n - lastPulse > 350) { lastPulse = n; dispatchEvent(new Event('agent-pulse')); }
  }));

  /* hero name: letter-by-letter reveal */
  const h1 = $('.hero h1');
  if (h1 && !reduce) {
    const t = h1.textContent.trim();
    h1.setAttribute('aria-label', t);
    h1.innerHTML = [...t].map((c, i) => `<span class="ch" aria-hidden="true" style="animation-delay:${250 + i * 55}ms">${c === ' ' ? '&nbsp;' : c}</span>`).join('');
  }

  /* cursor-following spotlight on cards */
  $$('.case, .skill-groups > div, .lead-grid > div, .screen, .era.featured, .badge, .hero-stats > div, .edu > div, .pipeline').forEach(el => {
    el.classList.add('spot');
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      el.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
  });

  /* scroll progress bar */
  const bar = $('#progress');
  const prog = () => { const d = document.documentElement; bar.style.transform = `scaleX(${d.scrollTop / ((d.scrollHeight - d.clientHeight) || 1)})`; };
  prog(); addEventListener('scroll', prog, { passive: true });

  $('#year').textContent = new Date().getFullYear();
})();
