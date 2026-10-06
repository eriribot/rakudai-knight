# MVU 标签展示与识别修复

玩家原始 `json_patch` 有数据。旧展示正则漏识别 `update_analysis` 与 `json_patch`，但仍匹配整个外层 `UpdateVariable`，因此两个捕获组为空，画面只剩空框。旧规则还会跨相邻变量块捕获，丢掉第一块展示内容。

展示正则现在兼容标准和下划线标签，并把匹配限制在同一完整外层块。纯未知或不完整块保留原文，避免变成空壳。标题沿用维护源中的“本轮变量输出”；旧截图里的“变量已同步”是静态文案，不能验证实际保存。

## 安装

1. 角色正则：用 [variable-display.regex.json](components/regex/variable-display.regex.json) 替换“伐刀者战术终端·变量折叠”。维护源 ID 为 `e0b51684-257a-422a-a9f8-rakudai00001`，旧卡可能为其他 ID；先停用或移除旧的同名显示规则，再保持一份新规则。保留“提示词修剪·清理历史变量”。
2. 小手机：用 [phone-v1-3-15.script.json](components/helper/phone-v1-3-15.script.json) 替换现有版本，只启用一份。
3. 使用约束时更新 [guard-v4-tags.script.json](components/helper/guard-v4-tags.script.json)。关闭约束的玩家无需为此重新开启它。
4. 重载酒馆后重新显示原始回复，确认分析与完整补丁可见。N01 与开局控制器沿用上一轮安装，本次不自动重放旧漏写补丁。

小手机和可选约束同步接受 `JSONPatch` / `json_patch` 的大小写变体，仍拒绝重复、混配、半截标签及非数组补丁；保存事件、当前楼层与回复页、并发比较和回读要求保持原样。规范输出仍使用 `Analysis` / `JSONPatch`，不从分析文字构造操作。

## 验证范围

本轮 95/95 项检查通过，三个独立组件结构验证通过；计数与边界见 [verification.json](verification.json)。展示用例为 18/18，保存来源检查为 33/33，固定上游核心执行为 7/7。它们不代替玩家实机验收。

执行 `node scripts/check-mvu-tag-compat.mjs --prepare` 检查写入计划，再执行 `--write` 生成三个独立组件。测试覆盖标准、下划线、混合大小写、实际空数组、长补丁、相邻块、半截块，以及 prompt、placement、depth 条件。历史清理规则与显示元数据逐字段比较保持原样。

`node scripts/check-mvu-native-core.mjs` 执行固定 MVU 61010dab 核心源码，确认该版本支持 `json_patch`，也确认混配开闭标签不会写入。宿主与事件为替身，不验证玩家当前实际安装版本及保存持久化。

`node scripts/黑白ADV轮盘终端/correction-readiness-test.mjs` 验证本轮来源、标签兼容和保存门禁；`node scripts/check-tournament-guard.mjs` 验证可选约束与选拔赛流程。网络、时钟或宿主替身的边界以各报告为准。

只输出组件，未重打包全卡、未修改玩家聊天。玩家实机导入、其他正则的顺序以及当前 swipe 的 `stat_data` 回读仍待验收。仅凭展示空白或静态标题不能判定真实保存。
