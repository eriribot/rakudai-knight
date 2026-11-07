# 本机实际角色卡的首楼初始化监听器核对

取证卡：`F:/SillyTavern-Launcher/SillyTavern/data/default-user/characters/落第x学战v0.01.png`，读取 `ccv3` 中 `extensions.tavern_helper.scripts`。脚本启用状态、SHA 与命中代码行见 `enabled-script-listener-report.json`。以下行号均指卡内对应脚本 content，不是工作区当前源码。

**结果：没有找到本卡已启用脚本在 MVU 初始化回调中再次等待 Mvu/楼层数据的环。** 不将这个结果外推到玩家安装的其他全局脚本或扩展。

| 实际脚本 | 证据 |
| --- | --- |
| N04/W02 原生兼容，启用 | 239 行在安装入口 await waitGlobalInitialized；254、258、277 行才注册 STARTED / COMMAND_PARSED / ENDED。回调均同步，不 await Mvu，不等待落盘。305 行使用 `void installRakudaiNativeMvu(window)`，不是顶层 await。 |
| 卷章剧情注入器，启用 | 580 行发起 wait 并挂 catch，后续代码继续；不注册 VARIABLE_INITIALIZED、STARTED 或 ENDED。 |
| 字段与卷章约束，停用 | `enabled:false`，本次不能作为实际运行的初始化阻塞来源。 |
| 世界书差异更新器、EJS 作用域修复，启用 | 只注册各自显式按钮事件，未注册 MVU 初始化/更新事件。 |
| 终端内置 native，启用 | 1144 行在安装入口等待，1159、1163、1182 行注册同步回调。6755 行以 `.then` 处理安装结果，不顶层 await。 |
| 终端副校正监听，启用 | 5966 行 COMMAND_PARSED、5981 行 ENDED 均同步；6014 行 wait 位于监听安装阶段，未置于回调内。回调中的 resumeCorrectionWait 仅唤醒后续处理，回调没有返回该处理的 Promise。 |
| 终端状态控制器 | 2527 行的 wait 在 capture 操作入口；调用来自用户编辑、赛事、宿舍、章节等操作，不是首楼 MVU 初始化事件的处理函数。 |

所有上述本卡脚本中，**VARIABLE_INITIALIZED / mag_variable_initialized 的监听数量为 0**。

## 可重复的隔离探针

运行：`node output/playwright/init-repro-20261107/enabled-script-listener-probe.mjs`。

- 直接执行 PNG 内独立 N04 脚本。
- 单独提取并执行终端实际 native installer，使用独立 N04 的工具函数支架；不声称执行完整终端。
- 每份安装器在 wait 未完成时注册 0 个 MVU 监听器；完成后注册 3 个。
- 两份安装器各以中性/落第初始化变量触发 STARTED、COMMAND_PARSED、ENDED：总共 **12 次真实回调**均同步返回。
- 每份安装器 wait 调用总数为 **1**；事件回调没有新增 wait。
- 独立 N04 和终端 installer 有 3 行差异（终端 H01 标记与学战字段保护范围），已写入报告；没有把它们误称为完全相同。
- PNG 前后 SHA 不变；没有真实聊天写入。

## 对旧宿主等待行为的含义

如果某个 TavernHelper 版本要求最新楼层先有 stat_data 才完成 wait，上述安装器会推迟绑定这些兼容监听器；它们不会因为“已绑定的初始化回调又等 stat_data”形成所怀疑的环，因为绑定发生在 wait 之后，且回调不再次等待。

第 0 楼变量 `{}` 能说明该页没有变量落盘，不能单独判定原因是该等待规则、MVU 首次初始化失败、远程依赖、世界书读取，还是其他扩展。旧宿主精确谓词/超时策略需与玩家版本匹配；本探针不模拟或认定玩家版本。
