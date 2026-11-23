/* ==========================================================================
   Motion showreel player.
   The reel waits on its first frame until the visitor clicks Play (or the
   video), then plays with sound. It pauses when scrolled out of view and stays
   paused until played again. Progress, time and the seek bar are painted
   straight to the DOM every frame while playing.
   Keys inside the player: Space / K play-pause, M mute, F full screen,
   ← → skip 5s, Home / End on the seek bar.
   ========================================================================== */
(function () {
  'use strict';
  var S = window.Site;

  function init() {
    var player = document.querySelector('.sr-player');
    if (!player) return;
    var hero = document.querySelector('.sr-hero');
    var video = player.querySelector('video');
    var hit = player.querySelector('.sr-hit');
    var playChip = player.querySelector('.sr-play');
    var playBtn = player.querySelector('[data-sr="play"]');
    var muteBtn = player.querySelector('[data-sr="mute"]');
    var fsBtn = player.querySelector('[data-sr="fs"]');
    var vol = player.querySelector('.sr-vol');
    var timeEl = player.querySelector('.sr-time');
    var track = player.querySelector('.sr-track');
    var buf = player.querySelector('.sr-buf');
    var fill = player.querySelector('.sr-fill');
    var knob = player.querySelector('.sr-knob');
    var tip = player.querySelector('.sr-tip');
    var FALLBACK_DURATION = Number(player.getAttribute('data-duration')) || 43.5;
    var vraf = 0;
    var scrubbing = false;
    var scrubT = null;

    video.muted = false;
    video.playsInline = true;
    video.loop = true;

    function dur() {
      var d = video.duration;
      return isFinite(d) && d > 0 ? d : FALLBACK_DURATION;
    }
    function fmt(t) {
      t = Math.max(0, Math.floor(t || 0));
      return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
    }

    function paint() {
      var d = dur();
      var t = scrubT != null ? scrubT : video.currentTime;
      var p = Math.max(0, Math.min(1, t / d));
      fill.style.transform = 'scaleX(' + p.toFixed(4) + ')';
      knob.style.left = (p * 100).toFixed(3) + '%';
      timeEl.textContent = fmt(t) + ' / ' + fmt(d);
      track.setAttribute('aria-valuenow', String(Math.round(t)));
      track.setAttribute('aria-valuemax', String(Math.round(d)));
      track.setAttribute('aria-valuetext', fmt(t) + ' of ' + fmt(d));
    }
    function paintBuf() {
      var end = 0;
      try {
        var b = video.buffered;
        for (var i = 0; i < b.length; i++) if (b.start(i) <= video.currentTime + 0.5) end = Math.max(end, b.end(i));
      } catch (e) {}
      buf.style.transform = 'scaleX(' + Math.min(1, end / dur()).toFixed(4) + ')';
    }
    function paintVol() {
      var muted = video.muted || video.volume === 0;
      var x = muted ? 0 : video.volume;
      if (Math.abs(Number(vol.value) - x) > 0.001) vol.value = String(x);
      vol.style.setProperty('--v', (x * 100).toFixed(1) + '%');
      muteBtn.textContent = muted ? '{ UNMUTE }' : '{ MUTE }';
      muteBtn.setAttribute('aria-label', muted ? 'Turn sound on' : 'Turn sound off');
    }
    function paintPlaying() {
      var playing = !video.paused;
      playChip.hidden = playing;
      hit.setAttribute('data-cursor', playing ? 'pause' : 'play');
      hit.setAttribute('aria-label', playing ? 'Pause showreel' : 'Play showreel');
      playBtn.textContent = playing ? '{ PAUSE }' : '{ PLAY }';
      playBtn.setAttribute('aria-label', playing ? 'Pause showreel' : 'Play showreel');
    }

    function frame() {
      vraf = 0;
      paint();
      paintBuf();
      if (!video.paused) vraf = requestAnimationFrame(frame);
    }

    function play() {
      var p = video.play();
      if (p && p.catch) p.catch(function () {});
    }
    function toggle() {
      if (video.paused) play();
      else video.pause();
    }
    function toggleMute() {
      if (video.muted || video.volume === 0) {
        video.muted = false;
        if (video.volume === 0) video.volume = 1;
      } else video.muted = true;
      paintVol();
    }

    // ---- full screen (the whole player; iPhone falls back to the system player)
    function fsEnabled() { return !!(document.fullscreenEnabled || document.webkitFullscreenEnabled); }
    function fsOk() { return fsEnabled() || !!video.webkitEnterFullscreen; }
    function fsEl() { return document.fullscreenElement || document.webkitFullscreenElement || null; }
    function toggleFs() {
      if (fsEl()) {
        var ex = document.exitFullscreen || document.webkitExitFullscreen;
        if (ex) { var p = ex.call(document); if (p && p.catch) p.catch(function () {}); }
        return;
      }
      var req = player.requestFullscreen || player.webkitRequestFullscreen;
      if (req && fsEnabled()) {
        var r = req.call(player);
        if (r && r.catch) r.catch(function () {});
      } else if (video.webkitEnterFullscreen) {
        video.webkitEnterFullscreen();
      }
    }
    function onFsChange() {
      var on = fsEl() === player;
      fsBtn.textContent = on ? '{ EXIT FULL SCREEN }' : '{ FULL SCREEN }';
      fsBtn.setAttribute('aria-label', on ? 'Exit full screen' : 'Full screen');
    }
    fsBtn.hidden = !fsOk();

    // ---- seek bar: click or drag anywhere on it; hover shows the time under the pointer
    function tAt(x) {
      var r = track.getBoundingClientRect();
      return Math.max(0, Math.min(1, (x - r.left) / Math.max(1, r.width))) * dur();
    }
    function seek(t) {
      try { video.currentTime = Math.max(0, Math.min(dur() - 0.05, t)); } catch (e) {}
    }
    track.addEventListener('pointerdown', function (e) {
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault();
      scrubbing = true;
      try { track.setPointerCapture(e.pointerId); } catch (err) {}
      track.focus({ preventScroll: true });
      scrubT = tAt(e.clientX);
      seek(scrubT);
      paint();
    });
    track.addEventListener('pointermove', function (e) {
      var t = tAt(e.clientX);
      var r = track.getBoundingClientRect();
      tip.style.left = Math.max(0, Math.min(r.width, e.clientX - r.left)).toFixed(1) + 'px';
      tip.textContent = fmt(t);
      if (scrubbing) { scrubT = t; seek(t); paint(); }
    });
    function endScrub() {
      if (!scrubbing) return;
      scrubbing = false;
      scrubT = null;
      paint();
    }
    track.addEventListener('pointerup', endScrub);
    track.addEventListener('pointercancel', endScrub);

    player.addEventListener('keydown', function (e) {
      var tag = (e.target && e.target.tagName) || '';
      var k = e.key;
      if ((k === ' ' && tag !== 'BUTTON' && tag !== 'INPUT') || k === 'k' || k === 'K') { e.preventDefault(); toggle(); }
      else if (k === 'm' || k === 'M') { e.preventDefault(); toggleMute(); }
      else if ((k === 'f' || k === 'F') && !fsBtn.hidden) { e.preventDefault(); toggleFs(); }
      else if (tag !== 'INPUT' && (k === 'ArrowRight' || k === 'ArrowLeft')) {
        e.preventDefault();
        seek(video.currentTime + (k === 'ArrowRight' ? 5 : -5));
        paint();
      } else if (e.target === track && (k === 'Home' || k === 'End')) {
        e.preventDefault();
        seek(k === 'Home' ? 0 : dur());
        paint();
      }
    });

    hit.addEventListener('click', toggle);
    playBtn.addEventListener('click', toggle);
    muteBtn.addEventListener('click', toggleMute);
    fsBtn.addEventListener('click', toggleFs);
    function onVolInput() {
      var x = Math.max(0, Math.min(1, Number(vol.value)));
      video.volume = x;
      video.muted = x === 0;
    }
    vol.addEventListener('input', onVolInput);
    vol.addEventListener('change', onVolInput);

    video.addEventListener('play', function () {
      paintPlaying();
      if (!vraf) vraf = requestAnimationFrame(frame);
    });
    video.addEventListener('pause', function () { paintPlaying(); paint(); });
    video.addEventListener('volumechange', paintVol);
    ['timeupdate', 'seeked', 'loadedmetadata', 'durationchange'].forEach(function (t) { video.addEventListener(t, paint); });
    video.addEventListener('progress', paintBuf);
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);

    // Never starts by itself: only pauses once the player is mostly scrolled out of view.
    S.onMeasure(function (vh) {
      if (video.paused || fsEl() || !hero) return;
      var r = hero.getBoundingClientRect();
      var seen = Math.min(r.bottom, vh) - Math.max(r.top, 0);
      if (seen <= Math.min(r.height, vh) * 0.35) video.pause();
    });

    paint();
    paintVol();
    paintPlaying();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
