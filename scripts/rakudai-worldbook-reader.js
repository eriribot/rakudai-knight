// 内联使用的只读工厂；章节索引由外层 storyPosition 提供。
// 只读取当前角色 primary 世界书，不缓存正文、不修改条目、不回退到其他材料。
function createRakudaiWorldbookReader({ getCharWorldbookNames, getWorldbook } = {}) {
  if (typeof getCharWorldbookNames !== 'function' || typeof getWorldbook !== 'function') {
    throw new Error('世界书读取器需要 getCharWorldbookNames 与 getWorldbook 函数。');
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

  function entryOrder(entry) {
    const position = entry.position;
    const order = position && typeof position === 'object' && !Array.isArray(position) && Object.hasOwn(position, 'order')
      ? position.order : entry.order;
    if (!Number.isInteger(order)) {
      throw new Error('剧情条目的顺序格式错误：position.order（或导出结构 order）必须是整数。');
    }
    return order;
  }

  async function read(volume, chapter) {
    if (!Number.isInteger(volume) || volume < 1 || typeof chapter !== 'string' || !chapter.trim()) {
      throw new Error('剧情读取参数错误：卷号必须是正整数，章节必须是非空文字。');
    }
    if (typeof storyPosition !== 'function') {
      throw new Error('共享章节索引尚未就绪，无法定位世界书剧情条目。');
    }
    const position = storyPosition(volume, chapter);
    if (!Number.isInteger(position) || position < 0) {
      throw new Error('当前卷章没有有效索引，无法定位世界书剧情条目。');
    }
    const order = position + 100;
    const worldbook = await readPrimary();
    const entries = await getWorldbook(worldbook);
    const currentPrimary = await readPrimary();
    if (currentPrimary !== worldbook) {
      throw new Error('读取期间角色主世界书绑定已变化，请重新读取。');
    }
    if (!Array.isArray(entries)) {
      throw new Error('世界书条目格式错误：getWorldbook 应返回条目数组。');
    }

    const matches = [];
    for (const entry of entries) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry) || typeof entry.name !== 'string') {
        throw new Error('世界书条目格式错误：每个条目必须包含文字 name。');
      }
      if (!entry.name.startsWith('[剧情]')) continue;
      if (entryOrder(entry) === order) matches.push(entry);
    }
    if (!matches.length) {
      throw new Error('当前主世界书未找到顺序为 ' + order + ' 的 [剧情] 条目。');
    }
    if (matches.length !== 1) {
      throw new Error('当前主世界书存在多个顺序为 ' + order + ' 的 [剧情] 条目，请先消除重复。');
    }

    const entry = matches[0];
    if (!Number.isInteger(entry.uid) || entry.uid < 0 || typeof entry.enabled !== 'boolean') {
      throw new Error('剧情条目格式错误：uid 必须是非负整数，enabled 必须是布尔值。');
    }
    if (entry.enabled !== false) {
      throw new Error('请关闭剧情条目“' + entry.name + '”的自动触发，再由章节注入器读取，避免重复注入。');
    }
    if (typeof entry.content !== 'string' || !entry.content.trim()) {
      throw new Error('剧情条目“' + entry.name + '”正文为空或不是文字。');
    }

    const material = { worldbook, uid: entry.uid, name: entry.name, order, content: entry.content };
    return { ...material, signature: JSON.stringify(material) };
  }

  return { read };
}
