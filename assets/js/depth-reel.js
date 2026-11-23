/* ==========================================================================
   Depth reel
   - Scroll moves focus 1 → N; each piece dwells in focus before the next one
     slides in. Focus follows the scroll on a spring.
   - Caption and index strip show where you are; click a thumbnail to jump.
   - Click the piece in focus to open it large. Keys: ← → Enter Esc.
   - One video plays at a time: the piece the reel is heading to.
   - Phones (< 640px) get a swipe carousel instead of the reel.
   ========================================================================== */
(function () {
  'use strict';
  var S = window.Site;
  var OVERLAP = 0.18;

  function init() {
    var root = document.querySelector('.dr');
    if (!root) return;
    var $ = function (sel) { return root.querySelector(sel); };
    var $$ = function (sel) { return Array.prototype.slice.call(root.querySelectorAll(sel)); };

    var pieces = $$('.dr-piece');
    var arts = pieces.map(function (el) {
      return {
        ratio: Number(el.getAttribute('data-ratio')) || 1,
        title: el.getAttribute('data-title') || '',
        client: el.getAttribute('data-client') || '',
        year: el.getAttribute('data-year') || '',
        video: el.getAttribute('data-video') || '',
        poster: el.getAttribute('data-poster') || ''
      };
    });
    var n = arts.length;
    if (!n) return;
    var spa = S.clamp(Number(root.getAttribute('data-spa')) || 45, 25, 100);
    var stage = $('.dr-stage');
    var items = pieces.map(function (p) { return p.querySelector('.dr-item'); });
    var vids = pieces.map(function (p) { return p.querySelector('video'); });
    var thumbs = $$('.dr-thumb');
    var capBox = $('.dr-cap');
    var capNum = $('.dr-cap-num');
    var capTitle = $('.dr-cap-title');
    var capInfo = $('.dr-cap-info');
    var car = $('.dr-car');
    var slides = $$('.dr-slide');
    var svids = slides.map(function (s) { return s.querySelector('video'); });
    var dots = $$('.dr-dot');
    var mNum = $('.dr-mnum');
    var lb = $('.dr-lb');
    var lbMedia = $('.dr-lb-media');
    var lbVid = lbMedia.querySelector('video');
    var lbNum = $('.dr-lb-num');
    var lbTitle = $('.dr-lb-title');
    var lbInfo = $('.dr-lb-info');
    var lbClose = $('[data-lb="close"]');

    var pad = function (k) { return String(k + 1).padStart(2, '0'); };
    var info = function (a) { return a.year ? a.client + ' · ' + a.year : a.client; };
    var total = String(n).padStart(2, '0');

    var st = { w: window.innerWidth, h: window.innerHeight, focus: 0, intro: S.reduced ? 1 : 0, open: null, capIdx: 0, pin: 0 };
    var f = null, v = 0, target = null, raf = 0, last = 0, introT0 = null;
    var manual = false, capT = 0, lbT = 0, touchX = null, lastFocus = null, prevOverflow = '';
    var lastMode = null;

    [].concat(vids, svids, [lbVid]).forEach(function (el) {
      if (!el) return;
      el.muted = true; el.defaultMuted = true; el.playsInline = true; el.loop = true;
    });

    var mobile = function () { return st.w < 640; };
    var tablet = function () { return !mobile() && st.w < 1024; };
    var travel = function () { return (n - 1) * spa * (st.h / 100); };
    var current = function () { return Math.max(0, Math.min(n - 1, Math.round(st.focus))); };
    function P() {
      return tablet()
        ? { frameW: 0.64 * st.w, frameH: 0.48 * st.h, falloff: 0.3, minScale: 0.4, maxD: 3 }
        : { frameW: 0.46 * st.w, frameH: 0.52 * st.h, falloff: 0.22, minScale: 0.3, maxD: 5 };
    }
    function fit(r, W, H) { var bw = r >= W / H ? W : H * r; return { w: bw, h: bw / r }; }

    // Only the videos of the layout in use load anything; the first few load fully.
    function setPreload() {
      var mode = mobile() ? 'm' : 'd';
      if (mode === lastMode) return;
      lastMode = mode;
      (mode === 'm' ? svids : vids).forEach(function (el, i) {
        if (el) el.preload = i < (mode === 'm' ? 2 : 3) ? 'auto' : 'metadata';
      });
    }

    // ---- videos
    function onScreen() {
      var r = root.getBoundingClientRect();
      return r.bottom > 0 && r.top < window.innerHeight;
    }
    function runVid(el, on) {
      if (!el) return;
      if (on) {
        if (el.paused) {
          try { el.currentTime = 0; } catch (e) {}
          var p = el.play && el.play();
          if (p && p.catch) p.catch(function () {});
        }
      } else if (!el.paused) el.pause();
    }
    function syncVids() {
      var open = st.open !== null;
      var live = !S.reduced && !open && onScreen();
      var cur = current();
      var F = Math.max(0, Math.min(n - 1, st.focus));
      var dest = v > 0.02 ? Math.ceil(F - 0.001) : v < -0.02 ? Math.floor(F + 0.001) : Math.round(F);
      for (var i = 0; i < n; i++) {
        if (mobile()) { runVid(svids[i], live && i === cur); runVid(vids[i], false); }
        else { runVid(vids[i], live && st.intro > 0.9 && i === dest); runVid(svids[i], false); }
      }
      lbVid.controls = S.reduced;
      runVid(lbVid, open && !S.reduced);
    }

    // ---- render the reel
    function render() {
      var cur = current();
      if (!mobile()) {
        var p = P();
        var F = Math.max(0, Math.min(n - 1, st.focus));
        var s = st.intro;
        var sizes = arts.map(function (a, i) {
          var b = fit(a.ratio, p.frameW, p.frameH);
          return { bw: b.w, bh: b.h, sc: Math.max(p.minScale, 1 - p.falloff * Math.abs(i - F)) };
        });
        var X = [0];
        for (var i = 1; i < n; i++) {
          var a = sizes[i - 1].bw * sizes[i - 1].sc, b = sizes[i].bw * sizes[i].sc;
          X[i] = X[i - 1] + (a + b) / 2 - OVERLAP * Math.min(a, b);
        }
        var f0 = Math.max(0, Math.min(n - 1, Math.floor(F)));
        var f1 = Math.min(n - 1, f0 + 1);
        var centre = X[f0] + (X[f1] - X[f0]) * (F - f0);
        var lineY = 0.52 * st.h;

        pieces.forEach(function (el, i) {
          var sz = sizes[i];
          var ad = Math.abs(i - F);
          var op = (ad <= p.maxD - 1 ? 1 : Math.max(0, 1 - (ad - (p.maxD - 1)) * 0.6)) * Math.min(1, s * 1.4 - ad * 0.06 * (1 - s));
          var es = el.style;
          es.top = lineY.toFixed(1) + 'px';
          es.width = sz.bw.toFixed(1) + 'px';
          es.height = sz.bh.toFixed(1) + 'px';
          es.marginLeft = (-sz.bw / 2).toFixed(1) + 'px';
          es.marginTop = (-sz.bh / 2).toFixed(1) + 'px';
          es.transform = 'translateX(' + ((X[i] - centre) * s).toFixed(2) + 'px) scale(' + (sz.sc * (0.6 + 0.4 * s)).toFixed(4) + ')';
          es.opacity = Math.max(0, op).toFixed(3);
          es.zIndex = String(100 - Math.round(ad * 10));
          es.visibility = ad > p.maxD + 0.5 ? 'hidden' : 'visible';
          es.pointerEvents = ad > p.maxD ? 'none' : 'auto';
          items[i].setAttribute('aria-label', arts[i].title + ', ' + arts[i].client + '. ' + (i === cur ? 'Open large view' : 'Bring into focus'));
        });
        capBox.style.top = Math.round(lineY + p.frameH / 2 + 16) + 'px';
        thumbs.forEach(function (t, i) { t.classList.toggle('is-current', i === cur); });
        stage.style.transform = st.pin ? 'translate3d(0,' + st.pin.toFixed(1) + 'px,0)' : 'none';
      } else {
        dots.forEach(function (d, i) { d.classList.toggle('is-current', i === cur); });
        mNum.textContent = '{ ' + pad(cur) + ' / ' + total + ' }';
      }
    }

    // Caption cross-fade (0.2s) when the artwork in focus changes.
    function paintCaption() {
      var a = arts[st.capIdx] || arts[0];
      capNum.textContent = '{ ' + pad(st.capIdx) + ' / ' + total + ' }';
      capTitle.textContent = a.title;
      capInfo.textContent = info(a);
    }
    function update() {
      render();
      syncVids();
      var c = current();
      if (c !== st.capIdx && !capT) {
        if (S.reduced) { st.capIdx = c; paintCaption(); }
        else {
          capBox.style.opacity = '0';
          capT = setTimeout(function () {
            capT = 0;
            st.capIdx = current();
            paintCaption();
            capBox.style.opacity = '1';
          }, 200);
        }
      }
    }

    // Plateau easing: each artwork holds in focus for the middle of its scroll slot.
    function dwell(x) {
      var k = Math.floor(x), t = x - k;
      if (t < 0.22) return k;
      if (t > 0.78) return k + 1;
      var u = (t - 0.22) / 0.56;
      return k + u * u * (3 - 2 * u);
    }
    function progress() {
      return S.clamp(-root.getBoundingClientRect().top / Math.max(1, travel()));
    }

    function onScroll() {
      syncVids();
      if (mobile()) return;
      var p = progress();
      // Fallback "sticky": if something breaks position: sticky, pin the stage with a transform instead.
      if (!manual && p > 0.02 && p < 0.98) {
        var top = stage.getBoundingClientRect().top - (st.pin || 0);
        if (Math.abs(top) > 4) manual = true;
      }
      var pin = manual ? p * travel() : 0;
      if (pin !== st.pin) { st.pin = pin; render(); }
      target = dwell(Math.min(n - 1, Math.max(0, p * (n - 1))));
      kick();
    }

    function kick() {
      if (raf) return;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    }
    // Focus follows the target on a spring (stiffness 140, damping 30, mass 0.6).
    function tick(now) {
      raf = 0;
      var dt = Math.min(0.032, Math.max(0.001, (now - last) / 1000));
      last = now;
      var fx = f === null ? st.focus : f;
      var tgt = target === null ? fx : target;
      if (S.reduced) { fx = tgt; v = 0; }
      else {
        for (var k = 0; k < 2; k++) {
          var h = dt / 2;
          var a = (-140 * (fx - tgt) - 30 * v) / 0.6;
          v += a * h;
          fx += v * h;
        }
        if (Math.abs(fx - tgt) < 0.0005 && Math.abs(v) < 0.0005) { fx = tgt; v = 0; }
      }
      f = fx;
      // Intro: 0 → 1 over 0.9s on an expo ease.
      var intro = st.intro;
      if (introT0 !== null && intro < 1) {
        var q = Math.min(1, (now - introT0) / 900);
        intro = q >= 1 ? 1 : 1 - Math.pow(2, -10 * q);
      }
      if (Math.abs(fx - st.focus) > 0.0001 || intro !== st.intro) {
        st.focus = fx;
        st.intro = intro;
        update();
      }
      if (Math.abs(fx - tgt) > 0.0005 || Math.abs(v) > 0.0005 || (introT0 !== null && intro < 1)) raf = requestAnimationFrame(tick);
    }

    function scrollToArt(i) {
      i = Math.max(0, Math.min(n - 1, i));
      if (mobile()) { carTo(i); return; }
      var slot = travel() / Math.max(1, n - 1);
      var top = window.scrollY + root.getBoundingClientRect().top;
      window.scrollTo({ top: top + i * slot, behavior: S.reduced ? 'auto' : 'smooth' });
    }

    // ---- phone carousel
    var slideW = function () { return st.w * 0.86; };
    function carTo(i) { car.scrollTo({ left: i * slideW(), behavior: S.reduced ? 'auto' : 'smooth' }); }
    car.addEventListener('scroll', function () {
      var i = Math.max(0, Math.min(n - 1, Math.round(car.scrollLeft / slideW())));
      if (i !== st.focus) { st.focus = i; update(); }
    }, { passive: true });

    // ---- lightbox
    function lockScroll(on) {
      var html = document.documentElement;
      if (on) { prevOverflow = html.style.overflow; html.style.overflow = 'hidden'; }
      else html.style.overflow = prevOverflow || '';
    }
    function paintLb() {
      var a = arts[st.open];
      lbMedia.style.setProperty('--r', String(a.ratio));
      if (lbVid.getAttribute('src') !== a.video) {
        lbVid.setAttribute('poster', a.poster);
        lbVid.setAttribute('src', a.video);
      }
      lbVid.setAttribute('aria-label', a.title + ', ' + a.client);
      lb.setAttribute('aria-label', a.title);
      lbNum.textContent = '{ ' + pad(st.open) + ' / ' + total + ' }';
      lbTitle.textContent = a.title;
      lbInfo.textContent = info(a);
    }
    function openBox(i) {
      lastFocus = document.activeElement;
      lockScroll(true);
      st.open = i;
      lbMedia.style.opacity = '1';
      paintLb();
      lb.hidden = false;
      lbClose.focus({ preventScroll: true });
      syncVids();
    }
    function closeLb() {
      clearTimeout(lbT);
      lockScroll(false);
      st.open = null;
      lb.hidden = true;
      runVid(lbVid, false);
      syncVids();
      var lf = lastFocus;
      setTimeout(function () { if (lf && lf.focus) lf.focus({ preventScroll: true }); }, 0);
    }
    // Switching artworks: fade out (0.2s), swap, fade in (0.2s).
    function navLb(dir) {
      if (st.open === null) return;
      var nx = (st.open + dir + n) % n;
      var swap = function () { st.open = nx; paintLb(); runVid(lbVid, false); syncVids(); };
      if (S.reduced) { swap(); return; }
      clearTimeout(lbT);
      lbMedia.style.opacity = '0';
      lbT = setTimeout(function () {
        if (st.open === null) return;
        swap();
        lbMedia.style.opacity = '1';
      }, 200);
    }

    lb.addEventListener('click', closeLb);
    lbMedia.addEventListener('click', function (e) { e.stopPropagation(); });
    $('.dr-lb-nav').addEventListener('click', function (e) { e.stopPropagation(); });
    $('[data-lb="prev"]').addEventListener('click', function () { navLb(-1); });
    $('[data-lb="next"]').addEventListener('click', function () { navLb(1); });
    lbClose.addEventListener('click', closeLb);
    lb.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); closeLb(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); navLb(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); navLb(-1); }
    });
    lb.addEventListener('touchstart', function (e) { var t = e.touches && e.touches[0]; touchX = t ? t.clientX : null; }, { passive: true });
    lb.addEventListener('touchend', function (e) {
      var t = e.changedTouches && e.changedTouches[0];
      if (touchX === null || !t) return;
      var dx = t.clientX - touchX;
      touchX = null;
      if (Math.abs(dx) > 50) navLb(dx < 0 ? 1 : -1);
    });

    // ---- wiring
    items.forEach(function (btn, i) {
      btn.addEventListener('click', function () {
        if (i === current()) openBox(i);
        else scrollToArt(i);
      });
    });
    thumbs.forEach(function (t, i) { t.addEventListener('click', function () { scrollToArt(i); }); });
    slides.forEach(function (s, i) { s.addEventListener('click', function () { openBox(i); }); });
    dots.forEach(function (d, i) { d.addEventListener('click', function () { carTo(i); }); });
    root.addEventListener('keydown', function (e) {
      if (st.open !== null || mobile() || lb.contains(e.target)) return;
      var c = current();
      if (e.key === 'ArrowRight' && c < n - 1) { e.preventDefault(); scrollToArt(c + 1); }
      if (e.key === 'ArrowLeft' && c > 0) { e.preventDefault(); scrollToArt(c - 1); }
    });

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', function () {
      st.w = window.innerWidth;
      st.h = window.innerHeight;
      setPreload();
      onScroll();
      update();
    });

    // The intro plays once, when the reel first comes into view (after the page-entry blocks).
    function begin() { if (S.reduced || introT0 !== null) return; introT0 = performance.now(); kick(); }
    if (typeof IntersectionObserver === 'function') {
      var io = new IntersectionObserver(function (es) {
        if (es.some(function (x) { return x.isIntersecting; })) { io.disconnect(); setTimeout(begin, 650); }
      }, { threshold: 0 });
      io.observe(root);
    } else setTimeout(begin, 650);

    setPreload();
    paintCaption();
    onScroll();
    update();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
