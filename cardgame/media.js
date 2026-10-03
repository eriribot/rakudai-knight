(() => {
  'use strict';

  const byId = id => document.getElementById(id);
  const tracks = {
    normal: byId('bgm-normal') || new Audio('assets/bgm1.mp3'),
    shura: byId('bgm-shura') || new Audio("assets/let's_go_ahead.mp3")
  };
  const overlay = byId('shura-intro');
  const visual = byId('shura-visual');
  const skip = byId('shura-skip');
  const gifPath = 'assets/tenor.gif';
  let enabled = true, activated = false, battleActive = true;
  let mode = 'normal', blocked = false, error = null;
  let intro = null, playRevision = 0, introRevision = 0, gifBlob = null;

  tracks.normal.loop = true;
  tracks.shura.loop = false;
  tracks.normal.volume = 0.3;
  tracks.shura.volume = 0.4;
  for (const track of Object.values(tracks)) track.preload = 'metadata';

  function state() {
    const track = tracks[mode];
    return Object.freeze({
      enabled, activated, mode,
      playing: enabled && activated && battleActive && !track.paused && !track.ended,
      introActive: Boolean(intro), blocked, error
    });
  }

  function publish() {
    const current = state();
    const status = byId('music-status');
    if (status) status.textContent = !enabled ? '音樂已靜音'
      : !battleActive ? '音樂已暫停'
      : error ? '音樂暫時無法播放'
      : !activated || blocked ? '點擊後播放音樂'
      : mode === 'shura' ? "BGM · Let's go ahead" : 'BGM · 通常戰鬥';
    window.dispatchEvent(new CustomEvent('battle:music-state', {detail: current}));
  }

  function report(kind, message, cause) {
    window.dispatchEvent(new CustomEvent('battle:media-error', {
      detail: {kind, message, reason: cause?.message || String(cause || '')}
    }));
  }

  function desired(track) {
    return enabled && activated && battleActive && tracks[mode] === track;
  }

  function rewind(track) {
    try { track.currentTime = 0; } catch { /* Metadata can still be loading. */ }
  }

  function pauseAll() {
    ++playRevision;
    for (const track of Object.values(tracks)) track.pause();
  }

  // Call play() in the initiating gesture, before any animation or decoding awaits.
  function playCurrent(restart = false) {
    const revision = ++playRevision;
    const current = tracks[mode];
    for (const track of Object.values(tracks)) if (track !== current) track.pause();
    if (restart) rewind(current);
    if (!desired(current)) {
      current.pause();
      publish();
      return;
    }
    blocked = false;
    error = null;
    let pending;
    try { pending = current.play(); }
    catch (cause) { playbackFailed(cause, revision, current); return; }
    Promise.resolve(pending).then(() => {
      if (!desired(current)) current.pause();
      if (revision === playRevision) publish();
    }, cause => playbackFailed(cause, revision, current));
    publish();
  }

  function playbackFailed(cause, revision, track) {
    if (revision !== playRevision || !desired(track) || cause?.name === 'AbortError') return;
    blocked = cause?.name === 'NotAllowedError';
    error = blocked ? null : (cause?.message || '音訊載入失敗');
    publish();
    report('audio', blocked ? '瀏覽器需要一次點擊才能播放音樂。' : '音樂無法播放，戰鬥仍可繼續。', cause);
  }

  function unlock() {
    activated = true;
    if (battleActive && enabled && (tracks[mode].paused || blocked || error)) playCurrent();
    else publish();
  }

  function setEnabled(value) {
    enabled = Boolean(value);
    if (enabled) playCurrent();
    else { pauseAll(); publish(); }
  }

  function closeIntro(completed) {
    const closing = intro;
    if (!closing) return;
    intro = null;
    clearTimeout(closing.loadTimer);
    clearTimeout(closing.durationTimer);
    if (closing.image) {
      closing.image.onload = null;
      closing.image.onerror = null;
      closing.image.removeAttribute('src');
    }
    if (visual) { visual.replaceChildren(); delete visual.dataset.loading; }
    if (overlay) overlay.hidden = true;
    if (closing.url) URL.revokeObjectURL(closing.url);
    const previous = closing.focus;
    if (previous?.isConnected && !previous.disabled) previous.focus({preventScroll: true});
    publish();
    closing.resolve(completed);
  }

  function cancelIntro() { closeIntro(false); }
  function skipIntro() { closeIntro(true); }

  function shuraIntro() {
    cancelIntro();
    if (!battleActive) return Promise.resolve(false);
    mode = 'shura';
    playCurrent(true);
    if (!overlay || !visual) return Promise.resolve(true);

    return new Promise(resolve => {
      const session = {resolve, focus: document.activeElement, image: null, url: null};
      intro = session;
      overlay.hidden = false;
      visual.replaceChildren();
      skip?.focus({preventScroll: true});
      publish();
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        session.durationTimer = setTimeout(() => { if (intro === session) closeIntro(true); }, 180);
        return;
      }

      const image = new Image();
      session.image = image;
      image.alt = '一刀修羅發動動畫';
      image.width = 498;
      image.height = 280;
      image.style.visibility = 'hidden';
      visual.dataset.loading = 'true';
      const fail = cause => {
        if (intro !== session) return;
        report('intro', '發動動畫無法載入，繼續施放一刀修羅。', cause);
        closeIntro(true);
      };
      image.onerror = () => fail('GIF 載入失敗');
      image.onload = () => {
        if (intro !== session) return;
        clearTimeout(session.loadTimer);
        image.style.visibility = 'visible';
        delete visual.dataset.loading;
        session.durationTimer = setTimeout(() => { if (intro === session) closeIntro(true); }, 2250);
      };
      session.loadTimer = setTimeout(() => fail('GIF 載入逾時'), 2500);
      visual.append(image);
      // A new Blob URL starts the animated GIF at its first frame on every use.
      // file:// and an unfinished preload use a distinct request URL instead.
      if (gifBlob) session.url = URL.createObjectURL(gifBlob);
      image.src = session.url || `${gifPath}?activation=${Date.now()}-${++introRevision}`;
    });
  }

  function reset() {
    cancelIntro();
    battleActive = true;
    mode = 'normal';
    rewind(tracks.shura);
    playCurrent(true);
  }

  function finish() {
    battleActive = false;
    cancelIntro();
    pauseAll();
    publish();
  }

  function restoreMode(nextMode) {
    cancelIntro();
    mode = nextMode === 'shura' ? 'shura' : 'normal';
    playCurrent();
  }

  skip?.addEventListener('click', skipIntro);
  for (const track of Object.values(tracks)) {
    track.addEventListener('playing', () => {
      if (!desired(track)) track.pause();
      publish();
    });
    track.addEventListener('pause', publish);
    track.addEventListener('error', () => {
      if (track !== tracks[mode] || !battleActive) return;
      error = '音訊載入失敗';
      publish();
      report('audio', '音樂無法載入，戰鬥仍可繼續。', track.error?.message);
    });
  }
  tracks.shura.addEventListener('ended', () => {
    if (mode !== 'shura' || !battleActive) return;
    mode = 'normal';
    playCurrent(true);
  });
  window.addEventListener('pagehide', finish);

  // Preload only the GIF bytes. Music remains paused until unlock() is called.
  if (location.protocol !== 'file:') {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 5000);
    fetch(gifPath, {signal: abort.signal, cache: 'force-cache'})
      .then(response => {
        if (!response.ok) throw new Error('GIF preload failed');
        return response.blob();
      })
      .then(blob => { gifBlob = blob; })
      .catch(() => {})
      .finally(() => clearTimeout(timer));
  }

  window.BattleMedia = Object.freeze({
    unlock, setEnabled, reset, finish, shuraIntro, cancelIntro, skipIntro, restoreMode,
    get state() { return state(); }
  });
  publish();
})();
