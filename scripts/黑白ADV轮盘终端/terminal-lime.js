"use strict";

// UI drafts are transient. Saved communication and its owning floor supply history and time.
var limeUI = {
  scope: '', tab: 'chats', query: '', drafts: new Map(), scroll: new Map(),
  profileOpen: false, records: [], signature: '', readRevision: 0,
  sending: false, generating: false, error: '', notice: '', source: null,
};
var limeProtocol = createLimeChatProtocol();

function limeScope(source) {
  return source ? JSON.stringify([source.characterId ?? null, source.groupId ?? null, source.chatId ?? null]) : '';
}
function resetLimeSession() {
  limeUI.readRevision++;
  limeUI.drafts.clear(); limeUI.scroll.clear(); limeUI.records = [];
  limeUI.signature = ''; limeUI.scope = ''; limeUI.source = null;
  limeUI.error = ''; limeUI.notice = ''; limeUI.profileOpen = false;
  limeUI.generating = false; activeChat = null;
}
function prepareLimeRefresh(event) {
  if (event && ['CHAT_CHANGED', 'MESSAGE_SWIPED', 'MESSAGE_SWIPE_DELETED', 'MESSAGE_DELETED', 'CHARACTER_FIRST_MESSAGE_SELECTED'].indexOf(event.type) !== -1) resetLimeSession();
}
function rememberLimeView() {
  var input = document.getElementById('lime-compose');
  if (input && activeChat && input.dataset.limeOwner === activeChat) limeUI.drafts.set(activeChat, input.value);
  var log = document.getElementById('lime-timeline');
  if (log && activeChat && log.dataset.limeOwner === activeChat) limeUI.scroll.set(activeChat, {
    top: log.scrollTop, bottom: log.scrollHeight - log.clientHeight - log.scrollTop < 48,
  });
}
function refreshLimeRecords() {
  if (!bridge || !bridge.lime || typeof bridge.lime.read !== 'function') return Promise.resolve();
  var revision = ++limeUI.readRevision, currentBridge = bridge;
  return Promise.resolve().then(function() { return currentBridge.lime.read(); }).then(function(result) {
    if (revision !== limeUI.readRevision || currentBridge !== bridge) return;
    var scope = limeScope(result.source);
    if (limeUI.scope && scope !== limeUI.scope) resetLimeSession();
    limeUI.scope = scope; limeUI.source = result.source || null;
    var records = limeProtocol.readLimeThreads(result.messages || [], {
      playerName: result.playerName || (stat.玩家 && stat.玩家.姓名), generating: result.generating === true,
    });
    var signature = JSON.stringify([scope, records, result.generating === true]);
    if (signature === limeUI.signature) return;
    rememberLimeView();
    limeUI.signature = signature; limeUI.records = records;
    limeUI.generating = result.generating === true;
    if (currentStack[currentStack.length - 1] === 'scr-lime') renderLime();
  }).catch(function(error) {
    if (revision !== limeUI.readRevision || currentBridge !== bridge) return;
    var message = error && error.message || '聊天记录暂时不可用。';
    if (limeUI.error === message) return;
    limeUI.error = message;
    if (currentStack[currentStack.length - 1] === 'scr-lime') renderLime();
  });
}
function handleLimeBack() {
  if (activeChat) closeLimeChat(); else goBack();
}
function openLimeChat(name) {
  if (!stat.人际 || !Object.prototype.hasOwnProperty.call(stat.人际, name) || isDeletedPerson(name)) return;
  rememberLimeView(); activeChat = name; limeUI.error = ''; limeUI.notice = ''; limeUI.profileOpen = false;
  renderLime();
}
function closeLimeChat() { rememberLimeView(); activeChat = null; limeUI.error = ''; limeUI.notice = ''; renderLime(); }
function handleChatKey(event) {
  // Enter is a newline on mobile; Ctrl/Cmd+Enter explicitly sends one communication.
  if (event.key === 'Enter' && !event.isComposing && (event.ctrlKey || event.metaKey)) {
    event.preventDefault(); sendChatMsg();
  }
}
function updateLimeComposer() {
  var input = document.getElementById('lime-compose'), button = document.getElementById('lime-send');
  if (!input || !activeChat || input.dataset.limeOwner !== activeChat) return;
  limeUI.drafts.set(activeChat, input.value);
  input.style.height = 'auto'; input.style.height = Math.min(112, Math.max(44, input.scrollHeight)) + 'px';
  if (button) button.disabled = input.disabled || !input.value.trim() || limeUI.sending || limeUI.generating || dataStatus !== 'ready' || !bridge || !bridge.lime;
}
function sendQuickAction(kind) {
  var values = { tactical: '现在方便吗？想和你确认一下接下来的行动。', duel: '有空一起练习吗？时间和地点听你的安排。', greeting: '今天过得怎么样？' };
  var input = document.getElementById('lime-compose');
  if (!input || input.disabled || !activeChat || input.dataset.limeOwner !== activeChat || !values[kind]) return;
  input.value = values[kind]; updateLimeComposer(); input.focus();
}
async function sendChatMsg() {
  var input = document.getElementById('lime-compose'), name = activeChat;
  if (!input || input.disabled || input.dataset.limeOwner !== name || !name || limeUI.sending || limeUI.generating || dataStatus !== 'ready') return;
  var text = input.value.trim(); if (!text) return;
  if (!bridge || !bridge.lime || typeof bridge.lime.send !== 'function') {
    limeUI.error = '当前没有酒馆连接，草稿已保留。'; renderLime(); return;
  }
  var currentBridge = bridge, scope = limeUI.scope;
  limeUI.drafts.set(name, input.value); limeUI.sending = true; limeUI.error = ''; limeUI.notice = '';
  renderLime();
  try {
    var result = await currentBridge.lime.send({ name: name, text: text, expectedSource: stateSource });
    if (bridge !== currentBridge || limeUI.scope !== scope) return;
    if (!result || result.sent !== true) throw new Error('尚未确认通讯保存；草稿已保留，请核对通讯记录后再操作。');
    var confirmedInput = document.getElementById('lime-compose');
    if (confirmedInput && confirmedInput.dataset.limeOwner === name) confirmedInput.value = '';
    limeUI.drafts.delete(name); limeUI.scroll.delete(name);
    limeUI.notice = result.notice || '已保存到当前剧情的通讯记录。';
    await refreshLimeRecords();
  } catch (error) {
    if (bridge === currentBridge && limeUI.scope === scope) limeUI.error = error && error.message || '消息未发送，草稿已保留。';
  } finally {
    limeUI.sending = false;
    if (bridge === currentBridge && currentStack[currentStack.length - 1] === 'scr-lime') renderLime();
  }
}
function limeHistory(name) { return limeUI.records.filter(function(record) { return record.contact === name; }); }
function limeRecordTime(record) { return typeof record.time === 'string' && record.time.trim() ? record.time : '时间未记录'; }
function limeContactNames() {
  var relations = stat && stat.人际 || {};
  return Object.keys(relations).filter(function(name) {
    return !isDeletedPerson(name) && !(stat.系统 && stat.系统.主角模式 === '黑铁一辉' && name === '黑铁一辉');
  });
}
function renderLime() {
  var body = document.getElementById('lime-body'), title = document.getElementById('lime-title'), sub = document.getElementById('lime-sub');
  var profileButton = document.getElementById('lime-profile-toggle');
  if (!body) return;
  var oldInput = document.getElementById('lime-compose');
  var selection = oldInput && oldInput.dataset.limeOwner === activeChat && document.activeElement === oldInput ? {
    start: oldInput.selectionStart, end: oldInput.selectionEnd, direction: oldInput.selectionDirection,
  } : null;
  rememberLimeView();
  var names = limeContactNames(), relations = stat && stat.人际 || {};
  if (activeChat && names.indexOf(activeChat) === -1 && dataStatus === 'ready') activeChat = null;
  body.dataset.view = activeChat ? 'chat' : 'list';
  if (profileButton) { profileButton.hidden = !activeChat; profileButton.setAttribute('aria-expanded', String(limeUI.profileOpen)); }
  if (activeChat) {
    var name = activeChat, relation = relations[name] || {}, history = limeHistory(name);
    var hasContact = relation.已加联系方式 === true;
    if (title) title.textContent = name;
    if (sub) sub.textContent = hasContact ? 'LIME · 已建立专线' : 'LIME · 尚未交换账号';
    var timeline = '', lastTime = null;
    history.forEach(function(record) {
      var time = limeRecordTime(record);
      if (lastTime !== time) {
        timeline += '<div class="rk-lime-turn-separator">' + esc(time) + '</div>';
        lastTime = time;
      }
      var outgoing = record.sender === 'player';
      timeline += '<div class="rk-lime-message ' + (outgoing ? 'out' : 'in') + '">' +
        (!outgoing ? '<div class="rk-lime-message-avatar">' + renderCompanionAvatar(name, true) + '</div>' : '') +
        '<div class="rk-lime-message-content">' +
          (!outgoing ? '<span class="rk-lime-sender">' + esc(name) + '</span>' : '') +
          '<div class="rk-lime-bubble">' + esc(record.text) + '</div>' +
          '<div class="rk-lime-message-meta">' + esc(time) + '</div>' +
        '</div></div>';
    });
    if (!history.length) timeline = '<div class="rk-lime-empty"><span class="rk-lime-empty-icon" aria-hidden="true">◇</span><strong>' + (hasContact ? '从一句问候开始' : '还没有建立专线') + '</strong><p>' +
      (hasContact ? '这里会显示本局剧情中明确记录的 LIME 对话。' : '先在剧情中交换 LIME 账号，或收到对方的短信、来电。') + '</p></div>';
    var disabled = !hasContact || dataStatus !== 'ready' || limeUI.sending || limeUI.generating;
    var draft = limeUI.drafts.get(name) || '';
    body.innerHTML = '<div class="rk-lime-room">' +
      '<details class="rk-lime-profile" id="lime-profile"' + (limeUI.profileOpen ? ' open' : '') + '><summary>联络资料</summary><div class="lime-chat-profile">' +
        renderCompanionAvatar(name, true) + '<div><strong>' + esc(name) + '</strong><p>' + esc(relation.关系 || '关系尚未确认') + '</p>' +
        (relation.态度印象 ? '<p>' + esc(relation.态度印象) + '</p>' : '') + '</div></div></details>' +
      '<div class="rk-lime-timeline" id="lime-timeline" data-lime-owner="' + esc(name) + '" role="log" aria-label="与' + esc(name) + '的LIME记录" aria-live="polite" aria-relevant="additions text">' + timeline +
        (limeUI.generating ? '<div class="rk-lime-date" role="status">正在处理通讯…</div>' : '') + '</div>' +
      '<div class="rk-lime-quick-actions" aria-label="准备快捷消息"><button type="button" data-lime-quick="tactical"' + (!hasContact ? ' disabled' : '') + '>战术联络</button><button type="button" data-lime-quick="duel"' + (!hasContact ? ' disabled' : '') + '>约练习</button><button type="button" data-lime-quick="greeting"' + (!hasContact ? ' disabled' : '') + '>问候</button></div>' +
      ((limeUI.error || limeUI.notice) ? '<div class="' + (limeUI.error ? 'rk-lime-error' : 'rk-lime-notice') + '" role="status">' + esc(limeUI.error || limeUI.notice) + '</div>' : '') +
      '<div class="rk-lime-composer"><textarea id="lime-compose" data-lime-owner="' + esc(name) + '" aria-label="LIME消息" rows="1" maxlength="4000" placeholder="' + (hasContact ? '输入消息…' : '先在剧情中建立联系') + '"' + (disabled ? ' disabled' : '') + '>' + esc(draft) + '</textarea>' +
      '<button type="button" class="rk-lime-send" id="lime-send" aria-label="发送消息"' + (disabled || !draft.trim() ? ' disabled' : '') + '><span aria-hidden="true">➤</span><span>发送</span></button></div>' +
      '<div class="rk-lime-send-note">通讯附于当前剧情 · Ctrl / ⌘ + Enter 发送</div></div>';
    var log = document.getElementById('lime-timeline'), position = limeUI.scroll.get(name);
    if (log) log.scrollTop = !position || position.bottom ? log.scrollHeight : position.top;
    updateLimeComposer();
    var newInput = document.getElementById('lime-compose');
    if (selection && newInput && !newInput.disabled) {
      newInput.focus({ preventScroll: true });
      newInput.setSelectionRange(selection.start, selection.end, selection.direction || 'none');
    }
    return;
  }
  if (title) title.textContent = '破军 LIME';
  if (sub) sub.textContent = '同伴之间，随时联系';
  var query = limeUI.query.trim().toLocaleLowerCase();
  var displayed = names.filter(function(name) { return (!query || name.toLocaleLowerCase().includes(query)) && (limeUI.tab === 'contacts' || relations[name].已加联系方式 === true); });
  if (limeUI.tab === 'chats') displayed.sort(function(a, b) { var ah = limeHistory(a), bh = limeHistory(b); return (bh.length ? bh[bh.length - 1].messageId : -1) - (ah.length ? ah[ah.length - 1].messageId : -1); });
  var rows = displayed.map(function(name) {
    var history = limeHistory(name), last = history[history.length - 1], contact = relations[name].已加联系方式 === true;
    return '<button type="button" class="rk-lime-contact" data-lime-contact="' + esc(name) + '"><span class="rk-lime-contact-avatar">' + renderCompanionAvatar(name, true) + '</span>' +
      '<span class="rk-lime-contact-copy"><span class="rk-lime-contact-top"><strong class="rk-lime-contact-name">' + esc(name) + '</strong><span class="rk-lime-contact-time">' + (last ? esc(limeRecordTime(last)) : contact ? '专线' : '待交换') + '</span></span>' +
      '<span class="rk-lime-contact-last">' + esc(last ? (last.sender === 'player' ? '我：' : '') + last.text : contact ? '还没有消息 · 点击开始聊天' : '尚未建立联系方式') + '</span></span></button>';
  }).join('');
  body.innerHTML = '<div class="rk-lime-search"><input id="lime-search" type="search" aria-label="搜索联系人" placeholder="搜索联系人" value="' + esc(limeUI.query) + '"></div>' +
    '<div class="rk-lime-tabs" role="tablist" aria-label="LIME列表"><button type="button" role="tab" data-lime-tab="chats" aria-selected="' + (limeUI.tab === 'chats') + '">聊天</button><button type="button" role="tab" data-lime-tab="contacts" aria-selected="' + (limeUI.tab === 'contacts') + '">联系人 <span>' + names.length + '</span></button></div>' +
    '<div class="rk-lime-list">' + (rows || '<div class="rk-lime-empty"><strong>' + (query ? '没有找到这个名字' : '还没有可联络的同伴') + '</strong><p>' + (query ? '换个名字试试。' : '在剧情中结识同伴并交换联系方式后，会显示在这里。') + '</p></div>') + '</div>';
}
document.addEventListener('click', function(event) {
  var control = event.target && event.target.closest && event.target.closest('[data-lime-contact],[data-lime-tab],[data-lime-quick],#lime-send,#lime-profile-toggle');
  if (!control || !document.getElementById('scr-lime').contains(control) || control.disabled) return;
  if (control.hasAttribute('data-lime-contact')) openLimeChat(control.getAttribute('data-lime-contact'));
  else if (control.hasAttribute('data-lime-tab')) { limeUI.tab = control.getAttribute('data-lime-tab'); renderLime(); }
  else if (control.hasAttribute('data-lime-quick')) sendQuickAction(control.getAttribute('data-lime-quick'));
  else if (control.id === 'lime-send') sendChatMsg();
  else if (control.id === 'lime-profile-toggle') { limeUI.profileOpen = !limeUI.profileOpen; renderLime(); }
});
document.addEventListener('input', function(event) {
  if (event.target.id === 'lime-compose') updateLimeComposer();
  else if (event.target.id === 'lime-search') {
    limeUI.query = event.target.value; var start = event.target.selectionStart; renderLime();
    var input = document.getElementById('lime-search'); input.focus();
    if (input.type !== 'search') input.setSelectionRange(start, start);
  }
});
document.addEventListener('keydown', function(event) { if (event.target.id === 'lime-compose') handleChatKey(event); });
document.addEventListener('toggle', function(event) { if (event.target.id === 'lime-profile') limeUI.profileOpen = event.target.open; }, true);
