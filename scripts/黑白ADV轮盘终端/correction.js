// 副 API 在本轮主回复与 MVU 保存后自动校正；连接与密钥按用户设置持久保存在本机。
// 接口与固定源码依据见 QUICKSTART；没有宿主转发能力时明确报错，不改主连接。
const correctionConfigKey = 'rk:correction:connection';
const correctionStored = LS.get(correctionConfigKey, {}) || {};
// 旧版未保存密钥时仍需保存一次；新版连同空密钥（免认证端点）一起记住配置。
let correctionKey = typeof correctionStored.apiKey === 'string' ? correctionStored.apiKey : '';
let correctionJob = null, correctionDraft = null, correctionModelsJob = null;
let correctionActive = Boolean(Object.hasOwn(correctionStored, 'apiKey') && correctionStored.endpoint && correctionStored.model);
let correctionAutoTurn = null, correctionAutoTimer = null, correctionBindMvu = null;
// 主回复的保存记录独立于副任务；取消副请求或关闭自动不能提前解除主 MVU 写锁。
let correctionMainTurn = null;
let correctionRetry = null, correctionEpoch = 0;
const CORRECTION_MAX_ATTEMPTS = 3;
let correctionStatus = correctionActive && correctionStored.autoApply !== false
  ? { state: 'ready', message: '已恢复本机副 API 配置，下一条主回复完成后自动处理。' }
  : { state: 'inactive', message: correctionStored.autoApply === false ? '自动处理已关闭，可在设置中开启。' : '保存副 API 配置和密钥后，从下一条主回复开始自动处理。' };
