# 玩家自填开局 · 中文 MVU

当前字段契约以本目录为准。`stat_data` 是 MVU 的固定容器；容器内的字段名、主角模式和状态文字均使用中文。页面内的表单 ID、评级函数和 v2/v3 档案 JSON 沿用原格式，导入旧档案后仍能生成中文变量。

## 世界书条目

- `[initvar]变量初始化`：内容使用同名 YAML 文件，**不要再套一层 stat_data**。保持条目禁用，MVU 按标题标记读取初始化数据。初始人物资料为空，等待玩家填表。
- `变量列表`：保留 `{{format_message_variable::stat_data}}` 宏，显示出的业务字段来自中文变量树。
- `变量更新规则`：内容使用同名 TXT 文件，设为常驻启用。规定玩家档案、原作身份和场景的写入范围，以及 MVU JSONPatch 输出格式。

## 页面与变量

`readOpeningDraft()` 读取表单，`buildOpeningVariables()` 生成中文的“系统、玩家”对象。它重用现有初评算法，忽略导入文件缓存的评级。开局消息附带该对象，交给当前卡的 MVU 更新协议处理；预览、填表、复制和本机保存不会写聊天变量。场景不在建档对象中，避免重新建档清空已有时间和地点。

| 原内部路径 | MVU 中文路径 |
|---|---|
| meta.schema_version / opening_status / profile_key | 系统.结构版本 / 开局状态 / 主角模式 |
| scene.volume / time / location | 场景.当前卷 / 时间 / 地点 |
| profile.name / personality / conduct / school | 玩家.姓名 / 性格关键词 / 处事风格 / 所属 |
| profile.device / nobleArt / category | 玩家.固有灵装 / 伐刀绝技 / 能力系别 |
| profile.desc / ability / limits / style | 玩家.角色简介 / 能力机制 / 限制与代价 / 战斗风格 |
| profile.stats.attack / defense / magic / control / physical / luck | 玩家.六维.攻击力 / 防御力 / 魔力量 / 魔力控制 / 体能 / 运气 |
| profile.rating.rule / score / base / proposed / status / missing | 玩家.综合初评.规则版本 / 分数 / 等级 / 拟定登记等级 / 评定状态 / 待填写项 |
| profile.registered_rank | 玩家.登记等级 |

`null` 保持未知，空字符串保持未填写；初评分数、字母等级和原作一辉 F 级不因汉化改变。自定义角色不会自动取得已登记等级。

## 已有聊天

修改 InitVar 只改变后续初始化模板，不会自动迁移已经初始化的旧楼层。已有英文变量须按上表迁移原值，并把 awaiting_profile / awaiting_axes / calculated / canon 分别改为待建档 / 待填写六维 / 已计算 / 原作档案；profile_key 的 user / kurogane 分别改为自定义角色 / 黑铁一辉。不得用空模板覆盖已填写人物或已发生的场景。普通新聊天直接采用中文模板。

迁移时同时检查 `display_data`、`delta_data` 及已推导 `schema.properties` 中对应的业务路径；MVU 自身的 `type`、`properties`、`required` 等结构关键字仍保留英文。不要只改显示缓存而留下英文 `stat_data`，也不要只改数据而留下旧路径约束。

## 验证

`node scripts/check-opening-mvu.cjs` 检查中文字段、完整与未完成建档、两种角色模式、未知值、评级和旧档案兼容边界。评级回归与酒馆正则传输分别使用既有 `check-opening-rating.cjs` 和 `check-opening-regex-transport.cjs`。这些静态检查不等同于 AI 实际输出与宿主 MVU 更新已经验收。

本次本地检查和「测试」角色的同步范围见 [核验记录](核验记录.md)。
