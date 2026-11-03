(function () {
  'use strict';
  // Isolated host fixture: never reads the live Tavern tab or its storage.
  const query = new URLSearchParams(location.search);
  const world = ['rakudai', 'unselected'].includes(query.get('world')) ? query.get('world') : 'asterisk';
  const schools = ['星导馆学园', '圣嘉莱多瓦思学园', '界龙第七学院', '雷渥夫黑学园', '阿勒坎特学园'];
  const school = schools[Number(query.get('school'))] || schools[0];
  const fixture = {
    系统: { 结构版本: 4, 作品: world === 'unselected' ? '' : world, 开局状态: world === 'unselected' ? '待建档' : '已建档', 主角模式: '自定义角色' },
    场景: { 当前卷: 1, 当前章: '入学报到', 阶段: '进行中', 时间: '报到日·上午', 地点: world === 'asterisk' ? school : '破军学园', 已发生事件: {} },
    玩家: { 姓名: '预览学生', 性别: '男性', 所属: world === 'asterisk' ? school : '破军学园', 所属学校: school,
      学战: { 所属学园: school, 能力身份: '尚未确定', 能力机制: '', 校内序列: { 状态: '未上榜', 名次: null },
        星辰力: { 控制: '', 运用: '', 负担: '' }, 武装: { 类别: '尚未确定', 名称: '', 使用条件: '' } } },
    人际: {}
  };
  const baseline = JSON.stringify(fixture), memory = new Map(), previewStorage = window.localStorage;
  const appearanceKey = 'rk:terminal:appearance:v1', previewKey = 'rk:preview:appearance:v1';
  let blocked = 0;
  const count = document.getElementById('preview-effects');
  const report = () => { count.textContent = '模型 / 写入调用：' + blocked + ' · 样本' + (JSON.stringify(fixture) === baseline ? '未改动' : '已改变'); };
  const deny = name => () => { blocked++; report(); throw new Error('外观预览不执行：' + name); };
  Object.defineProperty(window, 'localStorage', { value: {
    getItem: key => key === appearanceKey ? previewStorage.getItem(previewKey) : memory.get(key) ?? null,
    setItem: (key, value) => key === appearanceKey ? previewStorage.setItem(previewKey, String(value)) : memory.set(key, String(value)),
    removeItem: key => key === appearanceKey ? previewStorage.removeItem(previewKey) : memory.delete(key)
  } });
  const context = { characterId: 0, groupId: null, chatId: 'asterisk-shell-offline-preview',
    getCurrentChatId() { return this.chatId; }, characters: [{ name: '预览', avatar: 'preview.png' }],
    chat: [{ is_user: false, is_system: false, mes: '终端外观预览', swipe_id: 0 }],
    ChatCompletionService: { processRequest: deny('processRequest') } };
  window.SillyTavern = { getContext: () => context };
  window.getChatMessages = (id, options = {}) => Number(id) === 0 && (!options.role || options.role === 'assistant') ? [{
    message_id: 0, role: 'assistant', name: '预览', message: '终端外观预览', swipe_id: 0, swipes: ['终端外观预览'],
    data: { stat_data: structuredClone(fixture) }, swipes_data: [{ stat_data: structuredClone(fixture) }]
  }] : [];
  window.getVariables = () => ({ stat_data: structuredClone(fixture) });
  window.getCharWorldbookNames = async () => ({ primary: '隔离预览' });
  window.getWorldbook = async () => [];
  for (const key of ['generate', 'generateRaw', 'setChatMessages', 'updateVariablesWith', 'replaceVariables', 'injectPrompts', 'triggerSlash', 'stopGenerationById']) window[key] = deny(key);
  window.Mvu = { getMvuData: window.getVariables, parseMessage: deny('parseMessage'), replaceMvuData: deny('replaceMvuData'), events: {} };
  window.waitGlobalInitialized = async () => {};
  document.documentElement.dataset.previewWorld = world;
  document.querySelectorAll('[data-world]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.world === world));
    button.addEventListener('click', () => { query.set('world', button.dataset.world); location.search = query; });
  });
  const select = document.getElementById('preview-school');
  select.value = String(Math.max(0, schools.indexOf(school)));
  select.disabled = world !== 'asterisk';
  select.addEventListener('change', () => { query.set('school', select.value); location.search = query; });
  document.getElementById('preview-open').addEventListener('click', () => window.__RK_PHONE_SHELL__?.toggleWheel(true));
  document.getElementById('preview-home').addEventListener('click', () => window.__RK_PHONE_SHELL__?.openApp('home'));
  report();
})();
