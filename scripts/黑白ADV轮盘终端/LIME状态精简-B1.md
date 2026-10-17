# 主剧情 LIME 状态精简 B1

**2026-10-17 · 当前交付：** 安装仍使用 [B1 头像更新 JSON](../../世界书规则/MVU/落第骑士-小手机-v1.3.29-B1-头像更新.json)，组件 ID、显示名称和 v1.3.29 版号沿用。维护源码已合入 B1 的 LIME 精简、40 人头像、赛事预览与门禁、累计战绩补录及切卷预填与一次开始。已启用 [v4 字段约束](../../世界书规则/MVU/落第骑士-MVU-v4字段约束.json) 时同步替换，避免旧约束拒绝累计补录。原生 N04、开局 N06、世界书文本和历史存档沿用。

当前构建由本目录 `node build.js` 直接从维护源码生成 B1 头像更新包；根目录 `node scripts/build-knight-avatar-delivery.mjs` 统一处理终端与气泡头像交付。下方基线替换命令与离线指标保留为 2026-10-15 的历史记录，不用于重建当前修复包。本次没有实机导入；离线检查不能证明真实请求、写入和重载已通过验收。

**2026-10-16 头像同步记录：** 当时从原 B1 基线通过 `update-avatar-component.mjs` 更新内页头像目录、LIME 姓名别名和玩家头像的保留姓名表，以非头像内容指纹和 source map 检查保留 LIME 精简及赛事模块。原 B1 文件和该补丁方式作为历史保留；当前统一构建入口以上段为准。

## 安装

导入 [落第骑士-小手机-v1.3.29-B1-头像更新.json](../../世界书规则/MVU/落第骑士-小手机-v1.3.29-B1-头像更新.json) 到当前角色的酒馆助手脚本列表；已启用 v4 字段约束时一并替换上方约束文件。关闭对应旧组件，各仅保留一份启用，然后重载酒馆。原终端可保留作回退，完整步骤见 [QUICKSTART](QUICKSTART.md)。

保持已处理的 A 和现有 D 设置；本次未处理 C 的人物原文重复。导入后下一次正常剧情请求才会体现 B 的变化；旧提示词查看器缓存不会自动变小。

## 沿用的 LIME 精简范围

- 主角模式保留；玩家只附姓名、性别、所属。
- 场景只附当前卷、当前章、阶段、时间、地点，原有当前时间字段保留。
- 最近最多三位联系人的关系、态度印象、好感、支援度、羁绊阶段、恋爱阶段、已加联系方式、已知资料保留。
- 不在这段重复附带玩家能力、成长收据、场景历史、赛事账本等大块数据。完整主 MVU 仍提供这些状态，原存档没有删减。
- 显式 `null / false / 0 / ""` 保持原值；缺失字段保持缺失，不补默认状态或推算关系阶段。
- 人物世界书全文和来源、三联系人筛选、真实通讯、独立 LIME 发信、完整状态与分支一致性校验均不变。

## 2026-10-15 历史构建基线

以下记录原 B1 的 `component` 交付。当时只交付终端脚本 JSON，未修改或导入实机角色卡、世界书、预设、正则或聊天。[原 B1 JSON](../../世界书规则/MVU/落第骑士-小手机-v1.3.29-B1.json) 保留作历史基线。

实机 `落第骑士英雄谭v0.12.png` 内的终端 v1.3.29：

- 组件 ID：`3d8c6c23-f78e-46e5-8e89-4a90bab6fb85`
- 原 content SHA-256：`0eeadc635e76b49e71004c3c91b48da39c5fd86d149cce94a12399f9fe4e0d07`
- 脚本启用状态、按钮、data、export_with 以及未知元数据全部保留。
- 运行时版本保持 1.3.29；脚本显示名添加 B1，info 增加变更说明。

当时仓库默认构建版本为 1.3.28，且缺少实机的赛事页面模块，因此使用 `build-lime-story-component.mjs` 固定核对基线哈希，从内联 source map 找到旧 `lime-story.js`，唯一精确替换为当时维护的新源码，并重建相应来源映射。其他运行时代码、内嵌 HTML、头像资源和两个页面 source map 逐字保留。基线变化会阻止该历史补丁构建。

历史命令（BASELINE 为上述已核对 PNG 或其单独导出的 helper JSON；当前修复包使用文首的统一源码构建）：

```powershell
node scripts/黑白ADV轮盘终端/build-lime-story-component.mjs --baseline BASELINE --out output/lime-story-facts-b1
node scripts/黑白ADV轮盘终端/build-lime-story-component.mjs --baseline BASELINE --out output/lime-story-facts-b1 --write
node .agents/skills/sillytavern-component-update/scripts/validate-importable-component.mjs output/lime-story-facts-b1
```

第一条只检查与列计划，第二条写 UTF-8 spec、脚本、manifest 和 validation。发布文件是 staging 内 `terminal-v1-3-29-b1.script.json` 的原字节副本。维护源码为 `lime-story.js`，不手工修改已导出的 JSON。构建入口只读 baseline，没有实机写入路径。

## 2026-10-15 历史验证结果与边界

以下测试数量、产物检查和 token 对比均属于原 B1 交付，不是 2026-10-17 合并包的新验收结果。

五个 LIME 测试文件通过：Node test runner 119/119，其中聊天协议文件还包含 27/27 内部断言。主剧情 15 项覆盖大状态精简、完整人物原文和原状态不变、空值/缺失、取消、超时、切聊天及切回复页；独立发信 67 项通过。额外审查确认即使被省略的成长字段在读取期间改变，也会拒绝过期注入。

最终产物通过 JSON 组件契约、元数据保持、V8 语法、HTML 宿主解析、全部来源映射及非目标运行时字节一致性检查。这里是酒馆助手脚本，不经过正则 replacement 的 `$1/$&` 或实体解码管线。

同一实聊样本离线运行旧、新服务的实际 `prepare()`，使用最新 `stat_data`、同样三名联系人及世界书条目 UID 57/49/53；按已安装 Gemma tokenizer 计数：

| 内容 | 修改前 | 修改后 | 减少 |
| --- | ---: | ---: | ---: |
| LIME 状态补充 facts | 9,879 | 603 | 9,276 |
| 本服务完整人物提示块 | 17,326 | 8,050 | 9,276 |

人物原文逐字相同，输入状态未改。这是离线样本结果，不是新请求的实机计费数据；提示词查看器可能合并其他 depth 0 规则，不能把 17,326 当作截图中的 17,460。尚未实机导入、调用模型或证明下一轮请求总量。

组件构建采用 `sillytavern-component-update` 流程；资料路由回执：snapshot 2026-08-18，读取 A0、A2 的 helper 命名空间、A6 的 prompt/display 区别、B2 的提示注入段落。本次没有新增宿主 API。独立审查核对了源码和构建器，构建证据见 [validation.json](../../output/lime-story-facts-b1/validation.json)。
