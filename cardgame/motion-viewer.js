(() => {
  'use strict';
  const runtime = window.CombatActors;
  const poses = [
    { id: 'guard', name: '站姿' }, { id: 'slash', name: '揮砍' }
  ];
  const idleFrame = poses.findIndex(pose => pose.id === 'guard');
  const names = { player: '黑鐵一輝', enemy: '史黛菈' };
  const phases = { idle: '站立', ready: '準備', approach: '殘影突進', charge: '蓄力', strike: '揮砍命中', block: '格擋', recoil: '受擊', retreat: '歸位', guard: '防禦', insight: '觀察' };
  const $ = id => document.getElementById(id);
  let selectedSide = 'player';
  let selectedFrame = idleFrame;
  let assetsReady = false;
  let slowTimer = null;
  let operation = 0;
  let lastSide = 'player';
  const assetControls = ['attack-ikki', 'attack-stella', 'replay', 'previous-frame', 'next-frame', 'slow-frames', 'reset-pose', 'select-ikki', 'select-stella'];

  function setControlsReady(ready) {
    assetsReady = ready;
    for (const id of assetControls) $(id).disabled = !ready;
    for (const tile of document.querySelectorAll('.pose-tile')) tile.disabled = !ready;
  }

  function fitThumbnails(side) {
    const thumbs = [...$('poses-' + side).querySelectorAll('.pose-thumb')];
    const styles = thumbs.map(thumb => getComputedStyle(thumb));
    const prefix = side === 'player' ? '--ikki-' : '--stella-';
    const baseHeight = parseFloat(styles[0]?.getPropertyValue('--motion-base-height'));
    const span = Math.max(...styles.flatMap(style => ['frame-w', 'frame-h'].map(key => parseFloat(style.getPropertyValue(prefix + key)))));
    if (!Number.isFinite(baseHeight) || !Number.isFinite(span) || span <= 0) return;
    // Fit both complete source crops with one shared scale per character.
    for (const thumb of thumbs) thumb.style.setProperty('--preview-scale', String(baseHeight / span * .9));
  }

  function updateSelection() {
    for (const button of document.querySelectorAll('[data-select-side]')) {
      const selected = button.dataset.selectSide === selectedSide;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    }
    $('frame-counter').textContent = String(selectedFrame + 1).padStart(2, '0') + ' / ' + String(poses.length).padStart(2, '0');
  }

  function highlight(side, pose, inspecting = false, phase = 'idle') {
    const visiblePose = pose === 'idle' ? 'guard' : pose;
    for (const tile of document.querySelectorAll('.pose-tile[data-side="' + side + '"]')) {
      const active = tile.dataset.pose === visiblePose;
      tile.classList.toggle('is-current', active);
      tile.setAttribute('aria-pressed', String(active));
    }
    const found = poses.find(item => item.id === visiblePose);
    const title = inspecting && found ? '逐格 · ' + found.name : phases[phase] || found?.name || '待機';
    $('pose-' + side).textContent = title;
    $('actor-' + side).setAttribute('aria-label', names[side] + '，' + title);
    if (side === selectedSide && found) {
      selectedFrame = poses.indexOf(found);
      updateSelection();
    }
  }

  function stopSlow() {
    if (slowTimer !== null) window.clearInterval(slowTimer);
    slowTimer = null;
    $('slow-frames').setAttribute('aria-pressed', 'false');
    $('slow-frames').textContent = '▷ 慢速逐格';
  }

  function cancelPlayback() {
    operation++;
    stopSlow();
    runtime.reset();
    highlight('player', 'idle');
    highlight('enemy', 'idle');
  }

  function showFrame(side, index, preserveSlow = false) {
    if (!assetsReady) return;
    if (!preserveSlow) cancelPlayback();
    selectedSide = side;
    selectedFrame = (index + poses.length) % poses.length;
    const actor = $('actor-' + side);
    actor.dataset.pose = poses[selectedFrame].id;
    actor.dataset.phase = 'inspect';
    actor.classList.add('is-active');
    highlight(side, poses[selectedFrame].id, true);
    updateSelection();
    $('mode-tag').textContent = preserveSlow ? '慢速逐格' : '姿勢檢視';
    $('scene-status').textContent = names[side] + ' · ' + poses[selectedFrame].name + ' · 第 ' + (selectedFrame + 1) + ' 格';
  }

  async function playAttack(side) {
    if (!assetsReady) return;
    cancelPlayback();
    const token = operation;
    lastSide = side;
    selectedSide = side;
    updateSelection();
    $('mode-tag').textContent = '戰鬥演出';
    $('scene-status').textContent = names[side] + '準備出擊。';
    try {
      await runtime.attack(side, { onImpact() {
        if (token === operation) $('scene-status').textContent = '攻擊命中。';
      } });
      if (token === operation) {
        $('mode-tag').textContent = '演練完成';
        $('scene-status').textContent = '站立 → 殘影突進 → 揮砍 → 歸位。下方可分別檢視站姿與揮砍。';
      }
    } catch (error) {
      if (token === operation) {
        $('mode-tag').textContent = '動作暫不可用';
        $('scene-status').textContent = error.message;
      }
    }
  }

  for (const side of ['player', 'enemy']) {
    poses.forEach((pose, index) => {
      const tile = document.createElement('button');
      tile.className = 'pose-tile';
      tile.dataset.side = side;
      tile.dataset.pose = pose.id;
      tile.disabled = true;
      tile.setAttribute('aria-label', names[side] + '戰鬥姿勢：第 ' + (index + 1) + ' 格，' + pose.name);
      tile.setAttribute('aria-pressed', 'false');
      const thumb = document.createElement('span');
      thumb.className = 'pose-thumb';
      thumb.setAttribute('aria-hidden', 'true');
      {
        thumb.classList.add(side === 'enemy' ? 'stella-frame-thumbnail' : 'ikki-frame-thumbnail');
        thumb.dataset.pose = pose.id;
        const sprite = document.createElement('span');
        sprite.className = 'actor-sprite';
        thumb.append(sprite);
      }
      const label = document.createElement('span');
      label.className = 'pose-tile-label';
      const number = document.createElement('small');
      number.textContent = String(index + 1).padStart(2, '0');
      const name = document.createElement('span');
      name.textContent = pose.name;
      label.append(number, name);
      tile.append(thumb, label);
      tile.addEventListener('click', () => showFrame(side, index));
      $('poses-' + side).append(tile);
    });
  }

  $('attack-ikki').addEventListener('click', () => playAttack('player'));
  $('attack-stella').addEventListener('click', () => playAttack('enemy'));
  $('replay').addEventListener('click', () => playAttack(lastSide));
  $('reset-pose').addEventListener('click', () => {
    if (!assetsReady) return;
    cancelPlayback();
    $('mode-tag').textContent = '待機';
    $('scene-status').textContent = '已回到站姿。可播放完整出擊，或逐格查看站姿與揮砍。';
  });
  for (const button of document.querySelectorAll('[data-select-side]')) {
    button.addEventListener('click', () => {
      if (!assetsReady) return;
      const frame = selectedFrame;
      selectedSide = button.dataset.selectSide;
      updateSelection();
      showFrame(selectedSide, frame);
    });
  }
  $('previous-frame').addEventListener('click', () => showFrame(selectedSide, selectedFrame - 1));
  $('next-frame').addEventListener('click', () => showFrame(selectedSide, selectedFrame + 1));
  $('slow-frames').addEventListener('click', () => {
    if (!assetsReady) return;
    if (slowTimer !== null) {
      stopSlow();
      $('mode-tag').textContent = '逐格已暫停';
      return;
    }
    const frame = selectedFrame;
    cancelPlayback();
    showFrame(selectedSide, frame, true);
    $('slow-frames').setAttribute('aria-pressed', 'true');
    $('slow-frames').textContent = 'Ⅱ 暫停逐格';
    slowTimer = window.setInterval(() => showFrame(selectedSide, selectedFrame + 1, true), 800);
  });
  window.addEventListener('combat:pose', event => {
    highlight(event.detail.side, event.detail.pose, false, event.detail.phase);
  });
  window.addEventListener('pagehide', cancelPlayback);
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) $('motion-note').hidden = false;

  updateSelection();
  runtime.ready.then(report => {
    if (report?.ok) for (const side of ['player', 'enemy']) fitThumbnails(side);
    setControlsReady(Boolean(report?.ok));
    $('mode-tag').textContent = assetsReady ? '待機' : '素材未就緒';
    $('scene-status').textContent = assetsReady
      ? '站姿與揮砍已就緒。出擊依序呈現站立、殘影突進、揮砍與歸位。'
      : '戰鬥動作素材未能完整載入，請重新整理後再試。';
    if (assetsReady) {
      highlight('player', 'idle');
      highlight('enemy', 'idle');
    }
  }).catch(() => {
    setControlsReady(false);
    $('mode-tag').textContent = '素材未就緒';
    $('scene-status').textContent = '戰鬥動作素材無法載入，請重新整理後再試。';
  });
})();
