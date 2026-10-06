# 盾形正文对白 v0.1

模型只输出 `姓名:台词`，旁白另起段。头像和样式由两条角色局部显示正则补上；不需要酒馆助手，不写聊天、变量或提示词。

## 使用

1. 在酒馆正则面板导入 `output/dialogue-bubbles/components/dialogue-bubbles.regex.json` 和 `dialogue-bubble-style.regex.json`，按 **01 对白 → 02 样式** 排列，放在把普通正文转换成 HTML 的其他规则之前。
2. 两条都设为当前角色的局部正则、保持启用。默认仅作用于 AI 回复的显示，编辑后运行；不修改发送给模型的提示词。酒馆的“显示回复中的 HTML 标签 / Show <tags> in responses”应关闭。
3. 将 `output/dialogue-bubbles/format-rule.txt` 的首行及示例加入你现用的正文格式要求。此组件不会自动编辑预设或世界书。
4. 用 `史黛菈:别误会，我只是顺路。` 测试。姓名使用清单已有简称或全名。`艾莉丝` 有歧义，改用 `有栖院凪` 或 `艾莉丝·阿斯卡里德`。

未知姓名保留原文。未加载头像时显示淡色盾形占位，姓名与台词仍可读。图片直接使用现有 manifest 配置的 HTTPS 地址；预览使用对应本地原图。

## 首版边界

- 单段对白不手动换行，显示时会自动折行；英文/中文冒号均可。最多允许行首 3 个空格，四空格缩进及 tab 保留为代码。
- 为保护原文，含代码围栏（连续三个反引号或波浪号）的整条消息不美化。
- 从首个 `<` 起，余文保留原样，保护变量、分析、思考、HTML 属性、注释和未闭合的流式输出。正常位于回复末尾的 MVU 块不影响此前对白。首版面向普通正文；已有 `<content>` 等正文封套的回复保留原文。
- 含 `<`、`>`、`&` 或 `{{` 宏开头的对白整行保留原文，避免把台词当作 HTML/实体注入气泡，或在宿主的替换后宏展开中改变气泡结构。普通引号、冒号、美元符号可用；原文中的宏仍由酒馆正常处理。
- 共享样式每个有气泡的消息注入一次；不会每句重复。静态 CSS 只作用于 `data-rkd` 气泡节点，头像不裁切。
- 离线预览和正则检查不能代替真实酒馆的 Markdown、净化、其他正则顺序、主题、流式输出与历史重绘验收。

## 构建与验证

维护本目录源文件；头像唯一来源是 `resource/knightavatars/manifest.json`。

```powershell
node scripts/正文气泡/build.mjs
node .agents/skills/sillytavern-component-update/scripts/plan-component-update.mjs --spec output/dialogue-bubbles/update-spec.json --out output/dialogue-bubbles/components
node .agents/skills/sillytavern-component-update/scripts/build-importable-component.mjs --spec output/dialogue-bubbles/update-spec.json --out output/dialogue-bubbles/components --write
node .agents/skills/sillytavern-component-update/scripts/validate-importable-component.mjs output/dialogue-bubbles/components
node scripts/正文气泡/check.mjs
node scripts/正文气泡/check-artifact.mjs
```

导入字段依据 SillyTavern 1.18.0 `public/scripts/extensions/regex/engine.js` 的 `AI_OUTPUT=2`、显示执行条件和 `substitute_find_regex.NONE=0`，与仓库已有卡快照一致；本轮未确认用户当前运行版本。
