# 盾形正文对白 v0.6

**2026-10-10 · 凛奈与夏洛特头像补齐：** 正文气泡的实际导入入口在 `发布/components/`。本次按同一份头像清单同步重建 [01 姓名与台词](发布/components/dialogue-bubbles.regex.json) 和 [03 共享样式](发布/components/dialogue-bubble-style.regex.json)，支持 `风祭凛奈`、`風祭凜奈`（含简繁混写）、`风祭／風祭`、`凛奈／凜奈`，以及 `夏洛特`、`夏洛特·科黛`、`Charlotte Cordé` 等清单中的明确别名。

已安装 v0.6 的用户只需替换气泡 01 和 03；02 OC 姓名候选字节不变，保留原条目。发布组件沿用既有 ID 和 **01 → 02 → 03** 顺序；酒馆原生导入仍会追加新条目，应先关闭或删除旧 01、03，各保留一份开启。本次不需要替换 `世界书规则/MVU` 下的变量美化正则。后续修改清单姓名或 `imageUrl` 时，01 与 03 也须同步重建发布。

本次重建后的规则检查 **479/479** 通过，导入产物与源码一致性及组件格式验证通过；单独记录在 [风祭与夏洛特头像验证](验证记录/风祭与夏洛特头像/)。这是本地规则与产物检查，不替代玩家酒馆中的导入与显示验收，下文历史结果保留原范围。

v0.6 修复咩咩推理段里的标签引用导致整层对白失去气泡：完整 `story_driver` 或已知咩咩故事引擎折叠壳内部出现 `<wlog>` 等字面量时，不再把后面的正文误判成未闭合日志。真实未闭合保护块仍保守保留。此次现场使用咩咩 ver 5.8.1、小手机 v1.3.23；手机及玩家头像配置无需重装。

沿用 v0.5 的围栏、样式、逐字显示和玩家身份保护；共享上下文守卫默认保持旧行为，只有本气泡三条显式启用新驱动处理，现有 Izumi 本卡兼容三条不变。

## 玩家安装

1. 关闭或删除当前角色里的旧气泡三条，再导入本目录 `发布/components/` 三条新版，顺序 **01 姓名与台词 → 02 OC 姓名候选 → 03 共享样式**，每条只留一份开启。原生 JSON 导入会生成新 ID 并追加，不会按附件 ID 自动覆盖旧版。
2. 三条保持当前角色局部正则并启用，同时开启“启用本角色正则”。01 的查找宏为 **替换（转义）**，02/03 为 **不替换**。只作用于 AI 回复显示，编辑后运行；酒馆“Show <tags> in responses / 显示回复中的 HTML 标签”关闭。
3. 将 [format-rule.txt](format-rule.txt) 加入正文格式要求。推荐 `玩家:「台词」`，NPC 用明确姓名，旁白独立成行；日轻 `「」` / `『』` 均可。组件不自动修改预设或世界书。
4. 在 [开局页](../../第一卷-世界书整理/开局页面/index.html) 载入/上传照片，核对本局正式姓名后点 **应用头像到本局**，只改变显示，不重新建档或重置 MVU。
5. 小手机 v1.3.23「设置 → 玩家称呼 / 别名」登记别名，如正式姓名 `清泉朝阳`、别名 `朝阳`。手机脚本开启即可工作，无须展开窗口；配置只存在本机当前聊天。

使用此次附件 **Izumi 1002** 的玩家，在**当前角色局部正则**导入 [本卡兼容组件](发布/Izumi本卡兼容/components/) 三条，排列为 **Izumi 前缀修补 → Izumi 样式保护 → Izumi 计划闭合 → 气泡 01 → 02 → 03**。导入对话框可能默认“全局”，应明确选择当前角色局部。原 Izumi 若也在本卡局部列表，把它保留在兼容三条之前。公共 Izumi 正则、预设和提示词保持原样；切换其他卡时这些局部规则不参与。

本卡补丁只处理这份 Izumi 已生成的已知模板，补回其遗留的计划闭标签并保护样式；正文不捕获回填，字面宏保留。未知模板或真实未闭合的原始计划块保守保持，不能恢复已被公共规则删除的原文。此前 [直接替换 Izumi 原条目的方案](发布/Izumi兼容/components/izumi-planning-compat.regex.json) 保留作历史交付，修改公共分组会影响其他使用者，本次安装改用局部方案。已应用该旧方案时，先从原 Izumi 恢复原条目，并停用重复的旧补丁。

