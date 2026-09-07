/**
 * 《落第骑士英雄谭》TRPG - 动态剧情卷章注入脚本 (Tavern Helper / JS-Slash-Runner)
 * 
 * 核心原理：
 * 1. 监听 CHAT_COMPLETION_PROMPT_READY（出网前最后一微秒）
 * 2. 自动读取当前 MVU / 聊天变量中的 `场景.当前卷` 与 `场景.当前章`
 * 3. 内置《落第骑士英雄谭》第1卷至第19卷（全19卷完结）全章节脉络字典
 * 4. 自动匹配当前卷章并生成精简的情境与认知边界提示
 * 5. 精准注入到最新一条【User Input】之前，让大模型在生成本轮回复时明确当前所处的具体卷章舞台，杜绝剧透与提前越级
 */
(function () {
  'use strict';

  // 1. 落第骑士英雄谭 全19卷 章节脉络字典
  const VOLUME_CHAPTER_ROADMAP = {
    1: {
      title: '第一卷：校内选拔战·初战篇',
      chapters: {
        '序章': '早晨的相遇（破军学园宿舍405室初遇与误会）',
        '第一章': '天才骑士与落第骑士（理事长室交涉、第三训练场模拟决斗立约、同居室友）',
        '第二章': '来自旧巢的访客（黑铁珠雫与有栖院凪登场、同班相处）',
        '第三章': '解放军（Rebellion）（商场购物中心事件、商场恐怖袭击）',
        '第四章': '初战（校内选拔赛第一轮·迎战猎人桐原静矢）',
        '终章': '月下誓言（击败桐原、晋级次轮、天台月下约定）'
      }
    },
    2: {
      title: '第二卷：绫辻一刀流与剑士杀手篇',
      chapters: {
        '序章': '遥远的记忆（绫辻一刀流渊源）',
        '第一章': '拜入师门（绫辻绚濑拜师求教剑术）',
        '第二章': '逢魔时刻（家庭餐厅冲突、挑衅仓敷藏人）',
        '第三章': '绫辻绚濑（落第骑士 vs 剑士杀手仓敷藏人前哨）',
        '第四章': '决战！〈落第骑士〉VS〈剑士杀手〉（奥义对决、夺回道场招牌）',
        '终章': '寒冰微笑'
      }
    },
    3: {
      title: '第三卷：破军双璧与奥多摩决战篇',
      chapters: {
        '序章': '珠雫的挑战（兄妹之绊）',
        '第一章': '〈深海魔女〉VS〈雷切〉（珠雫对决东堂刀华）',
        '第二章': '奥多摩的怪物（绚濑陷害迷局、一辉深陷逆境）',
        '第三章': '身陷逆境的〈落第骑士〉（带伤受审与绝境备战）',
        '第四章': '一刀两断（击溃藏人、正名之战）',
        '终章': '无冕剑王（全校认可、Another One）'
      }
    },
    4: {
      title: '第四卷：集训合宿与雷切决战篇',
      chapters: {
        '序章': '雪国的街道',
        '第一章': '强化集训（奥多摩集训、晓学园渗透）',
        '第二章': '阴谋蠢动（黑铁宗家施压与暗流）',
        '第三章': '晓，进军（袭击事件）',
        '第四章': '过早的决战（一辉对决雷切东堂刀华，自创一刀罗刹）',
        '终章': '幕后黑手（以破军第一代表资格出线七星剑武祭）'
      }
    },
    5: {
      title: '第五卷：七星剑武祭·开幕篇',
      chapters: {
        '序章': '祭典的乐声',
        '第一章': '全国的劲敌们（浪速之星诸星雄大等各校代表亮相）',
        '第二章': '浪速之星',
        '第三章': '七星剑武祭·开幕（开幕式与初轮抽签）',
        '第四章': '决战·〈无冕剑王〉VS〈七星剑王〉',
        '终章': '好戏登场'
      }
    },
    6: {
      title: '第六卷：七星剑武祭·初战告捷篇',
      chapters: {
        '间章': '反射术士',
        '第五章': '快刀斩乱麻（第一轮轻取对手）',
        '第六章': '初战终了',
        '第七章': '七星剑武祭第二轮战·开战',
        '间章2': '转暗'
      }
    },
    7: {
      title: '第七卷：七星剑武祭·父子对峙与中盘战篇',
      chapters: {
        '间章': '毫无余韵的胜利',
        '第八章': '喧闹不休的医务室',
        '第九章': '战士们略微喧嚣的中场休息（黑铁严登场要求断绝父子关系）',
        '第十章': '七星剑舞祭第三轮战·开战',
        '间章2': '鲜血的结局'
      }
    },
    8: {
      title: '第八卷：七星剑武祭·公审与四强决战篇',
      chapters: {
        '间章': '为了让自己不再后悔',
        '第十一章': '鲜血的真相（黑铁家勾结伦理委员会非法拘禁公审）',
        '第十二章': '双龙相克（半决赛血战诸星雄大）',
        '第十三章': '阴云密布的准决赛',
        '间章2': '姗姗来迟（史黛菈探监宣示主权）'
      }
    },
    9: {
      title: '第九卷：七星剑武祭·巅峰决战与觉醒篇',
      chapters: {
        '第十四章': '战魂高昂（总决赛：一辉 vs 史黛菈，觉醒《魔人》）',
        '终章': '约定之刻与并立之人（夺得七星剑王、赛场当场求婚）'
      }
    },
    10: {
      title: '第十卷：法米利昂皇国篇·起（和平之国的阴云）',
      chapters: {
        '序章': '来自地狱的蜘蛛',
        '第一章': '庆典结束之后（两人旅行前往欧洲法米利昂）',
        '第二章': '〈深海魔女〉与〈白衣骑士〉',
        '第三章': '法米利昂皇国（拜会国王与皇室家族）',
        '第四章': '惨剧开幕（邻国奎多兰渗透与战争阴云爆发）'
      }
    },
    11: {
      title: '第十一卷：法米利昂皇国篇·承（边境战火）',
      chapters: {
        '第五章': '〈落第骑士〉VS〈红莲狂狮〉（边境遭遇战）',
        '第六章': '杀戮之夜',
        '第七章': '访问奎多兰',
        '第八章': '名为「法米利昂」的国家',
        '第九章': '卡尔迪亚城镇战'
      }
    },
    12: {
      title: '第十二卷：法米利昂皇国篇·转（雪山试炼与刺客）',
      chapters: {
        '间章': '第一皇女的决心',
        '第十章': '皇族的职责',
        '第十一章': '洁白之巅',
        '第十二章': '严寒的考验（暴风雪与战力受阻）',
        '第十三章': '来自〈神龙寺〉的刺客',
        '第十四章': '法米利昂之剑'
      }
    },
    13: {
      title: '第十三卷：法米利昂皇国篇·乱（王都陷落）',
      chapters: {
        '间章': '凶信',
        '第十五章': '月下乱斗',
        '第十六章': '王都开战（敌军大举攻破防线）',
        '第十七章': '不转杀手',
        '第十八章': '狂飙突进',
        '间章2': '迟来的魔女'
      }
    },
    14: {
      title: '第十四卷：法米利昂皇国篇·魔人对决（巅峰混战）',
      chapters: {
        '间章': '泪雨',
        '第十九章': '魔人对决（多方魔人顶级战力全力爆发）',
        '第二十章': '难舍的情谊',
        '第二十一章': '天理难容的心愿'
      }
    },
    15: {
      title: '第十五卷：法米利昂皇国篇·终曲（剑神降临与平叛）',
      chapters: {
        '间章': '遗言',
        '第二十二章': '剑神（比翼爱德怀斯与一辉领悟神境）',
        '第二十三章': '法米利昂的怒火',
        '第二十四章': '遗骸洒泪',
        '第二十五章': '胜负已分',
        '终章': '正义从天而降（法米利昂战争平定终结）'
      }
    },
    16: {
      title: '第十六卷：世界同盟篇·风暴前夕',
      chapters: {
        '序章': '深渊熅火',
        '第一章': '众劲敌的此刻',
        '第二章': '〈剑士杀手〉VS〈浪速之星〉',
        '第三章': '〈大炎〉（全球同盟与灭世级敌人现身）',
        '终章': '思乡'
      }
    },
    17: {
      title: '第十七卷：世界同盟篇·双线鏖战',
      chapters: {
        '间章': '波纹逐渐扩散',
        '第四章': '恩宠的力量',
        '第五章': '命运锁链',
        '第六章': '两场大战·首都保卫战',
        '第七章': '两场大战·〈大炎〉讨伐战'
      }
    },
    18: {
      title: '第十八卷：最终决战篇·正邪宿命',
      chapters: {
        '序章': '所谓正义，所谓邪恶',
        '第一章': '〈烈风剑帝〉VS〈超人〉（兄弟宿命对决：一辉 vs 王马）',
        '第二章': '屠尽三千世界之鸦',
        '第三章': '圣母史黛菈'
      }
    },
    19: {
      title: '第十九卷：最终卷·拯救皇女与世纪婚礼（全剧终）',
      chapters: {
        '间章': '遭囚的皇女',
        '第四章': '划破黑暗',
        '第五章': '〈大教授〉（彻底斩断幕后元凶）',
        '第六章': '最爱，也是最强的劲敌（终之秘剑追影、战胜命运）',
        '终章': '背负憧憬的意义（盛大皇室世纪婚礼、晋升世界级剑神、全剧终）'
      }
    }
  };

  // 2. 读取 stat_data 变量
  function getStatData() {
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

    if (stat_data && typeof window !== 'undefined') {
      window.stat_data = stat_data;
    }
    return stat_data;
  }

  // 3. 匹配当前卷章对应的情境摘要
  function resolveStageInfo(vol, rawChapter) {
    const volNum = parseInt(vol, 10) || 1;
    const volData = VOLUME_CHAPTER_ROADMAP[volNum];
    const chap = (rawChapter || '第一章').trim();

    if (!volData) {
      return {
        volumeTitle: `第${volNum}卷`,
        chapterName: chap,
        summary: ''
      };
    }

    // 精确或包含匹配章名
    let matchedName = chap;
    let summary = volData.chapters[chap] || '';

    if (!summary) {
      for (const [key, desc] of Object.entries(volData.chapters)) {
        if (chap.includes(key) || key.includes(chap)) {
          matchedName = key;
          summary = desc;
          break;
        }
      }
    }

    return {
      volumeTitle: volData.title,
      chapterName: matchedName,
      summary: summary
    };
  }

  // 4. 核心注入逻辑：定位最新 User 消息并在其正文最前方注入卷章提示
  function injectPlotStageNotice(chatArray) {
    if (!Array.isArray(chatArray) || chatArray.length === 0) return;

    const stat_data = getStatData();
    const currentVol = stat_data?.场景?.当前卷 || 1;
    const currentChap = stat_data?.场景?.当前章 || '第一章';

    const stageInfo = resolveStageInfo(currentVol, currentChap);
    
    // 构造高内聚提示词 Banner
    const banner = `【当前剧情节点：${stageInfo.volumeTitle} · ${stageInfo.chapterName}】${stageInfo.summary ? `（${stageInfo.summary}）` : ''}\n- 阶段原则：严格遵循本章情境与当前人物认知边界，绝不抢先演绎未达章节的事件与胜负，不提前预支未来关系与承诺。`;

    // 寻找最新一条用户消息（从后向前找 role === 'user'）
    let targetUserMsg = null;
    for (let i = chatArray.length - 1; i >= 0; i--) {
      const msg = chatArray[i];
      if (msg && (msg.role === 'user' || msg.is_user)) {
        targetUserMsg = msg;
        break;
      }
    }

    if (!targetUserMsg || typeof targetUserMsg.content !== 'string') return;

    // 清理可能已有的历史注入标签（防重试或多轮污染）
    targetUserMsg.content = targetUserMsg.content.replace(/【当前剧情节点：[\s\S]*?阶段原则：[^\n]*\n\n?/g, '');

    // 注入至 User Input 之前
    targetUserMsg.content = `${banner}\n\n${targetUserMsg.content}`;

    console.log(`[LK-剧情注入器] 成功在 User Input 前注入剧情锚点: [${stageInfo.volumeTitle} · ${stageInfo.chapterName}]`);
  }

  // 5. 事件就绪处理器
  function onPromptReady(eventData) {
    try {
      if (!eventData) return;
      if (Array.isArray(eventData)) {
        injectPlotStageNotice(eventData);
      } else if (Array.isArray(eventData.chat)) {
        injectPlotStageNotice(eventData.chat);
      } else if (Array.isArray(eventData.messages)) {
        injectPlotStageNotice(eventData.messages);
      }
    } catch (e) {
      console.error('[LK-剧情注入器] 拦截执行异常:', e);
    }
  }

  // 6. 注册事件监听
  function register() {
    const readyEvent = (window.tavern_events && window.tavern_events.CHAT_COMPLETION_PROMPT_READY)
      || 'chat_completion_prompt_ready';

    if (typeof eventMakeFirst === 'function') {
      eventMakeFirst(readyEvent, onPromptReady);
    } else if (typeof eventOn === 'function') {
      eventOn(readyEvent, onPromptReady);
    }

    try {
      const coreEventSource = window.eventSource 
        || (window.SillyTavern && window.SillyTavern.getContext && window.SillyTavern.getContext().eventSource);
      if (coreEventSource && typeof coreEventSource.on === 'function') {
        coreEventSource.on(readyEvent, onPromptReady);
      }
    } catch (e) {}

    console.log('[LK-剧情注入器] 已成功注入就绪监听，将在用户输入前动态标记第1卷～第19卷剧情！');
  }

  register();
})();
