// 显示存储由 player-display-store.js 提供；本服务只核对当前玩家身份。
function createPlayerPortraitService({ storage, getContext, getSnapshot, reservedNames = [], onChange = () => {} }) {
  const reserved = new Set(reservedNames.map(normalizePlayerPortraitName));
  const fixed = new Set(['玩家', 'player', 'user', 'oc']);
  const displayStore = createPlayerDisplayStore({ storage, getContext });
  function context() {
    const ctx = getContext();
    const chatId = ctx?.getCurrentChatId?.() ?? ctx?.chatId;
    const scope = playerDisplayScope(ctx);
    let state = null;
    try {
      const snapshot = getSnapshot(), source = snapshot?.source;
      const sameSource = !source || (String(source.chatId) === String(chatId) &&
        (source.characterId ?? null) === (ctx.characterId ?? null) && (source.groupId ?? null) === (ctx.groupId ?? null));
      if (sameSource) state = snapshot?.state;
    } catch (_) {}
    const primaryName = typeof state?.玩家?.姓名 === 'string' ? state.玩家.姓名.trim() : '';
    const personaName = typeof ctx.name1 === 'string' ? ctx.name1.trim() : '';
    const otherNames = state?.人际 && typeof state.人际 === 'object' && !Array.isArray(state.人际) ? Object.keys(state.人际) : [];
    return { scope, primaryName, personaName, otherNames };
  }
  function get() {
    const info = context(), record = displayStore.get();
    if (record.scope !== info.scope) throw new Error('读取时聊天已切换，请重新读取。');
    const profileMismatch = !!record.profileName && record.profileName !== info.primaryName;
    return { ...record, ...info, avatarUrl: profileMismatch ? '' : record.avatarUrl,
      aliases: profileMismatch ? [] : record.aliases, profileMismatch };
  }
  function same(expected, current) {
    return expected && expected.scope === current.scope && expected.primaryName === current.primaryName &&
      expected.personaName === current.personaName && expected.revision === current.revision;
  }
  function requireCurrent(expected) {
    const current = get();
    if (!same(expected, current)) throw new Error('聊天、玩家身份或头像设置已变化，请重新读取后保存。');
    return current;
  }
  function blocked(name, snapshot) {
    const key = normalizePlayerPortraitName(name);
    return reserved.has(key) || snapshot.otherNames.some(other => normalizePlayerPortraitName(other) === key);
  }
  function checkedAliases(values, current) {
    const names = validatePlayerDisplayAliases(values);
    const conflict = names.find(name => !fixed.has(normalizePlayerPortraitName(name)) && blocked(name, current));
    if (conflict) throw new Error('别名“' + conflict + '”与已知人物重名，请换一个明确称呼。');
    return names;
  }
  function finish(current, record) {
    const saved = get();
    if (saved.scope !== current.scope || saved.primaryName !== current.primaryName || saved.personaName !== current.personaName) {
      throw new Error('保存时聊天或玩家身份已切换，请在目标聊天重新读取。');
    }
    if (saved.revision !== record.revision) throw new Error('头像设置在保存后又发生变化，请重新读取。');
    onChange(saved);
    return saved;
  }
  function save(expected, values) {
    const current = requireCurrent(expected);
    const aliases = checkedAliases(values.aliases, current), avatarUrl = validatePlayerPortraitUrl(values.avatarUrl);
    return finish(current, displayStore.save(current, { aliases, avatarUrl }));
  }
  function clear(expected) {
    const current = requireCurrent(expected);
    return finish(current, displayStore.save(current, { avatarUrl: '', aliases: [] }));
  }
  function saveAliases(expected, values) {
    const current = requireCurrent(expected), aliases = checkedAliases(values.aliases, current);
    return finish(current, displayStore.save(current, { aliases }));
  }
  function clearAliases(expected) {
    const current = requireCurrent(expected);
    return finish(current, displayStore.save(current, { aliases: [] }));
  }
  function resolve(name, snapshot) {
    snapshot = snapshot || get();
    if (!safePlayerPortraitName(name)) return null;
    const key = normalizePlayerPortraitName(name);
    const match = fixed.has(key) || (!blocked(name, snapshot) &&
      [snapshot.primaryName, snapshot.personaName, ...snapshot.aliases].some(candidate =>
        safePlayerPortraitName(candidate) && normalizePlayerPortraitName(candidate) === key));
    return match ? { src: snapshot.avatarUrl, player: true, hasShieldFrame: false, prepared: false,
      portraitScale: 1, objectPosition: 'center top' } : null;
  }
  return { get, save, clear, saveAliases, clearAliases, resolve };
}

