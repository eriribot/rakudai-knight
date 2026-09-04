# 开局页面数据契约

## 1. 目标

本契约约束《落第骑士英雄谭》第一卷开局页面原型的数据源与状态边界。它不是 SillyTavern 的世界书 schema，也不声明任何 MVU/Tavern Helper API。

## 2. 档案字段

`profiles.json` 顶层字段：

- `schema_version`：当前数据源版本。
- `axis_order`：固定六轴顺序：攻击力、防御力、魔力量、魔力控制、体能、运气。
- `grade_values`：允许的字母等级 A–F。
- `profiles`：档案数组。

每个档案：

- `profile_id`：稳定的页面档案 ID，不是 SillyTavern UID。
- `type`：`canon` 或 `custom`。
- `name`、`romanized_name`、`subtitle`：显示字段。
- `school`、`class`：学校/班级；只填写作者源有依据的内容。
- `blazer_rank`：伐刀者等级 A–F 或 `null`；它独立于六轴。
- `title`、`device`、`noble_art`：称号、固有灵装、伐刀绝技。
- `traits`：第一卷可见的定性特征。
- `limits`：第一卷边界与不可误写提醒。
- `radar`：六轴到 A–F/`null` 的映射；`null` 表示原文未给出。
- `source_fragments`：`MAT-001#Lx-Ly` 稳定来源片段。

## 3. 雷达图归一化

页面用 `A=1.00、B=0.85、C=0.70、D=0.55、E=0.40、F=0.25` 的等距视觉半径绘制多边形；这个映射只服务于视觉比较，不是原文数值、百分比或战力计算。`null` 不绘制为 0，而显示为“待评定”并在雷达图上标出缺失轴。

不能从伐刀者等级、称号、属性相克、校内排行或比赛结果倒推六轴。特别是 F 级不等于实战无能，剑术/体术/观察等能力留在定性说明中。

## 4. 状态所有权

```text
profiles.json / 作者源
        ↓ read-only
active profile + draft form
        ↓ derive
radar / axis details / preview text
        ↓ explicit local save only
localStorage draft (schema_version=1)
```

- 档案数据是静态事实/模板，不由页面编辑。
- 表单是可撤销 draft；输入不写聊天、世界书或 MVU。
- SVG、六轴明细与预览是派生视图，必须由同一份 `currentRadar()`/`draftData()` 生成。
- 本机保存只保存草稿，不能视作游戏持久化。
- 复制是文本导出，不是发送；页面不执行 `triggerSlash`、`send_text_to_input`，不调用 `generateRaw`。

## 5. 事实状态

- `canon` 档案的字段必须能回指第一卷 `MAT-001`。
- `custom` 档案的六轴和定性文本是玩家草稿，不会自动升级为正典。
- 第一卷 `proposed` 时间连接、`rumor` 传闻、`foreshadow` 学生会伏笔不进入基础档案的硬字段。
- 外部联网资料和第二卷及以后 TXT 不作为本页面事实入口。

## 6. 安全与失败

- 动态文本只通过 `textContent` 或 DOM 节点写入；不把用户输入拼入 `innerHTML`。
- `profiles.json` 读取失败时只退回空白自定义模板，不用危险默认值覆盖档案。
- 导入/恢复数据须通过版本、类型、长度和枚举校验；坏草稿不覆盖当前页面。
- 当前页面无远程请求、iframe、EJS、动态执行、外部字体/图片或第三方库。
- 未来接入宿主时必须另建适配层，并单独验证发送确认、初始化写入、切聊天/重载和清理生命周期。
