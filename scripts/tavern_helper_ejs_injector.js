/**
 * 《落第骑士英雄谭》TRPG - 动态 EJS 提示词就绪拦截与解析脚本
 * 
 * 运行环境：SillyTavern 卡内内嵌脚本（Tavern Helper / JS-Slash-Runner）
 * 核心原理：
 * 1. 监听 CHAT_COMPLETION_PROMPT_READY（出网前最后一微秒）
 * 2. 直接就地遍历拦截 messages 里的所有提示词（包括世界书注入的原始文本）
 * 3. 无论你是放在【世界书】还是哪里，只要发现含有 <% if ... %>，立刻在前端就地解析为对应单分支！
 * 4. 彻底从根源抹除 <% %> 代码，终端与模型 100% 只能收到干净纯文本！
 */
(function () {
  'use strict';

  // 1. 获取当前 MVU 或聊天变量中的主角模式
  function checkIsIkki() {
    let stat_data = null;
    try {
      if (window.Mvu && typeof window.Mvu.getStatData === 'function') {
        stat_data = window.Mvu.getStatData();
      }
    } catch (e) {}

    if (!stat_data || typeof stat_data !== 'object') {
      try {
        if (typeof getVariables === 'function') {
          const vars = getVariables('chat') || getVariables() || {};
          stat_data = vars.stat_data || vars;
        } else if (window.TavernHelper && typeof window.TavernHelper.getVariables === 'function') {
          const vars = window.TavernHelper.getVariables('chat') || {};
          stat_data = vars.stat_data || vars;
        }
      } catch (e) {}
    }

    // 判定：主角模式是否为“黑铁一辉”
    if (stat_data?.系统?.主角模式 === '黑铁一辉') return true;

    // 兜底判定：玩家当前名字是否为黑铁一辉
    try {
      const userName = (window.SillyTavern && window.SillyTavern.getContext) 
        ? (window.SillyTavern.getContext().name1 || '') 
        : '';
      if (userName.includes('一辉')) return true;
    } catch (e) {}

    return false;
  }

  // 2. 核心模板解析处理器（就地替换）
  function renderEjsContent(text, isIkki) {
    if (!text || typeof text !== 'string' || !text.includes('<%')) {
      return text;
    }

    let processed = text;

    // A. 尝试使用官方 EjsTemplate.render（如果已安装且可用）
    if (window.EjsTemplate && typeof window.EjsTemplate.render === 'function') {
      try {
        const stat_data = { 系统: { 主角模式: isIkki ? '黑铁一辉' : '自定义' } };
        return window.EjsTemplate.render(processed, { stat_data, isIkki });
      } catch (err) {
        // 出错则降级到内置正则解析
      }
    }

    // B. 内置纯正则精准解析器：解析 if-else 结构
    // 匹配: <% if (stat_data?.系统?.主角模式 === '黑铁一辉') { %> [IF块] <% } else { %> [ELSE块] <% } %>
    processed = processed.replace(
      /<%\s*if\s*\(([\s\S]*?)\)\s*\{\s*%>([\s\S]*?)<%\s*\}\s*else\s*\{\s*%>([\s\S]*?)<%\s*\}\s*%>/g,
      (match, condition, ifBlock, elseBlock) => {
        return isIkki ? ifBlock.trim() : elseBlock.trim();
      }
    );

    // C. 兜底保护：彻底抹除所有可能残留的 <% ... %> 标签，绝不把代码泄露给模型
    processed = processed.replace(/<%[\s\S]*?%>/g, '');

    return processed;
  }

  // 3. 消息队列拦截器
  function processMessages(chatArray) {
    if (!Array.isArray(chatArray) || chatArray.length === 0) return;

    const isIkki = checkIsIkki();
    let modifiedCount = 0;

    for (const msg of chatArray) {
      if (msg && typeof msg.content === 'string' && msg.content.includes('<%')) {
        const before = msg.content;
        msg.content = renderEjsContent(msg.content, isIkki);
        if (msg.content !== before) {
          modifiedCount++;
        }
      }
    }

    if (modifiedCount > 0) {
      console.log(`[LK-EJS拦截器] 成功就地解析并清洗了 ${modifiedCount} 处 EJS 模板！当前路由模式: [${isIkki ? '黑铁一辉' : '自定义角色模式'}]`);
    }
  }

  // 4. 事件就绪处理器（兼容对象结构与数组结构）
  function onPromptReady(eventData) {
    try {
      if (!eventData) return;
      if (Array.isArray(eventData)) {
        processMessages(eventData);
      } else if (Array.isArray(eventData.chat)) {
        processMessages(eventData.chat);
      } else if (Array.isArray(eventData.messages)) {
        processMessages(eventData.messages);
      }
    } catch (e) {
      console.error('[LK-EJS拦截器] 拦截执行异常:', e);
    }
  }

  // 5. 双总线无缝注册
  function register() {
    const readyEvent = (window.tavern_events && window.tavern_events.CHAT_COMPLETION_PROMPT_READY)
      || 'chat_completion_prompt_ready';

    // A. 注册到 Tavern Helper 包装总线
    if (typeof eventMakeFirst === 'function') {
      eventMakeFirst(readyEvent, onPromptReady);
    } else if (typeof eventOn === 'function') {
      eventOn(readyEvent, onPromptReady);
    }

    // B. 同时直连 SillyTavern Core 原生 eventSource（双保险，防止 TH 包装层丢事件）
    try {
      const coreEventSource = window.eventSource 
        || (window.SillyTavern && window.SillyTavern.getContext && window.SillyTavern.getContext().eventSource);
      if (coreEventSource && typeof coreEventSource.on === 'function') {
        coreEventSource.on(readyEvent, onPromptReady);
      }
    } catch (e) {}

    console.log('[LK-EJS拦截器] 已成功注入就绪监听，世界书中的 EJS 将在出网前自动被计算替换！');
  }

  register();
})();
