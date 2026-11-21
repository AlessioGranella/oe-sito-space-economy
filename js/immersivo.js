/* Scenari | Space Economy — movimento della versione immersiva
   GSAP + ScrollTrigger per le scene legate allo scroll, Lenis per lo scroll morbido.
   Con «riduci movimento» attivo resta tutto fermo e leggibile (vedi CSS). */
(function () {
  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasGsap = window.gsap && window.ScrollTrigger;
  var lenis = null;

  /* ---------- Scroll morbido ---------- */
  if (hasGsap) gsap.registerPlugin(ScrollTrigger);
  if (!reduce && window.Lenis && hasGsap) {
    lenis = new Lenis({ duration: 1.15, easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); } });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
  }
  function vaiA(target, immediate) {
    var el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!el) return;
    var off = el.id === 'home' ? 0 : -76;
    if (lenis) lenis.scrollTo(el, { offset: off, immediate: !!immediate, duration: 1.4 });
    else window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY + off, behavior: reduce ? 'auto' : 'smooth' });
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute('href');
    if (id.length < 2 || !document.querySelector(id)) return;
    e.preventDefault();
    vaiA(id);
    history.replaceState(null, '', id);
  });

  /* ---------- Testata: piena dopo l'inizio, si nasconde scendendo ---------- */
  var testata = document.getElementById('testata');
  var ultimoY = 0;
  function suScroll() {
    var y = window.scrollY;
    testata.classList.toggle('piena', y > 40);
    testata.classList.toggle('nascosta', y > 400 && y > ultimoY + 4);
    if (y < ultimoY - 4) testata.classList.remove('nascosta');
    ultimoY = y;
  }
  window.addEventListener('scroll', suScroll, { passive: true });
  suScroll();

  /* ---------- Indice laterale e voce di menu attiva ---------- */
  var sezioni = Array.prototype.slice.call(document.querySelectorAll('.snap'));
  var indice = document.getElementById('indice');
  sezioni.forEach(function (s) {
    var a = document.createElement('a');
    a.href = '#' + s.id;
    a.innerHTML = '<span>' + s.dataset.label + '</span><i></i>';
    indice.appendChild(a);
  });
  var vociIndice = indice.querySelectorAll('a');
  var menu = {};
  document.querySelectorAll('nav.menu a').forEach(function (a) { menu[a.getAttribute('href').slice(1)] = a; });
  if ('IntersectionObserver' in window) {
    var spia = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        var i = sezioni.indexOf(e.target);
        vociIndice.forEach(function (a, k) { a.classList.toggle('attivo', k === i); });
      });
    }, { rootMargin: '-50% 0px -50% 0px' });
    sezioni.forEach(function (s) { spia.observe(s); });
    var spiaMenu = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting && menu[e.target.id]) {
          Object.keys(menu).forEach(function (k) { menu[k].classList.remove('attivo'); });
          menu[e.target.id].classList.add('attivo');
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    Object.keys(menu).forEach(function (id) { var s = document.getElementById(id); if (s) spiaMenu.observe(s); });
  }

  /* ---------- Cielo stellato (canvas leggero, solo quando è visibile) ---------- */
  document.querySelectorAll('canvas.stelle').forEach(function (cv) {
    var ctx = cv.getContext('2d'), stelle = [], attivo = false, dpr = Math.min(2, window.devicePixelRatio || 1);
    var colore = getComputedStyle(document.body).getPropertyValue('--space-text').trim() || 'white';
    function misura() {
      cv.width = cv.offsetWidth * dpr; cv.height = cv.offsetHeight * dpr;
      var n = Math.round(cv.offsetWidth * cv.offsetHeight / 5200);
      stelle = [];
      for (var i = 0; i < n; i++) stelle.push({ x: Math.random(), y: Math.random(), r: Math.random() * 1.1 + .25, z: Math.random() * .6 + .2, f: Math.random() * 6.28 });
    }
    function disegna(t) {
      if (!attivo) return;
      var w = cv.width, h = cv.height, sy = window.scrollY;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = colore;
      for (var i = 0; i < stelle.length; i++) {
        var s = stelle[i];
        var y = ((s.y * h - sy * s.z * .25 * dpr) % h + h) % h;
        ctx.globalAlpha = reduce ? s.z : s.z * (.65 + .35 * Math.sin(t / 900 + s.f));
        ctx.beginPath(); ctx.arc(s.x * w, y, s.r * dpr, 0, 6.283); ctx.fill();
      }
      if (!reduce) requestAnimationFrame(disegna);
    }
    misura();
    window.addEventListener('resize', misura);
    new IntersectionObserver(function (es) {
      attivo = es[0].isIntersecting;
      if (attivo) requestAnimationFrame(disegna);
    }).observe(cv);
  });

  /* ---------- Modalità Presenta ---------- */
  function corrente() {
    var y = window.scrollY + window.innerHeight / 2, i = 0;
    sezioni.forEach(function (s, k) { if (s.offsetTop <= y) i = k; });
    return i;
  }
  function presenta(on) {
    root.classList.toggle('presenta', on);
    if (on) setTimeout(function () { vaiA(sezioni[0]); }, 50);
  }
  document.querySelectorAll('[data-presenta]').forEach(function (b) {
    b.addEventListener('click', function () { presenta(!root.classList.contains('presenta')); });
  });
  document.addEventListener('keydown', function (e) {
    if (!root.classList.contains('presenta')) return;
    var i = corrente();
    if (e.key === 'Escape') presenta(false);
    else if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].indexOf(e.key) > -1) { e.preventDefault(); vaiA(sezioni[Math.min(sezioni.length - 1, i + 1)]); }
    else if (['ArrowLeft', 'ArrowUp', 'PageUp'].indexOf(e.key) > -1) { e.preventDefault(); vaiA(sezioni[Math.max(0, i - 1)]); }
  });

  if (!hasGsap || reduce) return;

  /* ---------- Titoli divisi in righe ---------- */
  function dividiRighe(el) {
    if (!el.dataset.testo) el.dataset.testo = el.textContent;
    var parole = el.dataset.testo.trim().split(/\s+/);
    el.innerHTML = parole.map(function (p) { return '<span class="w">' + p + '</span>'; }).join(' ');
    var righe = [], top = null;
    el.querySelectorAll('.w').forEach(function (w) {
      if (w.offsetTop !== top) { righe.push([]); top = w.offsetTop; }
      righe[righe.length - 1].push(w.textContent);
    });
    el.setAttribute('aria-label', el.dataset.testo);
    el.innerHTML = righe.map(function (r) { return '<span class="riga" aria-hidden="true"><span>' + r.join(' ') + '</span></span>'; }).join('');
    return el.querySelectorAll('.riga > span');
  }

  function avvia() {
    var mm = gsap.matchMedia();

    /* ---------- Livello 3D ---------- */
    var terra = null, satellite = null;
    var cvTerra = document.getElementById('terra3d');
    if (window.Terra3D && cvTerra) { try { terra = Terra3D.init(cvTerra, ''); } catch (e) { terra = null; } }
    if (!terra) document.querySelector('.hero').classList.add('senza3d');
    var cvSat = document.getElementById('satellite3d');
    if (window.Satellite3D && cvSat) { try { satellite = Satellite3D.init(cvSat); } catch (e) { satellite = null; } }
    if (!satellite && cvSat) cvSat.parentElement.style.display = 'none';

    /* ---------- Video: partono solo quando sono in vista ---------- */
    var video = document.querySelectorAll('video.video-sfondo');
    var vio = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        var v = e.target;
        if (e.isIntersecting) { if (v.preload !== 'auto') v.preload = 'auto'; var pr = v.play(); if (pr && pr.catch) pr.catch(function () {}); }
        else v.pause();
      });
    }, { rootMargin: '150px 0px' });
    video.forEach(function (v) { v.muted = true; vio.observe(v); });

    /* ---------- Hero: ingresso ---------- */
    var h1 = dividiRighe(document.querySelector('.hero h1'));
    gsap.timeline({ defaults: { ease: 'power4.out' } })
      .from('#terra3d', { opacity: 0, duration: 2.4, ease: 'power2.out' }, 0)
      .from(h1, { yPercent: 110, duration: 1.2, stagger: .09 }, .25)
      .from('.hero .entra', { y: 24, opacity: 0, duration: 1, stagger: .12 }, .6)
      .from('.scorri', { opacity: 0, duration: 1 }, 1.2);

    /* ---------- Hero: un solo movimento di camera dallo spazio all'Italia ---------- */
    ScrollTrigger.create({ trigger: '.hero', start: 'top top', end: 'bottom bottom', scrub: true,
      onUpdate: function (st) { if (terra) terra.setProgress(st.progress); } });
    gsap.timeline({ scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom bottom', scrub: 1 } })
      .to('.scorri', { opacity: 0, duration: .08 }, 0)
      .to('.hero-testo', { y: -140, opacity: 0, duration: .22, ease: 'power1.in' }, .16)
      /* passaggio alla foto: la stessa inquadratura obliqua, il movimento continua */
      .fromTo('.s3', { opacity: 0, scale: 1.22, filter: 'blur(10px)' }, { opacity: 1, scale: 1.08, filter: 'blur(0px)', duration: .12, ease: 'power1.out' }, .84)
      .to('.s3', { scale: 1, duration: .04, ease: 'none' }, .96)
      .to('#terra3d', { opacity: 0, duration: .1 }, .88);

    /* ---------- Titoli di sezione ---------- */
    document.querySelectorAll('.sez h2.righe').forEach(function (h) {
      var r = dividiRighe(h);
      gsap.from(r, { yPercent: 110, duration: 1.1, ease: 'power4.out', stagger: .08, scrollTrigger: { trigger: h, start: 'top 85%' } });
    });
    gsap.utils.toArray('.testa-sez .oe-tag-chip, .testa-sez .lead, .testa-sez .link-freccia').forEach(function (el) {
      gsap.from(el, { y: 20, opacity: 0, duration: .9, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 88%' } });
    });

    /* ---------- Video: il riquadro si apre fino a tutto schermo ---------- */
    gsap.timeline({ scrollTrigger: { trigger: '.video-pista', start: 'top top', end: 'bottom bottom', scrub: 1 } })
      .fromTo('.video', { clipPath: 'inset(14% 18% 14% 18%)' }, { clipPath: 'inset(0% 0% 0% 0%)', ease: 'none' }, 0)
      .fromTo('.video .video-sfondo', { scale: 1.18 }, { scale: 1, ease: 'none' }, 0);
    gsap.from('.video-palco', { opacity: 0, y: 80, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: '.video-pista', start: 'top 80%' } });

    /* ---------- Mosaico: dalla tessera centrale alla griglia ---------- */
    gsap.timeline({ scrollTrigger: { trigger: '.mosaico-pista', start: 'top top', end: 'bottom bottom', scrub: 1 } })
      .fromTo('.mosaico', { scale: 3.04 }, { scale: 1, ease: 'power2.inOut', duration: 1 }, 0)
      .fromTo('.tessera img', { scale: 1.25 }, { scale: 1, ease: 'none', duration: 1 }, 0)
      .fromTo('.tessera:not(.centro)', { '--velo': .85 }, { '--velo': 0, ease: 'none', duration: .6 }, .2);

    /* ---------- KPI: comparsa, cifre che si cercano, satellite che ruota ---------- */
    ScrollTrigger.batch('.kpi', {
      start: 'top 88%',
      onEnter: function (els) {
        gsap.from(els, { opacity: 0, y: 70, duration: 1, ease: 'power3.out', stagger: .12 });
        els.forEach(function (k, i) { setTimeout(function () { cerca(k.querySelector('.cifra')); }, 200 + i * 120); });
      }
    });
    function cerca(el) {
      if (!el || el.dataset.fatto) return;
      el.dataset.fatto = '1';
      var fine = el.textContent, giri = 0;
      var t = setInterval(function () {
        el.textContent = String(Math.floor(Math.random() * 10));
        if (++giri > 14) { clearInterval(t); el.textContent = fine; }
      }, 55);
    }
    if (satellite) ScrollTrigger.create({ trigger: '#numeri', start: 'top bottom', end: 'bottom top', onUpdate: function (st) { satellite.setProgress(st.progress); } });
    gsap.from('.satellite3d', { opacity: 0, scale: .85, duration: 1.4, ease: 'power3.out', scrollTrigger: { trigger: '.satellite3d', start: 'top 85%' } });

    /* ---------- Ingressi: tre scene a tutto schermo ---------- */
    var scene = gsap.utils.toArray('.scena'), pannelli = gsap.utils.toArray('.porta-pannello'), tacche = gsap.utils.toArray('.tacca');
    var tl = gsap.timeline({ scrollTrigger: { trigger: '.ingressi-pista', start: 'top top', end: 'bottom bottom', scrub: .8,
      onUpdate: function (st) {
        var i = Math.min(2, Math.floor(st.progress * 3));
        tacche.forEach(function (t, k) { t.classList.toggle('attiva', k === i); });
      } } });
    tl.fromTo(scene[0].querySelector('video'), { scale: 1.12 }, { scale: 1, duration: 1, ease: 'none' }, 0)
      .fromTo(tacche[0].querySelector('b'), { scaleX: 0 }, { scaleX: 1, duration: 1, ease: 'none' }, 0);
    [1, 2].forEach(function (i) {
      var at = i - .18;
      tl.fromTo(scene[i], { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: .36, ease: 'power2.inOut' }, at)
        .fromTo(scene[i].querySelector('video'), { scale: 1.3 }, { scale: 1, duration: 1.18, ease: 'none' }, at)
        .to(pannelli[i - 1], { y: -50, autoAlpha: 0, duration: .16, ease: 'power2.in' }, at)
        .fromTo(pannelli[i], { y: 60, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .2, ease: 'power3.out' }, at + .16)
        .fromTo(tacche[i].querySelector('b'), { scaleX: 0 }, { scaleX: 1, duration: 1 - .18, ease: 'none' }, i + .18 - .18);
    });
    tl.to({}, { duration: .2 });

    /* ---------- Perché adesso: la Terra si avvicina, il testo si accende ---------- */
    var lead = document.querySelector('.parole');
    lead.setAttribute('aria-label', lead.textContent);
    lead.innerHTML = lead.textContent.trim().split(/\s+/).map(function (p) { return '<span class="parola" aria-hidden="true">' + p + '</span>'; }).join(' ');
    var parole = lead.querySelectorAll('.parola');
    ScrollTrigger.create({
      trigger: '.perche-sez', start: 'top top', end: 'bottom bottom', scrub: true,
      onUpdate: function (st) {
        var n = Math.round(gsap.utils.mapRange(.12, .78, 0, parole.length, st.progress));
        parole.forEach(function (w, k) { w.classList.toggle('accesa', k < n); });
      }
    });
    gsap.fromTo('.perche-foto .video-sfondo', { scale: 1.25 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: '.perche-sez', start: 'top bottom', end: 'bottom bottom', scrub: true } });

    /* ---------- Scadenze: le schede scorrono di lato (schermi larghi) ---------- */
    mm.add('(min-width: 961px)', function () {
      var pista = document.querySelector('.scadenze');
      var finestra = document.querySelector('.scad-finestra');
      var dist = function () { return Math.max(0, pista.scrollWidth - finestra.clientWidth + 32); };
      gsap.to(pista, { x: function () { return -dist(); }, ease: 'none',
        scrollTrigger: { trigger: '.scad-palco', start: 'top top', end: function () { return '+=' + (dist() + window.innerHeight * .4); }, pin: true, scrub: 1, invalidateOnRefresh: true } });
      gsap.from('.scad', { y: 60, opacity: 0, duration: 1, stagger: .1, ease: 'power3.out', scrollTrigger: { trigger: '.scad-palco', start: 'top 70%' } });
    });

    /* ---------- Resta aggiornato ---------- */
    gsap.from('.qr-blocco', { y: 60, opacity: 0, duration: 1.1, ease: 'power3.out', scrollTrigger: { trigger: '.guida', start: 'top 80%' } });
    gsap.fromTo('.guida-media .video-sfondo', { yPercent: 6, scale: 1.15 }, { yPercent: -4, scale: 1.05, ease: 'none', scrollTrigger: { trigger: '.guida-sez', start: 'top bottom', end: 'bottom top', scrub: true } });

    /* ---------- Se la larghezza cambia, i titoli si ridividono in righe ---------- */
    var larghezza = window.innerWidth, timer;
    window.addEventListener('resize', function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        if (Math.abs(window.innerWidth - larghezza) < 40) return;
        larghezza = window.innerWidth;
        document.querySelectorAll('h1.righe, h2.righe').forEach(function (h) { var r = dividiRighe(h); gsap.set(r, { yPercent: 0 }); });
        ScrollTrigger.refresh();
      }, 250);
    });
  }

  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(avvia);
})();