固定 `玩家`、`player`、`user`、`OC`（ASCII 大小写均可）及完整安全 persona 姓名直接生成玩家气泡。未知安全姓名、英文 persona 大小写变体先显示无装饰候选；终端身份解析器唯一确认玩家后才提升。简称与已知 NPC 重名时回退原文，改用 `玩家:`。照片属于旧人物时，先在开局页为当前姓名应用照片；旧头像/别名会被屏蔽。

NPC 使用 `resource/knightavatars/manifest.json` 的姓名/明确别名。`艾莉丝` 有歧义，应写 `有栖院凪` 或 `艾莉丝·阿斯卡里德`。图片使用清单 HTTPS 地址，离线预览映射同一份本地图片。

## 显示契约与保护

三条正则只生成 HTML/CSS，不嵌脚本，不修改聊天原文、MVU 或模型上下文。NPC/固定玩家标记可独立显示；OC 简称与头像需要新版手机及酒馆助手桥接。候选固定为：

```html
<span data-rkd="candidate" data-rkd-name="朝阳"><span data-rkd-source>  朝阳 ： 台词。  </span></span>
```

`span[data-rkd-source].textContent` 保留完整原行及空白。`data-rkd-name` 为去掉冒号前空白的安全姓名，不携带图片/脚本。未知、冲突或解析不可用不提升。01 非空 `data-rkd-player` 表示固定玩家标记或 persona，NPC 为空；仅用于显示。

- 对白独占一行，支持中英文冒号，最多行首 3 个空格；四空格/tab 缩进保留为代码。单段台词不手动换行，显示自动折行。
- 只保护当前 fenced code block。行首 0–3 空格后至少三个同类反引号/波浪号开启；关闭行同类型、长度不少于开启符、末尾只含空格/tab。未闭合保护余文，多块/混合类型支持，块外正文仍转换。选项 fenced HTML 逐字保持，普通台词内行内标记不充当围栏。
- 分析、变量、思考、驱动、代码、表单、属性、注释及普通 `details` 内不转换。也保护 `konatan_planning~`、`tucao`、`konatan_chat`、`options`、`selection`、`special_status`、`secure_log`；`story_scene` / `content` 正文封套可转换。闭合围栏、完整注释和带引号属性里的标签字面量不改变正文状态；真实未闭标签跨围栏仍受保护，不能靠围栏里的假闭标签解除。不同受保护标签分别检查，未闭合/同名嵌套允许保守回退。首个 summary 含“平行线事件”的折叠正文可显示气泡。
- 姓名含 HTML 敏感字符、花括号、冒号或换行时回退，候选最多 64 字符。台词含 `<`、`>`、`&` 或 `{{` 时整行保留；普通引号/美元符号保留。
- 完整且签名已知的小写原始 `story_driver`、咩咩故事引擎壳作为整体判断，其内部协议标签引用不会打开或关闭外部保护区。未知模板、缺尾部或嵌套异常保守回退；已有未闭日志、脚本、属性、注释或代码围栏不能靠驱动壳内的假闭合标签解除。
- 03 在首个有效气泡/候选前以零长度位置插入一次，前文不回填，避免宿主再次展开其字面宏。`<pre hidden>` **只包裸 `<style>`**，正文在 pre 外，流式 segmenter 跳过 CSS 文本。候选无视觉装饰，媒体禁止时仍服从宿主过滤。
- ASCII 姓名/HTML 标签显式匹配大小写，围栏长后缀按字面比较；无全局 `i` 或新局部 modifier 语法，保留原浏览器语法基线。

## 证据与维护

[规则检查](验证记录/check-results.json) 468 项通过，覆盖此次完整驱动中的协议标签引用、外部保护边界及共享调用方字节兼容。此前 v0.5 的 [独立边界审查](验证记录/lexical-context-review.json) 108 项通过；[附件复放](验证记录/preset-compatibility-trace.json) 39 项、40 个 stage traces 使用过原条目修订方案，不能据此证明新的局部方案。完全保留原 Izumi 的局部方案见 [局部兼容检查](验证记录/izumi-local-check.json)，23 项通过；完整链路另见 [宿主复放](验证记录/host-render-local-izumi.json)，34 个 fixture 的预期全部通过。

