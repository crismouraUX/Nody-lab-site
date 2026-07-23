/* ==========================================================================
   NODY/LAB — scroll orchestration
   Lenis smooth scroll + GSAP ScrollTrigger. Vertical flow alternating with
   pinned horizontal rails; staggered word reveals; counters; terminal loops.
   ========================================================================== */

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

gsap.registerPlugin(ScrollTrigger);

/* ---------- Lenis ---------- */
const lenis = new Lenis({ duration: 1.15, smoothWheel: !REDUCED });
window.nodyLenis = lenis;
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);

/* ---------- preloader ---------- */
(function preloader() {
  const el = document.querySelector('.loader');
  if (!el) { start(); return; }
  const pct = el.querySelector('.loader__pct');
  const t0 = performance.now();
  const DURATION = REDUCED ? 50 : 1050;
  let finished = false;
  lenis.stop();

  function finish() {
    if (finished) return;
    finished = true;
    if (pct) pct.textContent = '100';
    el.classList.add('is-done');
    lenis.start();
    setTimeout(() => el.remove(), 700);
    start();
  }

  (function tick() {
    if (finished) return;
    const p = Math.min(1, (performance.now() - t0) / DURATION);
    if (pct) pct.textContent = String(Math.floor(p * 100)).padStart(3, '0');
    p < 1 ? requestAnimationFrame(tick) : finish();
  })();

  /* rAF is suspended in hidden/background tabs — guarantee init regardless */
  setTimeout(finish, DURATION + 250);
})();

function start() {
  document.body.classList.add('is-ready');
  initSplits();
  initReveals();
  initRails();
  initHeroFade();
  initNav();
  initMenu();
  initCounters();
  initProcess();
  initTermLoops();
  initCursor();
  initAnchors();
  requestAnimationFrame(() => ScrollTrigger.refresh());
}

/* ---------- split-text word reveals ---------- */
function splitWords(node) {
  [...node.childNodes].forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      if (!child.textContent.trim()) return;
      const frag = document.createDocumentFragment();
      child.textContent.split(/(\s+)/).forEach((part) => {
        if (!part.trim()) { frag.append(document.createTextNode(' ')); return; }
        const w = document.createElement('span');
        w.className = 'w';
        const i = document.createElement('i');
        i.textContent = part;
        w.append(i);
        frag.append(w);
      });
      child.replaceWith(frag);
    } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName !== 'BR') {
      splitWords(child);
    }
  });
}

function initSplits() {
  if (REDUCED) return;
  document.querySelectorAll('[data-split]').forEach((el) => {
    splitWords(el);
    gsap.to(el.querySelectorAll('.w > i'), {
      y: 0,
      duration: 1.1,
      ease: 'expo.out',
      stagger: 0.035,
      scrollTrigger: { trigger: el, start: 'top 88%', once: true },
    });
  });
}

/* ---------- generic reveals ---------- */
function initReveals() {
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    }),
    { threshold: 0.12, rootMargin: '0px 0px -6% 0px' }
  );
  document.querySelectorAll('[data-reveal], [data-img-reveal]').forEach((el) => io.observe(el));
}

/* ---------- pinned horizontal rails (desktop) / native swipe (mobile) ---------- */
function initRails() {
  const mm = gsap.matchMedia();
  mm.add('(min-width: 769px) and (prefers-reduced-motion: no-preference)', () => {
    document.querySelectorAll('[data-hrail]').forEach((rail) => {
      const track = rail.querySelector('.hrail__track');
      const bar = rail.querySelector('.hrail__progress i');
      const dist = () => track.scrollWidth - window.innerWidth;
      gsap.to(track, {
        x: () => -dist(),
        ease: 'none',
        scrollTrigger: {
          trigger: rail,
          start: 'top top',
          end: () => '+=' + dist(),
          scrub: 1,
          pin: true,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onUpdate: (self) => { if (bar) bar.style.width = self.progress * 100 + '%'; },
        },
      });
    });
  });
}

/* ---------- hero text drift while the 3D assembles ---------- */
function initHeroFade() {
  if (REDUCED) return;
  document.querySelectorAll('[data-hero]').forEach((runway) => {
    const rows = runway.querySelectorAll('[data-hero-fade]');
    if (!rows.length) return;
    gsap.to(rows, {
      opacity: 0,
      y: -90,
      stagger: 0.06,
      ease: 'none',
      scrollTrigger: { trigger: runway, start: '12% top', end: '55% top', scrub: 0.6 },
    });
    const late = runway.querySelector('[data-hero-late]');
    if (late) {
      gsap.fromTo(late, { opacity: 0, y: 50 }, {
        opacity: 1, y: 0, ease: 'none',
        scrollTrigger: { trigger: runway, start: '55% top', end: '82% top', scrub: 0.6 },
      });
    }
  });
}

