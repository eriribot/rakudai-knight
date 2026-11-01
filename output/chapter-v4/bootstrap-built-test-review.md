# 剧情注入器宿主适配离线验收

结果：23/23 项通过。

VM 加载玩家导入产物：世界书规则/MVU/落第骑士-卷章剧情注入器-v3.0.0.json。宿主、父 iframe 和脚本 iframe 同时提供 SillyTavern；模拟 TH 按 iframe 安装 MVU 动态 getter 的等待接口。事件常量按项目固定 TH 4.9.5 / ST 1.18 证据定义。没有连接实机或发送模型请求。

| 场景 | 结果 |
|---|---|
| TH iframe 也有 SillyTavern 时仍向最外层宿主发布唯一 API | PASS |
| MVU 后加载时每个 iframe 的 wait 安装动态 getter，预览恢复真实卷章 | PASS |
| 跨 iframe 热重装移除旧监听，旧 pagehide 不会删除新 API | PASS |
| 实际事件总线仅形成一次候选和一次尾确认，启动不发送模型请求 | PASS |
| TH START 实际常量触发撤回，缺 END 后下一原生主生成仍可确认 | PASS |
| 卸载撤回未确认候选，所有事件监听解除且不改聊天存档 | PASS |
| MVU 等待尚未完成即卸载，迟到就绪不会重新安装监听 | PASS |
| 初始预览只读且保留等待主生成状态，两种 dryRun 标志均有效 | PASS |
| 奇偶助手楼层分别追加 user 与新增尾消息，只在本次请求注入 | PASS |
| 奇偶位置均清理请求中的旧完整剧情块，保留消息对象与非剧情文本 | PASS |
| dryRun 在 before-prompt 不取消正式生成，两种奇偶位置均保留 | PASS |
| dryRun 在 candidate-ready 不取消正式生成，两种奇偶位置均保留 | PASS |
| dryRun 在 prompt-budget 等待中不能撤回正式剧情 | PASS |
| dryRun 在 settings-budget 等待中不能撤回正式剧情 | PASS |
| 预览不覆盖正式注入成功或预算失败的记录 | PASS |
| 默认生成类型与 normal 语义一致，空类型不会在发送前被撤回 | PASS |
| continue 与 normal 不混淆，quiet 与未知后台仍没有剧情 | PASS |
| 奇偶候选撤回保留其他监听器追加到同一消息的正常文字 | PASS |
| 奇偶候选均使用独立顺序快照，源数组原地重排不能获得发送确认 | PASS |
| 宿主先浅复制请求再取消，两种奇偶位置都不遗留旧剧情块或空 user | PASS |
| 撤回只清理注入器新建消息，原有空 user 即使被追加剧情也保持原对象 | PASS |
| 独立 user 转为 text parts 后撤回，保留额外文字并删除纯剧情尾消息 | PASS |
| getStatus.reason 公开修订号，旧终端只读取 reason 也能核对实际实例 | PASS |

仍须实机确认终端读取最外层 API、实际 MVU 初始化顺序及旧脚本停用后的监听清理。

