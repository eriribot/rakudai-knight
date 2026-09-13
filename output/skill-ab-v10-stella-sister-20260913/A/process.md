# A 组首轮过程与自检

## 范围与授权

目标是用指定 `build-work-library` 技能，从唯一的第十卷输入自行辨认史黛菈的姐姐，形成可供角色扮演使用的世界书。身份定位结果为露娜艾丝·法米利昂。主技能固定于 TavernWeave v1.6.0 提交 `612c51980549e179bb73ead699aa1c37680db08e`。本次为首次单人物小样本，采用技能明确允许的人工少量 Markdown 记录加 reindex 路线。

已读 protocol 的 A0 目标、红线、验收回执，并实际读取快照 A0。只写 A/，不联网，不读其他卷、旧世界书、B/、review/ 或另一主技能，不另开 Agent，不安装、不推送、不接入实际酒馆。persona receipt 实际返回英梨梨主位、global-default；只影响表达。

## 实际读取与执行

直接读过的指导文件（相对于实验根目录）：

- protocol.md。
- skills/build-work-library/SKILL.md。
- skills/build-work-library/references/data-and-commands.md。
- skills/build-work-library/scripts/work_library.py（执行前读完代码；长输出分段补读）。
- skills/consult-tavernweave-library/SKILL.md。
- skills/consult-tavernweave-library/references/communication-and-guidance.md。
- skills/consult-tavernweave-library/references/st-guides/A0_驾驭工程从零搭建检查单.md。

输入为 inputs/volume10.utf8.txt、同行号的 volume10.numbered.txt 和 entry-template.json。用 `rg -n` 先查“姐姐|姊姊”，再查“露娜|艾丝|下任女王|第一公主|王太女”，展开人物相关上下文：家庭会议、初见与救助、婚约试题、广播、约翰回忆；另读卷末以确认阶段边界。共同文本为 102811 个 Unicode 字符、6363 行。采用人物定向采证，未声称逐字精读全部章节。

实验快照起初仅提供主技能和必要参考，检查时 consult 的 query-library.mjs 暂未提供。根代理随后补齐同一提交依赖，本组实际执行 `node …/query-library.mjs --skill build-work-library --intent 第十卷单人物原作资料与世界书 --write`，得到 routeIds=[build-work-library]、documents=[ST-A0]、candidates=[]、unresolved=[]、snapshotVersion=2026-08-18。暂缺属于实验准备过程，不是上游缺陷结论。

实际建库命令均使用 `C:/Python314/python.exe -X utf8` 和指定主脚本：

1. `init --project A/library`：成功，新建资料库，工具声明自身 modelCalls=0。
2. `add-source --project A/library --input A/source-input.json --text inputs/volume10.utf8.txt --chunk-chars 6000`：成功，冻结一份来源，18 个单元。
3. 手工编排 4 份资料，经 A/prepare_records.py 写成合规 Markdown：profile、relationship、event 为 confirmed；manner 将行为概括标为 inference。冻结出处含来源描述哈希、单元 ID、全文 Unicode 字符位置及逐字摘录。
4. `reindex --project A/library`：成功，返回 indexed=4。此步骤实际验证记录格式、来源哈希、引用位置、单元范围与阶段。
5. `query --query 露娜艾丝 --realm canon --continuity novel-main --as-of 10 --limit 10`：成功返回 4 份。首次直接工具输出被截断，因此 A/query_records.py 再执行并完整保存查询回执、以可读正文回读：露娜艾丝/10 命中 4 份，约翰/10 命中 2 份，战争/10 命中 2 份，露娜艾丝/9 命中 0 份。实际共执行主脚本 query 5 次，主脚本命令合计 8 次；没有执行 benchmark、plan、next、usage、commit 或 SQLite 导出。
6. A/compose_worldbook.py 从已查询的 4 份记录正文组合 3 条世界书，使用共同 JSON 字段模板；正文和证据表分开。A/evidence.json 的 entry_sources 保存被查询记录的 ID、路径、实际 Markdown 哈希。
7. 逐段人工语义自检，再实际运行 A/validate_and_freeze.py，结构结果见 self-check.json；随后冻结首轮，不接受审查反馈回写。

沙箱期间 3 个只读启动请求在实际执行前报 helper_sandbox_lock_failed；限定只读或 A/ 写入的 require_escalated 后续成功。未把这类启动失败当作技能执行结果。未使用网络和实际后台任务。

## 取舍与未能核实

明确区分“不反对交往”与无条件赞成婚事；保留她观察一辉、准备帮助他的两面行动；没有把她写成父亲包围网的发动者。父王试图瞒住她与她后来承认装作没发现企图分别保留其视角，没有视为不可调和矛盾。

约翰转述的“似乎从一个月前”保留转述者和似乎；约翰认为她可靠、难以对她强硬也保留约翰视角。没有从大学背景推算确切年龄；没有把一次巴掌补写成未经原文说明的固定惩戒制度。第一皇女仍是下任女王，婚约胜利条件仍未履行。

外貌只写淡桃色头发、红眼、知性美、小巧胸部，以及明确限定于初见场景的蕾丝内衣。未核实身高、确切年龄、发长/发型、眼镜、常服、体重、个人魔力等级、灵装与战斗技能，未填补。没有从亲近与同校推断露娜艾丝和约翰是恋人，也不把未知说成已经证实不存在。

阅读了本卷末奎多兰遭袭及后续叙述，但未找到露娜艾丝获知此事或如何反应的明确段落，故不向她的主观知识或行动补写这些内容。正文不是卷末所有事件梗概，也未覆盖与她不直接相关的战斗细节或插图。

资料阶段 `known_from=10` 在本库定义为第十卷结束。原文标题前有空格，脚本的实际分段结果中 18 个单元的 entry 都为 1；本次因此只验证第十卷末资料不会进入第九阶段，不声称建立了卷内章节级时间回放。

## 最终自检与冻结

自检完成时间（UTC）：2026-09-13T08:30:41.862380+00:00。

- 3 条 worldbook entries；正文合计 1053 个 Unicode 字符，其中汉字 934 个，均低于 3500。
- 26 项事实/行为概括；81 段连续摘录的行号、全文字符位置、原句和来源哈希逐一通过机器核验。2 项行为概括标为 inference；转述事实保留其原有限制。
- entry 键与 uid 一致；字段集合与模板一致；除 key/comment/content/order/uid/displayIndex 外均保留模板值；Markdown 正文与 JSON content 一致。
- 冻结文本与共同输入字节哈希相同；查询记录哈希与当前 Markdown 一致；JSONL 中记录与查询结果一致。
- 人工已复核每段正文的身份归属、用词、引文支持和阶段；这是本组自检，不冒充独立裁判结果。逐字引文核验不等同于自动语义证明。
- 未做真实 SillyTavern 导入、触发测试或角色扮演运行验收；本轮只交付可审查文件。

从实际 library init 时间到本次自检完成，间隔 600.438 秒。这是可观测的建库至自检区间，不是整个 Agent 任务耗时。宿主未提供此独立尝试的实际输入/输出 token 数，二者记为不可见/null；不估造 token 节省。`.state/state.json` 的模型 calls=0 是没有运行长批次账本，不代表本次 Agent 没有消耗模型 token。

人工可编辑正文为 library/records/*.md，派生索引为 library/index/records.jsonl；当前首轮四项交付的哈希记录于 frozen.json。后续如需修订，应另存，不覆盖本轮。A 首轮已冻结。
