# 开局页面原型验证记录

## 2026-09-05：开局字段与档案流程

- `node output/check-opening.cjs`：2 段内嵌脚本语法通过、111 个 HTML ID 无重复；自定义等级省略、字段移除、JSON 往返、非法版本/等级/长度/外部头像拒绝、正典模板保护均通过。
- 本地浏览器 `http://127.0.0.1:8768/?scene=2`：自定义字段同步、只读开局预览与剪贴板逐字一致，未显示性别或自定义综合等级。
- 上传本地 JPEG 后，JSON 下载文件约 62 KB；刷新后读取档案槽、再导入下载的 JSON，姓名、性格、简介与照片均成功恢复。
- 首版 PNG 已实际下载并视觉检查；首次检查发现底部文字过近边框，已增加留白。最终版本的浏览器内图片预览已目视确认文字完整、底部有留白；增加了保留预览与显式下载链接，供自动下载受限时使用。
- 320 px 窄屏长姓名检查：卡面约 289 px，页面滚动宽度 305 px，无横向溢出。印章改为文档流内排版，避免覆盖长文本。
- BGM `currentSrc` 为 GitHub Pages 的 `bgm1.mp3`，`readyState=4`，`error=null`；该次浏览器检查没有错误级控制台日志。
- 页面初始化改为底部脚本在 DOM 就绪后立即执行，不等待远程媒体 load。
- 当前是独立页面验证；SillyTavern 导入、自动发送、真实 AI 回复、MVU 初始化未执行。
- 最终页面 SHA-256：`9f306e64a69227ed68649a474f2626864b0d978f7f7b740dffd8a9e680b8f8a3`。原参考卡哈希复核一致，未被改动。

## 历史验证：2026-09-02 原型

- **日期**：2026-09-02
- **页面**：`开局页面/index.html`
- **预览地址**：`http://127.0.0.1:8765/index.html`
- **页面定位**：独立 prototype/source；不是 SillyTavern 发布卡，也不是已完成的宿主运行时验收。

## 视觉方向

参考图采用浅米色纸卡、灰黑文字、低饱和灰粉/砖红分隔线和角色资料页式分栏。本原型已从最初的蓝黑玻璃拟态改为：

- 米色纸张背景与浅色平面面板；
- Georgia/宋体风格的大标题；
- 砖红等级徽章、标签和主操作；
- 暖灰细线、低对比圆形装饰；
- 右侧六轴雷达图作为资料页核心；
- 保留 `prefers-reduced-motion` 降级，不依赖图片、字体或第三方库。

## 静态检查

**结果：通过**

- `profiles.json`、`index.html`、`README.md`、`data-contract.md` 均可按 UTF-8 读取。
- `profiles.json` JSON 有效；4 个 `profile_id` 唯一。
- 六轴顺序固定为：攻击力、防御力、魔力量、魔力控制、体能、运气。
- 三名卷一角色的等级/六轴与 `MAT-001` 来源一致：
  - 一辉：`F / F F F E A F`，`MAT-001#L3,522-L3,544`
  - 史黛菈：`A / A A A B B A`，`MAT-001#L5,569-L5,591`
  - 珠雫：`B / D B C A E C`，`MAT-001#L7,546-L7,568`
- 自定义档案六轴保持 `null`，不以 0 或平均值代替未知。
- 来源片段均符合 `MAT-001#Lx-Ly` 格式，且位于 `L3–L7,892` 卷一正典范围内。
- 页面未发现远程 URL、`iframe`、`eval`、`innerHTML`、`triggerSlash`、`send_text_to_input` 或 `generateRaw`。
- 唯一 URL-like 字符串是 SVG 标准命名空间 `http://www.w3.org/2000/svg`，用于纯 SVG 雷达图，不是网络请求。
- 页面文本未出现“恋人”“无冕剑王”“桐原”或大凉卡的 CR/境界/骰子/MVU/EJS 运行时内容。

## 浏览器黑盒检查

浏览器：ZCode In-app Browser；页面由本地静态服务器提供。