// 只处理正则产出的安全候选；不读写聊天原文，不从任意正文猜说话人。
function createPlayerBubbleBinder({ host, document: doc, service, css = '' }) {
  const originals = new Map(), decorated = new Map();
  let destroyed = false, queued = false, observer = null, style = null, lastIdentity = null;
  const selector = '#chat .mes[is_user="false"] .mes_text [data-rkd]';
  function element(tag, attribute, text) {
    const node = doc.createElement(tag);
    if (attribute) node.setAttribute(attribute, '');
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function removeDecoration(node) {
    const previous = decorated.get(node);
    if (!previous) return;
    previous.avatar.querySelectorAll('[data-rkd-oc-image],[data-rkd-oc-initial]').forEach(child => child.remove());
    if (previous.runtimeAttribute === null) node.removeAttribute('data-rkd-runtime-player');
    else node.setAttribute('data-rkd-runtime-player', previous.runtimeAttribute);
    decorated.delete(node);
  }
  function restore(node) {
    const original = originals.get(node);
    if (!original) return;
    const currentSource = node.querySelector('[data-rkd-source]');
    removeDecoration(node);
    if (currentSource && currentSource !== original.source) {
      // A host redraw owns its new source; cached text must not replace it.
      originals.delete(node);
      node.removeAttribute('data-rkd-player');
      return;
    }
    node.replaceChildren(original.source);
    node.setAttribute('data-rkd', 'candidate');
    node.removeAttribute('data-rkd-player');
    originals.delete(node);
  }
  function promote(node) {
    const source = node.querySelector('[data-rkd-source]');
    if (!source) return false;
    const match = /^[ ]{0,3}([^:：]+?)[ \t]*[:：][ \t]*([\s\S]*?)[ \t]*$/.exec(source.textContent);
    if (!match) return false;
    originals.set(node, { source });
    const avatar = element('span', 'data-rkd-avatar'); avatar.setAttribute('aria-hidden', 'true');
    const body = element('div', 'data-rkd-body');
    body.append(element('span', 'data-rkd-speaker', match[1].trim()), element('div', 'data-rkd-line', match[2]));
    node.replaceChildren(avatar, body);
    node.setAttribute('data-rkd', 'bubble'); node.setAttribute('data-rkd-player', 'true');
    return true;
  }
  function decorationComplete(node, record) {
    if (!record || node.getAttribute('data-rkd') !== 'bubble' ||
        node.getAttribute('data-rkd-name') !== record.name || node.getAttribute('data-rkd-runtime-player') !== 'true' ||
        node.querySelector('[data-rkd-avatar]') !== record.avatar ||
        record.initial.parentNode !== record.avatar || record.initial.textContent !== record.initialText ||
        record.avatar.querySelectorAll('[data-rkd-oc-initial]').length !== 1) return false;
    const images = record.avatar.querySelectorAll('[data-rkd-oc-image]');
    if (!record.src || record.imageFailed) return images.length === 0 && !record.initial.hidden;
    return images.length === 1 && images[0] === record.image && record.image.parentNode === record.avatar &&
      record.image.getAttribute('src') === record.src && record.initial.hidden === record.imageLoaded;
  }
  function decorate(node, identity, snapshot) {
    let avatar = node.querySelector('[data-rkd-avatar]');
    if (!avatar) {
      if (!node.querySelector('[data-rkd-body]')) return;
      avatar = element('span', 'data-rkd-avatar'); avatar.setAttribute('aria-hidden', 'true');
      node.prepend(avatar);
    }
    const signature = snapshot.scope + '\n' + snapshot.revision + '\n' + snapshot.primaryName + '\n' + snapshot.personaName + '\n' + identity.src;
    const previous = decorated.get(node);
    if (previous?.signature === signature && decorationComplete(node, previous)) return;
    const imageFailed = previous?.signature === signature && previous.imageFailed;
    removeDecoration(node);
    avatar.querySelectorAll('[data-rkd-oc-image],[data-rkd-oc-initial]').forEach(child => child.remove());
    const initialText = Array.from(snapshot.primaryName || snapshot.personaName || '玩家')[0];
    const initial = element('span', 'data-rkd-oc-initial', initialText);
    const record = { avatar, signature, name: node.getAttribute('data-rkd-name'), src: identity.src,
      initial, initialText, image: null, imageFailed: !!imageFailed, imageLoaded: false,
      runtimeAttribute: node.getAttribute('data-rkd-runtime-player') };
    decorated.set(node, record); node.setAttribute('data-rkd-runtime-player', 'true');
    avatar.append(initial);
    if (identity.src && !record.imageFailed) {
      const image = element('img', 'data-rkd-oc-image'); image.alt = ''; image.decoding = 'async';
      record.image = image;
      image.addEventListener('error', () => {
        if (decorated.get(node) !== record) return;
        record.imageFailed = true; record.imageLoaded = false; initial.hidden = false; image.remove();
      });
      image.addEventListener('load', () => {
        if (decorated.get(node) !== record || image.parentNode !== avatar) return;
        record.imageLoaded = true; initial.hidden = true;
      });
      image.src = identity.src; avatar.append(image);
    }
  }
  function refresh(force = false) {
    if (destroyed || typeof doc.querySelectorAll !== 'function') return;
    let snapshot = null;
    try { snapshot = service.get(); } catch (_) {}
    const identityKey = snapshot ? JSON.stringify([snapshot.scope, snapshot.revision, snapshot.primaryName, snapshot.personaName, snapshot.otherNames]) : null;
    if (!force && identityKey === lastIdentity) return;
    lastIdentity = identityKey;
    const nodes = [...doc.querySelectorAll(selector)];
    const active = new Set(nodes);
    for (const node of [...originals.keys()]) if (!active.has(node)) restore(node);
    for (const node of [...decorated.keys()]) if (!active.has(node)) { removeDecoration(node); decorated.delete(node); }
    for (const node of nodes) {
      const kind = node.getAttribute('data-rkd');
      if (!['candidate', 'bubble'].includes(kind)) continue;
      const name = node.getAttribute('data-rkd-name');
      const identity = snapshot ? service.resolve(name, snapshot) : null;
      if (!identity) { if (originals.has(node)) restore(node); else removeDecoration(node); continue; }
      if (kind === 'candidate' && !promote(node)) continue;
      decorate(node, identity, snapshot);
    }
  }
  function schedule() {
    if (queued || destroyed) return;
    queued = true;
    Promise.resolve().then(() => { queued = false; refresh(true); });
  }
  if (typeof doc.createElement === 'function' && doc.head && typeof doc.querySelectorAll === 'function') {
    style = element('style');
    style.textContent = css + '\n[data-rkd="bubble"][data-rkd-runtime-player] [data-rkd-avatar]::after{background-image:none}' +
      '\n[data-rkd-oc-image]{position:absolute;inset:0;display:block;width:100%;height:100%;padding:3px;box-sizing:border-box;object-fit:contain}' +
      '\n[data-rkd-oc-initial]{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:1.2em;color:#66563c}' +
      '\n[data-rkd-oc-initial][hidden]{display:none}';
    doc.head.appendChild(style);
    if (typeof host.MutationObserver === 'function' && doc.body) {
      observer = new host.MutationObserver(records => {
        if (records.some(record => {
          const target = record.target?.closest ? record.target : record.target?.parentElement || record.target?.parentNode;
          const node = target?.closest?.('[data-rkd]'), current = decorated.get(node);
          // Our complete decoration and image fallback need no second pass.
          // A host morph may keep the outer node while replacing its descendants.
          return !current || !decorationComplete(node, current);
        })) schedule();
      });
      observer.observe(doc.body, { childList: true, subtree: true, characterData: true, attributes: true,
        attributeFilter: ['data-rkd', 'data-rkd-name', 'data-rkd-runtime-player', 'data-rkd-player',
          'data-rkd-avatar', 'data-rkd-oc-initial', 'data-rkd-oc-image', 'src'] });
    }
    refresh(true);
  }
  return { refresh, destroy() {
    if (destroyed) return;
    destroyed = true; observer?.disconnect();
    for (const node of [...originals.keys()]) restore(node);
    for (const node of [...decorated.keys()]) removeDecoration(node);
    style?.remove(); style = null;
  } };
}
