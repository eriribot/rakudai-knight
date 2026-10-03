(() => {
  'use strict';
  const runtime = window.CombatActors;
  const poses = [
    { id: 'walk-a', name: '踏出' }, { id: 'walk-b', name: '重心交替' },
    { id: 'walk-c', name: '跨步' }, { id: 'windup', name: '蓄勢' },
    { id: 'slash', name: '斬擊' }, { id: 'guard', name: '收勢・格擋' }
  ];
  const names = { player: '黑鐵一輝', enemy: '史黛菈' };
  const $ = id => document.getElementById(id);
  let selectedSide = 'player';
  let selectedFrame = 0;
  let assetsReady = false;
  let slowTimer = null;
  let operation = 0;
  let lastSide = 'player';
  const assetControls = ['attack-ikki', 'attack-stella', 'replay', 'previous-frame', 'next-frame', 'slow-frames'];

  function updateSelection() {
    for (const button of document.querySelectorAll('[data-select-side]')) {
      const selected = button.dataset.selectSide === selectedSide;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    }
    $('frame-counter').textContent = String(selectedFrame + 1).padStart(2, '0') + ' / 06';
  }

  function highlight(side, pose) {
    for (const tile of document.querySelectorAll('.pose-tile[data-side="' + side + '"]')) {
      const active = tile.dataset.pose === pose;
      tile.classList.toggle('is-current', active);
      tile.setAttribute('aria-pressed', String(active));
    }
    const found = poses.find(item => item.id === pose);
    const title = found ? found.name : '待機';
    $('pose-' + side).textContent = title;
    $('actor-' + side).setAttribute('aria-label', names[side] + '，' + title + '姿勢');
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
    highlight(side, poses[selectedFrame].id);
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
    $('mode-tag').textContent = '動作播放';
    $('scene-status').textContent = names[side] + '準備出擊。';
    try {
      await runtime.attack(side, { onImpact() {
        if (token === operation) $('scene-status').textContent = '刀鋒交會。';
      } });
      if (token === operation) {
        $('mode-tag').textContent = '演練完成';
        $('scene-status').textContent = '進身、出劍、收勢。可以再次播放，或選一格細看。';
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
      tile.setAttribute('aria-label', names[side] + '：第 ' + (index + 1) + ' 格，' + pose.name);
      tile.setAttribute('aria-pressed', 'false');
      const thumb = document.createElement('span');
      thumb.className = 'pose-thumb';
      thumb.setAttribute('aria-hidden', 'true');
      thumb.style.setProperty('--frame-x', (index % 3) * 50 + '%');
      thumb.style.setProperty('--frame-y', Math.floor(index / 3) * 100 + '%');
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
    cancelPlayback();
    $('mode-tag').textContent = assetsReady ? '待機' : '素材載入中';
    $('scene-status').textContent = assetsReady ? '選擇角色出擊，或點選下方姿勢。' : '正在準備人物動作。';
  });
  for (const button of document.querySelectorAll('[data-select-side]')) {
    button.addEventListener('click', () => {
      selectedSide = button.dataset.selectSide;
      updateSelection();
      if (assetsReady) showFrame(selectedSide, selectedFrame);
    });
  }
  $('previous-frame').addEventListener('click', () => showFrame(selectedSide, selectedFrame - 1));
  $('next-frame').addEventListener('click', () => showFrame(selectedSide, selectedFrame + 1));
  $('slow-frames').addEventListener('click', () => {
    if (slowTimer !== null) {
      stopSlow();
      $('mode-tag').textContent = '姿勢已暫停';
      return;
    }
    cancelPlayback();
    showFrame(selectedSide, selectedFrame, true);
    $('slow-frames').setAttribute('aria-pressed', 'true');
    $('slow-frames').textContent = 'Ⅱ 暫停逐格';
    slowTimer = window.setInterval(() => showFrame(selectedSide, selectedFrame + 1, true), 800);
  });
  window.addEventListener('combat:pose', event => {
    highlight(event.detail.side, event.detail.pose);
    if (event.detail.side === selectedSide && event.detail.frame >= 0) {
      selectedFrame = event.detail.frame;
      updateSelection();
    }
  });
  window.addEventListener('pagehide', cancelPlayback);
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) $('motion-note').hidden = false;

  runtime.ready.then(report => {
    assetsReady = report.ok;
    for (const side of ['player', 'enemy']) {
      const path = side === 'player' ? 'assets/ikki-unified-motion.png' : 'assets/stella-motion.png';
      const sheet = report.assets.find(asset => asset.path === path);
      if (sheet?.ok) $('poses-' + side).style.setProperty('--cell-ratio', String((sheet.width / 3) / (sheet.height / 2)));
    }
    for (const id of assetControls) $(id).disabled = !assetsReady;
    for (const tile of document.querySelectorAll('.pose-tile')) tile.disabled = !assetsReady;
    $('mode-tag').textContent = assetsReady ? '待機' : '素材未就緒';
    $('scene-status').textContent = assetsReady
      ? '選擇角色出擊，或點選下方六格姿勢。'
      : '人物素材尚未載入完成，請於素材就緒後重新整理。';
  }).catch(() => {
    $('mode-tag').textContent = '素材未就緒';
    $('scene-status').textContent = '人物素材無法載入，請重新整理後再試。';
  });
})();