| 检查项 | 结果 | 证据 |
|---|---|---|
| 初始加载 | 通过；默认载入黑铁一辉，六轴明细与来源显示正确 | `call_OH9GHIHcpRftnzGlCqAvYxrh-tool-result-212db9dd-9147-43ba-8cd2-00a95df1bfd6.png` |
| 史黛菈切换 | 通过；A 级、`A A A B B A`、妃龙罪剑/妃龙吐息同步 | DOM snapshot：`call_pkz5Pk8rfSuOfFCUBb9Ac5nv-tool-result-47c4033a-995a-4c54-aa76-e60ef62875db.png` |
| 珠雫切换 | 通过；B 级、`D B C A E C`、障破/障波字形说明同步 | DOM snapshot：同上操作批次的页面快照 |
| 自定义档案 | 通过；六轴初始均为“待评定”，自定义区出现，未知轴不绘制为 0 | DOM snapshot：自定义档案快照 |
| 自定义轴编辑 | 通过；将“攻击力”选为 A 后，六轴明细和预览变为 A | DOM snapshot：自定义攻击力快照 |
| 表单实时预览 | 通过；填写“测试骑士”后预览文本同步更新 | DOM snapshot：`call_...编辑开局姓名草稿` |
| 保存草稿 | 通过；提示“草稿已保存在本机浏览器；它不是聊天变量。” | DOM snapshot：`call_...保存自定义档案草稿` |
| 恢复草稿回归 | 通过；先切换史黛菈再恢复，页面回到自定义档案，姓名和自定义攻击力均保留 | DOM snapshot：`call_...恢复已保存的档案草稿` |
| 重置页面 | 通过；回到黑铁一辉，且明确提示不会删除本机草稿 | DOM snapshot：`call_...验证页面重置动作` |
| 复制开局稿 | 通过；提示“开局稿已复制；页面没有执行发送。” | DOM snapshot：`call_...检查复制按钮反馈` |
| 320px 窄屏 | 通过；`body.scrollWidth=320`、`overflowX=false`、根内容宽 300、雷达图宽约 266.67 | `call_O8xPkGaIcAWOrAyvMTFUy3dj-tool-result-4da01ae2-6a27-41fe-8ef3-b4a8929b8b57.png` |
| 键盘导航 | 通过；复制按钮后 Tab 可移动到保存按钮，保存按钮暴露为 active | DOM snapshot：`call_...检查按钮键盘导航` |

## 当前未验收

以下不能由本地原型关闭：

- SillyTavern 的实际挂载层、`first_mes`/Regex 或原生 opening 方案；
- 真实用户消息创建、正常回复、MVU 初始化、Tavern Helper 和世界书绑定；
- ST 重载、切聊天、swipe、消息编辑后的 DOM 生命周期；
- 真实移动设备键盘、读屏器、主题继承和宿主清洗链；
- 最终角色卡 JSON/PNG/CharX 打包与导入回环。

后续接入时应把本原型交给 `sillytavern-card-pipeline` 和 `sillytavern-runtime-debug`，先确认目标 ST 版本和真实导出样例，再实现最小宿主适配；不要把本地预览结果当作运行时通过。
# v3 评级与世界书源文件验收 · 2026-09-05

当前验收对象是带 `opening-rating-engine` 的 `index.html` 和项目根 `世界书规则/v0.3` 六条规则正文。下面较早的原型记录属于历史结果，不代替本轮结果。

## 本轮结果

- `node scripts/check-opening-rating.cjs`：通过。全部内联 JS 语法、18 个预期算例（明确保留兔丸/泡沫与正典的差异）、14,641 种合法四轴组合、未知项、半档取整、±1 越界、过期依据、正典保护与世界书参照一致性通过。
- `node scripts/check-opening-browser.cjs <已安装的 playwright 包路径>`：本机 Chrome 无头浏览器通过。测试脚本没有安装依赖；使用 Codex 提供的运行库和已安装 Chrome。
- 实测普通填写初评 B、粘贴带 request_id 的测试评定、卡面/开局消息/槽位/JSON 一致；PNG 成功生成并查看。能力、限制和风格在确认卡与导出图中均可见。
- 实测编辑使旧复核失效、旧回复被拒绝、未知轴保持待定、C+ 保存、v2 迁移、导入伪造的 rating/rank 无法覆盖重算值、原作一辉 F 与锁定保护。
- 390×844 手机视口：无横向溢出；档案截图已检查。浏览器未捕获页面 JS 错误。

浏览器测试使用明确的 JSON 回复夹具，未请求真实 AI；远程媒体主动阻断以证明建档不依赖加载成功，故不代表音乐/OP 在线可用性验收。实际 SillyTavern 自动发送、MVU 初始化、EJS 和条目触发仍未接线或实机验收。

证据目录：`output/playwright/rating-v03/`：`result.json`、`sample-profile.json`、`sample-profile.png`、`desktop-card.png`、`mobile-card.png`，全部是测试角色的本地结果。

规则交付范围：六条可复制世界书正文、来源与采用说明、MVU 接线契约；未打包角色卡、未导入或覆盖宿主世界书、未推送远端。

---
