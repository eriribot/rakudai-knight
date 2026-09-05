# 开局档案工作流 · 2026-09-05

当前维护入口是 `index.html`，页面使用内嵌 `START_PROFILES`；`profiles.json` 是前一版原型的资料源，不是当前页面的运行输入。当前页面为独立 HTML，没有自动发送至 SillyTavern 或写入 MVU。

## 已确定的字段与身份

- 删除性别展示、性别文本输出和罗马音字段。
- 原罗马音位置改为「性格关键词」，原综合等级输入位置改为「处事风格」。
- 自定义 U 作为独立新角色加入，一辉继续作为 NPC 存在。原作亲属、室友和感情关系不自动转移。
- 自定义档案不提供手填总 `rank`；`rating` 保存脚本初评与复核后的拟定登记级。六维可留空，支持 A—F 及 B+ 至 F+；计算轴未齐不出初评。
- 正典一辉保留 F 级及原作六维，字段锁定。性格、处事风格是基于人物资料的作者概括。

## v3 能力评定

新增 `ability`（能力机制）、`limits`（限制与代价）、`style`（战斗风格）。纯计算脚本 `opening-rating-engine` 维护六维参照与 r05-v1：前四项去最低平均并四舍五入；A=6 至 F=1，+ 为 0.5。参照按角色能力与限制比较，不提供虚构的官方统一物理阈值。

“让 AI 帮我评定”生成带档案指纹的请求。用户复制到 AI 后，将返回 JSON 粘贴并点击应用；没有后台 AI API 调用。返回值必须包含六项 stats、六项 reasons、整数 adjustment（-1/0/1）和非空 reviewReason；未知项可为空但须说明缺少的信息。只接受与当前档案相符的 request_id，再重算拟定登记级。

`assessment` 保存 `rule`、`basis`、`adjustment`、`reviewReason`、`reasons`；basis 精确绑定建档字段和六轴。`rating` 为派生 `rule`、`score`、`base`、`missing`、`proposed`、`status`。status 为 awaiting_axes、awaiting_review、reviewed_proposal 或 canon。未知用 null，不以 F 代替。编辑设定清除复核，原作一辉不接受复核覆盖。

配套六条世界书正文位于项目根的 `世界书规则/v0.3`。六维参照由同一 RATING_ANCHORS 生成；`node scripts/check-opening-rating.cjs` 检查一致性。MP/AP/统一减费与运气奖励没有因本次评级规则被自动启用。

## 唯一数据流

```text
表单 + 当前照片
  → readOpeningDraft()
  → 卡面 / buildOpeningMessage() / JSON / 本机槽位 / PNG 图片
```

`buildOpeningMessage()` 同时用于预览与复制，保留换行。消息明确区分原作角色和新增 U，不声称变量已初始化，不禁用用户尚未确定的变量更新流程。

「生成开局消息」打开只读预览；「复制档案开局稿」复制同一份消息。复制受限时选中预览文字供手动复制。独立页面需要把消息粘贴到酒馆发送，页面不会显示虚假的「已入局」。

## 保存格式

- `format: rakudai-opening-profile`
- `schema_version: 3`
- `profile_key: user | kurogane`
- `profile`: `name`、`personality`、`conduct`、`school`、`device`、`nobleArt`、`desc`、`ability`、`limits`、`style`、`stats`、`assessment`、`rating`；只有正典档案含 `rank: F`。
- `stats`: `attack`、`defense`、`magic`、`control`、`physical`、`luck`；值为 A—F、B+ 至 F+ 或空字符串，空字符串明确表示待定。
- `avatar`: 经过缩放的本地照片 data URL 或 `null`。正典头像引用页面固定资源。

三个显式本机槽位使用 `rakudai-opening-profiles-v2-slot-1` 至 `3`。这是可复用的人物建档草稿，不是当前聊天状态，因此不与 MVU 或聊天 metadata 同步，也不会自动加载到另一局。刷新后可以手动读取。换源、换浏览器、清理浏览器数据或换设备前应导出 JSON。

