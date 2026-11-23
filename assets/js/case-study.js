/* ==========================================================================
   Case studies — page entry blocks and the next-project glitch.
   Scroll reveals, row fades and the footer wipe live in site.js.
   ========================================================================== */
(function () {
  'use strict';
  var S = window.Site;

  function init() {
    // The entry blocks are a CSS animation; drop them once they have left the screen.
    var blocks = document.querySelector('.entry-blocks');
    if (blocks) setTimeout(function () { blocks.remove(); }, S.reduced ? 0 : 1300);

    // Next-project hover: a 6×4 grid of black squares flickers in random order for 0.4s, then clears.
    var next = document.querySelector('.cs-next');
    if (!next) return;
    var cells = next.querySelectorAll('.cs-glitch span');
    var timer = 0;
    next.addEventListener('mouseenter', function () {
      if (S.reduced) return;
      clearInterval(timer);
      var n = 0;
      timer = setInterval(function () {
        n += 1;
        var done = n >= 8;
        cells.forEach(function (c) { c.style.opacity = done ? '0' : (Math.random() < 0.5 ? '1' : '0'); });
        if (done) clearInterval(timer);
      }, 50);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
