// 剧情正文读取当前绑定世界书；目录只用于卷章键及条目顺序定位。
function createRakudaiPlotRuntime(deps) {
  const BEGIN = '【RK剧情注入:BEGIN】', END = '【RK剧情注入:END】';
  const REVISION = '20261107.1';
  const handled = new WeakSet();
  const standaloneMessages = new WeakSet();
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
  function assistantFloorNumber(snapshot) {
    const messages = snapshot.identity.chat, end = Math.min(snapshot.source.messageId, messages.length - 1);
    let count = 0;
    for (let index = 0; index <= end; index++) {
      const message = messages[index];
      if (message && message.is_user !== true && message.is_system !== true && message.extra?.type !== 'narrator') count++;
    }
    return Math.max(1, count);
  }
  function injectionPlacement(snapshot) {
    return assistantFloorNumber(snapshot) % 2 === 1 ? 'append-user' : 'standalone-user';
  }
  function cancel() {
    ticket = null; cancelPending?.();
    if (pending) {
      const revoked = pending; pending = null; revoked.cancel?.();
      stripOwned(revoked.requestMessages, revoked.text);
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
    const world = resolveMvuWorld(state);
    if (world !== 'rakudai' && world !== 'asterisk') throw new Error('尚未确认作品：不读取任何剧情条目');
    const chapter = world === 'asterisk' ? resolveAsteriskChapter(scene?.当前章) : resolveStoryChapter(scene?.当前卷, scene?.当前章);
    if (!chapter || !['未开始', '进行中', '已结束'].includes(scene.阶段)) throw new Error('正式卷章或阶段不合法，停止剧情注入');
    return { identity: id, world, source: { chatId: id.chatId, messageId: message.message_id, swipeId }, state: copy(state), fingerprint: JSON.stringify([message, wrapper]), volume: world === 'asterisk' ? 1 : scene.当前卷, chapter: chapter.key, phase: scene.阶段, node: chapter };
  }
  async function readMaterial(snapshot, cancelled) {
    if (typeof deps.readStoryEntry !== 'function') throw new Error('缺少绑定世界书读取接口，请更新剧情注入脚本');
    let timer;
    try {
      const waiting = [deps.readStoryEntry(snapshot.world, snapshot.volume, snapshot.chapter), new Promise((_, reject) => {
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
    const { state, world, volume, chapter, phase } = snapshot, scene = state.场景;
    const catalogNext = world === 'asterisk' ? nextAsteriskChapter(chapter) : nextStoryChapterForState(volume, chapter, state);
    const missingNext = world === 'asterisk' && catalogNext && material.next?.available !== true;
    const next = missingNext ? null : catalogNext;
    const lines = [BEGIN, `当前剧情节点：${world === 'asterisk' ? '学战 第一卷' : '第' + volume + '卷'} · ${chapter}`, `正式阶段：${phase}`,
      `本局时间：${scene.时间 || '未确认'}；地点：${scene.地点 || '未确认'}`, `切入说明：${scene.切入说明 || '沿用本局已确认情境'}`];
    if (phase !== '已结束') {
      lines.push('【对应世界书条目原文】\n' + material.content);
      if (phase === '进行中') {
        const patch = world === 'asterisk'
          ? next ? [{ op: 'replace', path: '/场景/当前章', value: next.key }, { op: 'replace', path: '/场景/阶段', value: '进行中' }]
            : [{ op: 'replace', path: '/场景/阶段', value: '已结束' }]
          : next ? [
            ...(next.volume !== volume ? [{ op: 'replace', path: '/场景/当前卷', value: next.volume }] : []),
            { op: 'replace', path: '/场景/当前章', value: next.chapter },
            { op: 'replace', path: '/场景/阶段', value: '进行中' },
          ] : [{ op: 'replace', path: '/场景/阶段', value: '已结束' }];
        const nextLabel = missingNext
          ? `下一章 ${catalogNext.key} 的剧情原文不可用（${material.next?.reason || '尚未核验'}），完成本章后仅标记已结束，不自动切章`
          : next ? (world === 'asterisk' ? '相邻下一条目为 ' + next.key : '相邻下一节点为第' + next.volume + '卷 · ' + next.chapter) : '这是目录最后一个条目，结束后不再前进';
        lines.push(nextLabel + '；仅在完成标识达成时，把以下操作并入本轮已有的 UpdateVariable/JSONPatch，Analysis 写明达成事实，不另输出第二个变量块：\n' + JSON.stringify(patch));
      }
    }
    lines.push(END);
    return lines.join('\n');
  }
  async function preview() {
    syncIdentity();
    const snapshot = readState(), material = await readMaterial(snapshot), latest = readState();
    if (!same(snapshot.identity, latest.identity) || snapshot.fingerprint !== latest.fingerprint) throw new Error('读取预览期间聊天或回复页已变化，请重新读取');
    return { text: render(snapshot, material), source: snapshot.source, worldbook: material.worldbook, entryUid: material.uid, entryName: material.name, entryOrder: material.order, volume: snapshot.volume, chapter: snapshot.chapter, phase: snapshot.phase, placement: injectionPlacement(snapshot) };
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
    for (let index = messages.length - 1; index >= 0; index--) {
      const message = messages[index];
      // A standalone user may have acquired another listener's text. Only
      // remove the whole message when all of its content is our complete block.
      // ST's shallow array copy retains these owned message objects, even after
      // cancellation clears pending. Never remove a pre-existing empty user.
      if (typeof message?.content === 'string') {
        const cleaned = strip(message.content);
        if (standaloneMessages.has(message) && message.role === 'user' && message.content.includes(BEGIN) && !cleaned.trim()) { messages.splice(index, 1); continue; }
        message.content = cleaned;
      }
      else if (Array.isArray(message?.content)) {
        const onlyOwnedText = standaloneMessages.has(message) && message.role === 'user'
          && message.content.some(part => part?.type === 'text' && typeof part.text === 'string' && part.text.includes(BEGIN))
          && message.content.every(part => part?.type === 'text' && typeof part.text === 'string' && !strip(part.text).trim());
        if (onlyOwnedText) { messages.splice(index, 1); continue; }
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
    // Keep the revision inside reason so existing player terminals also show
    // which runtime is active after another script iframe replaces the singleton.
    try { syncIdentity(); return { enabled: deps.readSettings() !== false, revision: REVISION, lastInjection: copy(lastInjection), reason: `注入器修订 ${REVISION}。${reason}` }; }
    catch (error) { return { enabled: false, revision: REVISION, lastInjection: null, reason: `注入器修订 ${REVISION}。${error.message}` }; }
  }
  function setEnabled(enabled) {
    syncIdentity(); deps.writeSettings(Boolean(enabled)); cancel();
    reason = enabled ? '剧情注入已开启，等待下一次主生成' : '当前聊天已关闭剧情注入';
  }
  const generationType = type => type == null || type === '' ? 'normal' : type;
  function onGeneration(type, options = {}, dryRun = false) {
    // ST also emits this event for prompt/token previews. They do not own the
    // live request: never revoke its candidate or overwrite its diagnostic.
    if (disposed || dryRun || options?.dryRun) return;
    try {
      const id = syncIdentity(); cancel();
      type = generationType(type);
      if (!['normal', 'continue', 'regenerate', 'swipe'].includes(type)) return fail('后台或非剧情生成：跳过注入');
      if (deps.getMvu()?.isDuringExtraAnalysis?.()) return fail('MVU 额外解析中：跳过注入');
      let excludedId = null;
      if (type === 'swipe') {
        const messages = deps.readMessages(`0-${id.chat.length - 1}`, { role: 'assistant', include_swipes: true });
        excludedId = messages.at(-1)?.message_id;
        if (!Number.isInteger(excludedId)) return fail('无法确定被重新生成的回复楼层');
      }
      ticket = { identity: id, type, excludedId, at: deps.now?.() ?? Date.now() };
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
      const placement = injectionPlacement(snapshot);
      if (placement === 'append-user') {
        const target = [...prepared].reverse().find(message => message.role === 'user');
        if (!target || !(typeof target.content === 'string' || Array.isArray(target.content))) return fail('主请求没有可注入的用户消息');
        // 奇数助手楼层：追加到最终请求的最后一条 user 消息。
        if (typeof target.content === 'string') target.content += '\n\n' + text;
        else target.content.push({ type: 'text', text });
      } else {
        // 偶数助手楼层：用独立 user 尾消息模拟 depth=0；真正提交时再用原对象追加。
        prepared.push({ role: 'user', content: text });
      }
      if (!(await Promise.race([deps.measureBudget(prepared, text), cancelled]))) return fail('生成已取消、无法确认上下文余量或预算不足：跳过剧情注入');
      const checkedMaterial = await readMaterial(snapshot, cancelled);
      const latest = readState(active.excludedId);
      if (checkedMaterial.signature !== material.signature || ticket !== active || disposed || deps.readSettings() === false || deps.getMvu()?.isDuringExtraAnalysis?.() || !same(snapshot.identity, latest.identity) || snapshot.fingerprint !== latest.fingerprint || savedChatStamp !== chatStamp() || initialPrompt !== JSON.stringify(payload.chat)) return fail('核对期间世界书、聊天、回复页或请求已变化：取消过期注入');
      // Preserve the request array, message objects, and original multimodal part objects.
      // Both placements must commit the old-block cleanup before adding a new block.
      for (let i = 0; i < payload.chat.length; i++) {
        const before = payload.chat[i].content, after = prepared[i].content;
        if (typeof before === 'string') payload.chat[i].content = after;
        else if (Array.isArray(before)) {
          for (let j = 0; j < before.length; j++) if (before[j].type === 'text') before[j].text = after[j].text;
          before.push(...after.slice(before.length));
        }
      }
      if (placement === 'standalone-user') {
        const message = { role: 'user', content: text };
        standaloneMessages.add(message);
        payload.chat.push(message);
      }
      handled.add(payload.chat); ticket = null;
      pending = { active, snapshot, material, text, savedChatStamp, placement, requestMessages: payload.chat, messages: [...payload.chat], settling: false };
      reason = `已组装第${snapshot.volume}卷·${snapshot.chapter}到 ${placement === 'append-user' ? '最后一条 user' : '独立 user 尾消息'}，等待发送前复核`;
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
      if (disposed || pending !== candidate || generationType(data.type) !== candidate.active.type || !same(candidate.active.identity, identity()) || deps.readSettings() === false || deps.getMvu()?.isDuringExtraAnalysis?.()) throw new Error('发送前归属失效，已撤回剧情注入');
      // ST-Prompt-Template 1.15.15.2 expands EJS in this event before our callback.
      // It retains message identities. Allow that content change, but require our exact single block.
      if (!matchesOwned(messages, candidate.text) || candidate.savedChatStamp !== chatStamp()) throw new Error('候选剧情块或当前聊天已变化，已撤回剧情注入');
      const settingsStamp = JSON.stringify(data);
      const cancelled = new Promise(resolve => { candidate.cancel = () => resolve(false); });
      if (!(await Promise.race([deps.measureBudget(messages, candidate.text, data), cancelled]))) throw new Error('发送前已取消或预算无法确认，已撤回剧情注入');
      readState(candidate.active.excludedId);
      const material = await readMaterial(candidate.snapshot, cancelled);
      const latest = readState(candidate.active.excludedId);
      if (material.signature !== candidate.material.signature || disposed || pending !== candidate || deps.readSettings() === false || deps.getMvu()?.isDuringExtraAnalysis?.() || !same(candidate.snapshot.identity, latest.identity) || candidate.snapshot.fingerprint !== latest.fingerprint || candidate.savedChatStamp !== chatStamp() || !sameMessages(messages, candidate.messages) || settingsStamp !== JSON.stringify(data)) throw new Error('发送前世界书、状态、回复页或请求已变化，已撤回过期剧情块');
      const { snapshot, text } = candidate;
      pending = null;
      lastInjection = { text, source: snapshot.source, worldbook: material.worldbook, entryUid: material.uid, entryName: material.name, entryOrder: material.order, volume: snapshot.volume, chapter: snapshot.chapter, phase: snapshot.phase, placement: candidate.placement, at: deps.now?.() ?? Date.now() };
      reason = `发送前已确认第${snapshot.volume}卷·${snapshot.chapter}，${candidate.placement === 'append-user' ? '追加最后一条 user' : '新增独立 user 尾消息'}，来源 #${snapshot.source.messageId} / 回复页 ${snapshot.source.swipeId}`;
      deps.report?.(reason);
    } catch (error) {
      if (pending === candidate) pending = null;
      stripOwned(messages, candidate.text);
      stripOwned(candidate.requestMessages, candidate.text); fail(error.message);
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