2026-10-08 [玩家现场只读复放](验证记录/现场掉气泡-20261008/live-preview.json)：SillyTavern 1.18.0 release (8172dcd0e)，实际安装 v0.5，咩咩 ver 5.8.1。成功层气泡 22 → 22，失败层 0 → 13；失败原因是完整推理段中的“校验 `<wlog>` 名单”被旧规则当成未闭日志。复放使用当前酒馆引擎、全部已允许正则和真实 persona，聊天数据 SHA-256 不变。现场既有 AutoComplete 定位异常单独记录，不当作本次气泡错误。

同日玩家反馈“修复了”，附图可见新宫寺黑乃的头像、姓名和对白气泡恢复，旁白及“平行线事件”折叠标题正常显示。该截图作为玩家侧可见效果验收；本任务未执行 `verify-live.mjs --apply`，不据此推断玩家实际导入步骤或最终安装文件哈希。

[最终本机浏览器观察](验证记录/host-render-local-izumi-root-browser.json) 使用同批发布文件：12 个正向例子流式处理前后气泡/样式保持一致，真实未闭标签仍受保护；原生正则三例 1/1/0 命中，首例冷执行约17ms。附件提示词/脚本只当数据，未执行脚本、未改 Downloads，报告只保存中立最小 fixture、哈希及变化摘要。

[性能预算](验证记录/performance-check.json) 单 worker 顺序测量。v0.6 最后一次检查 13/14 通过：一行冷启动 211.96ms，略超既定 200ms 门槛；50k/200句预热后约104–106ms，其余保护场景通过。该冷启动超时保留为未解决的性能项，不提高预算，也不以此前一次 14/14 的结果替代。普通预热预算200ms，保护块硬门槛1s；随硬件变化，不等于酒馆流式帧时间。

[ST 渲染基线](验证记录/host-render-baseline.json) 与 [真实 Chrome 机制验证](验证记录/host-render-browser.json) 复现裸样式被逐字效果拆成 span、CSSOM40→0；隐藏 pre 保留40→40，媒体禁止仍过滤图像规则。此前原条目修订复放保留在 [历史组件报告](验证记录/host-render-current.json)。当前局部方案见 [原 Izumi 与本卡组件的宿主复放](验证记录/host-render-local-izumi.json)；使用固定宿主的实际规则合并、正则解析、格式化和流式逐字处理，原30条 Izumi 规则保持原样，并核对其他卡排除局部规则后的输出全等。Izumi 自身样式的独立证据见 [作用域与样式复核](验证记录/izumi-scope-review.json)。这些证据不能替代玩家安装现场的主题、全部预设脚本、历史重绘、流式生命周期及远程图片可用性验收。

源文件维护在本目录，产物在 `发布/`、报告在 `验证记录/`。旧 `output/dialogue-bubbles/` 仅读历史 fixture，不写入。

```powershell
node scripts/正文气泡/build.mjs
node .agents/skills/sillytavern-component-update/scripts/plan-component-update.mjs --spec scripts/正文气泡/发布/update-spec.json --out scripts/正文气泡/发布/components
node .agents/skills/sillytavern-component-update/scripts/build-importable-component.mjs --spec scripts/正文气泡/发布/update-spec.json --out scripts/正文气泡/发布/components --write
node .agents/skills/sillytavern-component-update/scripts/validate-importable-component.mjs scripts/正文气泡/发布/components
node scripts/正文气泡/check.mjs
node scripts/正文气泡/check-performance.mjs
node scripts/正文气泡/check-preset-compatibility.mjs
node scripts/正文气泡/check-artifact.mjs
node scripts/正文气泡/build-izumi-local.mjs --prepare
node scripts/正文气泡/build-izumi-local.mjs --write
node scripts/正文气泡/check-izumi-local.mjs
```

字段依据 [SillyTavern 1.18.0 regex engine](https://raw.githubusercontent.com/SillyTavern/SillyTavern/1.18.0/public/scripts/extensions/regex/engine.js)：AI_OUTPUT为2，查找宏转义2、不替换0；宿主展开编号/命名捕获并对replacement执行宏替换。实际类型合并 `global → preset → scoped`，同 ID 不跨来源覆盖；逆序仅为压力测试，不推断玩家当前分组。原生导入新增 UUID 并追加，见 [导入实现](https://raw.githubusercontent.com/SillyTavern/SillyTavern/1.18.0/public/scripts/extensions/regex/index.js)。
