# 盾形正文对白 v0.3

模型只输出 `姓名:台词`，旁白另起段。头像和样式由两条角色局部显示正则补上；不需要酒馆助手，不写聊天、变量或提示词。

## 使用

1. 在酒馆正则面板导入 `output/dialogue-bubbles/components/dialogue-bubbles.regex.json` 和 `dialogue-bubble-style.regex.json`，按 **01 对白 → 02 样式** 排列。升级已有组件时替换对应旧规则，避免重复启用。
2. 两条都设为当前角色的局部正则、保持启用。01 的“正则表达式查找时的宏”设为 **替换（转义）**，02 保持“不替换”。默认仅作用于 AI 回复的显示，编辑后运行；不修改发送给模型的提示词。酒馆的“显示回复中的 HTML 标签 / Show <tags> in responses”应关闭。
3. 将 `output/dialogue-bubbles/format-rule.txt` 的首行及示例加入你现用的正文格式要求。此组件不会自动编辑预设或世界书。
4. 用 `史黛菈:别误会，我只是顺路。` 测试。姓名使用清单已有简称或全名。`艾莉丝` 有歧义，改用 `有栖院凪` 或 `艾莉丝·阿斯卡里德`。

当前玩家通过酒馆的 `{{user}}` 宏自动匹配，无须把各玩家姓名加入清单。没有对应原作头像时显示通用盾形；不冒用某个 NPC 的头像。其余未知姓名保留原文。图片直接使用现有 manifest 配置的 HTTPS 地址；预览使用对应本地原图。

## v0.3 自捏玩家

- 正文仍写实际 `姓名:台词`，例如 `清泉朝阳:打扰了。`；宏仅用于规则内部读取当前用户设定名，模型不用额外输出标签。
- 更换玩家时，在酒馆的“用户设定”中使用对应名字即可，正则无需修改。手动在卡内捏了与用户设定不同的名字时，应先让两处名字一致。只匹配当前名字，不追认改名前的历史别名。
- 名字中的常见正则符号按字面匹配。含换行、HTML 敏感字符、花括号或冒号的名字保守保留原文。未知 NPC 不因此被当成玩家。
- 当前仅补名字匹配与通用盾形，不读取用户设定头像，也不添加酒馆助手脚本。两条显示规则不修改聊天或变量。

## v0.2 修复

v0.1 在正文之前出现任意 `<` 后就停止匹配，导致含前置思考标签、正文封套和全局正则生成 HTML 的真实回复完全没有气泡。v0.2 按当前位置判断保护区；已闭合的前置块不再阻断后续正文。用户提供的日文原句保持原样，下一行中文 `姓名:台词` 转为气泡。

支持 `<content>`、`<story_scene>`、`<parallel_line>` 和普通 HTML 容器；适配当前全局规则生成的“平行线事件”折叠正文。原格式要求和头像清单不变。

同时修复第二处宿主差异：SillyTavern 1.18.0 的样式保护只识别裸 `<style>`。旧版把标记放在标签属性上，样式会被移除；新版将标记移入 CSS 注释，并让姓名颜色继承正文容器，适配浅色主题中的深色折叠区。

## 边界

- 单段对白不手动换行，显示时会自动折行；英文/中文冒号均可。最多允许行首 3 个空格，四空格缩进及 tab 保留为代码。
- 为保护原文，含代码围栏（连续三个反引号或波浪号）的整条消息不美化。
- 变量、分析、思考、代码、表单、HTML 属性和注释内的对白保持原样，包括未闭合的流式保护区。保护区闭合后恢复匹配。同名保护区嵌套时保守回退余文；不把这组正则当作通用 HTML 解析器。
- 普通 `details` 保护，首个 `summary` 含“平行线事件”的折叠区允许正文气泡；其中内嵌的驱动折叠区仍受保护。其他全局规则若改变这些结构或把对白变成非独立文本行，需要另行适配。
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

导入字段依据 SillyTavern 1.18.0 `public/scripts/extensions/regex/engine.js` 的 `AI_OUTPUT=2`、显示执行条件和 `substitute_find_regex.NONE=0`。本次连接到本地 SillyTavern 1.18.0；实际验证记录见 `output/dialogue-bubbles/runtime-check.json`，离线检查结果独立记录。
