(function () {
  'use strict';

  if (window.SupportDemo) return;

  function init() {
    const STORAGE_KEY = 'rakudai-support-demo-v1';
    const story = window.SupportDemoStory;
    const get = function (id) { return document.getElementById(id); };
    const node = {
      hub: get('hub-view'), event: get('event-view'), result: get('result-view'),
      start: get('support-start'), rank: get('rank-current'), status: get('support-status'),
      startLabel: get('support-start-label'), badge: get('rank-c'), badgeNote: get('rank-c-note'),
      reset: get('reset-demo'), speaker: get('dialogue-speaker'), text: get('dialogue-text'),
      count: get('dialogue-count'), next: get('dialogue-next'),
      ikki: get('portrait-ikki'), stella: get('portrait-stella'),
      auto: get('auto-play'), openLog: get('open-log'), leave: get('leave-event'),
      log: get('log-dialog'), logLines: get('log-lines'), closeLog: get('close-log'),
      resultTitle: get('result-title'), resultCopy: get('result-copy'),
      resultBack: get('result-back'), resultReplay: get('result-replay'), storage: get('storage-note')
    };
    const required = ['hub', 'event', 'result', 'start', 'speaker', 'text', 'next'];
    if (!story || !Array.isArray(story.lines) || !story.lines.length || required.some(function (key) { return !node[key]; })) {
      if (node.storage) node.storage.textContent = '演示未能载入完整内容，请刷新页面后重试。';
      if (node.start) node.start.disabled = true;
      return;
    }

    const media = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    let reducedMotion = Boolean(media && media.matches);
    let completed = false;
    let storageUsable = true;
    let storageMessage = '演示进度仅保存在当前浏览器。';
    let screen = 'hub';
    let index = 0;
    let typing = false;
    let autoPlay = false;
    let typeTimer = null;
    let autoTimer = null;
    let displayedCharacters = 0;
    let replay = false;
    let logOpen = false;

    function writeText(element, value) {
      if (element) element.textContent = value;
    }

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw !== null) {
        const saved = JSON.parse(raw);
        completed = Boolean(saved && saved.version === 1 && saved.completed === true);
        if (!saved || saved.version !== 1 || typeof saved.completed !== 'boolean') {
          storageMessage = '旧的演示记录不可用，已从初始状态开始。';
        }
      }
    } catch (error) {
      if (error instanceof SyntaxError) {
        storageMessage = '演示记录无法读取，已从初始状态开始。';
      } else {
        storageUsable = false;
        storageMessage = '浏览器未允许本地保存，本次仍可完整体验。';
      }
    }

    function clearTyping() {
      if (typeTimer !== null) window.clearTimeout(typeTimer);
      typeTimer = null;
    }

    function clearAuto() {
      if (autoTimer !== null) window.clearTimeout(autoTimer);
      autoTimer = null;
    }

    function setPortraits() {
      const current = story.lines[index];
      ['ikki', 'stella'].forEach(function (speaker) {
        const portrait = node[speaker];
        if (!portrait) return;
        portrait.dataset.speaking = String(screen === 'event' && typing && current.speaker === speaker);
        portrait.dataset.active = String(screen === 'event' && current.speaker === speaker);
        portrait.dataset.emotion = current.speaker === speaker ? current.emotion : 'neutral';
      });
    }

    function notifyLine() {
      setPortraits();
      document.dispatchEvent(new CustomEvent('support:line', {
        detail: Object.freeze({ speaker: story.lines[index].speaker, typing: typing, index: index })
      }));
    }

    function updateNextLabel() {
      const label = typing ? '显示完整台词' : index === story.lines.length - 1 ? (completed ? '结束回看' : '完成支援') : '下一句';
      const current = story.lines[index];
      const speakerName = story.speakers[current.speaker] || current.speaker;
      node.next.setAttribute('aria-label', speakerName + '：' + current.text + ' ' + label);
      const hint = node.next.querySelector('.continue-hint');
      if (hint) {
        const labelNode = Array.from(hint.childNodes).find(function (child) { return child.nodeType === Node.TEXT_NODE; });
        if (labelNode) labelNode.nodeValue = label + ' ';
        else hint.prepend(document.createTextNode(label + ' '));
      }
    }

    function updateHub() {
      writeText(node.rank, completed ? 'C' : '—');
      writeText(node.status, completed ? 'C 级支援已达成' : '支援对话已就绪');
      writeText(node.startLabel, completed ? '回看 C 级支援' : '观看 C 级支援');
      writeText(node.badgeNote, completed ? '已达成 · 可回看' : '可解锁');
      if (node.badge) {
        node.badge.dataset.unlocked = String(completed);
        node.badge.setAttribute('aria-label', completed ? 'C 级支援已达成' : 'C 级支援待解锁');
      }
      node.hub.dataset.completed = String(completed);
      writeText(node.storage, storageMessage);
    }

    function focus(element) {
      if (element && typeof element.focus === 'function') element.focus({ preventScroll: true });
    }

    function showScreen(nextScreen) {
      screen = nextScreen;
      node.hub.hidden = screen !== 'hub';
      node.event.hidden = screen !== 'event';
      node.result.hidden = screen !== 'result';
      document.body.dataset.supportView = screen;
      setPortraits();
    }

    function setAuto(value) {
      clearAuto();
      autoPlay = Boolean(value && screen === 'event' && !logOpen && !document.hidden);
      if (node.auto) {
        node.auto.setAttribute('aria-pressed', String(autoPlay));
        node.auto.textContent = autoPlay ? '自动 · 开' : '自动 · 关';
      }
      if (autoPlay && !typing) scheduleAuto();
    }

    function scheduleAuto() {
      clearAuto();
      if (!autoPlay || typing || screen !== 'event' || logOpen || document.hidden) return;
      // Full text remains readable after the typewriter finishes, including in reduced motion.
      const delay = Math.max(2600, Array.from(story.lines[index].text).length * 125);
      autoTimer = window.setTimeout(function () {
        autoTimer = null;
        advance();
      }, delay);
    }

    function finishLine() {
      clearTyping();
      typing = false;
      writeText(node.text, story.lines[index].text);
      displayedCharacters = Array.from(story.lines[index].text).length;
      node.text.setAttribute('aria-busy', 'false');
      updateNextLabel();
      notifyLine();
      scheduleAuto();
    }

    function showLine() {
      clearTyping();
      clearAuto();
      const current = story.lines[index];
      const characters = Array.from(current.text);
      writeText(node.speaker, story.speakers[current.speaker] || current.speaker);
      writeText(node.count, String(index + 1).padStart(2, '0') + ' / ' + String(story.lines.length).padStart(2, '0'));
      displayedCharacters = 0;
      typing = !reducedMotion && !document.hidden;
      node.text.setAttribute('aria-label', current.text);
      node.text.setAttribute('aria-busy', String(typing));
      writeText(node.text, typing ? '' : current.text);
      updateNextLabel();
      notifyLine();
      if (!typing) {
        scheduleAuto();
        return;
      }
      function typeCharacter() {
        displayedCharacters += 1;
        writeText(node.text, characters.slice(0, displayedCharacters).join(''));
        if (displayedCharacters >= characters.length) {
          finishLine();
          return;
        }
        const punctuation = /[，。！？；：…]/.test(characters[displayedCharacters - 1]);
        typeTimer = window.setTimeout(typeCharacter, punctuation ? 145 : 37);
      }
      typeTimer = window.setTimeout(typeCharacter, 80);
    }

    function startEvent() {
      closeLog();
      clearTyping();
      setAuto(false);
      replay = completed;
      index = 0;
      showScreen('event');
      showLine();
      focus(node.next);
    }

    function finishEvent() {
      clearTyping();
      setAuto(false);
      typing = false;
      if (!completed) {
        completed = true;
        if (storageUsable) {
          try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
              version: 1, completed: true, completedAt: new Date().toISOString()
            }));
          } catch (error) {
            storageUsable = false;
            storageMessage = '本次支援已完成；浏览器未允许保存，刷新后将恢复初始状态。';
          }
        }
      }
      updateHub();
      writeText(node.resultTitle, replay ? 'C 级支援 · 回看完成' : 'C 级支援达成');
      writeText(node.resultCopy, replay ? '那场训练之后的约定，仍留在这里。随时可以再看一次。' : '从看懂对方的一招开始，明天的训练有了约定。史黛拉与一辉的支援等级提升至 C。');
      showScreen('result');
      notifyLine();
      focus(node.resultBack);
    }

    function advance() {
      if (screen !== 'event' || logOpen || document.hidden) return;
      clearAuto();
      if (typing) {
        finishLine();
      } else if (index < story.lines.length - 1) {
        index += 1;
        showLine();
      } else {
        finishEvent();
      }
    }

    function closeLog() {
      if (!node.log || !logOpen) return;
      logOpen = false;
      if (typeof node.log.close === 'function' && node.log.open) node.log.close();
      else node.log.removeAttribute('open');
      if (screen === 'event') focus(node.openLog);
    }

    function openLog() {
      if (screen !== 'event' || !node.log || !node.logLines) return;
      setAuto(false);
      if (typing) finishLine();
      node.logLines.replaceChildren();
      story.lines.slice(0, index + 1).forEach(function (line, lineIndex) {
        const entry = document.createElement('div');
        entry.className = 'log-entry';
        entry.dataset.speaker = line.speaker;
        const name = document.createElement('strong');
        name.textContent = String(lineIndex + 1).padStart(2, '0') + ' · ' + story.speakers[line.speaker];
        const text = document.createElement('p');
        text.textContent = line.text;
        entry.append(name, text);
        node.logLines.append(entry);
      });
      logOpen = true;
      if (typeof node.log.showModal === 'function') node.log.showModal();
      else node.log.setAttribute('open', '');
      focus(node.closeLog);
      node.logLines.scrollTop = node.logLines.scrollHeight;
    }

    function leaveEvent() {
      closeLog();
      clearTyping();
      setAuto(false);
      typing = false;
      showScreen('hub');
      notifyLine();
      updateHub();
      focus(node.start);
    }

    function resetDemo() {
      closeLog();
      clearTyping();
      setAuto(false);
      typing = false;
      completed = false;
      replay = false;
      index = 0;
      try {
        window.localStorage.removeItem(STORAGE_KEY);
        storageUsable = true;
        storageMessage = '已重置演示进度，可以重新体验 C 级支援。';
      } catch (error) {
        storageUsable = false;
        storageMessage = '本次演示已重置；浏览器未允许修改本地记录。';
      }
      showScreen('hub');
      notifyLine();
      updateHub();
      focus(node.start);
    }

    function on(element, event, handler) {
      if (element) element.addEventListener(event, handler);
    }

    on(node.start, 'click', startEvent);
    on(node.next, 'click', advance);
    on(node.auto, 'click', function () { setAuto(!autoPlay); });
    on(node.openLog, 'click', openLog);
    on(node.closeLog, 'click', closeLog);
    on(node.leave, 'click', leaveEvent);
    on(node.resultBack, 'click', leaveEvent);
    on(node.resultReplay, 'click', startEvent);
    on(node.reset, 'click', resetDemo);
    on(node.log, 'cancel', function (event) { event.preventDefault(); closeLog(); });
    on(node.log, 'close', function () { logOpen = false; });
    on(node.log, 'click', function (event) {
      if (event.target !== node.log) return;
      const rect = node.log.getBoundingClientRect();
      const outside = event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
      if (outside) closeLog();
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        if (logOpen) { event.preventDefault(); closeLog(); }
        else if (screen === 'event') { event.preventDefault(); leaveEvent(); }
        return;
      }
      const target = event.target;
      if ((event.key === 'Enter' || event.key === ' ') && event.repeat && screen === 'event' && target === node.next) {
        event.preventDefault();
        return;
      }
      if ((event.key !== 'Enter' && event.key !== ' ') || event.repeat || event.ctrlKey || event.altKey || event.metaKey) return;
      if (target instanceof Element && target.closest('button, input, textarea, select, a, [contenteditable="true"], [role="button"]')) return;
      if (screen === 'event' && !logOpen) {
        event.preventDefault();
        advance();
      }
    });

    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) return;
      setAuto(false);
      if (screen === 'event' && typing) finishLine();
    });

    window.addEventListener('pagehide', function () {
      setAuto(false);
      if (screen === 'event' && typing) finishLine();
      clearTyping();
      clearAuto();
    });

    function onMotionChange(event) {
      reducedMotion = event.matches;
      document.documentElement.dataset.reducedMotion = String(reducedMotion);
      if (reducedMotion && screen === 'event' && typing) finishLine();
    }
    if (media && typeof media.addEventListener === 'function') media.addEventListener('change', onMotionChange);
    else if (media && typeof media.addListener === 'function') media.addListener(onMotionChange);
    document.documentElement.dataset.reducedMotion = String(reducedMotion);

    Object.defineProperty(window, 'SupportDemo', {
      configurable: false,
      writable: false,
      value: Object.freeze({
        story: story,
        get state() {
          return Object.freeze({
            screen: screen, index: index, typing: typing, autoPlay: autoPlay,
            completed: completed, total: story.lines.length, logOpen: logOpen,
            reducedMotion: reducedMotion, storageUsable: storageUsable
          });
        }
      })
    });

    showScreen('hub');
    setAuto(false);
    updateHub();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
}());
