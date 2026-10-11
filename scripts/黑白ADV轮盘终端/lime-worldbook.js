// LIME 只读当前角色 primary 世界书；按明确人物名选择，不模拟世界书关键词触发。
// 接口沿用已核定的 calendar-worldbook.js；每次读前后重核角色、聊天与绑定。
function createLimeWorldbookReader({ getCharWorldbookNames, getWorldbook, getContext, aliases = [] } = {}) {
  function fail(code, message) {
    const error = new Error(message); error.code = code; throw error;
  }
  if (typeof getCharWorldbookNames !== 'function' || typeof getWorldbook !== 'function' || typeof getContext !== 'function') {
    fail('LORE_API_UNAVAILABLE', '人物性格读取需要 getCharWorldbookNames、getWorldbook 与 getContext 接口。');
  }
  const normalize = value => value.normalize('NFKC').replace(/[\s·・･‧•．.]/gu, '');
  function validName(value) {
    return typeof value === 'string' && value.trim() && value.length <= 200 && !/[\u0000-\u001f\u007f-\u009f]/u.test(value);
  }
  const names = new Map();
  if (!Array.isArray(aliases)) fail('LORE_ALIAS_INVALID', '人物别名表必须是数组。');
  for (const person of aliases) {
    if (!person || !validName(person.name) || !Array.isArray(person.aliases)) fail('LORE_ALIAS_INVALID', '人物别名表须包含明确姓名与 aliases 数组。');
    const canonical = person.name.trim(), canonicalKey = normalize(canonical);
    if (!canonicalKey) fail('LORE_ALIAS_INVALID', '人物规范姓名不能为空。');
    for (const alias of [canonical, ...person.aliases]) {
      if (!validName(alias) || !normalize(alias)) fail('LORE_ALIAS_INVALID', '人物别名必须是非空姓名。');
      const key = normalize(alias), previous = names.get(key);
      if (previous && previous.key !== canonicalKey) fail('LORE_ALIAS_AMBIGUOUS', '人物别名“' + alias + '”对应多个角色，请先消除歧义。');
      if (!previous) names.set(key, { key: canonicalKey, name: canonical });
    }
  }
  function scope() {
    const context = getContext();
    if (!context || typeof context !== 'object' || Array.isArray(context) || !Array.isArray(context.chat)) {
      fail('LORE_SCOPE_UNAVAILABLE', '当前角色与聊天上下文不可读取。');
    }
    const chatId = typeof context.getCurrentChatId === 'function' ? context.getCurrentChatId() : context.chatId;
    if (chatId != null && !['string', 'number'].includes(typeof chatId)) fail('LORE_SCOPE_UNAVAILABLE', '当前聊天标识格式不受支持。');
    const character = Array.isArray(context.characters) ? context.characters[context.characterId] : null;
    return { chat: context.chat, chatId, characterId: context.characterId, groupId: context.groupId,
      avatar: character && character.avatar };
  }
  function assertScope(expected) {
    const current = scope();
    if (Object.keys(expected).some(key => current[key] !== expected[key])) {
      fail('LORE_SOURCE_CONFLICT', '读取人物性格期间角色或聊天已变化，请重新发送。');
    }
  }
  async function primary() {
    const binding = await getCharWorldbookNames('current');
    if (!binding || typeof binding !== 'object' || Array.isArray(binding) || typeof binding.primary !== 'string' || !binding.primary.trim()) {
      fail('LORE_BINDING_MISSING', '当前角色没有有效的 primary 主世界书绑定，无法激活人物性格。');
    }
    return binding.primary;
  }
  async function read(name) {
    if (!validName(name) || !normalize(name)) fail('LORE_NAME_INVALID', '请选择明确的 LIME 联系人。');
    const mapped = names.get(normalize(name)), canonical = mapped ? mapped.name : name.trim();
    const wanted = normalize(canonical), saved = scope(), worldbook = await primary();
    assertScope(saved);
    const rawEntries = await getWorldbook(worldbook);
    assertScope(saved);
    const currentBinding = await primary();
    assertScope(saved);
    if (currentBinding !== worldbook) fail('LORE_BINDING_CHANGED', '读取人物性格期间主世界书绑定已变化，请重新发送。');
    if (!Array.isArray(rawEntries)) fail('LORE_FORMAT_INVALID', 'getWorldbook 的人物条目返回格式应为数组。');
    const entries = [], ids = new Set();
    let total = 0, disabled = false;
    for (const entry of rawEntries) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry) || typeof entry.name !== 'string') {
        fail('LORE_FORMAT_INVALID', '世界书条目必须包含文字 name。');
      }
      // 组合档案只接受斜线明确分隔的完整姓名，不读取正文、关键字或包含匹配。
      if (normalize(entry.name) !== wanted && !entry.name.normalize('NFKC').split('/').some(title => normalize(title) === wanted)) continue;
      if (entry.enabled === false) { disabled = true; continue; }
      if (!Number.isInteger(entry.uid) || entry.uid < 0 || ids.has(entry.uid)) {
        fail('LORE_FORMAT_INVALID', '人物条目 uid 须为唯一的非负整数，无法核实“' + canonical + '”的性格来源。');
      }
      if (typeof entry.content !== 'string' || !entry.content.trim()) fail('LORE_CONTENT_EMPTY', '人物条目“' + entry.name + '”正文为空，无法激活性格。');
      total += entry.content.length;
      if (total > 100000) fail('LORE_LIMIT_EXCEEDED', '人物“' + canonical + '”的性格材料超过 100000 字符，请缩减条目后重试。');
      ids.add(entry.uid);
      entries.push({ uid: entry.uid, name: entry.name, content: entry.content });
    }
    if (!entries.length) fail(disabled ? 'LORE_DISABLED' : 'LORE_MISSING', disabled
      ? '人物“' + canonical + '”的世界书条目已停用，请先启用后发送。'
      : '当前主世界书没有人物“' + canonical + '”的明确词条，无法激活性格。');
    // 全部保留同名档案及来源身份；UID 排序使接口次序变化不改变材料顺序。
    entries.sort((left, right) => left.uid - right.uid);
    return { name: canonical, worldbook, entries };
  }
  return Object.freeze({ read });
}