导入先校验版本、枚举、文本长度、评定依据和图片，再询问是否替换当前表单。错误数据不覆盖当前草稿。支持本格式 v2/v3：v2 新增能力字段与评定留空，已有六维重算初评；v3 校验 assessment，忽略文件缓存 rating 与 U 自填 rank。三个槽位继续用原键，显式保存时才写入 v3。旧 v1 和外部人物 JSON 不猜测迁移。正典档案重新引用固定模板，避免把任意改写的数值冒充原作。

上传接受 PNG/JPEG/WebP，最大 8 MB；居中裁切为 640×640 JPEG 后保存。JSON 最大 2 MB。PNG 导出使用浏览器 Canvas 与当前雷达 SVG，包含姓名、性格、处事风格、简介、头像、六维、能力限制、初评、拟定等级与复核依据；它是图片纪念档案，继续编辑需保存 JSON。导出后保留图片预览和显式下载链接，支持长按保存。未引入截图 CDN 或图像生成服务。

## 音乐修复

旧 `<audio>` 的首个 source 是相对路径 `bgm1.mp3`，远程 GitHub Pages 地址排第二。HTML 嵌入、复制或在不含音频的目录服务时，相对地址会解析到当前页面源，如 `:8000/bgm1.mp3`，从而报 404。

当前只保留 `https://eriribot.github.io/rakudai-knight/bgm1.mp3`。这消除了本页面主动请求该本地音乐路径的原因；远程服务自身或旧缓存页面的错误属于不同情况。页面初始化不再等待远程媒体全部加载。

## 大凉参考卡的实际实现

只读来源：用户提供的 `大凉龙虎传v2.21.json`，字节数 3,027,168，SHA-256：`6b3574abf5e503efce8af39a7f0ba778192c5d22b3163ffd20aa391cdff38d17`。卡内部名称和版本字段为 `大凉龙虎传v2.2` / `2.2`。原文件未修改、未执行其代码。

提取位置：`/data/extensions/regex_scripts/3/replaceString`，脚本名「开场白」。证据副本保存在本机临时目录 `luodi-opening-reference-u3HBV8`。

1. `first_mes` 是 `[大凉龙虎录]`。开场白正则匹配这个标记，将显示内容替换为完整 HTML；该规则启用且 `markdownOnly: true`、`promptOnly: false`，页面替换本身不是向 AI 发起请求。
2. `sub()` 读取表单，组装一段 OOC 文本，包含身份、能力、资产、外貌、位置和开局情景。
3. 首选分支调用 `triggerSlash`，将文本拼进 `/send … | /trigger`；其次尝试 `send_text_to_input`；都不存在则复制到剪贴板。这是参考卡源码行为，未在用户目标酒馆版本执行验证。
4. `getCurrentData()` / `applyDataToForm()` 负责序列化和恢复。五个 `localStorage` 槽位保存人物草稿，`exportCurrent()` 导出 JSON。该开场白没有 PNG 档案导出；本页面的图片导出是新增实现。
5. 辅助的 `aiGenerate()` 使用 `generateRaw` 为表单补全文案，和最终提交开局的 `sub()` 是两条不同路径。

未照搬的细节：将玩家文本直接拼进斜杠管线、未经发送回执就设置「已入局」、在未证明初始化完成时宣称变量已初始化。将来自动接入时须匹配实际 Tavern Helper / MVU 版本，使用有明确文本参数和正常发送生命周期的接口，保留原输入并验证真实用户消息已创建。

## 依赖与交付边界

当前界面、保存和图片导出仅用浏览器原生能力。OP、音乐、封面与默认头像沿用项目 GitHub Pages 远程资源。没有新安装运行时、没有改动参考角色卡、没有输出或导入世界书/角色卡发布包。

实际 SillyTavern、Tavern Helper、MVU、EJS 版本尚未识别。自动发送、正则挂载、真实消息生成与 MVU 初始化均不计为已验收。

技能路由：TavernWeave `2026-08-18` 快照，`sillytavern-card-components`、`sillytavern-embedded-ui`；使用 A0、A2/A6 与 C1/C3/C10/D7 的相关边界。没有采用额外设计目录项目或实验性存储路线。