const correctionSeen = new Set();
// 可在设置中编辑的内置指令；变量规则和JSON格式随后由代码附加，正文/事件始终自动读取。
const DEFAULT_CORRECTION_PROMPT = [
  '你是本卡MVU校正助手。依据本轮正文、本轮事件、当前变量及玩家补充说明核对实际变化。本局事实优先于原著和训练记忆，不补未来经历。只返回JSONPatch数组；无实际变化返回[]。',
  '玩家资料、能力、六维、登记等级、成长经验，场景与事件，以及人物资料、好感和支援都可修正。已有数字提交最终值；当前变量是实际保存结果，主补丁可能漏写或部分失败。对照正文补漏纠错，同一成果不重复加分或发经验。',
  '分别核对好感与支援，不用态度印象代替数值变化。普通正向回应+2—10，新生轻微好感、认可或防备缓和+11—20，重大关系事件+21—40；校正错误旧分数可直接给正确终值，不受这些单轮参考区间限制。支援按实际协作判断。',
  '父对象可只写要改的键，代码会合并并保留省略字段；数组按最终内容更新。add/replace会按存在性适配，remove可删除过时能力、人物、事件等条目。新条目提供完整资料，能力也可用说明文字简写。',
  '成长直接提交经验及六维评级的最终值，不创建申请。经验是所提交评级的档内进度；达到门槛连续晋级、扣除门槛并保留余量。魔力控制与体能分别按实际成果判断，魔力量新成长须已觉醒。按当前已保存值补漏纠错，不把主补丁的提交意图当成已落实结果，不再加一遍已保存的本轮经验；登记等级仅随实际登记改变。',
  '魔人觉醒使用JSON布尔true/false，可纠正错误状态。卷章按本轮已落实的完成事实修正，主回复已经推进时不重复结束下一章。',
  '选拔赛只登记本局实际参赛者、安排和赛果；同一比赛沿用ID修正。程序按剧情日历推演场外背景并计算战绩、积分与排名；不抄写推演对局，不写初始战绩或赛前胜场。若本轮OC战胜珠雫等正典人物，按实际胜者登记，绝不能为迎合原著或背景推演改回败局。'
].join('\n');
function correctionContext() { return (HW.SillyTavern || window.SillyTavern)?.getContext?.(); }
function correctionChatKey() {
  const ctx = correctionContext();
  if (ctx?.chatId === undefined || ctx.chatId === null || ctx.chatId === '') throw new Error('请先打开本局聊天。');
  return 'rk:correction:plot:' + JSON.stringify([ctx.characterId ?? null, ctx.groupId ?? null, ctx.chatId]);
}
function normalizeCorrectionExcludedParams(value = []) {
  if (typeof value !== 'string' && !Array.isArray(value)) throw new Error('排除参数请填写参数名，用逗号、空格或换行分隔。');
  const text = Array.isArray(value) ? value.join('\n') : value;
  if (text.length > 4096 || Array.isArray(value) && value.some(name => typeof name !== 'string')) throw new Error('排除参数只接受参数名，总长度不能超过4096字。');
  const names = [...new Set(text.split(/[\s,，;；]+/u).filter(Boolean))];
  if (names.length > 64) throw new Error('最多排除64个请求参数。');
  if (names.some(name => !/^[A-Za-z_][A-Za-z0-9_-]{0,127}$/.test(name))) throw new Error('排除参数只填顶层参数名（字母、数字、下划线或连字符），不要填 JSON、参数值或嵌套路径。');
  return names;
}
function getCorrectionConfig() {
  const saved = LS.get(correctionConfigKey, {});
  return { endpoint: saved.endpoint || '', model: saved.model || '', maxTokens: saved.maxTokens || 3000,
    excludedParams: normalizeCorrectionExcludedParams(saved.excludedParams ?? []),
    hasKey: Boolean(correctionKey), autoApply: saved.autoApply !== false, deviation: LS.get(correctionChatKey(), ''),
    prompt: typeof saved.prompt === 'string' && saved.prompt.trim() ? saved.prompt : DEFAULT_CORRECTION_PROMPT, defaultPrompt: DEFAULT_CORRECTION_PROMPT };
}
function saveCorrectionConfig(value) {
  cancelCorrection();
  const endpoint = String(value.endpoint || '').trim() ? normalizeCorrectionEndpoint(value.endpoint) : '';
  const model = String(value.model || '').trim(), maxTokens = Number(value.maxTokens);
  if (model.length > 200 || !Number.isInteger(maxTokens) || maxTokens < 256 || maxTokens > 30000) throw new Error('模型名不能超过200字，输出上限为256—30000的整数。');
  const prompt = String(value.prompt ?? getCorrectionConfig().prompt).trim();
  if (prompt.length > 12000) throw new Error('校正提示词不能超过12000字。');
  const excludedParams = normalizeCorrectionExcludedParams(value.excludedParams ?? getCorrectionConfig().excludedParams);
  const nextKey = value.clearKey ? '' : String(value.apiKey || '').trim() || correctionKey;
  const autoApply = value.autoApply === undefined ? getCorrectionConfig().autoApply : value.autoApply === true;
  const connection = { endpoint, model, maxTokens, excludedParams, autoApply, apiKey: nextKey,
    prompt: prompt && prompt !== DEFAULT_CORRECTION_PROMPT ? prompt : '' };
  // 只写酒馆所在浏览器的本地配置，不放入聊天变量、请求正文或导入包。
  LS.set(correctionConfigKey, connection);
  if (JSON.stringify(LS.get(correctionConfigKey, null)) !== JSON.stringify(connection)) {
    throw new Error('浏览器未能保存副 API 配置，请检查本地存储是否可用后重试。');
  }
  correctionKey = nextKey;
  LS.set(correctionChatKey(), String(value.deviation || '').trim().slice(0, 6000));
  correctionDraft = null;
  correctionActive = Boolean(endpoint && model);
  setCorrectionStatus(autoApply && correctionActive ? 'ready' : 'inactive', autoApply && correctionActive
    ? '自动处理已就绪：从下一条主回复开始，主 MVU 保存后校正并回读。'
    : autoApply ? '请保存完整副 API 地址和模型后启用自动处理。' : '自动处理已关闭，可手动预览校正。');
  return getCorrectionConfig();
}
function normalizeCorrectionEndpoint(value) {
  const endpoint = String(value || '').trim().replace(/\/+$/, '').replace(/\/(?:chat\/completions|models)$/, '');
  let url;
  try { url = new URL(endpoint); } catch (_) { throw new Error('填写完整的OpenAI兼容API地址，如https://example.com/v1。'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('API地址仅支持HTTP/HTTPS，密钥请填专用输入框。');
  return endpoint;
}
function setCorrectionStatus(state, message, detail = {}) {
  const turn = correctionAutoTurn;
  const scope = detail.scope || 'correction';
  correctionStatus = { state, message, scope, attempt: scope === 'main' ? 0 : turn?.attempt || (['reading', 'requesting', 'preview', 'applying', 'verifying', 'applied', 'unchanged', 'failed'].includes(state) ? 1 : 0), maxAttempts: turn ? CORRECTION_MAX_ATTEMPTS : 1, canRetry: false, ...detail };
  // 收起时也可看到副 API 是否忙碌；不依赖设置页被打开或页面轮询。
  const busy = ['waiting', 'reading', 'requesting', 'retrying', 'applying', 'verifying'].includes(state);
  SS.orb?.setAttribute('data-correction-busy', String(busy));
  SS.orb?.setAttribute('aria-label', '打开终端操作轮盘；' + (scope === 'main' ? 'MVU 主保存：' : '副 API：') + message);
  const label = SS.orb?.querySelector('.crest span');
  if (label) label.textContent = busy ? scope === 'main' ? '待保存' : '处理中' : state === 'failed' ? scope === 'main' ? '未确认' : '待处理' : '操作';
  emit({ type: 'correction-status' });
}
function getCorrectionStatus() {
  return { ...correctionStatus, scope: correctionStatus.scope || 'correction',
    mainSave: !correctionMainTurn ? 'idle' : correctionMainTurn.settled ? 'saved' : correctionMainTurn.waitFailed ? 'failed' : 'waiting',
    autoApply: LS.get(correctionConfigKey, {}).autoApply !== false, active: correctionActive };
}
function cancelCorrection(reason = '本次校正已取消，后续新回复仍按已保存配置处理。') {
  correctionEpoch++;
  const pending = correctionJob || correctionDraft || correctionAutoTurn || correctionRetry;
  // Abort 后仍保留请求锁，直到原请求 finally 退出，避免慢端点产生并行请求。
  correctionJob?.abort(); correctionDraft = null;
  correctionModelsJob?.abort(); correctionModelsJob = null;
  correctionAutoTurn = null; correctionRetry = null;
  clearTimeout(correctionAutoTimer); correctionAutoTimer = null;
  if (correctionMainTurn?.phase === 'waiting' && correctionMainTurn.waitFailed) {
    correctionMainTurn.waitFailed = false; correctionMainTurn.deadline = Date.now() + 180000;
  }
  scheduleAutomaticCorrection();
  if (pending && !SS.destroyed) setCorrectionStatus('cancelled', reason);
}

async function fetchCorrectionModels(value = {}) {
  const endpoint = normalizeCorrectionEndpoint(value.endpoint), key = String(value.apiKey || '').trim() || correctionKey;
  const ctx = correctionContext();
  if (typeof HW.fetch !== 'function' || typeof ctx?.getRequestHeaders !== 'function') throw new Error('宿主尚未提供模型列表转发接口，可先手填模型名称。');
  correctionModelsJob?.abort();
  const abort = new AbortController(); correctionModelsJob = abort;
  const timer = setTimeout(() => abort.abort(), 20000);
  try {
    // 官方8172dcd…的独立status路由会GET custom_url/models，不调用会改主连接的前端状态函数。
    const response = await HW.fetch(new URL('/api/backends/chat-completions/status', HW.location.href).href, {
      method: 'POST', headers: ctx.getRequestHeaders(), credentials: 'same-origin', cache: 'no-cache', signal: abort.signal,
      body: JSON.stringify({ chat_completion_source: 'custom', custom_url: endpoint,
        // 空副密钥也显式覆盖Authorization，避免宿主回落到主连接保存的CUSTOM密钥。
        custom_include_headers: JSON.stringify({ Authorization: key ? 'Bearer ' + key : '' }) }),
    });
    if (!response.ok) throw new Error('模型列表读取失败（HTTP ' + response.status + '），请核对地址与密钥，或手填模型名称。');
    const data = await response.json();
    if (abort.signal.aborted || correctionModelsJob !== abort) throw new Error('模型列表请求已取消。');
    if (data?.error || !Array.isArray(data?.data)) throw new Error('API未返回标准模型列表，请核对地址与密钥；不支持列表的端点可手填模型名称。');
    const models = [...new Set(data.data.map(item => item?.id).filter(id => typeof id === 'string' && id.trim() && id.length <= 200))].sort();
    return { models };
  } catch (error) {
    if (abort.signal.aborted) throw new Error('模型列表请求已取消或超时，可重新拉取或手填。');
    if (error instanceof TypeError || error instanceof SyntaxError) throw new Error('模型列表请求失败或返回格式不符，可核对连接后重试，或手填模型名称。');
    throw new Error(String(error.message || '模型列表请求失败').replaceAll(key || '\u0000', '[已隐藏]'));
  } finally { clearTimeout(timer); if (correctionModelsJob === abort) correctionModelsJob = null; }
}
function correctionMainBusy(checkingSettlement = false) {
  // 已跟踪的轮次只等本轮 MVU 保存；正文和生图的后续流式阶段不再占用校正锁。
  if (correctionMainTurn) return !checkingSettlement && !correctionMainTurn.settled;
  return generationPending || Boolean(correctionContext()?.streamingProcessor);
}
// 开关开启不代表异步桥接已注册。先读宿主启动状态，再核对真实能力，不能借用旧实例残留的标记。
function correctionRuntime() {
  const scopes = [];
  for (const resolve of [() => window.top, () => HW, () => window.parent, () => window]) {
    try {
      const scope = resolve();
      if (scope && !scopes.includes(scope)) scopes.push(scope);
    } catch (_) { /* 跨域上层不可读时，继续检查当前脚本与可访问的宿主。 */ }
  }
  return { ...rakudaiMvuRuntime(scopes), scopes };
}
function correctionGuard(runtime = correctionRuntime()) {
  const { mode, boot, guard } = runtime;
  if (mode === 'native') return null;
  function fail(message, loading = false) {
    const error = new Error(message);
    if (loading) error.code = 'RK_GUARD_LOADING';
    throw error;
  }
  if (boot?.state === 'failed') fail('MVU v4 约束启动失败：' + (boot.message || '请查看约束脚本日志，排除加载错误后重新启用该脚本。'));
  if (boot?.state === 'loading') fail('MVU v4 约束正在初始化：' + (boot.message || '正在等待依赖加载。'), true);
  if (!guard) fail('尚未检测到 MVU v4 约束注册。若脚本已开启，请检查约束脚本日志中的 MVU、Zod 4 或桥接加载错误。', true);
  if (boot && (boot.state !== 'ready' || boot.guard !== guard)) fail('MVU v4 约束注册已变化，请重新启用当前约束脚本后重试。');
  const required = { growthProtocol: 'final-values-v1', repair: 'P02', storyRepair: 'S01',
    flexibleRepair: 'F01', growthSettlement: 'G04', tournament: 'T01', tournamentEngine: 'T02' };
  const missing = Object.entries(required).filter(([key, value]) => guard[key] !== value).map(([, value]) => value);
  if (!['MVU01', 'MVU02'].includes(guard.repairSource)) missing.push('MVU02');
  if (typeof guard.parseRepair !== 'function') missing.push('parseRepair');
  if (missing.length) fail('已检测到 MVU v4 约束，但缺少能力：' + missing.join(' / ') + '。请替换为配套终值成长 / T02 约束并重载酒馆；仅切换开关不能更新旧脚本。');
  return guard;
}
function ensureCorrectionGrowthMode(runtime) {
  if (runtime.mode !== 'native') return;
  for (const scope of runtime.scopes) {
    let growth = null;
    try {
      growth = scope.__RK_MVU_GROWTH_G04__;
    } catch (_) { /* 只读取可访问宿主中的独立成长组件。 */ }
    if (growth && growth.state !== 'failed') throw new Error('当前使用成长终值，请关闭旧独立成长 G04 并重载酒馆后校正，避免旧申请被再次结算。');
  }
}
function captureCorrection(checkingSettlement = false, requireGuard = true, copyData = true) {
  if (SS.destroyed || correctionMainBusy(checkingSettlement)) throw new Error('请等本轮 MVU 标签完整并保存后再校正。');
  const ctx = correctionContext(), reply = correctionReply();
  if (!reply?.sourceText) throw new Error('当前助手回复内容为空，暂不校正。');
  const runtime = correctionRuntime(), guard = requireGuard ? correctionGuard(runtime) : null;
  if (guard && !reply.mvuBlock && guard.repairSource !== 'MVU02') throw new Error('修复缺失或损坏的主补丁需要配套 MVU02 字段约束，请更新后重试。');
  ensureCorrectionGrowthMode(runtime);
  const mvu = window.Mvu || HW.Mvu;
  if (typeof mvu?.getMvuData !== 'function' || requireGuard && typeof mvu.parseMessage !== 'function') throw new Error('MVU 解析接口尚未就绪。');
  const options = { type: 'message', message_id: reply.messageId };
  const data = mvu.getMvuData(options);
  if (!data?.stat_data || typeof data.then === 'function') throw new Error('当前 MVU 不是可确认的同步楼层接口。');
  if (data.stat_data.系统?.结构版本 !== 4 || data.stat_data.系统?.开局状态 !== '已建档' ||
      !['系统', '场景', '玩家', '人际'].every(key => data.stat_data[key] && typeof data.stat_data[key] === 'object' && !Array.isArray(data.stat_data[key])))
    throw new Error('当前回复还没有完整的 v4 档案，请先完成本轮 MVU 保存。');
  // 仅采用同一回复、同一 MVU 块的主结算起点；正文/图片刷新不影响这个快照。
  const candidate = correctionMainTurn?.candidate;
  const storyBefore = candidate?.ended && correctionSameReply(reply, candidate.reply) && candidate.storyBefore
    ? structuredClone(candidate.storyBefore) : undefined;
  // 正文只在请求时读取一次作为分析材料；后续一致性检查仅看来源、MVU 标签和实际变量。
  return { ...reply, ctx, guard, mvu, runtimeMode: runtime.mode, scopes: runtime.scopes, data: copyData ? structuredClone(data) : data, options,
    chatId: ctx.chatId, characterId: ctx.characterId ?? null, groupId: ctx.groupId ?? null,
    storyBefore, stateKey: correctionMvuKey(data) };
}
function ensureCorrectionCurrent(saved) {
  const now = captureCorrection(false, true, false);
  if (!correctionSameReply(now, saved) || now.stateKey !== saved.stateKey || now.guard !== saved.guard || now.runtimeMode !== saved.runtimeMode || now.mvu !== saved.mvu)
    throw new Error('聊天、回复页、MVU 标签或实际变量已变化，请重新请求校正。');
  return now;
}
// 只合并解析实际改动的 MVU 字段；生图元数据和其它插件保存的内容沿用写入时的值。
function mergeCorrectionChanges(current, before, after) {
  if (JSON.stringify(before) === JSON.stringify(after)) return structuredClone(current);
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  if (!object(before) || !object(after)) return structuredClone(after);
  const next = object(current) ? structuredClone(current) : {};
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (JSON.stringify(before[key]) === JSON.stringify(after[key])) continue;
    if (!Object.hasOwn(after, key)) delete next[key];
    else Object.defineProperty(next, key, { value: mergeCorrectionChanges(current?.[key], before[key], after[key]),
      enumerable: true, configurable: true, writable: true });
  }
  return next;
}
function mergeCorrectionData(current, before, parsed) {
  const next = structuredClone(current);
  for (const key of ['initialized_lorebooks', 'stat_data', 'schema', 'display_data', 'delta_data']) {
    if (JSON.stringify(before[key]) === JSON.stringify(parsed[key])) continue;
    if (!Object.hasOwn(parsed, key)) delete next[key];
    else next[key] = mergeCorrectionChanges(current[key], before[key], parsed[key]);
  }
  if (Object.hasOwn(current.stat_data, '$internal')) next.stat_data.$internal = structuredClone(current.stat_data.$internal);
  return next;
}
// 只采集当前回复提交且已保存的事件结果，不回放整个事件历史或其他回复页。
function correctionInput(saved) {
  const events = {}, submittedRelations = [], submittedStory = [], all = saved.data.stat_data.场景?.已发生事件 || {};
  function rememberEvent(name, result) {
    if (!name || ['__proto__', 'prototype', 'constructor'].includes(name) || !Object.hasOwn(all, name)) return;
    if (typeof result === 'string' && result.trim() && result === all[name]?.结果) {
      Object.defineProperty(events, name, { value: structuredClone(all[name]), enumerable: true, configurable: true });
    }
  }
  const blocks = [...saved.mvuBlock.matchAll(/<(JSONPatch|json_patch)>([\s\S]*?)<\/\1>/gi)];
  if (blocks.length === 1) {
    try {
      const operations = JSON.parse(blocks[0][2].trim());
      for (const op of Array.isArray(operations) ? operations : []) {
        if (!op || !['add', 'replace'].includes(op.op) || typeof op.path !== 'string' || !op.path.startsWith('/')) continue;
        const parts = op.path.slice(1).split('/').map(part => part.replace(/~1/g, '/').replace(/~0/g, '~'));
        // 只附本轮原补丁的人际计分项，配合已保存最终值识别已结算部分，避免二次奖励。
        if (parts[0] === '人际' && (parts.length === 3 && ['好感', '支援度', '变化依据', '好感突破依据'].includes(parts[2]) || parts.length === 2 && op.value && typeof op.value === 'object')) {
          const fields = parts.length === 2 ? Object.fromEntries(Object.entries(op.value).filter(([key]) => ['好感', '支援度', '变化依据', '好感突破依据'].includes(key))) : op.value;
          submittedRelations.push({ path: op.path, value: fields });
        }
        // 原补丁是提交意图，当前变量才是实际结果；两者一起看才不会重复结束下一章。
        if (parts[0] === '场景' && parts.length === 2 && ['当前卷', '当前章', '阶段', '切入说明'].includes(parts[1])) {
          submittedStory.push({ path: op.path, value: op.value });
        }
        if (parts[0] !== '场景') continue;
        if (parts.length === 1 && op.value && typeof op.value === 'object' && !Array.isArray(op.value)) {
          for (const field of ['当前卷', '当前章', '阶段', '切入说明']) {
            if (Object.hasOwn(op.value, field)) submittedStory.push({ path: '/场景/' + field, value: op.value[field] });
          }
        }
        // 主模型也可能用父对象提交事件；仍须与当前真实保存结果一致才归为本轮事实。
        const supplied = parts.length === 1 ? op.value?.已发生事件 :
          parts.length === 2 && parts[1] === '已发生事件' ? op.value : null;
        if (supplied && typeof supplied === 'object' && !Array.isArray(supplied)) {
          for (const [name, event] of Object.entries(supplied)) rememberEvent(name, event?.结果);
        }
        if (parts[1] === '已发生事件') {
          rememberEvent(parts[2], parts.length === 3 ? op.value?.结果 : parts.length === 4 && parts[3] === '结果' ? op.value : null);
        }
      }
    } catch (_) { /* 没有有效结构化事件时，仍以本轮正文核对，不猜测历史事件属于本轮。 */ }
  }
  const state = structuredClone(saved.data.stat_data);
  delete state.$internal;
  if (state.系统) delete state.系统.关系计分;
  if (state.场景) delete state.场景.已发生事件;
  // 程序号池摘要单独按日期放行；原名册和实际比赛照常用于校正。
  if (state.场景?.选拔赛) delete state.场景.选拔赛.程序战况;
  if (state.玩家?.成长 && typeof state.玩家.成长 === 'object' && !Array.isArray(state.玩家.成长)) {
    const growth = state.玩家.成长;
    state.玩家.成长 = Object.hasOwn(growth, '经验') ? { 经验: growth.经验 } : {};
  }
  return { source: '楼层 ' + saved.messageId + ' · 回复页 ' + (saved.swipeId + 1),
    text: saved.text.replace(/<UpdateVariable>[\s\S]*?<\/UpdateVariable>/gi, '').trim(), events, submittedRelations, submittedStory, storyBefore: saved.storyBefore, state,
    mainPatch: saved.mvuBlock ? '主补丁格式完整；已提交项仍须与当前变量核对' : '主补丁缺失或格式损坏；根据正文与当前实际保存值补漏，提交最终值' };
}
function getCorrectionInput() { return correctionInput(captureCorrection()); }
// 世界书沿用原条目与 order；只在已展开的发送副本中过滤程序号池缓存。
function filterTournamentPoolPrompt(messages, state) {
  if (!Array.isArray(messages) || window.RakudaiStateController.shouldInjectTournament(state)) return;
  const filter = text => typeof text !== 'string' ? text : text.replace(/<status_current_variable>([\s\S]*?)<\/status_current_variable>/g, (block, json) => {
    let current;
    try { current = JSON.parse(json); } catch (_) { return block; }
    const tournament = current?.场景?.选拔赛;
    if (!tournament || !Object.hasOwn(tournament, '程序战况')) return block;
    delete tournament.程序战况;
    return block.replace(json, () => JSON.stringify(current));
  });
  for (const message of messages) {
    if (typeof message?.content === 'string') message.content = filter(message.content);
    else if (Array.isArray(message?.content)) for (const part of message.content) {
      if (part?.type === 'text') part.text = filter(part.text);
    }
  }
}
function correctionTournamentSummary(state) {
  if (!window.RakudaiStateController.shouldInjectTournament(state)) return undefined;
  const view = stateService().tournamentView(state), calendar = view.calendar || {};
  return { 引擎: view.engine, 背景预览: Boolean(view.virtual),
    日历: { valid: calendar.valid, reason: calendar.reason, date: calendar.date?.key,
      currentRound: calendar.currentRound, elapsedRound: calendar.elapsedRound, todayRound: calendar.todayRound,
      nextRound: calendar.nextRound, suspended: calendar.suspended },
    名册: view.roster.map(({ id, name, wins, losses, points, status, simulatedMatches }) => ({ id, name, wins, losses, points, status, simulatedMatches })),
    待补提示: '玩家未登记的比赛保留待补；null 表示尚未确定，不能当作 0。程序背景仅供核对，本轮实际赛果优先，不得将背景批量写回比赛。',
    警告: view.warnings || [] };
}
function correctionValue(state, parts) {
  let value = state;
  for (const part of parts) { if (!value || typeof value !== 'object' || !Object.hasOwn(value, part)) return undefined; value = value[part]; }
  return value;
}
// F01：统一处理业务 JSONPatch，不再为能力、人物、事件逐个维护写入白名单。
function correctionPath(path) {
  if (path === '') return [];
  if (typeof path !== 'string' || !path.startsWith('/') || /~(?![01])/.test(path)) throw new Error('JSONPatch 路径不合法。');
  const parts = path.slice(1).split('/').map(part => part.replace(/~1/g, '/').replace(/~0/g, '~'));
  if (parts.some(part => !part || ['__proto__', 'prototype', 'constructor'].includes(part))) throw new Error('JSONPatch 路径包含空键或保留键。');
  return parts;
}
function correctionJson(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value)) return;
  if (!value || typeof value !== 'object') throw new Error('补丁值必须是合法 JSON 数据。');
  for (const [key, child] of Object.entries(value)) {
    if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error('补丁对象包含保留键。');
    correctionJson(child);
  }
}
function normalizeCorrectionPatch(operations, state) {
  if (!Array.isArray(operations)) throw new Error('副模型须返回 JSONPatch 数组。');
  const draft = structuredClone(state), skipped = new Set();
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const pointer = parts => '/' + parts.map(part => part.replace(/~/g, '~0').replace(/\//g, '~1')).join('/');
  function protectedField(parts, removing = false) {
    if (!parts.length) return removing;
    const [root, field, child] = parts;
    if (!['玩家', '场景', '人际'].includes(root)) return true;
    if (removing && parts.length === 1) return true;
    if (root === '玩家' && ['性别', '综合初评'].includes(field)) return true;
    if (root === '玩家' && field === '成长' && (removing && parts.length === 2 || parts.length >= 3 && child !== '经验')) return true;
    if (root === '场景' && field === '选拔赛') {
      if (removing && parts.length <= 3) return true;
      const previousPerson = state.场景?.选拔赛?.名册?.[parts[3]];
      if (removing && child === '名册' && parts.length === 4 && previousPerson &&
          ['初始战绩', '入赛轮次', '退赛日期'].some(key => Object.hasOwn(previousPerson, key))) return true;
      if (parts.length >= 3 && ['结束日期', '总分', '总积分', '积分', '排名', '积分榜', '排行榜', '胜场', '败场', '程序战况', '程序推演', '推演版本'].includes(child)) return true;
      if (child === '名册' && parts.length >= 5 && (['初始战绩', '退赛日期', '胜场', '败场', '积分', '总分', '排名', '程序推演', '推演版本'].includes(parts[4]) ||
          parts[4] === '入赛轮次' && Object.hasOwn(state.场景?.选拔赛?.名册 || {}, parts[3]))) return true;
      if (child === '比赛' && parts.length >= 5 && ['甲赛前胜场', '乙赛前胜场', '积分', '程序推演', '推演版本'].includes(parts[4])) return true;
    }
    // 已保存的阶段由分数派生；旧坏记录缺阶段时允许补齐，不能把缺字段也当成受保护的值。
    return root === '人际' && parts.length >= 3 && ['恋爱阶段', '羁绊阶段'].includes(child) &&
      Object.hasOwn(state.人际?.[field] || {}, child);
  }
  function ignore(parts, value, removing = false) {
    if (!protectedField(parts, removing)) return false;
    if (removing ? correctionValue(draft, parts) !== undefined : !same(correctionValue(draft, parts), value)) skipped.add(pointer(parts));
    return true;
  }
  function parentFor(parts, create) {
    let parent = draft;
    for (let i = 0; i < parts.length - 1; i++) {
      const key = parts[i];
      if (!parent || typeof parent !== 'object') throw new Error('字段父级不是对象或数组：' + pointer(parts.slice(0, i)));
      if (!Object.hasOwn(parent, key)) {
        if (!create) return null;
        parent[key] = parts[i + 1] === '-' ? [] : {};
      }
      parent = parent[key];
    }
    if (!parent || typeof parent !== 'object') throw new Error('字段父级不是对象或数组：' + pointer(parts));
    return parent;
  }
  function arrayIndex(parent, key, insert) {
    const index = key === '-' ? parent.length : /^(0|[1-9]\d*)$/.test(key) ? Number(key) : -1;
    if (!Number.isSafeInteger(index) || index < 0 || index > parent.length || !insert && index === parent.length)
      throw new Error('数组索引超出当前范围：' + key);
    return index;
  }
  function put(parts, value, mode = 'replace') {
    // 不允许用 null/数组/文字替换赛制容器来间接擦掉只读历史和派生字段。
    if (parts[0] === '场景' && parts[1] === '选拔赛' &&
        (parts.length === 2 || parts.length <= 4 && ['名册', '比赛'].includes(parts[2])) && !object(value)) {
      skipped.add(pointer(parts)); return;
    }
    if (ignore(parts, value)) return;
    // 能力说明的文字简写也视为只改说明，避免省略的代价和掌握状态被清空。
    if (typeof value === 'string' && parts[0] === '玩家' &&
        (parts[1] === '其他能力' && parts.length === 3 || parts[1] === '伐刀能力' && parts[2] === '招式' && parts.length === 4)) value = { 说明: value };
    const parent = parts.length ? parentFor(parts, true) : null, key = parts.at(-1);
    if (Array.isArray(parent)) {
      const index = arrayIndex(parent, key, true);
      if (mode === 'add') parent.splice(index, 0, structuredClone(value));
      else parent[index] = structuredClone(value);
      return;
    }
    const old = correctionValue(draft, parts);
    if (object(value) && (object(old) || old === undefined)) {
      // 所有父对象统一按提供键合并，省略字段保留；先在内存组装，再输出完整的新记录。
      if (old === undefined) parent[key] = {};
      for (const [field, child] of Object.entries(value)) put([...parts, field], child);
      if (old === undefined && Object.keys(value).length && !Object.keys(parent[key]).length) delete parent[key];
      return;
    }
    if (!parts.length) throw new Error('MVU 根数据必须是对象。');
    parent[key] = structuredClone(value);
  }
  function remove(parts) {
    if (ignore(parts, undefined, true)) return;
    const parent = parentFor(parts, false), key = parts.at(-1);
    if (!parent || !Object.hasOwn(parent, key)) return;
    if (Array.isArray(parent)) parent.splice(arrayIndex(parent, key, false), 1);
    else delete parent[key];
  }
  for (const op of operations) {
    if (!op || !['add', 'replace', 'remove', 'copy', 'move', 'test'].includes(op.op)) throw new Error('JSONPatch 操作不合法。');
    const parts = correctionPath(op.path);
    if (op.op === 'remove') { remove(parts); continue; }
    if (op.op === 'copy' || op.op === 'move') {
      const from = correctionPath(op.from);
      if (protectedField(from) || protectedField(parts)) { skipped.add(pointer(protectedField(from) ? from : parts)); continue; }
      const value = correctionValue(draft, from);
      if (value === undefined) throw new Error('复制或移动的来源不存在：' + op.from);
      if (op.op === 'move' && parts.length > from.length && from.every((key, i) => parts[i] === key)) throw new Error('不能把对象移动到自身子级。');
      const copy = structuredClone(value);
      correctionJson(copy);
      if (op.op === 'move') remove(from);
      put(parts, copy, 'add'); continue;
    }
    if (!Object.hasOwn(op, 'value')) throw new Error('补丁缺少 value。');
    correctionJson(op.value);
    if (op.op === 'test') {
      if (!same(correctionValue(draft, parts), op.value)) throw new Error('补丁前置值已不匹配：' + op.path);
    } else put(parts, op.value, op.op);
  }
  // 多个既有人物可能同时缺字段；逐字段、甚至逐人物校验都会被另一条坏记录阻断。
  // 先组装完整名册，再提交一次；省略的资料保留，错键只有显式 remove 才删除。
  for (const [name, relation] of Object.entries(draft.人际 || {})) {
    if (!object(relation) || same(state.人际?.[name], relation)) continue;
    if (relation.支援度 === null) relation.羁绊阶段 = '未定';
    else if (Number.isInteger(relation.支援度) && relation.支援度 >= 0 && relation.支援度 <= 320)
      relation.羁绊阶段 = supportStage(relation.支援度);
  }
  const result = [];
  if (!same(state.人际, draft.人际)) result.push({ op: Object.hasOwn(state, '人际') ? 'replace' : 'add',
    path: '/人际', value: structuredClone(draft.人际) });
  function diff(before, after, parts) {
    if (parts.length === 1 && parts[0] === '人际') return;
    if (same(before, after)) return;
    if (object(before) && object(after)) {
      for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) diff(before[key], after[key], [...parts, key]);
    } else result.push(after === undefined ? { op: 'remove', path: pointer(parts) } :
      { op: before === undefined ? 'add' : 'replace', path: pointer(parts), value: structuredClone(after) });
  }
  // 名册修复先于其他字段，避免本可修复的人物结构阻断同批其它业务；新事件与能力保留完整对象。
  diff(state, draft, []);
  Object.defineProperty(result, 'skipped', { value: [...skipped] });
  return result;
}
function validateCorrectionPatch(operations, state) {
  // 字段类型、必填项和数值总范围交给统一 schema；这里仅确认归一化结果可完整应用。
  normalizeCorrectionPatch(operations, state);
  return operations;
}
function correctionRules(state) {
  // 副校正不再拼入主模型的字段所有权禁令；旧设置中保存的同类禁令由本次权限声明覆盖。
  return 'F01校正权限以本次为准：允许修改玩家、场景、人际的业务字段及现有对象，不限于补建。系统/框架元数据、固定玩家性别、综合初评、已有关系派生阶段和成长自动记录由程序维护，混入补丁时自动略过，不影响其他修改。' +
    '保持现有schema字段名称、类型与范围：好感0—1000或null，支援度0—320整数或null，觉醒只用true/false；卷章须属现有目录。' +
    '人际以人物姓名为键。新增人物或修复不完整人物必须补齐关系、态度印象、好感、支援度、羁绊阶段、变化依据；文本字段使用字符串，分数无依据时用null，不编造关系、态度、经历或奖励。未知资料明确写待确认，保留已有事实。羁绊阶段由最终支援度派生：null为未定，0—79未建立、80—159为C、160—239为B、240—319为A、320为S。' +
    '准确字段名是态度印象和支援度，不能写印象或支援。修复错键时先把有依据的内容写入正确字段，再显式remove旧错键；整个人物replace按提供字段合并，省略字段仍保留，不会自动删除旧键或其它已知资料。同批补齐所有已发现的坏人物，不靠反复逐字段试错。' +
    '本次成长统一采用终值：只写/玩家/成长/经验/<目标>与/玩家/六维/<目标>的最终值，不创建或修改成长申请；旧申请与记录只留档。经验为所提交评级的档内进度，门槛F100、F+100、E150、E+150、D250、D+250、C400、C+400、B600、B+900、A1200、A+1600，达标连续晋级、逐档扣除并保留余量，S保留余量。无约束时由模型完成计算；可选约束校验类型与门槛。读取当前实际保存值，主补丁可能漏写或部分失败；补漏纠错，不再次加已经落实的本轮经验；未知评级不猜起点。魔力量新成长须魔人觉醒:true，觉醒本身不赠经验。登记等级仅随实际登记改变。' +
    'T02日期结算沿用T01账本/场景/选拔赛，默认20轮6席。名册按稳定ID记录{姓名,来源:正典/原创/玩家,参赛状态:参赛/退选/取消资格}；只登记本局实际参赛者，初始战绩只读，禁止新增、修改或清除。新参赛者可按实际事实填入赛轮次，已有参赛者的入赛轮次不可修改；退赛日期及赛季结束日期完全由程序维护，只按事实修改参赛状态或赛季状态，不新增、改写或删除这些日期。' +
    '比赛按稳定ID记录{轮次,甲方:名册ID,乙方:名册ID,日期,时间,地点,状态:待定/已安排/已完成/已取消,胜者?:名册ID,弃权方?:名册ID,依据}；同场纠错沿用ID，结束填实际胜者及结果依据。排期不等于完赛；双方不能相同、重复对战或同轮多赛。' +
    '程序选拔赛摘要按场景/时间读取2013年赛程，场外背景默认沿正典走势、普通选手固定生成；当天排期不自动完赛，玩家缺场保留待补。只登记本轮实际事实，禁止把背景推演批量写回；本轮OC战胜珠雫等正典人物时据实登记，绝不能按原著或程序背景改回失败。' +
    '胜局积分=10+10×对手赛前胜场，败局不扣历史分；赛前胜场、战绩、积分、排名、程序战况、程序推演及推演版本由代码控制，禁止写入。现存初始战绩是玩家手动接管旧档的只读基线，不与逐场记录重复。摘要null为未知，不是0。当前模式' + String(state?.系统?.主角模式 || '未选择') + '，本局事实始终优先。' +
    '已有值按最终结果纠正；已有且完整的变化依据无需重复提交，缺失时必须根据本轮正文或现有事实补齐。资料足够时可核定原null或缺失分数。只输出裸JSONPatch数组，支持add/replace/remove/copy/move/test，不输出Analysis或UpdateVariable标签。';
}
// 只重试请求阶段的临时连接故障；鉴权、格式、字段和保存错误交明确提示处理。
function correctionRequestFailure(error, timedOut) {
  const status = Number(error?.status ?? error?.statusCode ?? error?.response?.status ?? String(error?.message || '').match(/\b(401|403|408|429|5\d\d)\b/)?.[1]);
  const transient = timedOut || error instanceof TypeError || [408, 429].includes(status) || status >= 500 && status <= 599 ||
    !status && /network|fetch failed|failed to fetch|timeout|timed out|ECONNRESET|ECONNREFUSED/i.test(String(error?.message || ''));
  return { retryable: !timedOut && transient, message: timedOut ? '副 API 请求超时，已停止自动重试；可检查连接后手动重试。' : status === 401 || status === 403 ? '副 API 认证失败，请核对密钥和权限后保存配置。'
    : status ? '副 API 请求失败（HTTP ' + status + '）。' : '副 API 连接失败，请核对地址、模型及密钥。' };
}
async function requestCorrection(automatic = false) {
  // 等待主结算时，手动按钮也不能绕过自动任务的来源锁。
  if (!automatic && (correctionMainBusy() || correctionAutoTurn?.phase === 'waiting')) throw new Error('正在等待酒馆主回复和 MVU 保存完成，请稍后校正。');
  if (!automatic && correctionAutoTurn) cancelCorrection('已转为手动校正本轮。');
  if (correctionJob) throw new Error('副 API 正在请求中，请等待或取消。');
  correctionDraft = null; correctionRetry = null;
  const abort = new AbortController(), epoch = correctionEpoch; correctionJob = abort;
  let timer, watch, received = false, timedOut = false, saved, requesting = false;
  setCorrectionStatus('reading', '正在自动读取本轮正文、事件与当前 MVU…');
  try {
    saved = captureCorrection();
    correctionRetry = { saved, automatic };
    const config = getCorrectionConfig();
    if (!config.endpoint || !config.model) throw new Error('请先保存副 API 地址和模型。');
    if (typeof saved.ctx.ChatCompletionService?.processRequest !== 'function') throw new Error('当前 SillyTavern 缺少独立请求转发接口，请更新宿主。');
    const input = correctionInput(saved), state = input.state;
    const system = config.prompt + '\n' + correctionRules(state);
    setCorrectionStatus('requesting', automatic ? '正在全面核对本轮正文与业务变量…' : '正在请求本轮校正预览…');
    timer = setTimeout(() => { timedOut = true; abort.abort(); }, 120000);
    watch = setInterval(() => { try { ensureCorrectionCurrent(saved); } catch (_) { abort.abort(); } }, 350);
    requesting = true;
    const response = await saved.ctx.ChatCompletionService.processRequest({ chat_completion_source: 'custom', custom_url: config.endpoint,
      custom_include_headers: JSON.stringify({ Authorization: correctionKey ? 'Bearer ' + correctionKey : '' }),
      // 固定宿主源码在最终请求体组装后排除顶层字段；JSON 数组也是合法 YAML，避免手拼配置语法。
      custom_exclude_body: JSON.stringify(config.excludedParams),
      model: config.model, messages: [{ role: 'system', content: system }, { role: 'user', content: JSON.stringify({
        当前变量: state, 程序选拔赛: correctionTournamentSummary(saved.data.stat_data), 本轮正文: input.text, 本轮已发生事件: input.events, 本轮已提交人际更新: input.submittedRelations,
        本轮已提交进度: input.submittedStory, 主结算前场景: input.storyBefore, 主补丁状态: input.mainPatch,
        玩家补充说明: config.deviation, 最新回复楼层: saved.messageId, 当前回复页: saved.swipeId }) }],
      max_tokens: config.maxTokens, stream: false }, {}, true, abort.signal);
    if (response?.error) {
      const error = new Error('副 API 请求失败。');
      error.status = response.status ?? response.error?.status ?? response.error?.code;
      throw error;
    }
    received = true;
    if (abort.signal.aborted || correctionJob !== abort) throw new Error('本次副 API 请求已取消。');
    ensureCorrectionCurrent(saved);
    const raw = typeof response === 'string' ? response : response?.content;
    if (typeof raw !== 'string' || raw.length > 300000) throw new Error('副 API 未返回可用的补丁文本。');
    let ops = parseCorrectionPatch(raw);
    ops = normalizeCorrectionPatch(ops, saved.data.stat_data);
    const skipped = ops.skipped || [];
    correctionDraft = ops.length ? { saved, ops, skipped } : null;
    if (!ops.length) correctionRetry = null;
    const skippedNote = skipped.length ? ' 已略过 ' + skipped.length + ' 项程序维护字段。' : '';
    setCorrectionStatus(ops.length ? 'preview' : 'unchanged', (ops.length ? (automatic ? '校正补丁已整理，准备通过 MVU 保存…' : '预览已就绪，确认后可应用。') : '本轮没有新的业务变量变化，未写入。') + skippedNote);
    return { patch: JSON.stringify(ops, null, 2), count: ops.length, skipped, source: '楼层 ' + saved.messageId + ' · 回复页 ' + (saved.swipeId + 1), automatic };
  } catch (error) {
    const cancelled = epoch !== correctionEpoch || abort.signal.aborted && !timedOut;
    const failure = (timedOut || !received && requesting) ? correctionRequestFailure(error, timedOut) : { retryable: false, message: String(error.message || '本轮校正失败。') };
    const message = (cancelled ? '当前 MVU 来源已变化或任务已手动取消。' : failure.message).replaceAll(correctionKey || '\u0000', '[已隐藏]');
    if (cancelled) correctionRetry = null;
    if (correctionJob === abort && epoch === correctionEpoch && correctionStatus.state !== 'cancelled') setCorrectionStatus(cancelled ? 'cancelled' : 'failed', message, { canRetry: Boolean(correctionRetry) });
    const result = new Error(message); result.retryable = !cancelled && failure.retryable;
    throw result;
  } finally { clearTimeout(timer); clearInterval(watch); if (correctionJob === abort) correctionJob = null; }
}
async function applyCorrection() {
  const draft = correctionDraft;
  if (!draft?.ops.length) throw new Error('没有待应用的补丁，请先请求校正。');
  if (correctionJob) throw new Error('已有副 API 操作正在执行。');
  correctionDraft = null;
  const lock = new AbortController(), epoch = correctionEpoch; correctionJob = lock;
  let writeStarted = false;
  setCorrectionStatus('applying', '正在通过 MVU 校验并写入本轮校正…');
  try {
    const parseBase = ensureCorrectionCurrent(draft.saved);
    const parser = draft.saved.guard;
    const parsed = parser
      ? await parser.parseRepair(JSON.stringify(draft.ops), prepareRakudaiNativeMvu(structuredClone(parseBase.data), parseBase.scopes), draft.saved.sourceText, draft.saved)
      : await draft.saved.mvu.parseMessage('<UpdateVariable><JSONPatch>' + JSON.stringify(draft.ops) + '</JSONPatch></UpdateVariable>',
        prepareRakudaiNativeMvu(structuredClone(parseBase.data), parseBase.scopes));
    if (lock.signal.aborted) throw new Error('本次校正已取消，未写入。');
    ensureCorrectionCurrent(draft.saved);
    if (!parsed?.stat_data) throw new Error('MVU 未返回可保存的状态，请查看 MVU 通知。');
    if (!draft.saved.guard) prepareRakudaiNativeMvu(parsed, parseBase.scopes);
    // 解析可能只接受了部分命令；“有变化”不等于坏记录已经修好。两种模式都检查真实候选，检查不改值。
    const service = stateService();
    if (typeof service.validateState !== 'function') throw new Error('状态服务缺少完整档案检查接口，请更新配套终端后重试；未写入。');
    try { service.validateState(parsed.stat_data); }
    catch (error) {
      const issues = Array.isArray(error?.issues) ? error.issues.slice(0, 8).map(issue =>
        '/' + issue.path.join('/') + '：' + issue.message).join('；') : String(error?.message || error);
      throw new Error('校正结果仍不符合档案结构，未写入：' + issues);
    }
    if (correctionMvuKey(parsed) === draft.saved.stateKey) {
      // 同轮已推进时，重复的卷章提议属于无变化，不再显示连接或写入失败。
      const scene = draft.saved.data.stat_data.场景, start = draft.saved.storyBefore;
      const alreadyAdvanced = start && (start.当前卷 !== scene.当前卷 || start.当前章 !== scene.当前章);
      const repeatedStory = draft.ops.every(op => /^\/场景\/(当前卷|当前章|阶段)$/.test(op.path) &&
        (op.value === scene[op.path.split('/')[2]] || op.path === '/场景/阶段' && op.value === '已结束' && alreadyAdvanced));
      if (repeatedStory) {
        correctionRetry = null;
        setCorrectionStatus('unchanged', '本轮进度已核对，未产生新的变量变化。');
        return '本轮进度已核对，未写入重复变更。';
      }
      throw new Error('没有可保存的变化：补丁可能已落实或被字段约束拒绝，请查看 MVU 通知。');
    }
    const update = fn('updateVariablesWith');
    if (!update) throw new Error('酒馆助手缺少同步变量更新接口。');
    // 比较与赋值之间没有 await；只写请求时捕获的当前楼层/当前 swipe。
    writeStarted = true;
    const result = update(current => {
      ensureCorrectionCurrent(draft.saved);
      if (correctionMvuKey(current) !== draft.saved.stateKey) throw new Error('MVU 实际变量已变化，未覆盖。');
      return mergeCorrectionData(current, parseBase.data, parsed);
    }, draft.saved.options);
    if (result && typeof result.then === 'function') throw new Error('接口不是预期同步版本，请回读当前变量确认。');
    terminalStateReader?.clear();
    setCorrectionStatus('verifying', '已提交写入，正在回读当前回复页确认…');
    const persisted = captureCorrection();
    if (persisted.chatRef !== draft.saved.chatRef || persisted.swipeId !== draft.saved.swipeId ||
        correctionMvuKey(persisted.data) !== correctionMvuKey(parsed)) throw new Error('回读未确认一致，请查看当前变量后再操作。');
    correctionRetry = null;
    emit({ type: 'correction-applied', reset: true, retainDisplay: true });
    setCorrectionStatus('applied', '本轮校正已保存，当前回复页回读一致。' + (draft.skipped?.length ? ' 已略过 ' + draft.skipped.length + ' 项程序维护字段。' : ''));
    return draft.saved.guard ? 'MVU 已解析并保存，当前回复页回读一致；被字段约束拒绝的项不会强写。' : '原生 MVU 已解析并保存，当前回复页回读一致。';
  } catch (error) {
    const message = (String(error.message || '校正未能保存。') + (writeStarted ? ' 写入结果未确认，请先核对当前变量；不会自动重放补丁。' : '')).replaceAll(correctionKey || '\u0000', '[已隐藏]');
    if (writeStarted) correctionRetry = null;
    else if (correctionRetry) correctionRetry.automatic = false;
    if (correctionJob === lock && epoch === correctionEpoch && correctionStatus.state !== 'cancelled') setCorrectionStatus(lock.signal.aborted ? 'cancelled' : 'failed', message, { canRetry: Boolean(correctionRetry) });
    throw new Error(message);
  } finally { if (correctionJob === lock) correctionJob = null; }
}
// 自动调度接已保存配置或本机恢复配置之后的新生成；打开旧聊天和变量轮询不补跑历史。
function correctionMvuBlock(content) {
  const text = String(content || '').replace(/\r\n?/g, '\n');
  // 半截、多块或不可解析的标签不能代表本轮结算完成；非 MVU 文本不参与指纹。
  if ((text.match(/<UpdateVariable>/gi) || []).length !== 1 || (text.match(/<\/UpdateVariable>/gi) || []).length !== 1) return '';
  const block = text.match(/<UpdateVariable>[\s\S]*?<\/UpdateVariable>/i)?.[0];
  if (!block || (block.match(/<(?:JSONPatch|json_patch)>/gi) || []).length !== 1 || (block.match(/<\/(?:JSONPatch|json_patch)>/gi) || []).length !== 1) return '';
  const patch = block.match(/<(JSONPatch|json_patch)>([\s\S]*?)<\/\1>/i);
  try { return patch && Array.isArray(JSON.parse(patch[2].trim())) ? block : ''; }
  catch (_) { return ''; }
}
function correctionReplyIdentity(content) {
  return correctionMvuBlock(content) || String(content || '').replace(/\r\n?/g, '\n')
    .replace(/(?:\s*<StatusPlaceHolderImpl\s*\/>)+\s*$/i, '').trim();
}
function parseCorrectionPatch(raw) {
  let text = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  const block = correctionMvuBlock(text);
  if (block === text) text = block.match(/<(JSONPatch|json_patch)>([\s\S]*?)<\/\1>/i)[2].trim();
  else {
    const wrapped = text.match(/^<(JSONPatch|json_patch)>([\s\S]*?)<\/\1>$/i);
    if (wrapped) text = wrapped[2].trim();
  }
  try { const operations = JSON.parse(text); if (Array.isArray(operations)) return operations; } catch (_) {}
  throw new Error('副模型未返回完整 JSON 数组，请调整模型或输出上限后重试。');
}
function correctionReply() {
  const ctx = correctionContext(), read = fn('getChatMessages');
  if (!ctx || !read || !Array.isArray(ctx.chat)) throw new Error('当前聊天不可读。');
  for (let id = ctx.chat.length - 1; id >= 0; id--) {
    const message = read(id, { role: 'assistant', include_swipes: true })?.[0];
    if (!message) continue;
    const active = read(id, { role: 'assistant' })?.[0];
    const swipeId = message.swipe_id, raw = active?.message;
    if (message.message_id !== id || active?.message_id !== id || !Number.isInteger(swipeId) || typeof raw !== 'string') throw new Error('当前回复页不完整。');
    const chatKey = correctionChatKey(), mvuBlock = correctionMvuBlock(raw), sourceText = correctionReplyIdentity(raw);
    return { chatKey, chatRef: ctx.chat, messageRef: ctx.chat[id], messageId: id, swipeId, text: raw, mvuBlock, sourceText,
      key: JSON.stringify([chatKey, id, swipeId, sourceText]) };
  }
  return null;
}
function correctionSameSlot(a, b) {
  return a && b && a.chatKey === b.chatKey && a.chatRef === b.chatRef && a.messageRef === b.messageRef &&
    a.messageId === b.messageId && a.swipeId === b.swipeId;
}
function correctionSameReply(a, b) {
  return correctionSameSlot(a, b) && a.key === b.key;
}
function correctionMvuKey(data) {
  // display_data、schema、图片元数据不决定本次校正是否过期；真正的变量冲突仍阻止写入。
  const { $internal, ...state } = data?.stat_data || {};
  // Zod 会按 schema 重排键，合并保存则沿用现有键序；业务比较忽略对象键序，数组仍按原顺序。
  return JSON.stringify(state, (_key, value) => value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]])) : value);
}
function correctionHostReset(type) {
  if (['generation-start', 'CHAT_CHANGED', 'CHARACTER_FIRST_MESSAGE_SELECTED'].includes(type)) {
    correctionMainTurn = null;
    cancelCorrection('已切换聊天或开始新一轮，本次校正已取消。');
    return;
  }
  // MESSAGE_UPDATED/EDITED 也会由生图插件触发，不能看到事件名就撤销副任务。
  const main = correctionMainTurn;
  const saved = correctionRetry?.saved || correctionDraft?.saved;
  const source = saved || main?.candidate?.reply;
  if (main?.phase === 'waiting' && !source) {
    if (['MESSAGE_RECEIVED', 'MESSAGE_UPDATED', 'MESSAGE_EDITED'].includes(type) || generationPending) return;
  }
  if (source) {
    try {
      const current = correctionReply();
      if (correctionSameReply(current, source)) return;
    } catch (_) { /* 来源确实不可读时停止，不把旧回复当当前页。 */ }
    correctionMainTurn = null;
    cancelCorrection('聊天、回复页或 MVU 标签已变化，本次校正已取消。');
  }
}
function startAutomaticCorrection() {
  const config = getCorrectionStatus();
  if (SS.destroyed) return;
  const ctx = correctionContext();
  if (!ctx || !Array.isArray(ctx.chat)) return;
  let before;
  try { before = correctionReply()?.key; }
  catch (error) { setCorrectionStatus('failed', '无法读取当前回复：' + error.message, { scope: 'main' }); return; }
  // 原生生成入口已隔离辅助请求；同页续写即使沿用相同补丁，也属于需要全面核验的新一轮。
  if (before) correctionSeen.delete(before);
  const turn = { phase: 'waiting', chatRef: ctx.chat, chatKey: correctionChatKey(), before,
    candidate: null, finished: false, settled: false };
  correctionMainTurn = turn;
  // 主保存门禁始终跟踪；只有连接与自动开关都启用时才安排后续副请求。
  if (config.active && config.autoApply) correctionAutoTurn = turn;
  if (!correctionBindMvu?.()) {
    turn.waitFailed = true;
    setCorrectionStatus('failed', '主生成或 MVU 保存事件尚未就绪，尚未确认本轮主保存。', { scope: 'main' }); return;
  }
  setCorrectionStatus('waiting', '等待本轮 MVU 标签、解析与当前回复页保存确认。', { scope: 'main' });
}
function endAutomaticCorrection(stopped, messageCount) {
  const turn = correctionMainTurn;
  if (!turn) return;
  if (stopped) {
    // MVU 已完成解析后，停止正文或生图不等于撤销变量；只复核本页 MVU 来源。
    if (turn.settled || turn.candidate?.ended) correctionHostReset('MESSAGE_UPDATED');
    else { correctionMainTurn = null; cancelCorrection('本轮 MVU 尚未完成，生成已停止。'); return; }
    if (correctionMainTurn !== turn) return;
  }
  const ctx = correctionContext();
  if (ctx?.chat !== turn.chatRef || Number.isInteger(messageCount) && messageCount !== ctx.chat.length) return;
  // 宿主结束仅启动缺失 MVU 的等待期限；是否能请求由标签与变量保存结果决定。
  turn.finished = true;
  turn.deadline = Date.now() + 180000;
  scheduleAutomaticCorrection();
}
function scheduleAutomaticCorrection() {
  clearTimeout(correctionAutoTimer);
  const waiting = correctionMainTurn?.phase === 'waiting' && !correctionMainTurn.waitFailed;
  const correcting = ['guard', 'retrying'].includes(correctionAutoTurn?.phase) && !correctionAutoTurn.waitFailed;
  if ((waiting || correcting) && !SS.destroyed) correctionAutoTimer = setTimeout(checkAutomaticCorrection, 200);
}
function resumeCorrectionWait(turn) {
  if (correctionMainTurn !== turn || turn.phase !== 'waiting') return;
  if (turn.waitFailed) {
    // 迟到的本轮事件恢复原任务的自动意图；用户取消或改配置已清掉重试记录，不擅自重开。
    const retry = correctionRetry?.waiting === turn ? correctionRetry : null;
    turn.waitFailed = false; turn.deadline = Date.now() + 180000;
    if (retry?.automatic) correctionAutoTurn = turn;
    if (retry) correctionRetry = null;
    setCorrectionStatus('waiting', '已收到本轮 MVU 更新，正在核对当前回复页的保存结果。', { scope: 'main' });
  }
  scheduleAutomaticCorrection();
}
function rememberCorrection(key) {
  correctionSeen.add(key);
  if (correctionSeen.size > 300) correctionSeen.delete(correctionSeen.values().next().value);
}
async function runAutomaticCorrection(turn) {
  try {
    turn.phase = 'requesting';
    const preview = await requestCorrection(true);
    if (correctionAutoTurn !== turn || SS.destroyed) return preview;
    if (preview.count) { turn.phase = 'applying'; await applyCorrection(); }
    rememberCorrection(turn.candidate.reply.key);
    if (correctionAutoTurn === turn) correctionAutoTurn = null;
    return { ...preview, applied: correctionStatus.state === 'applied' };
  } catch (error) {
    if (correctionAutoTurn !== turn || SS.destroyed) return;
    correctionDraft = null;
    if (turn.phase === 'requesting' && error.retryable && turn.attempt < CORRECTION_MAX_ATTEMPTS && correctionRetry) {
      // 只对尚未写入的请求做有限退避；每次重试前都重新确认原 MVU 标签、回复页和实际变量没有变化。
      turn.phase = 'retrying';
      turn.retryAt = Date.now() + (turn.attempt === 1 ? 2000 : 5000);
      setCorrectionStatus('retrying', '连接暂时失败，等待重试；变量尚未写入。', { retryAt: turn.retryAt });
      scheduleAutomaticCorrection();
      return;
    }
    correctionAutoTurn = null;
    if (correctionStatus.state !== 'cancelled') setCorrectionStatus('failed', error.message || '本轮自动校正失败。', {
      canRetry: Boolean(correctionRetry), attempt: turn.attempt, maxAttempts: CORRECTION_MAX_ATTEMPTS });
  }
}
async function retryCorrection() {
  if (correctionJob || correctionAutoTurn) throw new Error('正在处理本轮校正，请先等待或取消。');
  const retry = correctionRetry;
  if (!retry || !correctionStatus.canRetry) throw new Error('没有可重试的任务，请先核对配置与当前变量。');
  if (retry.waiting) {
    const turn = retry.waiting;
    if (correctionMainTurn !== turn || turn.settled && turn.phase !== 'guard') throw new Error('原等待任务已变化，请重新读取本轮。');
    // 保存未确认的失败只能重走门禁，绝不把“能读到旧 v4”当成可重试的校正来源。
    turn.waitFailed = false; turn.deadline = Date.now() + 180000;
    delete turn.guardWaitDeadline;
    if (retry.automatic) correctionAutoTurn = turn;
    correctionRetry = null;
    setCorrectionStatus('waiting', turn.settled ? '主 MVU 已保存，重新等待副校正约束就绪。' : '重新等待本轮 MVU 标签与保存结果；确认完成后再校正。', { scope: turn.settled ? 'correction' : 'main' });
    scheduleAutomaticCorrection();
    return { waiting: true, count: 0 };
  }
  try { ensureCorrectionCurrent(retry.saved); }
  catch (_) {
    correctionRetry = null;
    setCorrectionStatus('cancelled', 'MVU 标签、回复页或实际变量已变化，旧任务不可重试；请重新读取本轮。');
    throw new Error(correctionStatus.message);
  }
  if (!retry.automatic) return requestCorrection(false);
  const reply = correctionReply();
  const turn = { phase: 'requesting', candidate: { reply }, attempt: 1 };
  correctionAutoTurn = turn;
  return runAutomaticCorrection(turn);
}
async function checkAutomaticCorrection() {
  const turn = ['guard', 'retrying'].includes(correctionAutoTurn?.phase) ? correctionAutoTurn : correctionMainTurn;
  if (!turn || !['waiting', 'guard', 'retrying'].includes(turn.phase) || turn.waitFailed || SS.destroyed) return;
  try {
    if (turn.phase === 'retrying') {
      ensureCorrectionCurrent(correctionRetry.saved);
      if (Date.now() < turn.retryAt) { scheduleAutomaticCorrection(); return; }
      turn.attempt++;
      return await runAutomaticCorrection(turn);
    }
    if (turn.phase === 'waiting' && turn.deadline && Date.now() > turn.deadline) throw new Error('未确认本轮 MVU 主保存。请检查 MVU 是否启用、是否在等待独立更新；当前楼层有完整变量后可重试。');
    const ctx = correctionContext();
    if (ctx?.chat !== turn.chatRef || correctionChatKey() !== turn.chatKey) throw new Error('聊天已切换，本轮校正已取消。');
    const candidate = turn.candidate;
    if (!candidate?.ended) { scheduleAutomaticCorrection(); return; }
    if (candidate.receiptTailError && correctionRuntime().mode !== 'native') throw new Error(candidate.receiptTailError);
    if (!correctionSameReply(correctionReply(), candidate.reply)) throw new Error('回复页或 MVU 标签已变化，本轮校正已取消。');
    // 解析结束收据必须随主 MVU 真正落到本页；同值或空补丁不能冒充尚未完成的主写入。
    const saved = captureCorrection(true, false), current = correctionMvuKey(saved.data), expected = correctionMvuKey(candidate.variables);
    if (turn.phase === 'waiting') {
      if (!candidate.receiptId || saved.data.delta_data?.$internal?.__rk_main_save?.id !== candidate.receiptId) {
        turn.persisted = null; scheduleAutomaticCorrection(); return;
      }
      if (current !== expected) { turn.persisted = null; scheduleAutomaticCorrection(); return; }
      const stable = current + saved.mvuBlock;
      if (turn.persisted !== stable) { turn.persisted = stable; turn.stableSince = Date.now(); scheduleAutomaticCorrection(); return; }
      if (Date.now() - turn.stableSince < 300) { scheduleAutomaticCorrection(); return; }
      turn.settled = true; turn.phase = 'settled'; turn.saved = saved;
      if (correctionRetry?.waiting === turn) correctionRetry = null;
      if (correctionAutoTurn !== turn) {
        setCorrectionStatus('ready', '本轮 MVU 主保存已确认；未安排副 API 自动校正。', { scope: 'main' });
        return;
      }
      turn.phase = 'guard';
    }
    if (!correctionSameReply(saved, turn.saved) || current !== turn.saved.stateKey) throw new Error('主 MVU 保存后回复页或实际变量已变化，请重新请求校正。');
    if (correctionJob) { scheduleAutomaticCorrection(); return; }
    try { correctionGuard(); }
    catch (error) {
      if (error.code !== 'RK_GUARD_LOADING') throw error;
      turn.guardWaitDeadline ??= Date.now() + 60000;
      if (Date.now() >= turn.guardWaitDeadline) throw new Error('等待 MVU v4 约束注册超时。' + error.message + ' 排除原因后可点击“重试本轮”。');
      if (correctionStatus.scope !== 'correction' || correctionStatus.state !== 'waiting' || correctionStatus.message !== error.message) setCorrectionStatus('waiting', error.message, { attempt: 0 });
      scheduleAutomaticCorrection(); return;
    }
    delete turn.guardWaitDeadline;
    if (correctionSeen.has(candidate.reply.key)) { correctionAutoTurn = null; setCorrectionStatus('unchanged', '本回复已经自动核对过，不重复请求。'); return; }
    turn.attempt = 1;
    return await runAutomaticCorrection(turn);
  } catch (error) {
    if (SS.destroyed || correctionMainTurn !== turn && correctionAutoTurn !== turn) return;
    const automatic = correctionAutoTurn === turn;
    correctionAutoTurn = null; correctionDraft = null; correctionRetry = null;
    if (['waiting', 'guard'].includes(turn.phase)) {
      // 保留主流程写锁；超时后等待新 MVU 事件或显式重试，避免定时器反复报错。
      turn.waitFailed = true;
      correctionRetry = { waiting: turn, automatic };
    }
    setCorrectionStatus('failed', String(error.message || '本轮自动校正失败。').replaceAll(correctionKey || '\u0000', '[已隐藏]'), { scope: turn.settled ? 'correction' : 'main', canRetry: Boolean(correctionRetry) });
  }
}
function wireAutomaticCorrection(safeOn, TE) {
  let bound = false;
  function stampReceipt(candidate) {
    const variables = candidate.variables;
    if (!variables.delta_data || typeof variables.delta_data !== 'object' || Array.isArray(variables.delta_data)) variables.delta_data = {};
    const delta = variables.delta_data;
    if (!delta.$internal || typeof delta.$internal !== 'object' || Array.isArray(delta.$internal)) delta.$internal = {};
    delta.$internal.__rk_main_save = { id: candidate.receiptId };
  }
  const receiptTail = variables => {
    const turn = correctionMainTurn, candidate = turn?.candidate;
    if (turn?.phase !== 'waiting' || !candidate?.ended || candidate.variables !== variables) return;
    try {
      if (!correctionSameReply(correctionReply(), candidate.reply)) return;
      stampReceipt(candidate);
      resumeCorrectionWait(turn);
    } catch (_) {
      candidate.receiptTailError = 'MVU 约束结束后的保存收据未能注册，主保存尚未确认。';
      resumeCorrectionWait(turn);
    }
  };
  correctionBindMvu = () => {
    if (bound) return true;
    const events = (window.Mvu || HW.Mvu)?.events;
    if (!events?.COMMAND_PARSED || !events.VARIABLE_UPDATE_ENDED) return false;
    bound = true;
    const tailEvent = events.VARIABLE_UPDATE_ENDED + '_for_zod';
    SS.disposers.push(() => fn('eventRemoveListener')?.(tailEvent, receiptTail));
    safeOn(events.COMMAND_PARSED, (variables, commands, content) => {
      const turn = correctionMainTurn;
      // 上一轮已取消的慢请求仍持有网络锁，也要接住新主回复的结算；发请求时再等待锁释放。
      if (!turn || turn.phase !== 'waiting') return;
      try {
        const reply = correctionReply();
        if (!reply || reply.chatRef !== turn.chatRef || reply.chatKey !== turn.chatKey ||
            reply.sourceText !== correctionReplyIdentity(content)) return;
        turn.candidate = { variables, reply, ended: false };
        turn.deadline = Date.now() + 180000;
        turn.persisted = null;
        resumeCorrectionWait(turn);
      } catch (_) { /* 无法唯一绑定当前回复时不开放自动写入。 */ }
    });
    safeOn(events.VARIABLE_UPDATE_ENDED, (variables, previous) => {
      const turn = correctionMainTurn;
      if (turn?.phase !== 'waiting' || turn.candidate?.variables !== variables) return;
      try {
        if (!correctionSameReply(correctionReply(), turn.candidate.reply)) return;
        // 两版 MVU 都先设置 delta_data 再发 ENDED；随后会清 stat_data.$internal，但保留 delta_data。
        // 将唯一收据放入本轮真实写入包装，直到当前楼层回读同 id 才释放主保存锁。
        turn.candidate.receiptId = Date.now().toString(36) + ':' + Math.random().toString(36).slice(2);
        stampReceipt(turn.candidate);
        const makeLast = fn('eventMakeLast'), remove = fn('eventRemoveListener');
        if (typeof makeLast !== 'function' || typeof remove !== 'function') {
          turn.candidate.receiptTailError = '当前酒馆助手缺少 eventMakeLast / eventRemoveListener，无法确认约束处理后的主保存；请更新配套运行环境。';
        } else {
          try {
            // 桥接可以后加载；每轮都显式移到其后，并使用原回调解绑，避免依赖包装后的 stop。
            remove(tailEvent, receiptTail);
            makeLast(tailEvent, receiptTail);
            delete turn.candidate.receiptTailError;
          } catch (_) {
            turn.candidate.receiptTailError = '保存收据尾部监听注册失败，无法确认约束处理后的主保存；请检查酒馆助手事件接口。';
          }
        }
      } catch (_) { return; /* 无法绑定真实当前页时不制造主写入收据。 */ }
      // 保留引用，等待后续守卫与 Zod 完成，而不是在本回调中提前复制旧中间态。
      turn.candidate.ended = true;
      // previous 是主 MVU 本次结算前的快照；不从正文或当前卷章倒推起点。
      const scene = previous?.stat_data?.场景;
      if (scene && Number.isInteger(scene.当前卷) && typeof scene.当前章 === 'string' &&
          ['未开始', '进行中', '已结束'].includes(scene.阶段)) {
        turn.candidate.storyBefore = { 当前卷: scene.当前卷, 当前章: scene.当前章, 阶段: scene.阶段 };
      }
      resumeCorrectionWait(turn);
    });
    return true;
  };
  correctionBindMvu();
  const waitMvu = fn('waitGlobalInitialized');
  if (waitMvu) Promise.resolve(waitMvu('Mvu')).then(() => { if (!SS.destroyed) correctionBindMvu?.(); }).catch(() => { /* 下次主生成前再次核对就绪状态。 */ });
  if (TE.CHARACTER_MESSAGE_RENDERED) safeOn(TE.CHARACTER_MESSAGE_RENDERED, messageId => {
    const turn = correctionMainTurn;
    if (turn?.phase !== 'waiting') return;
    try {
      const reply = correctionReply();
      if (!reply || reply.messageId !== messageId || reply.chatRef !== turn.chatRef || reply.chatKey !== turn.chatKey) return;
      // 渲染只唤醒保存核验，不把界面已经显示当作变量已写入。
      resumeCorrectionWait(turn);
    } catch (_) {}
  });
}
SS.disposers.push(() => { correctionMainTurn = null; cancelCorrection(); correctionKey = ''; correctionActive = false; correctionBindMvu = null; correctionSeen.clear(); });
