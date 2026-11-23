/* ==========================================================================
   Devika K S — shared behaviour
   - Site: a small helper object (reduced motion, pointer type, a rAF-throttled
     scroll/resize "measure" loop other scripts hook into).
   - Square cursor, torn menu, block wipes, reveal-on-enter, table row fade.
   ========================================================================== */
(function () {
  'use strict';

  var mq = function (q) {
    return window.matchMedia ? window.matchMedia(q) : { matches: false, addEventListener: function () {} };
  };
  var reducedMQ = mq('(prefers-reduced-motion: reduce)');
  var fineMQ = mq('(hover: hover) and (pointer: fine)');

  function clamp(x, lo, hi) {
    if (lo === undefined) lo = 0;
    if (hi === undefined) hi = 1;
    return Math.max(lo, Math.min(hi, x));
  }
  // Map v from range r to output o, clamped at both ends.
  function lerp(v, r, o) {
    if (v <= r[0]) return o[0];
    if (v >= r[1]) return o[1];
    return o[0] + (o[1] - o[0]) * (v - r[0]) / (r[1] - r[0]);
  }
  function onChange(list, fn) {
    if (list.addEventListener) list.addEventListener('change', fn);
    else if (list.addListener) list.addListener(fn);
  }

  // ---- measure loop: everything scroll-driven reads layout here, once per frame
  var measures = [];
  var raf = 0;
  var kickRaf = 0;
  var kickUntil = 0;

  function runMeasures() {
    var vh = window.innerHeight;
    for (var i = 0; i < measures.length; i++) measures[i](vh);
  }
  function requestMeasure() {
    if (raf) return;
    raf = requestAnimationFrame(function () { raf = 0; runMeasures(); });
  }
  // Re-measure every frame for a while (e.g. while a card's width animates).
  function kick(ms) {
    kickUntil = Math.max(kickUntil, performance.now() + (ms || 800));
    if (kickRaf) return;
    var loop = function () {
      runMeasures();
      kickRaf = performance.now() < kickUntil ? requestAnimationFrame(loop) : 0;
    };
    kickRaf = requestAnimationFrame(loop);
  }

  window.addEventListener('scroll', requestMeasure, { passive: true });
  window.addEventListener('resize', requestMeasure);

  // Scroll straight to a section, skipping smooth scrolling. Sections marked
  // data-menu-block="end" (the scroll-driven contact envelope) are landed on at their end.
  function jumpTo(el) {
    var html = document.documentElement;
    var prev = html.style.scrollBehavior;
    html.style.scrollBehavior = 'auto';
    var top = el.getBoundingClientRect().top + window.scrollY;
    var y = el.getAttribute('data-menu-block') === 'end'
      ? Math.max(top, top + el.offsetHeight - window.innerHeight)
      : top;
    window.scrollTo(0, y);
    html.style.scrollBehavior = prev;
    runMeasures();
  }

  var Site = {
    get reduced() { return reducedMQ.matches; },
    get fine() { return fineMQ.matches; },
    clamp: clamp,
    lerp: lerp,
    onMeasure: function (fn) { measures.push(fn); requestMeasure(); },
    measureNow: runMeasures,
    requestMeasure: requestMeasure,
    kick: kick,
    jumpTo: jumpTo,
    onMotionChange: function (fn) { onChange(reducedMQ, fn); },
    onPointerChange: function (fn) { onChange(fineMQ, fn); }
  };
  window.Site = Site;

  // ------------------------------------------------------------------------
  // Square cursor
  // ------------------------------------------------------------------------
  function initCursor() {
    var SIZES = {
      default: [16, 16], link: [10, 10], open: [70, 26.4], view: [84, 26.4], next: [84, 26.4],
      peek: [70, 26.4], play: [70, 26.4], pause: [78, 26.4], unmute: [84, 26.4]
    };
    var LABELS = {
      open: '{ OPEN }', view: '{ VIEW } →', next: '{ NEXT } →', peek: '{ VIEW }',
      play: '{ PLAY }', pause: '{ PAUSE }', unmute: '{ SOUND ON }'
    };
    var el = null;
    var on = false;
    var mode = 'default';
    var started = false;
    var tx = 0, ty = 0;
    var p = { x: 0, y: 0, w: 16, h: 16 };
    var v = { x: 0, y: 0, w: 0, h: 0 };
    var rafId = 0, last = 0;

    function paint() {
      el.style.width = Math.max(0, p.w).toFixed(2) + 'px';
      el.style.height = Math.max(0, p.h).toFixed(2) + 'px';
      el.style.transform = 'translate3d(' + (p.x - p.w / 2).toFixed(2) + 'px,' + (p.y - p.h / 2).toFixed(2) + 'px,0)';
    }

    // Position and size follow on springs (position 400/40, size 320/26).
    function step(now) {
      rafId = 0;
      var dt = Math.min(0.032, Math.max(0.001, (now - last) / 1000));
      last = now;
      var size = SIZES[mode] || SIZES.default;
      var goal = { x: tx, y: ty, w: size[0], h: size[1] };
      var keys = ['x', 'y', 'w', 'h'];
      for (var s = 0; s < 2; s++) {
        var h = dt / 2;
        keys.forEach(function (k) {
          var pos = k === 'x' || k === 'y';
          var a = -(pos ? 400 : 320) * (p[k] - goal[k]) - (pos ? 40 : 26) * v[k];
          v[k] += a * h;
          p[k] += v[k] * h;
        });
      }
      var moving = keys.some(function (k) { return Math.abs(p[k] - goal[k]) > 0.05 || Math.abs(v[k]) > 0.05; });
      if (!moving) p = { x: goal.x, y: goal.y, w: goal.w, h: goal.h };
      paint();
      if (moving) rafId = requestAnimationFrame(step);
    }
    function kickCursor() {
      if (rafId) return;
      last = performance.now();
      rafId = requestAnimationFrame(step);
    }

    function onMove(e) {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      tx = e.clientX;
      ty = e.clientY;
      var t = e.target && e.target.closest ? e.target : null;
      var next = 'default';
      if (t) {
        var tagged = t.closest('[data-cursor]');
        if (tagged) next = tagged.getAttribute('data-cursor') || 'default';
        else if (t.closest('a, button')) next = 'link';
      }
      if (!started) {
        started = true;
        p = { x: tx, y: ty, w: 16, h: 16 };
        v = { x: 0, y: 0, w: 0, h: 0 };
      }
      if (next !== mode) {
        mode = next;
        el.textContent = LABELS[mode] || '';
      }
      el.style.opacity = '1';
      kickCursor();
    }
    function onLeave() { el.style.opacity = '0'; }

    function sync() {
      var want = Site.fine && !Site.reduced;
      if (want === on) return;
      on = want;
      document.documentElement.classList.toggle('cur-on', on);
      if (on) {
        if (!el) {
          el = document.createElement('div');
          el.className = 'cursor';
          el.setAttribute('aria-hidden', 'true');
          document.body.appendChild(el);
        }
        window.addEventListener('pointermove', onMove, { passive: true });
        window.addEventListener('pointerdown', onMove, { passive: true });
        document.documentElement.addEventListener('mouseleave', onLeave);
      } else if (el) {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerdown', onMove);
        document.documentElement.removeEventListener('mouseleave', onLeave);
        if (rafId) cancelAnimationFrame(rafId);
        rafId = 0;
        el.style.opacity = '0';
      }
    }
    sync();
    Site.onMotionChange(sync);
    Site.onPointerChange(sync);
  }

  // ------------------------------------------------------------------------
  // Torn menu
  // phase: closed (hidden) → pre (shown, off-screen) → in → out → closed
  // ------------------------------------------------------------------------
  function initMenu() {
    var btn = document.querySelector('.tm-btn');
    var nav = document.getElementById('torn-menu');
    if (!btn || !nav) return;
    var phase = 'closed';
    var ct = 0;
    var prevOverflow = '';

    function lock(on) {
      var html = document.documentElement;
      if (on) { prevOverflow = html.style.overflow; html.style.overflow = 'hidden'; }
      else html.style.overflow = prevOverflow || '';
    }
    function setPhase(ph) {
      phase = ph;
      nav.classList.toggle('is-pre', ph === 'pre');
      nav.classList.toggle('is-in', ph === 'in');
      nav.classList.toggle('is-out', ph === 'out');
      var open = ph === 'pre' || ph === 'in';
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    }
    function open() {
      clearTimeout(ct);
      nav.hidden = false;
      setPhase('pre');
      lock(true);
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          setPhase('in');
          nav.focus({ preventScroll: true });
        });
      });
    }
    function close() {
      if (phase === 'closed' || phase === 'out') return;
      setPhase('out');
      clearTimeout(ct);
      ct = setTimeout(function () {
        setPhase('closed');
        nav.hidden = true;
        lock(false);
        btn.focus({ preventScroll: true });
      }, Site.reduced ? 0 : 900);
    }

    btn.addEventListener('click', function () {
      if (phase === 'closed') open();
      else close();
    });
    // Esc closes while focus is inside the menu (focus moves to the sheet when it opens).
    nav.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
    });
    nav.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var href = a.getAttribute('href') || '';
        if (href.charAt(0) !== '#') return; // another page: let the browser go there
        e.preventDefault();
        // Jump while the black sheet still covers the screen, then tear it away,
        // so the clicked section is what gets revealed.
        var target = document.querySelector(href);
        if (target) Site.jumpTo(target);
        requestAnimationFrame(function () { requestAnimationFrame(close); });
      });
    });
  }

  // ------------------------------------------------------------------------
  // Block wipes. data-wipe="edge" (default): 0 when the section's top edge
  // touches the viewport bottom, 1 when it reaches the top. data-wipe="footer":
  // finishes exactly as the page ends; the edge only travels the footer's own
  // height (or the whole page's scroll, on a page shorter than that).
  // ------------------------------------------------------------------------
  function initWipes() {
    var wipes = Array.prototype.slice.call(document.querySelectorAll('.wipe'));
    if (!wipes.length) return;
    var last = wipes.map(function () { return -1; });
    Site.onMeasure(function (vh) {
      wipes.forEach(function (w, i) {
        var sec = w.parentElement;
        var p;
        if (w.getAttribute('data-wipe') === 'footer') {
          var maxScroll = document.documentElement.scrollHeight - vh;
          var travel = Math.max(1, Math.min(vh, sec.offsetHeight, maxScroll));
          p = clamp(1 - (maxScroll - window.scrollY) / travel);
        } else {
          p = clamp((vh - sec.getBoundingClientRect().top) / Math.max(1, vh));
        }
        if (Math.abs(p - last[i]) > 0.0005) {
          last[i] = p;
          w.style.setProperty('--p', p.toFixed(4));
        }
      });
    });
  }

  // ------------------------------------------------------------------------
  // Reveal once on enter: [data-reveal] / [data-clip] (landing page) and
  // [data-enter] (case studies: diagrams, bars, media) get data-in.
  // Table rows [data-rowfade] fade 0.15 → 1 as they reach mid-screen.
  // ------------------------------------------------------------------------
  function initReveals() {
    var pending = Array.prototype.slice.call(document.querySelectorAll('[data-reveal], [data-clip], [data-enter]'));
    var rows = Array.prototype.slice.call(document.querySelectorAll('[data-rowfade]'));
    if (!pending.length && !rows.length) return;
    Site.onMeasure(function (vh) {
      if (pending.length) {
        pending = pending.filter(function (el) {
          var b = el.getBoundingClientRect();
          var at = el.hasAttribute('data-enter') ? 0.85 : 0.92;
          if (Site.reduced || (b.top < vh * at && b.bottom > 0)) {
            el.setAttribute('data-in', '');
            return false;
          }
          return true;
        });
      }
      rows.forEach(function (el) {
        var o = 1;
        if (!Site.reduced) {
          var b = el.getBoundingClientRect();
          o = 0.15 + 0.85 * clamp((vh - (b.top + b.bottom) / 2) / (vh * 0.5));
        }
        el.style.opacity = o.toFixed(3);
      });
    });
  }

  // Muted inline loops: make sure they start (some browsers need the property, not just the attribute).
  function initAutoplay() {
    document.querySelectorAll('video[autoplay]').forEach(function (v) {
      v.muted = true;
      v.defaultMuted = true;
      v.playsInline = true;
      if (Site.reduced) { v.removeAttribute('autoplay'); v.pause(); return; }
      var pr = v.play && v.play();
      if (pr && pr.catch) pr.catch(function () {});
    });
  }

  function init() {
    initCursor();
    initMenu();
    initWipes();
    initReveals();
    initAutoplay();
    window.addEventListener('load', requestMeasure);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(requestMeasure);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