/* ---------- nav ---------- */
function initNav() {
  const nav = document.querySelector('.nav');
  if (!nav) return;
  let lastY = 0;
  lenis.on('scroll', ({ scroll }) => {
    nav.classList.toggle('is-solid', scroll > 40);
    if (Math.abs(scroll - lastY) > 6) {
      nav.classList.toggle('is-hidden', scroll > lastY && scroll > 320 && !document.body.classList.contains('menu-open'));
      lastY = scroll;
    }
  });
}

function initMenu() {
  const burger = document.querySelector('.nav__burger');
  if (!burger) return;
  burger.addEventListener('click', () => {
    const open = document.body.classList.toggle('menu-open');
    burger.setAttribute('aria-expanded', open);
    open ? lenis.stop() : lenis.start();
  });
  document.querySelectorAll('.menu a').forEach((a) =>
    a.addEventListener('click', () => { document.body.classList.remove('menu-open'); lenis.start(); })
  );
}

/* ---------- counters ---------- */
function initCounters() {
  document.querySelectorAll('[data-count]').forEach((el) => {
    const end = parseFloat(el.dataset.count);
    const prefix = el.dataset.prefix || '';
    const suffix = el.dataset.suffix || '';
    const obj = { v: 0 };
    gsap.to(obj, {
      v: end,
      duration: REDUCED ? 0.01 : 1.8,
      ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 90%', once: true },
      onUpdate: () => { el.childNodes[0].nodeValue = prefix + Math.round(obj.v) + suffix; },
    });
  });
}

/* ---------- process timeline ---------- */
function initProcess() {
  document.querySelectorAll('.process').forEach((proc) => {
    const line = proc.querySelector('.process__line');
    const steps = proc.querySelectorAll('.pstep');
    ScrollTrigger.create({
      trigger: proc,
      start: 'top 70%',
      end: 'bottom 55%',
      scrub: 0.5,
      onUpdate: (self) => {
        if (line) line.style.transform = `scaleY(${self.progress})`;
        steps.forEach((s, i) => s.classList.toggle('is-active', self.progress > i / steps.length + 0.04));
      },
    });
  });
}

/* ---------- BYA terminal typing loop ---------- */
function initTermLoops() {
  const SCRIPT = [
    ['$ nody deploy --agent ', 'k'],
    ['SEU-NEGOCIO-01', 'v'],
    ['\n> carregando skills           ', 'c'], ['✓', 'v'],
    ['\n> conectando whatsapp-api     ', 'c'], ['✓', 'v'],
    ['\n> conectando crm/agenda       ', 'c'], ['✓', 'v'],
    ['\n> treinando tom de voz        ', 'c'], ['✓', 'v'],
    ['\n\n', 'c'],
    ['agent online. ', 'k'],
    ['primeira resposta em 0.8s', 'v'],
  ];
  document.querySelectorAll('[data-bya-term]').forEach((el) => {
    if (REDUCED) {
      el.innerHTML = SCRIPT.map(([txt, cls]) => `<span class="${cls}">${txt.replace(/\n/g, '<br>')}</span>`).join('');
      return;
    }
    let seg = 0, ch = 0, out = '';
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); type(); } }, { threshold: 0.3 });
    io.observe(el);
    function type() {
      if (seg >= SCRIPT.length) {
        setTimeout(() => { seg = 0; ch = 0; out = ''; type(); }, 5200);
        return;
      }
      const [txt, cls] = SCRIPT[seg];
      ch++;
      if (ch >= txt.length) { out += `<span class="${cls}">${txt.replace(/\n/g, '<br>')}</span>`; seg++; ch = 0; }
      el.innerHTML = out + (ch ? `<span class="${cls}">${txt.slice(0, ch).replace(/\n/g, '<br>')}</span>` : '') + '<span class="cursor"></span>';
      setTimeout(type, txt[ch - 1] === '\n' ? 90 : 18 + Math.random() * 26);
    }
  });
}

/* ---------- cursor dot ---------- */
function initCursor() {
  if (REDUCED || window.matchMedia('(pointer: coarse)').matches) return;
  const dot = document.createElement('div');
  dot.className = 'cursor-dot';
  document.body.appendChild(dot);
  let x = 0, y = 0, tx = 0, ty = 0;
  window.addEventListener('pointermove', (e) => {
    tx = e.clientX; ty = e.clientY;
    dot.classList.add('is-on');
    dot.classList.toggle('is-hover', !!e.target.closest('a, button, .copt, input'));
  }, { passive: true });
  gsap.ticker.add(() => {
    x += (tx - x) * 0.22; y += (ty - y) * 0.22;
    dot.style.transform = `translate(${x - dot.offsetWidth / 2}px, ${y - dot.offsetHeight / 2}px)`;
  });
}

/* ---------- smooth anchors ---------- */
function initAnchors() {
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const target = document.querySelector(a.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target, { offset: -70 });
    });
  });
}
