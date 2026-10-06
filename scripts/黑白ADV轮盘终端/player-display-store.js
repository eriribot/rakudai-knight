// 开局页与终端共用的本机、当前聊天显示配置；不读取或写入 MVU。
function normalizePlayerPortraitName(value) {
  return typeof value === 'string' ? value.normalize('NFKC').replace(/[\s·・･‧•．.]/g, '').toLowerCase() : '';
}

function safePlayerPortraitName(value) {
  return typeof value === 'string' && value.trim().length > 0 && Array.from(value.trim()).length <= 64 &&
    !/[\x00-\x1f\x7f<>"&{}:：\u2028\u2029]/.test(value);
}

function validatePlayerPortraitUrl(value) {
  if (typeof value !== 'string') throw new Error('头像地址须为文字。');
  value = value.trim();
  if (!value) return '';
  const data = /^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (data) {
    const base64 = data[2], padding = (base64.match(/=+$/) || [''])[0].length;
    if (base64.length % 4 || base64.length * 3 / 4 - padding > 1024 * 1024) throw new Error('本地头像须为 1 MiB 以内的 PNG、JPEG、WebP 或 GIF。');
    return value;
  }
  let url;
  try { url = new URL(value); } catch (_) { throw new Error('请填写有效的 HTTPS 图片地址，或选择本地图片。'); }
  if (url.protocol !== 'https:' || url.username || url.password || /[\x00-\x1f\x7f]/.test(value)) {
    throw new Error('远程头像只接受不含账号密码的 HTTPS 图片地址。');
  }
  return url.href;
}

function validatePlayerDisplayAliases(value) {
  if (!Array.isArray(value) || value.length > 20) throw new Error('别名须为至多 20 个名称。');
  const seen = new Set();
  return value.map(name => {
    if (!safePlayerPortraitName(name)) throw new Error('别名须为 1—64 字的单行名称，不含冒号、引号或标签。');
    return name.trim();
  }).filter(name => { const key = normalizePlayerPortraitName(name); if (seen.has(key)) return false; seen.add(key); return true; });
}

function playerDisplayScope(ctx) {
  const chatId = ctx?.getCurrentChatId?.() ?? ctx?.chatId;
  if (!ctx || chatId === undefined || chatId === null || String(chatId).trim() === '') {
    throw new Error('当前聊天标识尚未就绪，不能读取或保存 OC 外观。');
  }
  return JSON.stringify([ctx.characterId ?? null, ctx.groupId ?? null, String(chatId)]);
}

function createPlayerDisplayStore({ storage, getContext, onChange = () => {} }) {
  const prefix = 'rk:oc:portrait:v1:';
  const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  function profileName(value) {
    if (typeof value !== 'string' || (value.trim() && !safePlayerPortraitName(value))) {
      throw new Error('开局玩家姓名须为空或 1—64 字的安全单行名称。');
    }
    return value.trim();
  }
  function source(value) {
    if (value !== '' && value !== 'opening') throw new Error('头像来源须为空或 opening。');
    return value;
  }
  function read() {
    const scope = playerDisplayScope(getContext()), key = prefix + scope, raw = storage.getItem(key);
    let record;
    if (raw === null) record = { version: 1, avatarUrl: '', aliases: [], revision: 'empty', profileName: '', source: '' };
    else {
      try { record = JSON.parse(raw); } catch (_) { throw new Error('本聊天 OC 外观配置无法读取。'); }
      if (!record || Array.isArray(record) || record.version !== 1) throw new Error('本聊天 OC 外观配置版本不受支持。');
      record = { ...record, avatarUrl: validatePlayerPortraitUrl(record.avatarUrl), aliases: validatePlayerDisplayAliases(record.aliases),
        revision: typeof record.revision === 'string' ? record.revision : raw,
        profileName: record.profileName === undefined ? '' : profileName(record.profileName),
        source: record.source === undefined ? '' : source(record.source) };
    }
    const snapshot = { version: 1, scope, avatarUrl: record.avatarUrl, aliases: record.aliases,
      revision: record.revision, profileName: record.profileName, source: record.source };
    return { key, raw, record, snapshot };
  }
  function get() { return read().snapshot; }
  function save(expected, values) {
    const current = read();
    if (!expected || expected.scope !== current.snapshot.scope || expected.revision !== current.snapshot.revision) {
      throw new Error('聊天或头像设置已变化，请重新读取后保存。');
    }
    if (!values || typeof values !== 'object' || Array.isArray(values)) throw new Error('头像设置须为对象。');
    const changes = {};
    if (own(values, 'avatarUrl')) changes.avatarUrl = validatePlayerPortraitUrl(values.avatarUrl);
    if (own(values, 'aliases')) changes.aliases = validatePlayerDisplayAliases(values.aliases);
    if (own(values, 'profileName')) changes.profileName = profileName(values.profileName);
    if (own(values, 'source')) changes.source = source(values.source);
    const record = { ...current.record, ...changes, version: 1,
      revision: Date.now().toString(36) + '-' + Math.random().toString(36).slice(2) };
    const raw = JSON.stringify(record);
    if (playerDisplayScope(getContext()) !== current.snapshot.scope || storage.getItem(current.key) !== current.raw) {
      throw new Error('聊天或头像设置已变化，请重新读取后保存。');
    }
    try { storage.setItem(current.key, raw); } catch (_) { throw new Error('本机未能保存头像设置；请检查存储空间或浏览器权限。'); }
    if (storage.getItem(current.key) !== raw) throw new Error('头像设置保存后回读不一致，请重新读取。');
    const saved = read();
    if (saved.snapshot.scope !== current.snapshot.scope || saved.raw !== raw) {
      throw new Error('头像设置在保存后又发生变化，请重新读取。');
    }
    onChange(saved.snapshot);
    return saved.snapshot;
  }
  return { get, save };
}
