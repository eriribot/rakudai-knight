  function viewport() {
    const vv = HW.visualViewport;
    let r = vv ? { x: vv.offsetLeft, y: vv.offsetTop, w: vv.width, h: vv.height }
               : { x: 0, y: 0, w: HW.innerWidth, h: HW.innerHeight };
    if (!isFinite(r.w) || !isFinite(r.h) || r.w < 50 || r.h < 50) {
      r = { x: 0, y: 0, w: HW.innerWidth, h: HW.innerHeight };
    }
    return r;
  }

  function preferDrawer() {
    try { return HW.innerWidth <= 768 || HW.matchMedia('(pointer: coarse)').matches; }
    catch(_) { return HW.innerWidth <= 768; }
  }

  function clampRect(r, vp) {
    const GAP = 10, MINW = 320, MINH = 500;
    const w = Math.min(Math.max(r.w, Math.min(MINW, vp.w - GAP * 2)), vp.w - GAP * 2);
    const h = Math.min(Math.max(r.h, Math.min(MINH, vp.h - GAP * 2)), vp.h - GAP * 2);
    return {
      x: Math.min(Math.max(r.x, vp.x + GAP), vp.x + vp.w - w - GAP),
      y: Math.min(Math.max(r.y, vp.y + GAP), vp.y + vp.h - h - GAP),
      w, h
    };
  }

  function clampOrb(x, y) {
    const vp = viewport();
    return {
      x: Math.min(Math.max(x, vp.x + 4), vp.x + vp.w - ORB_W - 4),
      y: Math.min(Math.max(y, vp.y + 4), vp.y + vp.h - ORB_H - 4)
    };
  }

  function fixedBase() {
    try {
      let el = HD.body;
      while (el) {
        const cs = HW.getComputedStyle(el);
        if (cs && (cs.transform !== 'none' || cs.perspective !== 'none' ||
                   (cs.filter && cs.filter !== 'none') ||
                   (cs.willChange && /transform|perspective/.test(cs.willChange)))) {
          const r = el.getBoundingClientRect();
          const sx = el.offsetWidth ? r.width / el.offsetWidth : 1;
          const sy = el.offsetHeight ? r.height / el.offsetHeight : 1;
          return { x: r.left, y: r.top, sx: sx || 1, sy: sy || 1 };
        }
        if (el === HD.documentElement) break;
        el = el.parentElement || HD.documentElement;
      }
    } catch(_) {}
    return { x: 0, y: 0, sx: 1, sy: 1 };
  }

  function writePos(el, vx, vy, vw, vh) {
    const b = fixedBase();
    el.style.left = ((vx - b.x) / b.sx) + 'px';
    el.style.top  = ((vy - b.y) / b.sy) + 'px';
    if (vw != null) el.style.width  = (vw / b.sx) + 'px';
    if (vh != null) el.style.height = (vh / b.sy) + 'px';
  }

  function placeOrb(p) {
    SS.orbPos = p;
    writePos(SS.orb, p.x, p.y);
  }

  function placeOrbTip() {
    const t = SS.orb && SS.orb.querySelector('.tip');
    if (!t || !t.classList.contains('on')) return;
    const vp = viewport();
    const isLeft = (SS.orbPos.x + ORB_W / 2) > (vp.x + vp.w / 2);
    t.classList.toggle('side-l', isLeft);
    t.classList.toggle('side-r', !isLeft);
  }

  function showOrbTip(title, body) {
    const t = SS.orb && SS.orb.querySelector('.tip');
    if (!t) return;
    t.replaceChildren();
    const heading = HD.createElement('b'); heading.textContent = title || '破军战术终端'; t.appendChild(heading);
    if (body) { const line = HD.createElement('s'); line.textContent = body; t.appendChild(line); }
    t.classList.add('on');
    placeOrbTip();
  }

  function clearOrbTip() {
    const t = SS.orb && SS.orb.querySelector('.tip');
    if (t) { t.classList.remove('on'); t.innerHTML = ''; }
  }

  function applyRect(r) {
    writePos(SS.host, r.x, r.y, r.w, r.h);
    SS.rect = r;
  }

  function defaultRect() {
    const vp = viewport();
    const w = Math.min(412, vp.w - 24);
    const h = Math.min(780, vp.h - 24);
    return {
      x: vp.x + Math.round((vp.w - w) / 2),
      y: vp.y + Math.round((vp.h - h) / 2),
      w, h
    };
  }

  function setMode(m) {
    SS.mode = m;
    if (m === 'drawer') {
      SS.host.classList.add('drawer');
      const vp = viewport();
      const w = Math.min(410, vp.w - 16);
      const h = Math.min(vp.h - 24, Math.max(500, Math.round(w * 1.9)));
      writePos(SS.host, vp.x + (vp.w - w) / 2, vp.y + (vp.h - h) / 2, w, h);
    } else {
      SS.host.classList.remove('drawer');
      applyRect(clampRect(LS.get('rk:rect', null) || defaultRect(), viewport()));
    }
  }

  function recenter() {
    const vp = viewport();
    placeOrb(clampOrb(vp.x + vp.w - ORB_W - 16, vp.y + Math.round(vp.h * 0.45)));
    LS.set('rk:orb', { x: SS.orbPos.x, y: SS.orbPos.y });
    const r = defaultRect();
    LS.set('rk:rect', r);
    if (SS.visible && SS.mode === 'floating') applyRect(clampRect(r, vp));
    return true;
  }

