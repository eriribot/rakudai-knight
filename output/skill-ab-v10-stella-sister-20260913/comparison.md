# 第十卷露娜艾丝世界书：两技能实际对比

本次对象是**露娜艾丝·法米利昂**，史黛菈的姐姐、法米利昂第一皇女与下任女王。

**本轮两组均找对人物，未检出无依据新增设定、原文矛盾或母亲外貌串用。B（dossier）保留的场景与动机背景更多；A（TavernWeave）正文更短，并实际完成了可重建的本地资料库。单凭此次结果，不能把 TavernWeave 判为幻觉更多，也没有依据认定它的世界书比 dossier 更可靠。**

若直接选择本题的人物世界书，我倾向 B：它保留了后文对“战争”实际性质的解释，以及一辉未挣脱的原因，对避免扮演时误读人物更有帮助。这是依据本轮具体正文作出的使用取舍，不是整个技能的胜率结论。

## 原始交付

| 项目 | A：build-work-library | B：character-visual-lore-dossier |
|---|---|---|
| 世界书正文 | [A/worldbook.md](E:/web/落第/output/skill-ab-v10-stella-sister-20260913/A/worldbook.md) | [B/worldbook.md](E:/web/落第/output/skill-ab-v10-stella-sister-20260913/B/worldbook.md) |
| 世界书 JSON | [A/worldbook.json](E:/web/落第/output/skill-ab-v10-stella-sister-20260913/A/worldbook.json) | [B/worldbook.json](E:/web/落第/output/skill-ab-v10-stella-sister-20260913/B/worldbook.json) |
| 逐项出处 | [A/evidence.json](E:/web/落第/output/skill-ab-v10-stella-sister-20260913/A/evidence.json) | [B/evidence.json](E:/web/落第/output/skill-ab-v10-stella-sister-20260913/B/evidence.json) |
| 实际过程 | [A/process.md](E:/web/落第/output/skill-ab-v10-stella-sister-20260913/A/process.md) | [B/process.md](E:/web/落第/output/skill-ab-v10-stella-sister-20260913/B/process.md) |
| 条目数 | 3 | 3 |
| JSON content 字符数 | 1053 | 1871（含 XML 标签） |
| 自列证据项 | 26 | 36 |
| 统一逐字、行号引文核验 | 81/81 通过 | 92/92 通过 |
| 共同 JSON 模板及 UID 核验 | 通过 | 通过 |
| 独立盲评的 20 项预定检查点 | 19 完整、1 部分、0 遗漏 | 19 完整、1 部分、0 遗漏 |

证据项与摘录数量只描述各自产物，不作为“更准确”的评分；字符数也不是实际模型 token 用量。

独立盲评回执见 [review/blind-review.md](E:/web/落第/output/skill-ab-v10-stella-sister-20260913/review/blind-review.md)。A 的部分覆盖为没有交代一辉为何不强行挣脱；B 的部分覆盖为没有写出差计划。核对员已检查两份全部正文，保持未揭盲后给出最终意见；回执由主代理据其回复落盘。这里没有把细节省略计成事实错误。

## 具体内容比较

### 两组都处理正确的关键点

- **身份与外貌没有串人。** 姐姐的淡桃色头发见 [原文 L5079](E:/web/落第/output/skill-ab-v10-stella-sister-20260913/inputs/volume10.utf8.txt:5079)，鲜红双眸见 [L5027](E:/web/落第/output/skill-ab-v10-stella-sister-20260913/inputs/volume10.utf8.txt:5027)。机场“身材娇小、金桃色波浪发”的女性在 [L2779](E:/web/落第/output/skill-ab-v10-stella-sister-20260913/inputs/volume10.utf8.txt:2779) 被明确介绍为母亲；两组都没有把这一组外貌挪给姐姐。
- **没有把不反对写成无条件赞成。** 两组均保留 [L5447](E:/web/落第/output/skill-ab-v10-stella-sister-20260913/inputs/volume10.utf8.txt:5447) 的态度限制，并写清婚事有条件。
- **胜利条件没有缩水。** [L5511–L5515](E:/web/落第/output/skill-ab-v10-stella-sister-20260913/inputs/volume10.utf8.txt:5511) 要求一辉赢过自己的对手，并为法米利昂带来整体胜利；两组均写出双条件，没有改成只赢一场即可。
- **转述视角与阶段保留下来。** 两组均把一个月前开始交涉的说法归给约翰，并保留“似乎”；也没有写成已经即位、已经取得战争胜利或已经举行婚礼。
- **没有补造数值与能力。** 两组均未填不存在于本次证据中的确切年龄、身高、灵装或骑士等级。

