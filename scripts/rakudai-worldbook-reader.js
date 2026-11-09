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

  async function readBook() {
    const worldbook = await readPrimary();
    const entries = await getWorldbook(worldbook);
    const currentPrimary = await readPrimary();
    if (currentPrimary !== worldbook) {
      throw new Error('读取期间角色主世界书绑定已变化，请重新读取。');
    }
    if (!Array.isArray(entries)) {
      throw new Error('世界书条目格式错误：getWorldbook 应返回条目数组。');
    }
    const orders = new Map();
    for (const entry of entries) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry) || typeof entry.name !== 'string') {
        throw new Error('世界书条目格式错误：每个条目必须包含文字 name。');
      }
      if (!entry.name.startsWith('[剧情]')) continue;
      const order = entryOrder(entry);
      if (!orders.has(order)) orders.set(order, []);
      orders.get(order).push(entry);
    }
    return { worldbook, orders };
  }

  function select(book, order, includeSignature = true, expectedPrefix) {
    const { worldbook, orders } = book, matches = orders.get(order) || [];
    if (!matches.length) {
      throw new Error('当前主世界书未找到顺序为 ' + order + ' 的 [剧情] 条目。');
    }    if (matches.length !== 1) {
      throw new Error('当前主世界书存在多个顺序为 ' + order + ' 的 [剧情] 条目，请先消除重复。');
    }

    const entry = matches[0];
    if (expectedPrefix && !entry.name.startsWith(expectedPrefix)) {
      throw new Error('剧情顺序 ' + order + ' 的卷章不符：应为 ' + expectedPrefix + '，实际为 ' + entry.name + '。');
    }
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
    return { ...material, ...(includeSignature ? { signature: JSON.stringify(material) } : {}) };
  }

  function availability(book, order, includeSignature = true, expectedPrefix) {
    try {
      const material = select(book, order, includeSignature, expectedPrefix);
      return { order, available: true, reason: '', ...(includeSignature ? { signature: material.signature } : {}) };
    } catch (error) {
      const reason = error.message;
      return { order, available: false, reason, ...(includeSignature ? { signature: JSON.stringify({ worldbook: book.worldbook, order, reason }) } : {}) };
    }
  }

  async function read(volume, chapter, options = {}) {
    if (!Number.isInteger(volume) || volume < 1 || typeof chapter !== 'string' || !chapter.trim()) {
      throw new Error('剧情读取参数错误：卷号必须是正整数，章节必须是非空文字。');
    }
    if (!Number.isInteger(options.position) && typeof storyPosition !== 'function') {
      throw new Error('共享章节索引尚未就绪，无法定位世界书剧情条目。');
    }
    const position = Number.isInteger(options.position) ? options.position : storyPosition(volume, chapter);
    if (!Number.isInteger(position) || position < 0) throw new Error('当前卷章没有有效索引，无法定位世界书剧情条目。');
    const base = Number.isInteger(options.orderBase) ? options.orderBase : 100;
    const book = await readBook(), material = select(book, position + base, true, options.expectedPrefix);
    if (Number.isInteger(options.nextPosition) && options.nextPosition >= 0) material.next = availability(book, options.nextPosition + base, true, options.nextExpectedPrefix);
    return material;
  }

  // 一次取书构建整个目录；缺章只标为不可用，不影响其他已核对条目。
  async function list(volume, chapters, { orderBase = 100 } = {}) {
    if (!Number.isInteger(volume) || volume < 1 || !Array.isArray(chapters) || !chapters.length || !Number.isInteger(orderBase) ||
        chapters.some(chapter => typeof chapter?.key !== 'string' || !chapter.key.trim())) throw new Error('剧情目录读取参数不合法。');
    const book = await readBook();
    return { worldbook: book.worldbook, chapters: chapters.map((chapter, index) => ({
      key: chapter.key, title: chapter.title || chapter.key, ...availability(book, orderBase + index, false, chapter.entryPrefix),
    })) };
  }

  return { read, list };
}
