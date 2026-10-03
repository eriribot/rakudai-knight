# 骑士人物头像

人物图片保留来源原档，身份、别名、来源、尺寸和 SHA-256 见 [manifest.json](./manifest.json)。终端按清单中的 `imageUrl` 使用图床地址；地址留空时内联本地图片，方便上传前预览。

## 图床地址填写位置

打开 [manifest.json](./manifest.json)，将上传后得到的 **HTTPS 图片直链** 填入以下字段：

| 素材 | 填写字段 | 上传的本地文件 |
| --- | --- | --- |
| 每个人物头像 | `characters` 中对应人物的 `imageUrl` | 有 `displayFile` 时上传该合成 PNG；否则上传 `file` |
| 共用透明盾框 | `shieldFrame.imageUrl` | `shield-frame.png` |

例如西京宁音记录里填入：

```json
"file": "nene.jpg",
"displayFile": "prepared/nene.png",
"imageUrl": "https://你的图床域名/knightavatars/nene.png"
```

`sourceUrl` 和 `sourcePage` 记录原始出处，不是填写图床的地方。`shield-mask.svg` 保持内联，无须上传。

填完地址后，在 `scripts/黑白ADV轮盘终端` 目录执行 `node build.js`，重新导入生成的 v1.3.11 JSON。执行 `node preview.mjs` 可更新离线预览。当前 `imageUrl` 均留空，继续展示本地素材；填写后构建不会下载图床图片，而是直接保留地址。

百度百科页面的浏览被网站安全政策阻止。这批图片改从独立的官方页面取得；GA 文库的彩色盾形图与提供的绫辻绚濑参考图属于同一套素材。

## 原版彩色曲边盾形图