### B 比 A 多保留的两处实用上下文

1. **战争的实际性质。** A 写了争夺天然气田、五人团体战与胜场规则；B 继续保留 [L5832–L5838](E:/web/落第/output/skill-ab-v10-stella-sister-20260913/inputs/volume10.utf8.txt:5832) 的补充：两国有援助条约，实际是公开演习，并已变成国民联欢会。A 的名义规则有出处，不构成编造；B 的背景更充分，能帮助理解露娜原定的考验安排。B 明确称其为原定活动，未以此否认卷末发生的新危机。
2. **强势举动与战力不能混为一谈。** B 写明一辉没有挣脱，是担心伤到她，对应 [L5143](E:/web/落第/output/skill-ab-v10-stella-sister-20260913/inputs/volume10.utf8.txt:5143)。A 没写这个原因，但也没有据此宣称她的力量胜过一辉。因此是细节覆盖差异，不是 A 已经写错战力。

B 另保留了餐厅裙摆的场景证据，并明确不能扩写固定服饰；A 的场景服装集中在初见更衣。A 则保留了赴奎多兰出差的安排，B 只写她忙于战争前置工作。两份均为人物世界书取舍后的摘要，不能要求收进整卷所有相关句子。

## 验证与方法边界

- 依据用户提供的同一份第十卷 TXT 核查，检查的是对该底本文字的忠实程度，没有另校日文版或出版译本。原文件无损解码后只统一换行，正文未纠错或补写：102811 个 Unicode 字符，6363 行。
- A 固定为 TavernWeave v1.6.0 提交 `612c51980549e179bb73ead699aa1c37680db08e`；B 为用户本地技能及两个附件的原样快照。完整指纹见 [manifest.json](E:/web/落第/output/skill-ab-v10-stella-sister-20260913/manifest.json)。
- 使用两个不继承先前技能争论的独立 Agent，同一继承模型设置，唯一事实材料相同，禁止互读结果、旧世界书、其他卷和联网补设定。共同目标和 JSON 模板见 [protocol.md](E:/web/落第/output/skill-ab-v10-stella-sister-20260913/protocol.md)。
- 独立核对员在看到任何产物前冻结了 [20 项原文基准](E:/web/落第/output/skill-ab-v10-stella-sister-20260913/review/source-benchmark.md)，随后只看隐藏技能标签的 X/Y 正文和证据进行语义复核；主审另外逐段核对正文与差异。技能标签映射在评审员不可读的单独文件中。文风和结构仍可能提示工作方式，不能声称严格双盲。
- 有一项执行顺序差异：B 最初被安排做原文核对，已先检索部分原文，随后才接入 dossier；没有形成或读取裁判基准，也未看另一组。不能把这些先行阅读全部归功于 dossier。
- A 最小快照最初少带了附属 router 的四个依赖文件，实验准备阶段已从同一提交补齐；A 随后实际执行路由成功。这不是上游文件缺失，也未计作技能缺陷。
- A 实际完成 init、add-source、人工少量记录、reindex、query；本轮没有运行长批次，也没有导出 SQLite。B 按 dossier 方法直接整理人物与证据。双方都按共同协议做了自检，所以这不是撤掉一切共同约束后测量技能自身的独立因果效果。
- 首轮交付在语义评审前冻结；没有按裁判反馈改写参赛结果。原小说、规范化输入、技能快照和冻结产物均已核对哈希。机器检查见 [structural-validation.json](E:/web/落第/output/skill-ab-v10-stella-sister-20260913/review/structural-validation.json)。
- 逐字引用通过不自动证明解释正确；本报告另做了语义回查。结果只覆盖本人物、本卷、此次运行，不能推广为某技能永不幻觉或必然幻觉。
- 没有联网/图片能力测试，没有真实 SillyTavern 导入与触发测试，也没有可比的实际 token 总量。不会拿字符数或脚本账本的 calls=0 冒充模型费用。

两份 JSON 是本次可审查的候选世界书，保留原始结果供用户比较；没有覆盖项目正式世界书。
