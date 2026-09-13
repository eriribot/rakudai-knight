// 剧情正文读取当前绑定世界书；目录只用于卷章键及条目顺序定位。
function createRakudaiPlotRuntime(deps) {
  const BEGIN = '【RK剧情注入:BEGIN】', END = '【RK剧情注入:END】';
  const handled = new WeakSet();
  let ticket = null, pending = null, busy = false, disposed = false, lastInjection = null, cancelPending = null;
  let reason = '等待主聊天生成', statusIdentity = null;
  const copy = value => structuredClone(value);
  function identity() {
    const c = deps.getContext();
    const chatId = c.getCurrentChatId?.() ?? c.chatId;
    if (chatId == null || !Array.isArray(c.chat)) throw new Error('没有可识别的聊天');
    return { chatId, characterId: c.characterId, groupId: c.groupId, chat: c.chat };
  }
  function same(a, b) {
    return !!a && !!b && a.chatId === b.chatId && a.characterId === b.characterId && a.groupId === b.groupId && a.chat === b.chat;
  }
  function chatStamp() { return JSON.stringify(identity().chat.map(message => [message.is_user, message.is_system, message.mes, message.swipe_id])); }
  function cancel() {
    ticket = null; cancelPending?.();
    if (pending) {
      const revoked = pending; pending = null; revoked.cancel?.();
      stripOwned(revoked.messages, revoked.text);
    }
  }
  function syncIdentity() {
    const current = identity();
    if (!same(statusIdentity, current)) {
      cancel(); lastInjection = null; reason = '等待当前聊天的主生成'; statusIdentity = current;
    }
    return current;
  }
  function fail(message) { reason = message; deps.report?.(message); return null; }
  function readState(excludedId) {
    const id = identity();
    const messages = deps.readMessages(`0-${id.chat.length - 1}`, { role: 'assistant', include_swipes: true });
    const message = [...messages].filter(m => Number.isInteger(m.message_id) && (excludedId == null || m.message_id < excludedId)).sort((a,b) => b.message_id-a.message_id)[0];
    if (!message) throw new Error('没有有效助手楼层，停止剧情注入');
    const swipeId = message.swipe_id;
    if (!Number.isInteger(swipeId) || swipeId < 0 || !Array.isArray(message.swipes_data)) throw new Error('助手回复页来源不明确');
    const slot = message.swipes_data[swipeId];
    const wrapper = deps.getMvu()?.getMvuData?.({ type: 'message', message_id: message.message_id });
    // The public message API identifies the active swipe. MVU must agree with that slot.
    if (!slot?.stat_data || !wrapper?.stat_data) throw new Error('当前助手回复页缺少 MVU 状态');
    if (JSON.stringify(slot.stat_data) !== JSON.stringify(wrapper.stat_data)) throw new Error('MVU 与当前回复页状态不一致');
    const state = wrapper.stat_data, system = state.系统, scene = state.场景;
    if (system?.结构版本 !== 4) throw new Error('当前存档需要先预览并确认迁移至 v4');
    if (system.开局状态 !== '已建档') throw new Error('尚未建档，停止剧情注入');
    const chapter = resolveStoryChapter(scene?.当前卷, scene?.当前章);
    if (!chapter || !['未开始', '进行中', '已结束'].includes(scene.阶段)) throw new Error('正式卷章或阶段不合法，停止剧情注入');
    return { identity: id, source: { chatId: id.chatId, messageId: message.message_id, swipeId }, state: copy(state), fingerprint: JSON.stringify([message, wrapper]), volume: scene.当前卷, chapter: chapter.key, phase: scene.阶段, node: chapter };
  }
  async function readMaterial(snapshot, cancelled) {
    if (typeof deps.readStoryEntry !== 'function') throw new Error('缺少绑定世界书读取接口，请更新剧情注入脚本');
    let timer;
    try {
      const waiting = [deps.readStoryEntry(snapshot.volume, snapshot.chapter), new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('读取绑定世界书超时，停止该次注入')), 8000);
      })];
      if (cancelled) waiting.push(cancelled);
      const material = await Promise.race(waiting);
      if (material === false || disposed) throw new Error('世界书读取已取消');
      if (!material || typeof material.content !== 'string' || !material.content.trim()) throw new Error('对应世界书条目没有正文');
      return material;
    } finally { clearTimeout(timer); }
  }
  function render(snapshot, material) {
    const { state, volume, chapter, phase } = snapshot, scene = state.场景;
    const next = nextStoryChapter(volume, chapter);
    const lines = [BEGIN, `当前剧情节点：第${volume}卷 · ${chapter}`, `正式阶段：${phase}`, `本局时间：${scene.时间 || '未确认'}；地点：${scene.地点 || '未确认'}`, `切入说明：${scene.切入说明 || '沿用本局已确认情境'}`,
      `世界书来源：${material.worldbook} / ${material.name}（UID ${material.uid}，order ${material.order}）`,
      '剧情内容及完成标识以本条世界书原文为准，不用原作目录或章节摘要重新定义结束位置。'];
    if (phase === '已结束') {
      lines.push('本章已结束：仅回应当前收束与玩家操作，不继续推动本章事件，不提前展开下一章。');
    } else {
      lines.push(phase === '未开始' ? '本章尚未开始：按原文交代切入情境，实际开始时在 MVU 中将 /场景/阶段 改为“进行中”；本轮不跨章。' : '本章进行中：按下列原文推进，以原文完成标识作为本章交接边界。');
      lines.push('【对应世界书条目原文】\n' + material.content);
      lines.push('【每轮推进节奏】上面的原文是整章材料，不是这一轮必须完成的任务清单。默认只承接玩家本轮输入，推进当前场景的一小段互动；遇到需要玩家回答、决定、行动或应对攻击的位置就停下，把行动权交还玩家。不得替玩家说话、做决定、连打多轮战斗，也不得用概述或时间跳跃把多个关键事件、转场和本章结局一口气演完。自定义角色模式也须保留玩家对当前场景的介入机会，不连续播放 NPC 剧情直至章末。只有玩家明确要求快进、跳过或概述时才放宽节奏，不能把普通的“继续”当作快进整章。');
      if (phase === '进行中') {
        lines.push('【完成后的变量交接】完成标识是否达成，以本条原文和本局已发生事实判断。未达成、原文未定义完成标识或无法确认时保持卷章；不以轮数、转场或章节摘要代替判断。');
        lines.push('不得为了触发自动切章而赶演完成标识、提前替玩家完成行动或把计划写成既成事实。一章可以持续多轮；完成条件已经自然达成时正常交接，不为了凑轮数拖延。');
        lines.push('条件达成时，正文停在本章完成标识指定的交接处；本轮不演下一章。已发生事件仍记录在本章卷号、章段下，不改写旧事件，不补造未发生剧情。');
        const patch = next ? [
          ...(next.volume !== volume ? [{ op: 'replace', path: '/场景/当前卷', value: next.volume }] : []),
          { op: 'replace', path: '/场景/当前章', value: next.chapter },
          { op: 'replace', path: '/场景/阶段', value: '进行中' },
        ] : [{ op: 'replace', path: '/场景/阶段', value: '已结束' }];
        lines.push((next ? `相邻下一节点为第${next.volume}卷 · ${next.chapter}；` : '这是最后一个目录节点，结束后不再前进；') + '仅在完成条件达成时，把以下操作合并到本轮已有的 UpdateVariable/JSONPatch 中，Analysis 写明达成事实，不另输出第二个变量块：\n' + JSON.stringify(patch));
      }
    }
    lines.push(END);
    return lines.join('\n');
  }
  async function preview() {
    syncIdentity();
    const snapshot = readState(), material = await readMaterial(snapshot), latest = readState();
    if (!same(snapshot.identity, latest.identity) || snapshot.fingerprint !== latest.fingerprint) throw new Error('读取预览期间聊天或回复页已变化，请重新读取');
    return { text: render(snapshot, material), source: snapshot.source, worldbook: material.worldbook, entryUid: material.uid, entryName: material.name, entryOrder: material.order, volume: snapshot.volume, chapter: snapshot.chapter, phase: snapshot.phase };
  }
  function clean(text, strict = true) {
    if (typeof text !== 'string') return text;
    let result = text, from, cursor = 0;
    while ((from = result.indexOf(BEGIN, cursor)) >= 0) {
      const to = result.indexOf(END, from + BEGIN.length);
      const nested = result.indexOf(BEGIN, from + BEGIN.length);
      if (nested >= 0 && (to < 0 || nested < to)) {
        if (strict) throw new Error('发现嵌套或未闭合的自有剧情块，请重建本次请求');
        // Do not treat an orphan BEGIN as the start of a later complete block:
        // preserve its intervening prose, then inspect the later marker itself.
        cursor = nested;
        continue;
      }
      if (to < 0) {
        if (strict) throw new Error('发现未闭合的自有剧情块，请重建本次请求');
        break;
      }
      result = result.slice(0, from) + result.slice(to + END.length);
      cursor = from;
    }
    return result;
  }
  function stripOwned(messages, knownText) {
    if (!Array.isArray(messages)) return;
    // Request preparation is strict, but cancellation must finish even if another
    // handler introduced broken markers. Remove the exact candidate first, leave
    // orphan markers and their prose intact, and inspect every remaining message.
    const strip = value => clean(typeof knownText === 'string' && knownText
      ? value.split(knownText).join('') : value, false);
    for (const message of messages) {
      if (typeof message?.content === 'string') message.content = strip(message.content);
      else if (Array.isArray(message?.content)) {
        for (const part of message.content) if (part?.type === 'text' && typeof part.text === 'string') part.text = strip(part.text);
      }
    }
  }
  function hasOwned(messages) {
    return Array.isArray(messages) && messages.some(message => typeof message?.content === 'string'
      ? message.content.includes(BEGIN)
      : Array.isArray(message?.content) && message.content.some(part => part?.type === 'text' && part.text?.includes(BEGIN)));
  }
  function matchesOwned(messages, text) {
    const combined = messages.flatMap(message => typeof message?.content === 'string' ? [message.content]
      : Array.isArray(message?.content) ? message.content.filter(part => part?.type === 'text').map(part => part.text) : []).join('\n');
    return combined.split(BEGIN).length === 2 && combined.split(END).length === 2 && combined.includes(text);
  }
  function sameMessages(messages, expected) {
    return Array.isArray(messages) && messages.length === expected.length && messages.every((message, i) => message === expected[i]);
  }
  function getStatus() {
    try { syncIdentity(); return { enabled: deps.readSettings() !== false, lastInjection: copy(lastInjection), reason }; }
    catch (error) { return { enabled: false, lastInjection: null, reason: error.message }; }
  }
  function setEnabled(enabled) {
    syncIdentity(); deps.writeSettings(Boolean(enabled)); cancel();
    reason = enabled ? '剧情注入已开启，等待下一次主生成' : '当前聊天已关闭剧情注入';
  }
  function onGeneration(type, options = {}, dryRun = false) {
    try {
      const id = syncIdentity(); cancel();
      if (disposed || dryRun || options?.dryRun || ![undefined, null, '', 'normal', 'continue', 'regenerate', 'swipe'].includes(type)) return fail('预览、后台或非剧情生成：跳过注入');
      if (deps.getMvu()?.isDuringExtraAnalysis?.()) return fail('MVU 额外解析中：跳过注入');
      let excludedId = null;
      if (type === 'swipe') {
        const messages = deps.readMessages(`0-${id.chat.length - 1}`, { role: 'assistant', include_swipes: true });
        excludedId = messages.at(-1)?.message_id;
        if (!Number.isInteger(excludedId)) return fail('无法确定被重新生成的回复楼层');
      }
      ticket = { identity: id, type: type || 'normal', excludedId, at: deps.now?.() ?? Date.now() };
      reason = '已记录主生成，等待组装 user 消息中的章节内容';
    } catch (error) { ticket = null; fail(error.message); }
  }
  async function onPromptReady(payload) {
    if (disposed || !payload || payload.dryRun) return;
    if (busy) { cancel(); return fail('提示词请求并发，归属不明：停止该次注入'); }
    if (handled.has(payload.chat)) return;
    busy = true;
    const active = ticket;
    try {
      syncIdentity();
      if (!active || ticket !== active || !same(active.identity, identity())) return fail('无法确认主聊天请求归属：跳过注入');
      if (deps.readSettings() === false) return fail('当前聊天已关闭剧情注入');
      if (deps.getMvu()?.isDuringExtraAnalysis?.()) { ticket = null; return fail('MVU 额外解析中：跳过注入'); }
      if (!Array.isArray(payload.chat)) return fail('请求不是可编辑的聊天消息数组');
      // 此时宏、预设和正则已经可能加工 user 内容，不能拿输入框原文做相等判断。
      // 主生成票据、聊天身份及后台开始事件负责撤销；发送前再核对生成类型和消息对象。
      const snapshot = readState(active.excludedId), savedChatStamp = chatStamp();
      const initialPrompt = JSON.stringify(payload.chat);
      const cancelled = new Promise(resolve => { cancelPending = () => resolve(false); });
      const material = await readMaterial(snapshot, cancelled), text = render(snapshot, material);
      if (ticket !== active || disposed || savedChatStamp !== chatStamp() || initialPrompt !== JSON.stringify(payload.chat)) return fail('读取世界书期间请求已变化，取消过期注入');
      const prepared = copy(payload.chat);
      for (const message of prepared) {
        if (typeof message.content === 'string') message.content = clean(message.content);
        else if (Array.isArray(message.content)) for (const part of message.content) if (part.type === 'text') part.text = clean(part.text);
      }
      const target = [...prepared].reverse().find(message => message.role === 'user');
      if (!target || !(typeof target.content === 'string' || Array.isArray(target.content))) return fail('主请求没有可注入的用户消息');
      // 只组装本次模型请求的 user 消息；不把注入内容保存到聊天楼层或输入框。
      if (typeof target.content === 'string') target.content += '\n\n' + text;
      else target.content.push({ type: 'text', text });
      if (!(await Promise.race([deps.measureBudget(prepared, text), cancelled]))) return fail('生成已取消、无法确认上下文余量或预算不足：跳过剧情注入');
      const checkedMaterial = await readMaterial(snapshot, cancelled);
      const latest = readState(active.excludedId);
      if (checkedMaterial.signature !== material.signature || ticket !== active || disposed || deps.readSettings() === false || deps.getMvu()?.isDuringExtraAnalysis?.() || !same(snapshot.identity, latest.identity) || snapshot.fingerprint !== latest.fingerprint || savedChatStamp !== chatStamp() || initialPrompt !== JSON.stringify(payload.chat)) return fail('核对期间世界书、聊天、回复页或请求已变化：取消过期注入');
      // Preserve the request array, message objects, and original multimodal part objects.
      for (let i = 0; i < prepared.length; i++) {
        const before = payload.chat[i].content, after = prepared[i].content;
        if (typeof before === 'string') payload.chat[i].content = after;
        else if (Array.isArray(before)) {
          for (let j = 0; j < before.length; j++) if (before[j].type === 'text') before[j].text = after[j].text;
          before.push(...after.slice(before.length));
        }
      }
      handled.add(payload.chat); ticket = null;
      pending = { active, snapshot, material, text, savedChatStamp, messages: [...payload.chat], settling: false };
      reason = `已组装第${snapshot.volume}卷·${snapshot.chapter}到 user 消息，等待发送前复核`;
    } catch (error) { ticket = null; fail(error.message); }
    finally { if (ticket === active) ticket = null; cancelPending = null; busy = false; }
  }
  async function onSettingsReady(data) {
    const candidate = pending, messages = data?.messages;
    if (!hasOwned(messages)) return;
    // ST filters the array in createGenerationParameters but preserves the message objects.
    // Unknown copies/reordered payloads may only have our block removed, never receive one.
    if (!candidate || !sameMessages(messages, candidate.messages)) {
      stripOwned(messages, candidate?.text);
      return fail('发送请求与候选消息身份不符，已撤回自有剧情块');
    }
    if (candidate.settling) { cancel(); stripOwned(messages, candidate.text); return fail('末端请求并发，已撤回剧情注入'); }
    candidate.settling = true;
    try {
      syncIdentity();
      if (disposed || pending !== candidate || data.type !== candidate.active.type || !same(candidate.active.identity, identity()) || deps.readSettings() === false || deps.getMvu()?.isDuringExtraAnalysis?.()) throw new Error('发送前归属失效，已撤回剧情注入');
      // ST-Prompt-Template 1.15.15.2 expands EJS in this event before our callback.
      // It retains message identities. Allow that content change, but require our exact single block.
      if (!matchesOwned(messages, candidate.text) || candidate.savedChatStamp !== chatStamp()) throw new Error('候选剧情块或当前聊天已变化，已撤回剧情注入');
      const settingsStamp = JSON.stringify(data);
      const cancelled = new Promise(resolve => { candidate.cancel = () => resolve(false); });
      if (!(await Promise.race([deps.measureBudget(messages, candidate.text, data), cancelled]))) throw new Error('发送前已取消或预算无法确认，已撤回剧情注入');
      const material = await readMaterial(candidate.snapshot, cancelled);
      const latest = readState(candidate.active.excludedId);
      if (material.signature !== candidate.material.signature || disposed || pending !== candidate || deps.readSettings() === false || deps.getMvu()?.isDuringExtraAnalysis?.() || !same(candidate.snapshot.identity, latest.identity) || candidate.snapshot.fingerprint !== latest.fingerprint || candidate.savedChatStamp !== chatStamp() || !sameMessages(messages, candidate.messages) || settingsStamp !== JSON.stringify(data)) throw new Error('发送前世界书、状态、回复页或请求已变化，已撤回过期剧情块');
      const { snapshot, text } = candidate;
      pending = null;
      lastInjection = { text, source: snapshot.source, worldbook: material.worldbook, entryUid: material.uid, entryName: material.name, entryOrder: material.order, volume: snapshot.volume, chapter: snapshot.chapter, phase: snapshot.phase, at: deps.now?.() ?? Date.now() };
      reason = `发送前已确认第${snapshot.volume}卷·${snapshot.chapter}，来源 #${snapshot.source.messageId} / 回复页 ${snapshot.source.swipeId}`;
      deps.report?.(reason);
    } catch (error) {
      if (pending === candidate) pending = null;
      stripOwned(messages, candidate.text); fail(error.message);
    } finally { candidate.cancel = null; }
  }
  return { version: '3.0.0', preview, getStatus, setEnabled, onGeneration, onPromptReady, onSettingsReady,
    end: cancel,
    // TH emits START after PROMPT_READY but before SETTINGS_READY, including custom APIs.
    // Revoke this candidate; never depend on END (it is absent on some error paths).
    foreignStart() { cancel(); fail('检测到助手后台生成，已撤回本次候选剧情块'); },
    foreignEnd() {},
    dispose() { disposed = true; cancel(); lastInjection = null; },
  };
}
