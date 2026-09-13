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
  '玩家资料、能力、六维、登记等级、成长经验，场景与事件，以及人物资料、好感和支援都可修正。已有数字提交最终值；当前变量已含主回复结算，同一成果不重复加分或发经验。',
  '分别核对好感与支援，不用态度印象代替数值变化。普通正向回应+2—10，新生轻微好感、认可或防备缓和+11—20，重大关系事件+21—40；校正错误旧分数可直接给正确终值，不受这些单轮参考区间限制。支援按实际协作判断。',
  '父对象可只写要改的键，代码会合并并保留省略字段；数组按最终内容更新。add/replace会按存在性适配，remove可删除过时能力、人物、事件等条目。新条目提供完整资料，能力也可用说明文字简写。',
  '有效训练可通过成长申请结算：来源事件、目标、类型、经验、方式、成果。混合训练按实际魔力和身体参与分别申请；每目标每条回复合计最多9999。直接修正经验时给最终值，同轴申请不在这个终值上再加一次。',
  '魔人觉醒使用JSON布尔true/false，可纠正错误状态。卷章按本轮已落实的完成事实修正，主回复已经推进时不重复结束下一章。'
].join('\n');
function correctionContext() { return (HW.SillyTavern || window.SillyTavern)?.getContext?.(); }
function correctionChatKey() {
  const ctx = correctionContext();
  if (ctx?.chatId === undefined || ctx.chatId === null || ctx.chatId === '') throw new Error('请先打开本局聊天。');
  return 'rk:correction:plot:' + JSON.stringify([ctx.characterId ?? null, ctx.groupId ?? null, ctx.chatId]);
}
function getCorrectionConfig() {
  const saved = LS.get(correctionConfigKey, {});
  return { endpoint: saved.endpoint || '', model: saved.model || '', maxTokens: saved.maxTokens || 3000,
    hasKey: Boolean(correctionKey), autoApply: saved.autoApply !== false, deviation: LS.get(correctionChatKey(), ''),
    prompt: typeof saved.prompt === 'string' && saved.prompt.trim() ? saved.prompt : DEFAULT_CORRECTION_PROMPT, defaultPrompt: DEFAULT_CORRECTION_PROMPT };
}
function saveCorrectionConfig(value) {
  cancelCorrection();
  const endpoint = String(value.endpoint || '').trim() ? normalizeCorrectionEndpoint(value.endpoint) : '';
  const model = String(value.model || '').trim(), maxTokens = Number(value.maxTokens);
  if (model.length > 200 || !Number.isInteger(maxTokens) || maxTokens < 256 || maxTokens > 16000) throw new Error('模型名不能超过200字，输出上限为256—16000的整数。');
  const prompt = String(value.prompt ?? getCorrectionConfig().prompt).trim();
  if (prompt.length > 12000) throw new Error('校正提示词不能超过12000字。');
  const nextKey = value.clearKey ? '' : String(value.apiKey || '').trim() || correctionKey;
  const autoApply = value.autoApply === undefined ? getCorrectionConfig().autoApply : value.autoApply === true;
  const connection = { endpoint, model, maxTokens, autoApply, apiKey: nextKey,
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
  correctionStatus = { state, message, attempt: turn?.attempt || (['reading', 'requesting', 'preview', 'applying', 'verifying', 'applied', 'unchanged', 'failed'].includes(state) ? 1 : 0), maxAttempts: turn ? CORRECTION_MAX_ATTEMPTS : 1, canRetry: false, ...detail };
  // 收起时也可看到副 API 是否忙碌；不依赖设置页被打开或页面轮询。
  const busy = ['waiting', 'reading', 'requesting', 'retrying', 'applying', 'verifying'].includes(state);
  SS.orb?.setAttribute('data-correction-busy', String(busy));
  SS.orb?.setAttribute('aria-label', '打开终端操作轮盘；副 API：' + message);
  const label = SS.orb?.querySelector('.crest span');
  if (label) label.textContent = busy ? '处理中' : state === 'failed' ? '待处理' : '操作';
  emit({ type: 'correction-status' });
}
function getCorrectionStatus() {
  return { ...correctionStatus, autoApply: LS.get(correctionConfigKey, {}).autoApply !== false, active: correctionActive };
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
function captureCorrection(checkingSettlement = false) {
  if (SS.destroyed || correctionMainBusy(checkingSettlement)) throw new Error('请等本轮 MVU 标签完整并保存后再校正。');
  const ctx = correctionContext(), reply = correctionReply();
  if (!reply?.mvuBlock) throw new Error('当前回复没有完整且唯一的 UpdateVariable / JSONPatch，暂不校正。');
  const guard = HW.__RK_MVU_GUARD_V4__ || window.__RK_MVU_GUARD_V4__;
  if (guard?.growth !== 'G03' || guard?.repair !== 'P02' || guard?.repairSource !== 'MVU01' || guard?.storyRepair !== 'S01' || guard?.flexibleRepair !== 'F01' || typeof guard.parseRepair !== 'function')
    throw new Error('请同步启用说明含 F01 的 v4 约束脚本，以支持通用业务字段校正。');
  const mvu = window.Mvu || HW.Mvu;
  if (typeof mvu?.getMvuData !== 'function' || typeof mvu.parseMessage !== 'function') throw new Error('MVU 解析接口尚未就绪。');
  const options = { type: 'message', message_id: reply.messageId };
  const data = mvu.getMvuData(options);
  if (!data?.stat_data || typeof data.then === 'function') throw new Error('当前 MVU 不是可确认的同步楼层接口。');
  if (data.stat_data.系统?.结构版本 !== 4 || data.stat_data.系统?.开局状态 !== '已建档' ||
      !['系统', '场景', '玩家', '人际'].every(key => data.stat_data[key] && typeof data.stat_data[key] === 'object'))
    throw new Error('当前回复还没有完整的 v4 档案，请先完成本轮 MVU 保存。');
  // 仅采用同一回复、同一 MVU 块的主结算起点；正文/图片刷新不影响这个快照。
  const candidate = correctionMainTurn?.candidate;
  const storyBefore = candidate?.ended && correctionSameReply(reply, candidate.reply) && candidate.storyBefore
    ? structuredClone(candidate.storyBefore) : undefined;
  // 正文只在请求时读取一次作为分析材料；后续一致性检查仅看来源、MVU 标签和实际变量。
  return { ...reply, ctx, guard, data: structuredClone(data), options,
    chatId: ctx.chatId, characterId: ctx.characterId ?? null, groupId: ctx.groupId ?? null,
    storyBefore, stateKey: correctionMvuKey(data) };
}
function ensureCorrectionCurrent(saved) {
  const now = captureCorrection();
  if (!correctionSameReply(now, saved) || now.stateKey !== saved.stateKey)
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
  const blocks = [...saved.mvuBlock.matchAll(/<JSONPatch>([\s\S]*?)<\/JSONPatch>/gi)];
  if (blocks.length === 1) {
    try {
      const operations = JSON.parse(blocks[0][1].trim());
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
  if (state.玩家?.成长) { delete state.玩家.成长.记录; delete state.玩家.成长.境界; delete state.玩家.成长.境界依据; }
  return { source: '楼层 ' + saved.messageId + ' · 回复页 ' + (saved.swipeId + 1),
    text: saved.text.replace(/<UpdateVariable>[\s\S]*?<\/UpdateVariable>/gi, '').trim(), events, submittedRelations, submittedStory, storyBefore: saved.storyBefore, state };
}
function getCorrectionInput() { return correctionInput(captureCorrection()); }
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
    if (root === '玩家' && field === '成长' && (removing && parts.length === 2 || parts.length >= 3 && !['经验', '申请'].includes(child))) return true;
    // 新人物保留模型提供的初始占位；已有阶段由最终分数派生，忽略它不影响同批业务改动。
    return root === '人际' && parts.length >= 3 && ['恋爱阶段', '羁绊阶段'].includes(child) && Object.hasOwn(state.人际 || {}, field);
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
  const result = [];
  function diff(before, after, parts) {
    if (same(before, after)) return;
    if (object(before) && object(after)) {
      for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) diff(before[key], after[key], [...parts, key]);
    } else result.push(after === undefined ? { op: 'remove', path: pointer(parts) } :
      { op: before === undefined ? 'add' : 'replace', path: pointer(parts), value: structuredClone(after) });
  }
  // 新事件、人物或能力作为完整对象添加；数组索引操作折叠成最终数组，兼容 MVU 的逐项校验。
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
    '保持现有schema字段名称、类型与范围：好感0—1000或null，支援0—320整数或null，觉醒只用true/false；卷章须属现有目录。' +
    '已有值按最终结果纠正，无需为了通过校验重复提交变化依据；资料足够时可核定原null或缺失分数。只输出裸JSONPatch数组，支持add/replace/remove/copy/move/test，不输出Analysis或UpdateVariable标签。';
}
// 只重试请求阶段的临时连接故障；鉴权、格式、字段和保存错误交明确提示处理。
function correctionRequestFailure(error, timedOut) {
  const status = Number(error?.status ?? error?.statusCode ?? error?.response?.status ?? String(error?.message || '').match(/\b(401|403|408|429|5\d\d)\b/)?.[1]);
  const transient = timedOut || error instanceof TypeError || [408, 429].includes(status) || status >= 500 && status <= 599 ||
    !status && /network|fetch failed|failed to fetch|timeout|timed out|ECONNRESET|ECONNREFUSED/i.test(String(error?.message || ''));
  return { retryable: transient, message: timedOut ? '副 API 请求超时。' : status === 401 || status === 403 ? '副 API 认证失败，请核对密钥和权限后保存配置。'
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
    setCorrectionStatus('requesting', automatic ? '正在自动核对本轮正文、好感与支援…' : '正在请求本轮校正预览…');
    timer = setTimeout(() => { timedOut = true; abort.abort(); }, 120000);
    watch = setInterval(() => { try { ensureCorrectionCurrent(saved); } catch (_) { abort.abort(); } }, 350);
    requesting = true;
    const response = await saved.ctx.ChatCompletionService.processRequest({ chat_completion_source: 'custom', custom_url: config.endpoint,
      custom_include_headers: JSON.stringify({ Authorization: correctionKey ? 'Bearer ' + correctionKey : '' }),
      model: config.model, messages: [{ role: 'system', content: system }, { role: 'user', content: JSON.stringify({
        当前变量: state, 本轮正文: input.text, 本轮已发生事件: input.events, 本轮已提交人际更新: input.submittedRelations,
        本轮已提交进度: input.submittedStory, 主结算前场景: input.storyBefore,
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
    if (typeof raw !== 'string' || raw.length > 100000) throw new Error('副 API 未返回可用的补丁文本。');
    let ops;
    try { ops = JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')); }
    catch (_) { throw new Error('副模型未返回完整 JSON 数组，请调整模型或输出上限后重试。'); }
    ops = normalizeCorrectionPatch(ops, saved.data.stat_data);
    validateCorrectionPatch(ops, saved.data.stat_data);
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
    ensureCorrectionCurrent(draft.saved);
    const parseBase = ensureCorrectionCurrent(draft.saved);
    const parsed = await draft.saved.guard.parseRepair(JSON.stringify(draft.ops), parseBase.data, draft.saved.mvuBlock, draft.saved);
    if (lock.signal.aborted) throw new Error('本次校正已取消，未写入。');
    ensureCorrectionCurrent(draft.saved);
    if (!parsed?.stat_data) throw new Error('MVU 未返回可保存的状态，请查看 MVU 通知。');
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
    return 'MVU 已解析并保存，当前回复页回读一致；被字段约束拒绝的项不会强写。';
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
  if (!block || (block.match(/<JSONPatch>/gi) || []).length !== 1 || (block.match(/<\/JSONPatch>/gi) || []).length !== 1) return '';
  const patch = block.match(/<JSONPatch>([\s\S]*?)<\/JSONPatch>/i);
  try { return patch && Array.isArray(JSON.parse(patch[1].trim())) ? block : ''; }
  catch (_) { return ''; }
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
    const chatKey = correctionChatKey(), mvuBlock = correctionMvuBlock(raw);
    return { chatKey, chatRef: ctx.chat, messageRef: ctx.chat[id], messageId: id, swipeId, text: raw, mvuBlock,
      key: JSON.stringify([chatKey, id, swipeId, mvuBlock]) };
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
  const state = structuredClone(data?.stat_data || {});
  delete state.$internal;
  return JSON.stringify(state);
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
  catch (error) { setCorrectionStatus('failed', '无法读取当前回复：' + error.message); return; }
  const turn = { phase: 'waiting', chatRef: ctx.chat, chatKey: correctionChatKey(), before,
    candidate: null, finished: false, settled: false };
  correctionMainTurn = turn;
  // 主保存门禁始终跟踪；只有连接与自动开关都启用时才安排后续副请求。
  if (config.active && config.autoApply) correctionAutoTurn = turn;
  if (!correctionBindMvu?.()) {
    setCorrectionStatus('failed', '主生成或 MVU 保存事件尚未就绪，当前轮次未开放校正。'); return;
  }
  if (correctionAutoTurn === turn) setCorrectionStatus('waiting', '等待本轮 MVU 标签完整并保存，随后自动核对人际与角色变化。');
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
  if ((waiting || correctionAutoTurn?.phase === 'retrying') && !SS.destroyed) correctionAutoTimer = setTimeout(checkAutomaticCorrection, 200);
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
    if (correctionMainTurn !== turn || turn.settled) throw new Error('原等待任务已变化，请重新读取本轮。');
    // 保存未确认的失败只能重走门禁，绝不把“能读到旧 v4”当成可重试的校正来源。
    turn.waitFailed = false; turn.deadline = Date.now() + 180000;
    if (retry.automatic) correctionAutoTurn = turn;
    correctionRetry = null;
    setCorrectionStatus('waiting', '重新等待本轮 MVU 标签与保存结果；确认完成后再校正。');
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
  const turn = correctionAutoTurn?.phase === 'retrying' ? correctionAutoTurn : correctionMainTurn;
  if (!turn || !['waiting', 'retrying'].includes(turn.phase) || turn.waitFailed || SS.destroyed) return;
  try {
    if (turn.phase === 'retrying') {
      ensureCorrectionCurrent(correctionRetry.saved);
      if (Date.now() < turn.retryAt) { scheduleAutomaticCorrection(); return; }
      turn.attempt++;
      return await runAutomaticCorrection(turn);
    }
    if (turn.deadline && Date.now() > turn.deadline) throw new Error('未确认本轮 MVU 保存。请检查 MVU 是否启用、是否在等待独立更新；当前楼层有完整变量后可重试。');
    const ctx = correctionContext();
    if (ctx?.chat !== turn.chatRef || correctionChatKey() !== turn.chatKey) throw new Error('聊天已切换，本轮校正已取消。');
    const candidate = turn.candidate;
    if (!candidate?.ended || !candidate.rendered || correctionJob) { scheduleAutomaticCorrection(); return; }
    if (!correctionSameReply(correctionReply(), candidate.reply)) throw new Error('回复页或 MVU 标签已变化，本轮校正已取消。');
    // 仅本处可在结算锁内回读 MVU 保存结果；请求和写入仍必须等待本轮变量确认。
    const saved = captureCorrection(true), current = correctionMvuKey(saved.data), expected = correctionMvuKey(candidate.variables);
    // ENDED 在楼层写入之前触发。另等保存后的渲染信号，并回读相同的完整结算结果。
    if (current !== expected) {
      // 主结算可能分多次解析/保存，清掉早先的稳定读数，继续等最新候选，不能抢先报失败。
      turn.persisted = null;
      scheduleAutomaticCorrection(); return;
    }
    const stable = current + saved.mvuBlock;
    if (turn.persisted !== stable) { turn.persisted = stable; turn.stableSince = Date.now(); scheduleAutomaticCorrection(); return; }
    if (Date.now() - turn.stableSince < 300) { scheduleAutomaticCorrection(); return; }
    turn.settled = true; turn.phase = 'settled';
    if (correctionRetry?.waiting === turn) correctionRetry = null;
    if (correctionAutoTurn !== turn) {
      if (['waiting', 'failed'].includes(correctionStatus.state)) setCorrectionStatus('ready', '本轮 MVU 已保存，可手动校正；本轮没有安排自动请求。');
      return;
    }
    if (correctionSeen.has(candidate.reply.key)) { correctionAutoTurn = null; setCorrectionStatus('unchanged', '本回复已经自动核对过，不重复请求。'); return; }
    turn.attempt = 1;
    return await runAutomaticCorrection(turn);
  } catch (error) {
    if (SS.destroyed || correctionMainTurn !== turn && correctionAutoTurn !== turn) return;
    const automatic = correctionAutoTurn === turn;
    correctionAutoTurn = null; correctionDraft = null; correctionRetry = null;
    if (turn.phase === 'waiting') {
      // 保留主流程写锁；超时后等待新 MVU 事件或显式重试，避免定时器反复报错。
      turn.waitFailed = true;
      correctionRetry = { waiting: turn, automatic };
    }
    setCorrectionStatus('failed', String(error.message || '本轮自动校正失败。').replaceAll(correctionKey || '\u0000', '[已隐藏]'), { canRetry: Boolean(correctionRetry) });
  }
}
function wireAutomaticCorrection(safeOn, TE) {
  let bound = false;
  correctionBindMvu = () => {
    if (bound) return true;
    const events = (window.Mvu || HW.Mvu)?.events;
    if (!events?.COMMAND_PARSED || !events.VARIABLE_UPDATE_ENDED || !TE.CHARACTER_MESSAGE_RENDERED) return false;
    bound = true;
    safeOn(events.COMMAND_PARSED, (variables, commands, content) => {
      const turn = correctionMainTurn;
      // 上一轮已取消的慢请求仍持有网络锁，也要接住新主回复的结算；发请求时再等待锁释放。
      if (!turn || turn.phase !== 'waiting') return;
      try {
        const reply = correctionReply();
        if (!reply || reply.chatRef !== turn.chatRef || reply.chatKey !== turn.chatKey || reply.key === turn.before ||
            !reply.mvuBlock || reply.mvuBlock !== correctionMvuBlock(content)) return;
        turn.candidate = { variables, reply, ended: false, rendered: false };
        turn.deadline = Date.now() + 180000;
        turn.persisted = null;
        if (turn.waitFailed) { turn.waitFailed = false; turn.deadline = Date.now() + 180000; }
      } catch (_) { /* 无法唯一绑定当前回复时不开放自动写入。 */ }
    });
    safeOn(events.VARIABLE_UPDATE_ENDED, (variables, previous) => {
      const turn = correctionMainTurn;
      if (turn?.phase !== 'waiting' || turn.candidate?.variables !== variables) return;
      // 保留引用，等待后续守卫与 Zod 完成，而不是在本回调中提前复制旧中间态。
      turn.candidate.ended = true;
      // previous 是主 MVU 本次结算前的快照；不从正文或当前卷章倒推起点。
      const scene = previous?.stat_data?.场景;
      if (scene && Number.isInteger(scene.当前卷) && typeof scene.当前章 === 'string' &&
          ['未开始', '进行中', '已结束'].includes(scene.阶段)) {
        turn.candidate.storyBefore = { 当前卷: scene.当前卷, 当前章: scene.当前章, 阶段: scene.阶段 };
      }
      if (turn.waitFailed) { turn.waitFailed = false; turn.deadline = Date.now() + 180000; }
      scheduleAutomaticCorrection();
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
      if (!reply || reply.messageId !== messageId || reply.chatRef !== turn.chatRef || reply.chatKey !== turn.chatKey || reply.key === turn.before) return;
      // 渲染事件只确认同一 MVU 块已回到当前页，不要求正文/生图插件的全部渲染结束。
      if (turn.candidate?.ended && correctionSameReply(reply, turn.candidate.reply)) turn.candidate.rendered = true;
      if (turn.waitFailed) { turn.waitFailed = false; turn.deadline = Date.now() + 180000; }
      scheduleAutomaticCorrection();
    } catch (_) {}
  });
}
SS.disposers.push(() => { correctionMainTurn = null; cancelCorrection(); correctionKey = ''; correctionActive = false; correctionBindMvu = null; correctionSeen.clear(); });
