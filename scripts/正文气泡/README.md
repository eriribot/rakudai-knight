# 盾形正文对白 v0.4

玩家头像复用开局页已载入或上传的照片，终端只登记明确别名，正文气泡共用这份显示配置。模型优先写 `玩家:台词`；写全名或已登记简称也可识别，歧义姓名保留原文。v1.3.19 / 开局 N04 调整照片入口，以下 v0.4 气泡规则本体沿用。

## 使用

1. 在酒馆正则面板导入本目录 `发布/components/` 的三条规则，顺序为 **01 姓名与台词 → 02 OC 姓名候选 → 03 共享样式**。01 和共享样式继续使用旧稳定 ID，替换原组件；02 是新增规则，避免重复启用旧版本。
2. 三条都设为当前角色局部正则、保持启用。01 的“正则表达式查找时的宏”设为 **替换（转义）**，02 和 03 保持“不替换”。默认只作用于 AI 回复显示，编辑后运行；酒馆“显示回复中的 HTML 标签 / Show <tags> in responses”应关闭。
3. 将本目录 [format-rule.txt](format-rule.txt) 加入现用正文格式要求；此组件不会自动修改预设或世界书。
4. 头像使用 [开局页](../../第一卷-世界书整理/开局页面/index.html) 原有的照片载入或上传入口。旧聊天在新版开局页载入档案或照片，核对姓名与本局正式姓名一致后点 **应用头像到本局**；只改变显示，不重新建档或重置 MVU。
5. 在小手机 v1.3.19 的「设置 → 玩家称呼 / 别名」中查看头像并登记明确别名；终端不再重复提供头像上传或地址输入，清除别名不会删除照片。正式姓名读取玩家档案；例如档案姓名 `清泉朝阳`、别名 `朝阳`。这两种写法和固定 `玩家` 标记共用开局照片；别名碰到其他已知人物时拒绝保存，后续出现重名则保守回退，改用 `玩家`。配置只保存在本机当前聊天；小手机脚本开启即可工作，不必展开窗口。

如果照片记录属于旧人物，先在开局页为当前正式姓名应用照片，再回终端重新读取；旧头像与别名会被屏蔽，保存别名也会禁用。正文暂用固定 `玩家:`，避免冒用旧人物。

固定 `玩家`、`player`、`user`、`OC` 和当前 persona 的完整安全姓名可以直接生成玩家气泡；其余未知安全姓名先生成无装饰候选，终端只将唯一确认属于玩家的候选提升为气泡。未确认的候选继续显示原来的整行文字，不冒用 NPC 头像。

NPC 仍使用 `resource/knightavatars/manifest.json` 的全名和明确别名。`艾莉丝` 有歧义，使用 `有栖院凪` 或 `艾莉丝·阿斯卡里德`。图片使用清单配置的 HTTPS 地址；离线预览映射到对应本地图片。

## 显示契约

三条正则只生成 HTML/CSS，不嵌脚本，不修改聊天原文、MVU 状态或发送给模型的文本。NPC 气泡及固定玩家标记可独立显示；OC 简称提升和自选头像需要新版终端运行时及其酒馆助手桥接。

候选 DOM 固定为：

```html
<span data-rkd="candidate" data-rkd-name="朝阳"><span data-rkd-source>  朝阳 ： 台词。  </span></span>
```

`span[data-rkd-source].textContent` 包含完整原行，行首空白、冒号及周围空白均保留。`data-rkd-name` 是剔除冒号前空白的安全姓名。候选不携带图片地址和脚本。只有共享身份解析器唯一命中玩家后，终端才将候选设为 `data-rkd="bubble"` 并建立头像与正文子节点；未知、冲突或不可用时不提升。

01 气泡的 `data-rkd-player` 为非空时，表示当前 persona 名或固定玩家标记；NPC 的该属性为空。终端提升的玩家气泡使用非空标记。这个属性仅用于显示身份，不是修改游戏身份的指令。

## 边界

- 对白独占一行，支持中英文冒号。最多允许行首 3 个空格；四空格缩进和 tab 保留为代码。单段台词不手动换行，显示自动折行。
- 含连续三个反引号或波浪号的消息整条保留。
- 分析、变量、思考、驱动、代码、表单、HTML 属性、注释及普通 `details` 内不转换，包括未闭合的流式保护区。已闭合保护区之后恢复；首个 summary 含“平行线事件”的折叠正文可以显示气泡。同名保护区嵌套允许保守保留余文。
- 姓名含 HTML 敏感字符、花括号、冒号或换行时保守回退；候选姓名最多 64 个字符。台词含 `<`、`>`、`&` 或 `{{` 时整行保留，避免实体和宏改变生成结构。普通引号、冒号、美元符号可以原样保留。
- 共享样式在含气泡或候选的消息中只注入一次；候选没有视觉装饰，预置样式供终端稍后提升。
- 离线检查验证规则字段、JavaScript 替换与候选文本可还原。实际 Markdown、净化、其他正则顺序、主题、流式、历史重绘与远程图片仍需实机验收。

## 构建与验证

v0.4 气泡正则既有 337 项检查通过，规则本体本次未改。当前开局照片与终端别名的联动见 [开局头像复用汇总](../黑白ADV轮盘终端/验证记录/开局头像复用.json)；此前 [OC 头像与气泡汇总](../黑白ADV轮盘终端/验证记录/OC头像与气泡.json) 保留为历史。真实酒馆验收未完成，旧入口的离线结果不能代替本次 N04 验收。

维护本目录源文件，产物保存在 `发布/`，报告保存在 `验证记录/`。旧 `output/dialogue-bubbles/` 仅读取历史复现 fixture，不写入。

```powershell
node scripts/正文气泡/build.mjs
node .agents/skills/sillytavern-component-update/scripts/plan-component-update.mjs --spec scripts/正文气泡/发布/update-spec.json --out scripts/正文气泡/发布/components
node .agents/skills/sillytavern-component-update/scripts/build-importable-component.mjs --spec scripts/正文气泡/发布/update-spec.json --out scripts/正文气泡/发布/components --write
node .agents/skills/sillytavern-component-update/scripts/validate-importable-component.mjs scripts/正文气泡/发布/components
node scripts/正文气泡/check.mjs
node scripts/正文气泡/check-artifact.mjs
```

规则字段依据 [SillyTavern 1.18.0 的 regex engine](https://raw.githubusercontent.com/SillyTavern/SillyTavern/1.18.0/public/scripts/extensions/regex/engine.js)：AI_OUTPUT 为 2，查找宏转义为 2，无替换为 0；宿主自己展开编号及命名捕获，因此原行使用命名捕获，不使用 JavaScript 的 `$&`。这些是版本源码证据；当前 v0.4 尚未在真实酒馆导入验收，旧 output 中 v0.3 记录不能替代本版验证。
