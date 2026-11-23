/* ==========================================================================
   Landing page
   - Hero intro: "I'm Devika" zooms out of a difference-blend flash, then
     cycles through four typefaces. Replays when the window width changes.
   - Work shelf: vertical scroll slides the row of books sideways (desktop);
     a field of white pixels drifts at different speeds behind it.
   - Books: hover a spine to open it (mouse), tap a spine to open it (touch);
     click an open book to go to the project.
   - Contact envelope: every part is driven by scroll progress.
   - Arriving with #work / #about / #contact jumps straight to that section.
   ========================================================================== */
(function () {
  'use strict';
  var S = window.Site;
  var CYCLE_MS = 500;
  var clamp = S.clamp;
  var lerp = S.lerp;

  // ------------------------------------------------------------------ hero
  function initHero() {
    var hero = document.querySelector('.hero');
    var names = Array.prototype.slice.call(hero.querySelectorAll('.name-v'));
    var v = 0, t0 = 0, iv = 0;
    var lastW = window.innerWidth;
    var rt = 0;

    function show(i) { names.forEach(function (n, k) { n.hidden = k !== i; }); }
    function clearTimers() { clearTimeout(t0); clearInterval(iv); }
    function startCycle(delay) {
      clearTimers();
      if (S.reduced) return;
      t0 = setTimeout(function () {
        iv = setInterval(function () { v = (v + 1) % names.length; show(v); }, CYCLE_MS);
      }, delay);
    }
    function replay() {
      clearTimers();
      v = 0;
      show(0);
      hero.classList.remove('intro-on');
      if (S.reduced) return;
      void hero.offsetWidth; // restart the CSS animations
      hero.classList.add('intro-on');
      startCycle(1600);
    }

    if (S.reduced) hero.classList.remove('intro-on');
    startCycle(1600);
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () {
        if (window.innerWidth === lastW) return;
        lastW = window.innerWidth;
        replay();
      }, 180);
    });
    S.onMotionChange(function () {
      if (S.reduced) { clearTimers(); v = 0; show(0); hero.classList.remove('intro-on'); }
      else startCycle(0);
    });
  }

  // ----------------------------------------------------------------- books
  // Cover height steps down first (55% → 45% → 38%), then the text, until the open card fits.
  var FITS = [['55%', 1], ['45%', 1], ['38%', 1], ['38%', 0.9], ['38%', 0.8]];

  function fitOpen(book) {
    var box = book.querySelector('.book-open');
    if (box.hidden) return;
    for (var i = 0; i < FITS.length; i++) {
      box.style.setProperty('--cover-h', FITS[i][0]);
      box.style.setProperty('--k', String(FITS[i][1]));
      if (box.scrollHeight <= box.clientHeight + 1) break;
    }
  }

  // Spine titles scale down to fit the spine's height, never truncate.
  function fitSpine(book) {
    var spine = book.querySelector('.book-spine');
    if (spine.hidden) return;
    var top = spine.querySelector('.book-spine-top');
    var title = spine.querySelector('.book-spine-title');
    title.style.fontSize = '40px';
    var avail = spine.clientHeight - 16 - (top.offsetTop + top.offsetHeight) - 16;
    var natural = title.offsetHeight;
    if (!natural || avail <= 0) return;
    var size = Math.max(10, Math.min(40, Math.floor((40 * avail / natural) * 10) / 10));
    title.style.fontSize = size + 'px';
  }

  function initBooks(shelf) {
    var books = Array.prototype.slice.call(shelf.querySelectorAll('.book'));
    var openIdx = books.findIndex(function (b) { return b.classList.contains('is-open'); });
    var rt = 0;

    function setOpen(book, on) {
      book.classList.toggle('is-open', on);
      book.querySelector('.book-spine').hidden = on;
      book.querySelector('.book-open').hidden = !on;
      if (on) fitOpen(book);
      else fitSpine(book);
    }
    function openBook(i) {
      if (i === openIdx) return;
      if (openIdx >= 0) setOpen(books[openIdx], false);
      openIdx = i;
      setOpen(books[i], true);
      S.kick(800); // the shelf's travel changes while the widths animate
    }
    function refit() { books.forEach(function (b) { fitSpine(b); fitOpen(b); }); }

    books.forEach(function (book, i) {
      var spine = book.querySelector('.book-spine');
      var box = book.querySelector('.book-open');
      var link = box.querySelector('.book-link');
      var p0 = null, ht = 0, hover = false;

      // Mouse: hovering a spine opens that book; clicking it goes to the project.
      // Touch: a tap on a spine opens the book; a tap on the open book goes to the project.
      spine.addEventListener('mouseenter', function (e) { hover = true; p0 = { x: e.clientX, y: e.clientY }; });
      spine.addEventListener('mousemove', function (e) {
        if (!S.fine) return;
        if (!p0) { p0 = { x: e.clientX, y: e.clientY }; return; }
        // Only a real pointer movement opens a book — never a spine sliding under a still cursor.
        if (e.clientX === p0.x && e.clientY === p0.y) return;
        if (ht) return;
        ht = setTimeout(function () {
          ht = 0;
          if (hover && openIdx !== i) openBook(i);
        }, 110);
      });
      spine.addEventListener('mouseleave', function () { clearTimeout(ht); ht = 0; p0 = null; hover = false; });
      spine.addEventListener('click', function (e) {
        if (S.fine) return;
        e.preventDefault();
        openBook(i);
      });
      box.addEventListener('click', function (e) {
        if (e.target.closest && e.target.closest('a')) return; // the cover and the link already go there
        link.click();
      });
    });

    refit();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(refit);
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(refit, 150);
    });
  }

  // ----------------------------------------------------------------- shelf
  function initShelf() {
    var shelf = document.getElementById('work');
    if (!shelf) return;
    var frame = shelf.querySelector('.shelf-frame');
    var clip = shelf.querySelector('.shelf-clip');
    var row = shelf.querySelector('.shelf-row');
    var pixels = Array.prototype.slice.call(shelf.querySelectorAll('.shelf-pixels span')).map(function (el) {
      return { el: el, top: Number(el.getAttribute('data-top')), speed: Number(el.getAttribute('data-speed')) };
    });
    var mobileMQ = window.matchMedia('(max-width: 900px)');
    var lastH = null;
    var shown = false;

    initBooks(shelf);

    S.onMeasure(function (vh) {
      var st = shelf.getBoundingClientRect().top;

      // Books rise in, staggered, as the shelf arrives.
      var nowIn = S.reduced ? true : (st < vh * 0.6 ? true : (st > vh ? false : shown));
      if (nowIn !== shown) { shown = nowIn; shelf.classList.toggle('is-in', shown); }

      // Travel = how far the row overflows its window, plus a 24px right margin. The section is
      // 100vh + travel tall, so vertical and sideways scroll match 1:1 and the last spine lands
      // 24px from the right edge exactly as the section ends.
      if (!mobileMQ.matches) {
        var travel = Math.max(0, row.scrollWidth - clip.clientWidth + 24);
        var h = Math.round(vh + travel);
        if (h !== lastH) { lastH = h; shelf.style.height = h + 'px'; }
        var u = travel > 0 ? clamp(-st / travel) : 0;
        row.style.transform = 'translateX(' + (-u * travel).toFixed(1) + 'px)';
      } else if (lastH !== null) {
        lastH = null;
        shelf.style.height = '';
        row.style.transform = '';
      }

      // Pixels move at (speed)× the page while the frame scrolls in; once it is pinned they keep
      // drifting up, wrapping off-screen so the field never empties.
      var fh = frame.offsetHeight || 900;
      var s = -st;
      var span = fh + 60;
      pixels.forEach(function (p) {
        var y = p.top * fh;
        if (!S.reduced) {
          var shift = s < 0 ? (p.speed - 1) * s : p.speed * s;
          y = ((((y - shift) + 30) % span) + span) % span - 30;
        }
        p.el.style.transform = 'translateY(' + y.toFixed(1) + 'px)';
      });
    });
  }

  // -------------------------------------------------------------- envelope
  function initEnvelope() {
    var contact = document.getElementById('contact');
    if (!contact) return;
    var q = function (sel) { return contact.querySelector(sel); };
    var pocket = q('.env-pocket');
    var flap = q('.env-flap');
    var shade = q('.env-shade');
    var btns = Array.prototype.slice.call(contact.querySelectorAll('.env-btn'));
    var string = q('.env-string');
    var path = string.querySelector('path');
    var flapText = q('.env-flap-text');
    var rows = Array.prototype.slice.call(contact.querySelectorAll('.env-row'));
    var foot = q('.env-foot');
    var footLink = foot.querySelector('a');
    var last = '';
    var progress = 0;

    var lerp3 = function (x, r, o) {
      return x <= r[1] ? lerp(x, [r[0], r[1]], [o[0], o[1]]) : lerp(x, [r[1], r[2]], [o[1], o[2]]);
    };

    S.onMeasure(function (vh) {
      var r = contact.getBoundingClientRect();
      var reduced = S.reduced;
      // enter: 0 when its top touches the viewport bottom, 1 when it reaches the top.
      // p: 0 when its top reaches the viewport top, 1 when its bottom reaches the viewport bottom.
      var enter = reduced ? 1 : clamp((vh - r.top) / Math.max(1, vh));
      var p = reduced ? 1 : clamp(-r.top / Math.max(1, contact.offsetHeight - vh));
      var key = enter.toFixed(4) + '|' + p.toFixed(4);
      if (key === last) return;
      last = key;
      progress = p;

      // 1. the pocket rises  2. the stepped flap folds down  3. square buttons pop in, the string
      // ties them  4. "Thank You" and the contact rows land.
      pocket.style.transform = 'translateY(' + lerp(enter, [0.25, 1], [100, 0]).toFixed(3) + '%)';
      flap.style.transform = 'rotateX(' + lerp3(p, [0, 0.26, 0.3], [180, -3, 0]).toFixed(3) + 'deg)';
      shade.style.opacity = lerp(p, [0, 0.3], [0.35, 0]).toFixed(3);
      var bs = 'scale(' + lerp(p, [0.3, 0.36], [0, 1]).toFixed(4) + ')';
      btns.forEach(function (b) { b.style.transform = bs; });
      path.style.strokeDashoffset = (1 - lerp(p, [0.36, 0.52], [0, 1])).toFixed(4);
      string.style.opacity = lerp(p, [0.35, 0.36], [0, 1]).toFixed(3);
      flapText.style.opacity = lerp(p, [0.46, 0.6], [0, 1]).toFixed(3);
      flapText.style.transform = 'translateY(' + lerp(p, [0.46, 0.6], [24, 0]).toFixed(2) + 'px)';
      rows.forEach(function (row, i) {
        var a = 0.54 + i * 0.05;
        row.style.opacity = lerp(p, [a, a + 0.08], [0, 1]).toFixed(3);
        row.style.transform = 'translateY(' + lerp(p, [a, a + 0.08], [16, 0]).toFixed(2) + 'px)';
      });
      foot.style.opacity = lerp(p, [0.7, 0.8], [0, 1]).toFixed(3);
      // Links only become clickable once they are visible.
      var pe = reduced || p > 0.66 ? 'auto' : 'none';
      rows.forEach(function (row) { row.style.pointerEvents = pe; });
      footLink.style.pointerEvents = pe;
    });

    // Tabbing into a contact link while the envelope is still closed jumps to its finished state.
    contact.addEventListener('focusin', function (e) {
      if (progress < 0.66 && e.target.closest && e.target.closest('a')) S.jumpTo(contact);
    });
  }

  // ------------------------------------------------- land on #section links
  function landOnHash() {
    var id = decodeURIComponent(location.hash.slice(1));
    if (!id) return;
    var el = document.getElementById(id);
    if (!el) return;
    var jump = function () {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          S.measureNow(); // the shelf's height is only known after the first measure
          S.jumpTo(el);
        });
      });
    };
    jump();
    // Browsers re-apply the #fragment scroll (to the section's top) once the page finishes
    // loading, so land again then, unless the visitor has already scrolled.
    if (document.readyState !== 'complete') {
      var moved = false;
      var onUser = function () { moved = true; };
      ['wheel', 'touchstart', 'keydown'].forEach(function (t) { window.addEventListener(t, onUser, { passive: true, once: true }); });
      window.addEventListener('load', function () { if (!moved) jump(); }, { once: true });
    }
  }

  function init() {
    initHero();
    initShelf();
    initEnvelope();
    landOnHash();
    // Same-page #links to the envelope land on its finished state, not its top.
    window.addEventListener('hashchange', function () {
      var el = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (el && el.getAttribute('data-menu-block') === 'end') S.jumpTo(el);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
