# MVU 固定版本初始化路径取证

目标版本：`MagicalAstrogy/MagVarUpdate@61010dab47bc3a08a1b626320bf7fc8c9573eca4`。

取证对象为本机角色卡引用的固定提交源码及同提交 `artifact/bundle.js`。这是源码分层结论，不是玩家手机根因判定；未重启实机、修改业务源码或写入聊天。

## 关键结论

`parent.Mvu` 的发布在首楼 `stat_data` 初始化之前。卡内此版本不调用名为 `initializeGlobal` 的函数，而是在 `initGlobals()` 内直接赋值，再发 `global_Mvu_initialized` 事件。

因此必须区分两个故障位置：

1. **全局接口尚未发布**：remote module graph、版本请求、脚本唯一实例选择、面板/按钮初始化等发布前步骤未完成。
2. **接口已经发布但首楼变量尚未写入**：世界书读取、初始化事件监听器、变量更新事件监听器、swipe 处理或聊天更新未完成。

本次没有证据把所有可能性统称为“手机超时”，也没有证据认定存在一个贯穿所有 MVU 操作的全局队列。

## 发布前路径

以下路径相对于 `mvu-pinned-source/`。

| 步骤 | 固定源码位置 | 可停住或失败的条件 |
| --- | --- | --- |
| 模块依赖图 | `artifact/bundle.js` 第一行 imports | 主入口之外还静态导入 `testingcf.jsdelivr.net/npm/.../+esm` 的 klona、intlify、compare-versions、json5、jsonrepair、mathjs。任一模块网络或执行失败，入口不会继续。主 bundle HTTP 200 不能证明完整加载。 |
| DOM ready 回调 | `src/main.ts:23` | 模块必须先完成执行，才注册此回调。 |
| 酒馆助手版本 | `src/main.ts:25`，`util/common.ts:23` | await `getTavernHelperVersion()`；版本低只显示错误提示，没有主动 return；调用挂起或抛错会影响后续。 |
| store 初始化 | `src/main.ts:32`，`src/store.ts:305` | 配置解析或宿主调用同步异常可中断。 |
| 同源版本请求 | `src/main.ts:33`，`src/store.ts:373` | await `fetch('/version')`，无 AbortSignal 或代码级 timeout。reject 会回退 `1.0.0`；一直 pending 不会触发 catch。随后再次 await helper 版本。 |
| UI 初始化 | `src/main.ts:37`、`:38` | 先同步 `initPanel()`、`initButtons()`，随后才调用 `initGlobals()`。这里的异常可让发布未发生。 |
| 唯一实例优先权 | `src/store.ts:381`、`:389`，`util/script.ts:40` | `should_enable` 初始 false。监听 `th_unique_check.MVU变量框架`，用 `#tavern_helper div[data-script-id]` 里最后一个已注册脚本 ID 选择优先实例。无匹配 ID、另一个故障实例占优、该优先权回调未执行，都可能让当前实例不启用。这里只列条件，未认定玩家发生了其中某项。 |
| 发布 Mvu | `src/function/global/index.ts:165` | Vue watch immediate；仅 should_enable=true 时 `_.set(window.parent, 'Mvu', mvu)`，然后 `eventEmit('global_Mvu_initialized')`。这个 eventEmit 没有 await，且赋值在前。 |

## 发布后、首楼写入前路径

`src/main.ts:101` 才等待 `transitionToChat()`。该函数维护一个本模块的 Promise 串链（`:44`、`:54`），串行销毁旧聊天模块并初始化新模块；代次号淘汰过期切换任务。这是**聊天切换队列**，并不等同于所有操作共用同一队列。

聊天初始化顺序：

1. `main.ts:131` await `initCharacterSettingsOverride()`。它先读角色主世界书；`character_override/index.ts:201` await reload，最终到 `SillyTavern.loadWorldInfo()`。
2. `main.ts:138` await `initInitvar()`。后者 `initvar/index.ts:10` await `initCheck()`。
3. `initCheck()` 的 `variable_init.ts:69` await 世界书初始化数据读取。逐本 `getLorebookEntries()` 在 `:267`，没有 MVU 自己的请求超时。
4. 首楼会构造所有开场 swipe 的 `Promise.all`（`:142`）。每个 swipe 在 `:188` await `VARIABLE_INITIALIZED` 事件，在 `:191` await `updateVariables()`。
5. `updateVariables()` 还 await `VARIABLE_UPDATE_STARTED`、`COMMAND_PARSED`、Zod 后置事件、`VARIABLE_UPDATE_ENDED`。任一被调用监听器返回不结束的 Promise，就可阻止该 swipe 完成。
6. `Promise.all` 完成后，才调用 `setChatMessages()` 写首楼变量（`:138` 的参数求值先于调用）。因此某个 swipe 的监听器挂起，会让全部 swipe 尚未提交。
7. 首次 `initCheck()` 成功返回之后，`initInitvar()` 才注册 `GENERATION_STARTED`、`MESSAGE_SENT` 监听（`initvar/index.ts:12`、`:13`）。源码没有定时轮询重试。

其他明确的未写入情况：

- 欢迎页面、零条聊天、读取现有变量异常：`variable_init.ts:23`、`:31`、`:40` 提前返回。
- 无新增可读取世界书，或所有世界书读取/解析失败：`loadInitVarData()` 返回 false，`initCheck()` 在 `:126` 返回。世界书错误会输出日志/部分错误通知，而非无限等待。
- 初始化监听器抛错：聊天 transition 在 `main.ts:84` catch 并显示重初始化失败；已发布的 Mvu 不因该 catch 自动删除。
- 聊天切换队列的前一个任务永久 pending：后续 `.then` 任务不会到达。Mvu 全局已在建立该队列前发布。

## 与卡内建档页面的关系

卡内 `capture()` 先等 `waitGlobalInitialized('Mvu')`，随后同步检查当前楼层 `stat_data`。在宿主等待实现正常返回的情况下：

- Mvu 不存在：可以表现为一直“正在核对本局状态并提交档案…”；具体是否还受 TavernHelper 等待超时与事件实现影响，必须看对应 TH 版本源码。
- Mvu 已存在、stat_data 未写入：会显示“当前楼层没有 MVU 初始化数据，请先检查初始化通知”，并解除按钮 busy；不会因为 MVU 的 initvar 队列而直接等待其落盘。

## 来源与一致性

- 固定源码：<https://github.com/MagicalAstrogy/MagVarUpdate/tree/61010dab47bc3a08a1b626320bf7fc8c9573eca4>
- `artifact/bundle.js` SHA-256：`be149c7fb531c9f8755bde722931b3389ac8470218248fec12440d2b2a9b9c89`。
- 已在实际 bundle 核对 `/version` 请求、唯一实例 DOM 选择、Mvu 赋值后发事件，以及后续聊天 transition 顺序。
- 每个下载文件的固定 URL、SHA-256 见 `mvu-pinned-source/source-receipt.json`。
- `updateVariables()` 的上述事件调用另在既有缓存 `output/native-mvu-repair/native-core-update-variables.txt` 核对，其既有报告记录同一固定提交，SHA-256 `fdcb2d26b047c21eb7bff7432a57fe2f1b9ab8fa77db17e06fed54596520383a`。
