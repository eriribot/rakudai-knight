// 在原生剧情组装提示前读取近期通讯人物；只管理本次提示，不修改世界书或 MVU。
function createLimeStoryPersonaService(options = {}) {
  const timeoutMs = Math.min(5000, Math.max(1, Number(options.timeoutMs) || 5000));
  const setTimer = options.setTimeout || setTimeout, clearTimer = options.clearTimeout || clearTimeout;
  let revision = 0, active = null, managed = null;
  const released = new WeakSet();
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  function result(task, reason, contacts = [], applied = false) {
    return { applied, contacts, skipped: task ? task.skipped.slice() : [], reason };
  }
  function releaseHandle(handle) {
    if (!handle || typeof handle.uninject !== 'function' || released.has(handle)) return;
    released.add(handle);
    try { handle.uninject(); } catch (_) { /* Cleanup cannot block normal story generation. */ }
  }
  function release() {
    const handle = managed; managed = null; releaseHandle(handle);
  }
  function cancel(reason = 'cancelled') {
    revision++; release();
    const task = active; active = null;
    if (task) {
      task.skipped.push({ contact: '', reason: reason === 'timeout' ? '人物档案读取超过 5 秒，本轮继续正常剧情。' : '人物提示已取消。' });
      task.resolveCancel(result(task, reason));
    }
  }
  function alive(task) {
    return task.token === revision && !(typeof options.isDestroyed === 'function' && options.isDestroyed());
  }
  function contextScope() {
    const context = options.getContext();
    if (!context || !Array.isArray(context.chat)) throw new Error('当前聊天上下文尚未就绪。');
    const character = Array.isArray(context.characters) ? context.characters[context.characterId] : null;
    return { chat: context.chat, chatId: typeof context.getCurrentChatId === 'function' ? context.getCurrentChatId() : context.chatId,
      characterId: context.characterId, groupId: context.groupId, avatar: character && character.avatar };
  }
  function sameScope(saved) {
    const current = contextScope();
    return Object.keys(saved).every(key => current[key] === saved[key]);
  }
  function capture(snapshot) {
    if (!snapshot || snapshot.pending || !object(snapshot.state) || !object(snapshot.source)) return null;
    const scope = contextScope(), source = snapshot.source;
    if ((scope.chatId ?? null) !== (source.chatId ?? null) || (scope.characterId ?? null) !== (source.characterId ?? null) ||
      (scope.groupId ?? null) !== (source.groupId ?? null)) throw new Error('人物档案与当前聊天来源不一致。');
    return { scope, state: structuredClone(snapshot.state), stateKey: JSON.stringify(snapshot.state), sourceKey: JSON.stringify(source) };
  }
  async function unchanged(task, frozen) {
    if (!alive(task) || !sameScope(frozen.scope)) return false;
    const snapshot = await options.getSnapshot();
    return alive(task) && sameScope(frozen.scope) && !!snapshot && !snapshot.pending &&
      JSON.stringify(snapshot.source) === frozen.sourceKey && JSON.stringify(snapshot.state) === frozen.stateKey;
  }
  function validLore(lore) {
    return object(lore) && typeof lore.name === 'string' && lore.name.trim() && typeof lore.worldbook === 'string' &&
      lore.worldbook.trim() && Array.isArray(lore.entries) && lore.entries.length && lore.entries.every(entry =>
        object(entry) && Number.isInteger(entry.uid) && entry.uid >= 0 && typeof entry.name === 'string' &&
        entry.name.trim() && typeof entry.content === 'string' && entry.content.trim());
  }
  async function run(task) {
    const frozen = capture(await options.getSnapshot());
    if (!alive(task)) return result(task, 'cancelled');
    if (!frozen) return result(task, 'mvu-pending');
    const records = await options.getRecords();
    if (!Array.isArray(records)) throw new Error('近期通讯记录不是受支持的数组。');
    if (!await unchanged(task, frozen)) return result(task, alive(task) ? 'source-changed' : 'cancelled');
    const relations = frozen.state.人际 || {}, deleted = frozen.state.系统 && frozen.state.系统.已删除人物;
    const candidates = [], seen = new Set();
    for (let index = records.length - 1; index >= 0 && candidates.length < 3; index--) {
      const name = records[index] && records[index].contact;
      if (typeof name !== 'string' || !name.trim() || seen.has(name)) continue;
      seen.add(name);
      const relation = Object.prototype.hasOwnProperty.call(relations, name) ? relations[name] : null;
      if (!object(relation) || relation.已加联系方式 !== true || Array.isArray(deleted) && deleted.includes(name)) {
        task.skipped.push({ contact: name, reason: '未交换联系方式或已从当前分支删除，沿用普通世界书规则。' });
        continue;
      }
      candidates.push({ name, relation });
    }
    if (!candidates.length) return result(task, 'no-contact');
    const selected = [], canonical = new Set();
    let size = 0;
    for (const candidate of candidates) {
      let lore;
      try { lore = await options.getCharacterLore(candidate.name); }
      catch (error) {
        if (!await unchanged(task, frozen)) return result(task, alive(task) ? 'source-changed' : 'cancelled');
        task.skipped.push({ contact: candidate.name, reason: error && error.message || '人物世界书档案未读取。' });
        continue;
      }
      if (!await unchanged(task, frozen)) return result(task, alive(task) ? 'source-changed' : 'cancelled');
      if (!validLore(lore)) {
        task.skipped.push({ contact: candidate.name, reason: '人物世界书档案格式不完整，继续正常剧情。' }); continue;
      }
      if (canonical.has(lore.name) || Array.isArray(deleted) && deleted.includes(lore.name)) {
        task.skipped.push({ contact: candidate.name, reason: '规范人物重复或已删除，未重复注入。' }); continue;
      }
      const amount = lore.entries.reduce((total, entry) => total + entry.content.length, 0);
      if (size + amount > 64000) {
        task.skipped.push({ contact: candidate.name, reason: '完整人物原文超出本轮 64000 字符预算，未截断档案。' }); continue;
      }
      size += amount; canonical.add(lore.name); selected.push({ lore, relation: candidate.relation });
    }
    if (!selected.length) return result(task, 'no-lore');
    if (!await unchanged(task, frozen)) return result(task, alive(task) ? 'source-changed' : 'cancelled');
    const state = frozen.state;
    const facts = JSON.stringify({ 主角模式: state.系统 && state.系统.主角模式 || '未记录', 玩家: state.玩家 || {},
      场景: state.场景 || {}, 当前时间: state.场景 && state.场景.时间 || '',
      近期通讯人物关系: selected.map(item => ({ 姓名: item.lore.name, 关系资料: item.relation })) });
    const loreText = selected.map(item => item.lore.entries.map(entry =>
      '【人物：' + item.lore.name + ' / 世界书：' + item.lore.worldbook + ' / 条目：' + entry.name + ' / UID：' + entry.uid + '】\n' + entry.content
    ).join('\n\n')).join('\n\n');
    const content = '【LIME近期通讯人物性格依据】\n以下是当前分支近期通联人物的明确世界书原文与当前MVU事实。' +
      '只用于人物口吻、称呼、距离感、信任及回应意愿；其他人物仍遵循原本世界书。' +
      '不强迫每轮来信，不新增玩家行动，不把历史通讯重新执行或自动奖励。' +
      '好感与支援各自独立，支援S不等于恋爱或服从；null与未知不等于零，不倒补告白、婚约或亲密经历。' +
      '仅用当前卷章已经发生的事实，档案未来经历不可提前实现，人物不泄露自己尚不知情的秘密。' +
      '本提示不直接改动或计分；主剧情实际发生的态度与协作变化仍按原有MVU规则结算。\n' +
      '【当前本局事实】\n' + facts + '\n【人物世界书原文与出处】\n' + loreText;
    const handle = options.injectPrompt(content, task.id);
    if (!handle || typeof handle.uninject !== 'function') {
      task.skipped.push({ contact: '', reason: '人物提示未返回 managed uninject 接口，继续正常剧情。' });
      return result(task, 'unmanaged-injection');
    }
    managed = handle;
    if (!await unchanged(task, frozen)) {
      if (managed === handle) release(); else releaseHandle(handle);
      return result(task, alive(task) ? 'source-changed' : 'cancelled');
    }
    return result(task, '', selected.map(item => item.lore.name), true);
  }
  async function prepare() {
    cancel();
    const task = { token: revision, id: 'rk-lime:story-persona:' + Date.now().toString(36) + ':' + revision,
      skipped: [] };
    if (['getSnapshot', 'getRecords', 'getContext', 'getCharacterLore', 'injectPrompt'].some(key => typeof options[key] !== 'function')) {
      task.skipped.push({ contact: '', reason: '人物提示读取接口未就绪，本轮继续普通世界书。' });
      return result(task, 'capability-unavailable');
    }
    const cancelled = new Promise(resolve => { task.resolveCancel = resolve; }); active = task;
    const timer = setTimer(() => { if (active === task) cancel('timeout'); }, timeoutMs);
    try {
      return await Promise.race([run(task).catch(error => {
        if (task.token === revision) release();
        task.skipped.push({ contact: '', reason: error && error.message || '人物提示读取失败，继续正常剧情。' });
        return result(task, 'unavailable');
      }), cancelled]);
    } finally {
      clearTimer(timer); if (active === task) active = null;
    }
  }
  return Object.freeze({ prepare, cancel });
}
