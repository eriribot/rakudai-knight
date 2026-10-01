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

九张补框头像位于 `prepared/`，均为 434 × 580 透明 PNG。先从盾框 alpha 像素取最大的封闭透明区域作为盾口，排除外侧和花饰小孔；再使用每人的人工核验人物区域、眼部位置和脸部保护点，搜索等比例裁切窗口。合成图完整显示，人物不再被运行时二次缩放。暗亮主题只改变独立框层的颜色，不反转人物。

[contact-sheet.png](./prepared/contact-sheet.png) 是九人效果一览；不要把它当作人物头像上传。[preparation-report.json](./prepared/preparation-report.json) 记录实际裁切窗口与输出尺寸，清单的 `preparation` 记录源图和合成图哈希。

维护脚本：`scripts/黑白ADV轮盘终端/prepare-avatars.mjs`，定位配置：同目录 `avatar-fit.json`。重新裁切需 Node.js 与 sharp；已有本地 sharp 时执行 `node prepare-avatars.mjs`，也可用 `--sharp-module <已安装的sharp模块路径>` 指向工作区提供的依赖。正常构建直接读取已生成的 PNG，无须执行此脚本。

## 透明盾框

- [shield-frame.png](./shield-frame.png)：1085 × 1450，透明内外，仅盾边和卷草花饰。由内置 imagegen 根据用户提供的参考图提取，是衍生素材，不是官网原始空框。
- [shield-mask.svg](./shield-mask.svg)：从实际盾口逐行生成的精确遮罩；修正了旧近似曲线下半部过宽的问题。已合成头像不再二次使用遮罩。

## 尚无核实头像

日下部加加美、绫辻海斗尚未入库单人头像；此次使用的角色介绍页未收录两人的单人图片。两人记录在 `missingPortraits`，终端保留姓名缩写。此列表表示本地素材的收集状态，不表示这些人物没有头像，也不是全作品人物穷举。

所有素材均记录实际来源，未以封面、多人插图或其他角色头像代替缺图人物。图片与原作的著作权归各自权利人。