来源：[GA 文库角色介绍](https://ga.sbcr.jp/sp/cavalry/chara.html)。原图包含日文人物名、盾形裁切与底部花饰，外侧为透明；官网未提供单独的空盾框素材。

| 人物 | 文件 |
| --- | --- |
| 黑铁一辉 | [ikki.png](./ikki.png) |
| 史黛菈·法米利昂 | [stella.png](./stella.png) |
| 黑铁珠雫 | [shizuku.png](./shizuku.png) |
| 绫辻绚濑 | [ayase.png](./ayase.png) |
| 东堂刀华 | [toka.png](./toka.png) |
| 黑铁严 | [itsuki.png](./itsuki.png) |
| 黑铁王马 | [ouma.png](./ouma.png) |
| 爱德怀斯 | [edelweiss.png](./edelweiss.png) |
| 诸星雄大 | [yuudai.png](./yuudai.png) |

## 缺少原版曲边盾框的人物

这六人的原黑白徽章继续存档，**终端已经改用[动画官方角色页](https://ittoshura.com/character/)的彩色设定图**，从中央大头或半身区域裁切，避开日文资料、能力图表及右侧重复立绘。原图没有曲边盾框，故来源仍标为 `hasShieldFrame: false` 与 `sourceStatus: missing-original-curved-shield`。完整合成图由 `displayFile` 指定，终端不再把旧六角徽章二次放大套框。

| 人物 | 原彩色素材 | 上传图床的合成头像 |
| --- | --- | --- |
| 有栖院凪 | [color/nagi.jpg](./color/nagi.jpg) | [prepared/nagi.png](./prepared/nagi.png) |
| 桐原静矢 | [color/kirihara.jpg](./color/kirihara.jpg) | [prepared/kirihara.png](./prepared/kirihara.png) |
| 仓敷藏人 | [color/kuraudo.jpg](./color/kuraudo.jpg) | [prepared/kuraudo.png](./prepared/kuraudo.png) |
| 兔丸恋恋 | [color/renren.jpg](./color/renren.jpg) | [prepared/renren.png](./prepared/renren.png) |
| 御祓泡沫 | [color/misogi.jpg](./color/misogi.jpg) | [prepared/misogi.png](./prepared/misogi.png) |
| 贵德原彼方 | [color/kanata.jpg](./color/kanata.jpg) | [prepared/kanata.png](./prepared/kanata.png) |

西京宁音的原近景来自 [AnimateTimes 角色介绍](https://www.animatetimes.com/tag/details.php?id=5494)「西京寧音（CV：井口裕香）」段落，继续保留原始 JPG。合成头像改用 [Bangumi 的西京寧音具名角色页](https://bgm.tv/character/35961)单人动画图，保留更完整的脸与发型；后者是社区角色页来源，不标成官方素材。黑乃与有里继续使用 AnimateTimes 具名角色图。

| 人物 | 本次合成使用的原图 | 上传图床的合成头像 |
| --- | --- | --- |
| 西京宁音 | [nene-fullbody.jpg](./nene-fullbody.jpg) | [prepared/nene.png](./prepared/nene.png) |
| 新宫寺黑乃 | [kurono.jpg](./kurono.jpg) | [prepared/kurono.png](./prepared/kurono.png) |
| 折木有里 | [yuri.jpg](./yuri.jpg) | [prepared/yuri.png](./prepared/yuri.png) |

## 算法裁切与合成

二十一张补框头像位于 `prepared/`，均为 434 × 580 透明 PNG。先从盾框 alpha 像素取最大的封闭透明区域作为盾口，排除外侧和花饰小孔；再使用每人的人工核验人物区域、眼部位置和脸部保护点，搜索等比例裁切窗口。合成图完整显示，人物不再被运行时二次缩放。暗亮主题只改变独立框层的颜色，不反转人物。

艾莉丝第11卷旗袍彩图以及新补四人的倾斜构图先调平眼线后裁切。凛奈的一侧眼睛被眼罩遮住，该定位点取眼罩覆盖的眼位中心，记录在 `orientation.landmarkNote`；未补画被遮住的眼睛。艾茵群像中的双眼倾角约46度，核实后仅对她配置 `maxLevelDegrees: 47`，其他人物仍默认45度核验范围。旋转后的候选裁切还须用不透明源像素覆盖整个盾口，并留出4像素重采样安全边，排除旋转产生的透明三角。`avatar-fit.json` 的 `levelEyes` 使用原图坐标，`window`、`eye` 与 `protect` 使用旋转后的画布坐标；清单 `preparation.orientation` 记录角度、画布尺寸及裁切坐标空间。原始小说 JPG 保留不变。

[contact-sheet.png](./prepared/contact-sheet.png) 是二十一人效果一览；[novel-contact-sheet.png](./prepared/novel-contact-sheet.png) 单独展示十一名使用 EPUB 小说插图的人物；[latest-contact-sheet.png](./prepared/latest-contact-sheet.png) 展示碎城雷、浅木椛、城之崎白夜和已有的诸星雄大。美琴使用用户提供的黑白人物图，不列入 EPUB 插图联系表。不要把效果一览当作人物头像上传。[preparation-report.json](./prepared/preparation-report.json) 记录实际裁切窗口与输出尺寸，清单的 `preparation` 记录源图和合成图哈希。

维护脚本：`scripts/黑白ADV轮盘终端/prepare-avatars.mjs`，定位配置：同目录 `avatar-fit.json`。重新裁切需 Node.js 与 sharp；已有本地 sharp 时执行 `node prepare-avatars.mjs`，也可用 `--sharp-module <已安装的sharp模块路径>` 指向工作区提供的依赖。正常构建直接读取已生成的 PNG，无须执行此脚本。

## 小说人物补充

前十一人的原始图片位元组由本地 EPUB 提取，存于 `novel/`；鹤屋美琴的黑白头像由用户提供，原始截图保留在研究素材目录。人物对应核对正文、具名图片与衣装，依据在 [character-evidence.json](./research/epub/character-evidence.json)。这十二人原图没有盾框，已按相同算法裁出各自的脸与头发，避开版面文字和旁边人物的脸部。

| 人物 | 原始图档来源 | 上传图床的完整合成图 |
| --- | --- | --- |
| 艾莉丝·阿斯卡里德（艾莉丝·格尔） | 台版第11卷 `OEBPS/Images/003_.jpg`，白底绿纹旗袍 | [prepared/iris.png](./prepared/iris.png) |
| 多多良幽衣 | 台版第12卷 `OEBPS/Images/003.jpg`，女仆装 | [prepared/uri.png](./prepared/uri.png) |
| 欧尔·格尔 | 台版第15卷 `OEBPS/Images/004.jpg`，**童年回忆形态** | [prepared/or_gaule.png](./prepared/or_gaule.png) |
| 华伦斯坦 | 台版第15卷 `OEBPS/Images/004.jpg`，同一彩图右侧人物 | [prepared/wallenstein.png](./prepared/wallenstein.png) |
| 药师雾子 | 台版第5卷 `OEBPS/Images/004.jpg`，具名原生彩图 | [prepared/kiriko.png](./prepared/kiriko.png) |
| 莎拉·布拉德莉莉 | 台版第6卷 `OEBPS/Images/005.jpg`，左上持画笔者 | [prepared/sara.png](./prepared/sara.png) |
| 风祭凛奈 | 台版第5卷 `OEBPS/Images/007.jpg`，**原黑白图的 AI 上色衍生图** | [prepared/rinna.png](./prepared/rinna.png) |
| 艾茵·阿伯伦特 | 台版第13卷 `OEBPS/Images/004.jpg`，左半金发人物下方的紫长发女子 | [prepared/ein.png](./prepared/ein.png) |
| 碎城雷 | 台版第9卷 `OEBPS/Images/007.jpg`，**小说黑白人物的 AI 上色衍生图，动画配色** | [prepared/rai.png](./prepared/rai.png) |
| 浅木椛 | 台版第9卷 `OEBPS/Images/003.jpg`，左下黑长发紫蝴蝶结少女 | [prepared/momiji.png](./prepared/momiji.png) |
| 城之崎白夜 | 台版第9卷 `OEBPS/Images/003.jpg`，左半中间黑发眼镜男子 | [prepared/byakuya.png](./prepared/byakuya.png) |
| 鹤屋美琴 | 用户提供的具名黑白头像，**灰金发 AI 上色衍生图** | [prepared/mikoto.png](./prepared/mikoto.png) |

凛奈使用内置 imagegen 上色：[novel/rinna-original.jpg](./novel/rinna-original.jpg) 保留第5卷黑白原档，[novel/rinna-colorized.png](./novel/rinna-colorized.png) 是编辑结果。淡粉红发与红褐眼色参考第18卷具名场景的头脸裁片，深红礼服依据第5卷正文；蝴蝶结深红属于本次上色选择。清单标明 `ai-colorized-derivative`，不视为官方原生彩图。[上色记录](./research/epub/rinna-colorization.json) 保存完整提示词、输入来源、输出尺寸和哈希。

碎城雷按用户要求使用小说线稿人物、动画配色，以内置 imagegen 上色。[novel/rai-original.jpg](./novel/rai-original.jpg) 是完整第9卷黑白原档，[novel/rai-original.png](./novel/rai-original.png) 是用户提供的原byte头像裁片，[novel/rai-colorized.png](./novel/rai-colorized.png) 是上色结果；三者分别记录SHA。[上色记录](./research/epub/rai-colorization.json) 保存完整提示词、动画截图配色参考和来源，不把生成图标成官方原生彩图。原小说制服的黑滚边与结构保留，没有增添动画截图的棕襟结构。

浅木椛与白夜使用同一张高清原彩页分别裁头像，身份另与具名PROFILE核对，详见 [三人身份证据](./research/epub/bukyoku-evidence.json)。`浅桦／淺樺` 作为本次用户称呼仅用于头像匹配，标准名仍为 `浅木椛`。浅木头像按要求保持缩放比例并右移，眼位从盾口横向27%调整到36%，同时保护OK绷；旋转后原图边界使本次裁切无法保留完整蝴蝶结。诸星雄大仍使用上述原版 `yuudai.png`，原图未被群像替换。

鹤屋美琴使用用户提供的黑白人物图，以内置 imagegen 上色。灰金色头发依据用户给出的描述，并与第5卷尾声正文核对；眼色与制服颜色尚无官方彩图核实，标为本次上色选择。原截图与 [color/mikoto-colorized.png](./color/mikoto-colorized.png) 上色结果分别保留，不把来源标成已核实的小说插图，也不把生成图标成官方原生彩图。[上色记录](./research/epub/mikoto-colorization.json) 保存完整提示词、输入来源和哈希。图床上传使用 [prepared/mikoto.png](./prepared/mikoto.png)。

目前共有 **30个人物头像 + 1张共用盾框，共31个图床文件**：九张原版盾形 PNG 与二十一张 `prepared/` PNG。研究联系表、小说原彩图、旧徽章、扫描索引不作为终端图床头像上传。

有栖院凪的 Alice 与后期 Iris 均曾被译作“艾莉丝”。裸 `艾莉丝／艾莉絲` 不绑定人物图片，保留姓名首字；请使用 `有栖院凪`、`有栖院艾莉丝` 或 `艾莉丝·阿斯卡里德`、`艾莉丝·格尔`、完整三段姓名。`Alice`、`爱丽丝／愛麗絲` 仍绑定凪；`Iris Ascarid`、`Iris Gaule` 绑定后期艾莉丝。裸 `黑骑士／黑騎士` 同样不作姓名替代，可使用 `黑骑士艾莉丝`。这里只消歧头像，原有聊天人物名不会被自动改写。

[EPUB 扫描说明](./research/epub/README.md) 记录22本书的图片索引与第5–19卷彩色参考图；[公开来源记录](./research/fandom/sources.json) 包含 Fandom 身份交叉参考、海空陆作者采访的具名黑甲图，以及尚待卷次核对的社区扫描候选。社区候选没有进入终端头像清单。

## 透明盾框

- [shield-frame.png](./shield-frame.png)：1085 × 1450，透明内外，仅盾边和卷草花饰。由内置 imagegen 根据用户提供的参考图提取，是衍生素材，不是官网原始空框。
- [shield-mask.svg](./shield-mask.svg)：从实际盾口逐行生成的精确遮罩；修正了旧近似曲线下半部过宽的问题。已合成头像不再二次使用遮罩。

## 尚无核实头像

日下部加加美、绫辻海斗尚未入库单人头像；此次使用的角色介绍页未收录两人的单人图片。两人记录在 `missingPortraits`，终端保留姓名缩写。此列表表示本地素材的收集状态，不表示这些人物没有头像，也不是全作品人物穷举。

所有素材均记录实际来源，未以封面、多人插图或其他角色头像代替缺图人物。图片与原作的著作权归各自权利人。
