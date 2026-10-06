(function () {
  'use strict';
  // The official sheet is an identity reference; these are generated derivative frames.
  // Both layers use one immutable 1024 × 1536 coordinate system at every viewport.
  const rig = Object.freeze({
    canvas: Object.freeze({ width: 1024, height: 1536 }),
    body: 'assets/stella.png',
    expression: 'assets/stella-expression.png',
    regions: Object.freeze({
      eyes: Object.freeze({ x: 435, y: 205, width: 153, height: 60 }),
      mouth: Object.freeze({ x: 496, y: 277, width: 50, height: 31 })
    }),
    blinkPeriodMs: 4700,
    blinkClosedMs: 141,
    speakingPeriodMs: 360,
    format: 'aligned-full-canvas-overlays',
    fallback: 'static-neutral-body'
  });
  const portrait = document.getElementById('portrait-stella');
  if (!portrait) return;
  Object.entries(rig.regions).forEach(function (entry) {
    const name = entry[0];
    const region = entry[1];
    const layer = portrait.querySelector(name === 'eyes' ? '.eye-layer' : '.mouth-layer');
    if (!layer) return;
    Object.assign(layer.style, {
      left: region.x / rig.canvas.width * 100 + '%',
      top: region.y / rig.canvas.height * 100 + '%',
      width: region.width / rig.canvas.width * 100 + '%',
      height: region.height / rig.canvas.height * 100 + '%',
      backgroundSize: (rig.canvas.width / region.width * 100) + '% ' + (rig.canvas.height / region.height * 100) + '%',
      backgroundPosition: (region.x / (rig.canvas.width - region.width) * 100) + '% ' + (region.y / (rig.canvas.height - region.height) * 100) + '%'
    });
  });
  const expression = new Image();
  expression.onload = function () {
    if (expression.naturalWidth === rig.canvas.width && expression.naturalHeight === rig.canvas.height) {
      portrait.dataset.layersReady = 'true';
    }
  };
  expression.onerror = function () { portrait.dataset.layersReady = 'false'; };
  expression.src = rig.expression;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  function syncAnimation() {
    portrait.dataset.animate = String(!document.hidden && !motion.matches);
  }
  document.addEventListener('visibilitychange', syncAnimation);
  motion.addEventListener('change', syncAnimation);
  syncAnimation();
  Object.defineProperty(window, 'SupportPortraitRig', { value: rig, writable: false });
}());
