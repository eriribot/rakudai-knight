# 固定 MVU 初始化取证摘要

版本：`MagicalAstrogy/MagVarUpdate@61010dab47bc3a08a1b626320bf7fc8c9573eca4`。本次只取证源码；没有操作实机或修改业务代码。以下行号相对于 `mvu-pinned-source/`。

**已证实的顺序：先发布 `parent.Mvu`，再初始化世界书与首楼变量。** 因而“全局未发布”和“全局已发布、stat_data 未写入”必须分开判断。下述可达失败条件均尚未在玩家设备验证，不能直接命名为本次根因。

| 已读取的源码事实 | 位置 | 对故障定位的意义 |
| --- | --- | --- |
| 模块入口先等待版本检查及 store 初始化 | `src/main.ts:25`、`:33` | 这些步骤未完成时，尚未发布 Mvu。 |
| `_wait_init()` await 同源 `fetch('/version')`；无 AbortSignal/代码级超时；失败 catch 回退 `1.0.0` | `src/store.ts:373`–`:378` | **pending 与 reject 不同**：前者可以阻止发布；后者会继续。尚无玩家 /version pending 证据。 |
| `should_enable` 初始 false，由唯一实例事件的回调设为 true | `src/store.ts:381`、`:389`–`:390` | 需要本脚本取得优先实例资格。 |
| 优先实例从 `#tavern_helper div[data-script-id]` 中选择最后一个已注册 ID；订阅并广播 `th_unique_check.MVU变量框架` | `util/script.ts:40`–`:47`、`:75`–`:79` | DOM 无匹配、其他实例占优、优先权事件未到达都在源码上可让资格不成立；未证明玩家触发。 |
| initPanel、initButtons 在 initGlobals 之前同步调用 | `src/main.ts:37`–`:39` | 发布前同步异常也是可达原因，尚无玩家对应异常。 |
| 启用时先 `_.set(window.parent, 'Mvu', mvu)`，再发 `global_Mvu_initialized`，不 await 此事件 | `src/function/global/index.ts:165`–`:176` | **Mvu 已赋值不代表旧 iframe 已收到事件通知。** 需另看对应 TavernHelper 的等待/事件实现。 |
| 发布后才 await 聊天 transition；transition 自身用 Promise 串行 | `src/main.ts:44`、`:54`、`:101` | 存在聊天切换队列；不是“所有 MVU 操作共用一个全局队列”的证据。 |
| 聊天初始化先 await 角色世界书配置，再 await initvar | `src/main.ts:131`、`:138` | 这些请求阻塞发生在全局发布后。 |
| 首楼所有 swipe 的 Promise.all 内 await VARIABLE_INITIALIZED，再 await updateVariables，完成后才调用 setChatMessages | `src/function/initvar/variable_init.ts:138`–`:197` | 不结束的监听器可卡住变量落盘，但通常此时 parent.Mvu 已存在。 |

## 远程依赖的实际边界

本机卡内入口为 `https://cdn.jsdelivr.net/gh/MagicalAstrogy/MagVarUpdate@61010dab47bc3a08a1b626320bf7fc8c9573eca4/artifact/bundle.js`。

实际 bundle 开头还静态 import `https://testingcf.jsdelivr.net/npm/.../+esm`：klona、@intlify/core-base、@intlify/shared、compare-versions、json5、jsonrepair、mathjs。主入口 HTTP 200 不足以证明这些子模块已经成功执行；任一子模块失败可阻止发布 Mvu。**这只是已确认的依赖路径，未证明玩家子模块请求失败。**

## bundle 与源码一致性

已在该固定提交实际 `artifact/bundle.js` 交叉检查：`/version` 请求、唯一实例 DOM 选择、should_enable 门、Mvu 赋值后发事件、之后建立聊天 transition 的顺序均一致。

- bundle SHA-256：`be149c7fb531c9f8755bde722931b3389ac8470218248fec12440d2b2a9b9c89`。
- 所有下载源码的固定 URL 与 SHA-256：`mvu-pinned-source/source-receipt.json`。
- 更完整的后续 initvar 分支记录：`mvu-init-path.md`。
- 官方固定源码：<https://github.com/MagicalAstrogy/MagVarUpdate/tree/61010dab47bc3a08a1b626320bf7fc8c9573eca4>。

## 证据边界

能据源码区分“发布前依赖未完成”“全局已发布但通知未到旧 iframe”“发布后变量初始化阻塞”；不能仅凭截图选择其中一个作为玩家根因。TavernHelper 等待机制与事件阻塞的本地复现实验应单独引用 `helper-wait-mechanism-report.json`，不能把该模拟故障当作玩家设备实测。
