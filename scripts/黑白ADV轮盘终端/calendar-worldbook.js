// 只读剧情日历：沿用 rakudai-worldbook-reader.js 已核定的 Tavern Helper 世界书接口。
// 日期只来自条目前置元信息；不借用浏览年份、系统日期或其他剧情条目的年份。
function createCalendarWorldbookReader({ getCharWorldbookNames, getWorldbook, getContext } = {}) {
  if (typeof getCharWorldbookNames !== 'function' || typeof getWorldbook !== 'function') {
    throw new Error('剧情日历需要 getCharWorldbookNames 与 getWorldbook 读取接口。');
  }
  if (typeof getContext !== 'function') throw new Error('剧情日历需要 getContext 确认当前角色与聊天。');

  function readScope() {
    const context = getContext();
    if (!context || typeof context !== 'object' || Array.isArray(context)) {
      throw new Error('当前角色与聊天上下文不可读取。');
    }
    const chatId = typeof context.getCurrentChatId === 'function' ? context.getCurrentChatId() : context.chatId;
    const character = Array.isArray(context.characters) ? context.characters[context.characterId] : null;
    const scope = { chat: context.chat, chatId, characterId: context.characterId,
      groupId: context.groupId, avatar: character && character.avatar };
    if (!Array.isArray(scope.chat) && scope.chatId == null && scope.characterId == null && scope.groupId == null) {
      throw new Error('当前上下文缺少可确认的角色或聊天标识。');
    }
    if (scope.chatId && typeof scope.chatId === 'object') {
      throw new Error('当前聊天标识格式不受支持。');
    }
    return scope;
  }
  function assertScope(scope) {
    const current = readScope();
    if (Object.keys(scope).some(key => current[key] !== scope[key])) {
      throw new Error('读取期间角色或聊天已变化，请重新打开剧情日历。');
    }
  }
  async function readPrimary() {
    const binding = await getCharWorldbookNames('current');
    if (!binding || typeof binding !== 'object' || Array.isArray(binding)) {
      throw new Error('角色世界书绑定格式错误：应返回包含 primary 的对象。');
    }
    if (typeof binding.primary !== 'string' || !binding.primary.trim()) {
      throw new Error('当前角色没有有效的 primary 主世界书绑定。');
    }
    return binding.primary;
  }

  function readDateLabel(content) {
    const lines = content.split(/\r?\n/);
    let block = -1;
    for (let index = 0; index < Math.min(lines.length, 24); index++) {
      if (/^\s*(?:<[^>]+>\s*)?【(?:场景核心信息|基础信息)】\s*$/.test(lines[index])) { block = index; break; }
      if (!/^\s*$|^\s*<[^>]+>\s*$|^\s*#{1,6}\s/.test(lines[index])) break;
    }
    const labels = [];
    // 首部信息块是当前卡的真实格式；同时允许无块标题的前置键值元信息。
    // 到下一标题或正文即结束，避免正文中的历史、对话和示例被当成发生日期。
    const start = block < 0 ? 0 : block + 1;
    for (let index = start; index < lines.length; index++) {
      const line = lines[index];
      if (/^\s*【[^】]+】/.test(line) || /^\s*<\//.test(line)) break;
      const match = line.match(/^\s*(?:[-*]\s*)?(?:发生时间|时间|日期|时序)[：:]\s*(.+?)\s*$/);
      if (match) { labels.push(match[1]); continue; }
      if (block < 0 && !/^\s*$|^\s*<[^>]+>\s*$|^\s*#{1,6}\s|^\s*(?:[-*]\s*)?[^：:]{1,12}[：:]/.test(line)) break;
    }
    return labels.length ? labels : ['未标注日期'];
  }

  function calendarDate(year, month, day) {
    if (!Number.isInteger(year) || year < 1 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) return null;
    const date = new Date(0);
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCFullYear(year, month - 1, day);
    if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) return null;
    return { year, month, day, time: date.getTime(), key: String(year).padStart(4, '0') + '-' +
      String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0') };
  }
  function dateToken(source, previous) {
    let match = source.match(/^\s*(?:(?:西历|公历)\s*)?(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
    if (match) return { date: calendarDate(+match[1], +match[2], +match[3]), length: match[0].length };
    match = source.match(/^\s*(\d{4})-(\d{2})-(\d{2})(?!\d)/);
    if (match) return { date: calendarDate(+match[1], +match[2], +match[3]), length: match[0].length };
    if (!previous) return null;
    match = source.match(/^\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
    if (match) return { date: calendarDate(previous.year, +match[1], +match[2]), length: match[0].length };
    match = source.match(/^\s*(\d{1,2})\s*日/);
    return match ? { date: calendarDate(previous.year, previous.month, +match[1]), length: match[0].length } : null;
  }
  function parseLabel(label) {
    // 追忆与现实并置的唯一明确路由：只取实际声明的现实切入段，仍向 UI 保留完整原标签。
    const reality = label.match(/现实切入【([^】]+)】/);
    let source = reality ? reality[1] : label;
    if (!reality && /^\s*(?:回忆|追忆|回溯|倒叙|前置追忆)/.test(source)) return [];
    if (/[（(]\s*(?:约|大约|日期不明|时间不明|回忆|追忆|回溯|倒叙|暂定|推测|不确定)\s*[）)]/.test(source)) return [];
    // 括号解释可含出生年、出版日期等；它们不是当前事件的日历日期。
    let stripped;
    do { stripped = source; source = source.replace(/（[^（）]*）|\([^()]*\)/g, ''); } while (stripped !== source);
    if (/回忆|追忆|回溯|倒叙|大约|约\s*(?:(?:西历|公历)\s*)?\d|左右|前后|不详|不明|未定|暂定|不确定|推测/.test(source)) return [];
    let token = dateToken(source);
    if (!token || !token.date) return [];
    let previous = token.date;
    let rest = source.slice(token.length);
    const dates = new Map([[previous.key, { key: previous.key, label }]]);
    while (rest) {
      // 日内时刻允许出现在明确区间端点之间；任意叙述文字会终止解析。
      const separator = rest.match(/^\s*(?:[T·・]?\s*(?:凌晨|清晨|早晨|上午|中午|正午|下午|傍晚|晚上|晚间|入夜|深夜|夜间)?\s*(?:\d{1,2}:\d{2}(?::\d{2})?)?\s*)?((?:[，,]\s*)?(?:至|到|—|–|~|～|-)|、|，|,|及|和|与)\s*/);
      if (!separator) break;
      const range = /^(?:至|到|—|–|~|～|-)$/.test(separator[1].replace(/^[，,]\s*/, ''));
      const remaining = rest.slice(separator[0].length);
      token = dateToken(remaining, previous);
      // 没有明确端点（如“至次日”）不猜日期；保留首个明确日期。
      if (!token) break;
      if (!token.date) return [];
      const next = token.date;
      if (range) {
        const days = Math.round((next.time - previous.time) / 86400000);
        // 不自动推断跨年；对极长或倒置区间保留未定标签，避免制造错误/无界格子。
        if (days < 0 || days > 3660) return [];
        for (let day = 1; day <= days; day++) {
          const date = new Date(previous.time + day * 86400000);
          const key = date.toISOString().slice(0, 10);
          dates.set(key, { key, label });
        }
      } else dates.set(next.key, { key: next.key, label });
      previous = next;
      rest = remaining.slice(token.length);
    }
    return [...dates.values()];
  }

  async function read() {
    const scope = readScope();
    const worldbook = await readPrimary();
    assertScope(scope);
    const rawEntries = await getWorldbook(worldbook);
    assertScope(scope);
    const currentPrimary = await readPrimary();
    assertScope(scope);
    if (currentPrimary !== worldbook) throw new Error('读取期间角色主世界书绑定已变化，请重新读取。');
    if (!Array.isArray(rawEntries)) throw new Error('世界书条目格式错误：getWorldbook 应返回条目数组。');
    const entries = [], ids = new Set();
    for (const entry of rawEntries) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry) || typeof entry.name !== 'string') {
        throw new Error('世界书条目格式错误：每个条目必须包含文字 name。');
      }
      if (!entry.name.startsWith('[剧情]')) continue;
      if (!Number.isInteger(entry.uid) || entry.uid < 0 || ids.has(entry.uid)) {
        throw new Error('剧情条目格式错误：uid 必须是唯一的非负整数。');
      }
      if (typeof entry.content !== 'string' || !entry.content.trim()) {
        throw new Error('剧情条目“' + entry.name + '”正文为空或不是文字。');
      }
      ids.add(entry.uid);
      const labels = readDateLabel(entry.content);
      const dates = new Map();
      labels.forEach(label => parseLabel(label).forEach(date => dates.set(date.key, date)));
      entries.push({ uid: entry.uid, name: entry.name, dates: [...dates.values()], dateLabel: labels.join('；'), content: entry.content });
    }
    return { worldbook, entries, undatedCount: entries.filter(entry => !entry.dates.length).length };
  }
  return { read };
}
