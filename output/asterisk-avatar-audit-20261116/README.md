# 学战角色头像审计与补图 · 2026-11-16

范围为 `DLC/学战研究/` 的正式人物条目：38 个文件，合写条目拆人并去重后共 **44 人**。原先已接入 **23 人**，本次审计发现 **21 人**缺少已接入头像。人物正文偶尔提及的名字不计入，小说插图目录里有文件也不等于头像已经接入。

本轮补齐 **20 人**：**15 人使用动画正片截图，5 人使用动画官网表情设定图**。连同原有 23 人，头像覆盖 **43/44 人**；沙沙宫创一仍缺可验证人物脸。

可直接打开 [全部新增头像预览](http://127.0.0.1:18737/output/asterisk-avatar-audit-20261116/preview.html)。浏览器逐排核对 20 人均已载入： [上部截图](<E:/web/落第/output/asterisk-avatar-audit-20261116/preview.jpg>)、[下部截图](<E:/web/落第/output/asterisk-avatar-audit-20261116/preview-bottom.jpg>)。截图采用正式 01／03 规则并放大头像便于观察；不是酒馆实机截图。

本轮正文规则检查 **1137/1137** 通过，组件格式与源码/产物一致性检查通过。独立核验 **12/12**、终端打包检查 **9/9**、头像服务与身份绑定检查 **77/77** 通过；原有 23 人及 02 保持不变，20 个新头像已进入正文与实际 B1 联系人清单。记录见 [validation.json](<E:/web/落第/output/asterisk-avatar-audit-20261116/validation.json>)。

21 人逐项记录如下，按人物条目所在卷分组。优先正片脸部近景；没有合适近景时明确标注动画官网表情设定图。图片保存原始字节，不使用 AI 重绘；前端按 `portraitCrop` 取景，不改变原图人物。

| 所属条目 | 角色 | 来源类型 | 可核查来源 | 图文件 |
| --- | --- | --- | --- | --- |
| 第二卷 | 刀藤钢一郎 | 动画官网表情设定图 | [来源页](https://asterisk-war.com/character/others.html) · [原图](https://asterisk-war.com/assets/img/character/character_ph/kouichiro2.jpg) | [kouichiro-anime.jpg](<E:/web/落第/resource/asteriskavatars/kouichiro-anime.jpg>) |
| 第二卷 | 左近洲马 | 动画官网表情设定图 | [来源页](https://asterisk-war.com/character/allekant.html) · [原图](https://asterisk-war.com/assets/img/character/character_ph/shuma2.jpg) | [sakon-anime.jpg](<E:/web/落第/resource/asteriskavatars/sakon-anime.jpg>) |
| 第三卷 | 摩立兹·奈斯勒 | 动画正片截图（转载） | [来源页](https://otanews.livedoor.biz/archives/52038643.html) · [原图](https://livedoor.blogimg.jp/otanews/imgs/4/8/481659f4.jpg) | [moritz-anime.jpg](<E:/web/落第/resource/asteriskavatars/moritz-anime.jpg>) |
| 第三卷 | 葛尔特·席勒 | 动画正片截图（转载） | [来源页](https://otanews.livedoor.biz/archives/52038643.html) · [原图](https://livedoor.blogimg.jp/otanews/imgs/4/8/481659f4.jpg) | [gerd-anime.jpg](<E:/web/落第/resource/asteriskavatars/gerd-anime.jpg>) |
| 第三卷 | 沙沙宫创一 | 暂缺可验证头像 | [人物资料](https://asterisk.fandom.com/wiki/Sasamiya_Souichi) · [第10话声优记录](https://www.mau2.com/anime/gakusentosiasterisk/ep/10) | 未建替代图 |
| 第三卷 | 马迪亚斯·梅萨 | 动画正片截图（转载） | [来源页](https://totkuruma01.blogto.jp/archives/411506.html) · [原图](https://livedoor.blogimg.jp/animeda/imgs/2/b/2bbf12ba.jpg) | [mathias-anime.jpg](<E:/web/落第/resource/asteriskavatars/mathias-anime.jpg>) |
| 第四卷 | 列媞希亚·布兰查得 | 动画第12话正片截图（剧评转载） | [来源页](https://fapservice.com/gakusen-toshi-asterisk-fanservice-review-episodes-11-12/) · [原图](https://fapservice.com/wp-content/uploads/2015/12/Purrint228.jpg) | [laetitia-anime.jpg](<E:/web/落第/resource/asteriskavatars/laetitia-anime.jpg>) |
| 第四卷 | 天雾遥 | 动画正片截图（分集评论转载） | [来源页](https://otanews.livedoor.biz/archives/52048957.html) · [原图](https://livedoor.blogimg.jp/otanews/imgs/0/9/095f0fbe.jpg) | [haruka-anime.jpg](<E:/web/落第/resource/asteriskavatars/haruka-anime.jpg>) |
| 第四卷 | 宋（宋然） | 动画正片截图（转载） | [来源页](https://otanews.livedoor.biz/archives/52047810.html) · [原图](https://livedoor.blogimg.jp/otanews/imgs/c/5/c553ebeb.jpg) | [song-anime.jpg](<E:/web/落第/resource/asteriskavatars/song-anime.jpg>) |
| 第四卷 | 罗（罗坤展） | 动画正片截图（转载） | [来源页](https://otanews.livedoor.biz/archives/52047810.html) · [原图](https://livedoor.blogimg.jp/otanews/imgs/c/5/c553ebeb.jpg) | [luo-anime.jpg](<E:/web/落第/resource/asteriskavatars/luo-anime.jpg>) |
| 第四卷 | 梁濑咪子 | 动画正片截图（转载） | [来源页](https://fapservice.com/gakusen-toshi-asterisk-fanservice-review-episodes-11-12/) · [原图](https://fapservice.com/wp-content/uploads/2015/12/Purrint225.jpg) | [miko-anime.jpg](<E:/web/落第/resource/asteriskavatars/miko-anime.jpg>) |
| 第四卷 | 芳亭常 | 动画正片截图（转载） | [来源页](https://fapservice.com/gakusen-toshi-asterisk-fanservice-review-episodes-11-12/) · [原图](https://fapservice.com/wp-content/uploads/2015/12/Purrint224.jpg) | [tsune-anime.jpg](<E:/web/落第/resource/asteriskavatars/tsune-anime.jpg>) |
| 第四卷 | 芙萝拉·克蕾姆 | 动画官网分集场面图 | [来源页](https://asterisk-war.com/story/st14.html) · [原图](https://asterisk-war.com/assets/img/story/14/ep_slide02.jpg) | [flora-anime.jpg](<E:/web/落第/resource/asteriskavatars/flora-anime.jpg>) |
| 第四卷 | 赵虎峰 | 动画官网角色表情设定图 | [来源页](https://asterisk-war.com/character/jielong.html) · [原图](https://asterisk-war.com/assets/img/character/character_ph/zhao2.jpg) | [hufeng-anime.jpg](<E:/web/落第/resource/asteriskavatars/hufeng-anime.jpg>) |
| 第四卷 | 黎沈云 | 动画正片截图（分集评论转载） | [来源页](https://otanews.livedoor.biz/archives/52048957.html) · [原图](https://livedoor.blogimg.jp/otanews/imgs/2/5/250c97c2.jpg) | [shenyun-anime.jpg](<E:/web/落第/resource/asteriskavatars/shenyun-anime.jpg>) |
| 第四卷 | 黎沈华 | 动画正片截图（分集评论转载） | [来源页](https://otanews.livedoor.biz/archives/52048957.html) · [原图](https://livedoor.blogimg.jp/otanews/imgs/2/5/250c97c2.jpg) | [shenhua-anime.jpg](<E:/web/落第/resource/asteriskavatars/shenhua-anime.jpg>) |
| 第五卷 | 威尔纳 | 动画官网表情设定图 | [来源页](https://asterisk-war.com/character/lewolfe.html) · [原图](https://asterisk-war.com/assets/img/character/character_ph/wernher2.jpg) | [wernher-anime.jpg](<E:/web/落第/resource/asteriskavatars/wernher-anime.jpg>) |
| 第五卷 | 关 | 动画正片截图（角色资料站转载） | [来源页](https://otakotaku.com/character/view/4726/guen) · [原图](https://otakotaku.com/asset/img/character/2016/06/guen.jpg) | [guan-anime.jpg](<E:/web/落第/resource/asteriskavatars/guan-anime.jpg>) |
| 第五卷 | 席尔薇雅·琉奈海姆 | 动画正片截图（分集评论转载） | [来源页](https://fapservice.com/gakusen-toshi-asterisk-fanservice-review-episodes-11-12/) · [原图](https://fapservice.com/wp-content/uploads/2015/12/Purrint229.jpg) | [sylvia-anime.jpg](<E:/web/落第/resource/asteriskavatars/sylvia-anime.jpg>) |
| 第五卷 | 艾略特·佛斯达 | 动画官网第18话正片场景图 | [来源页](https://asterisk-war.com/story/st18.html) · [原图](https://asterisk-war.com/assets/img/story/18/ep_slide03.jpg) | [elliot-anime.jpg](<E:/web/落第/resource/asteriskavatars/elliot-anime.jpg>) |
| 第五卷 | 多洛提欧·雷姆斯 | 动画官网角色表情设定图 | [来源页](https://asterisk-war.com/character/gallardworth.html) · [原图](https://asterisk-war.com/assets/img/character/character_ph/doroteo2.jpg) | [doroteo-anime.jpg](<E:/web/落第/resource/asteriskavatars/doroteo-anime.jpg>) |

条目中的“宋”“罗”分别对应宋然、罗坤展，按同一人统计；保留“宋”“罗/羅”的精确对白别名，不重复计数。芳亭常对应动画解说员 Pham Thi Tram，与梁濑咪子同席。

沙沙宫创一未找到可验证的动画脸图：现有来源只确认第 10 话声音出场。此次保留缺图，未拿沙夜、声优照片或设备图代替人物。动画官网表情图也属于动画素材，但不冒充正片截图；本轮这 5 人为刀藤钢一郎、左近洲马、赵虎峰、多洛提欧和威尔纳。

交付文件：

- [01 姓名与台词](<E:/web/落第/scripts/正文气泡/发布/components/dialogue-bubbles.regex.json>)：识别新增人物及明确别名。
- [03 共享样式](<E:/web/落第/scripts/正文气泡/发布/components/dialogue-bubble-style.regex.json>)：学战人物六边形头像、逐人脸部取景。
- [B1 头像更新终端](<E:/web/落第/世界书规则/MVU/落第骑士-小手机-v1.3.29-B1-头像更新.json>)：同步人物头像与终端名单。
- [02 OC 姓名候选](<E:/web/落第/scripts/正文气泡/发布/components/dialogue-player-candidates.regex.json>)：已与本轮备份逐字节核对相同，不需要替换。

头像仍按人物作品显示：落第人物保留盾形，学战人物用六边形。终端换皮不改变人物归属、MVU 或剧情注入。只更新上述头像相关组件；未新建或替换世界书。

本轮仅在本地落盘和构建，**未导入酒馆，未 Git 提交或推送，未部署 Pages**。发布包中的图片地址为 `https://eriribot.github.io/rakudai-knight/resource/asteriskavatars/`；新增图片须随 Git 推送且 Pages 部署成功后，远程地址才能显示。

素材核对：20 个文件均存在，SHA256 与来源清单一致；20 个裁切框均在图片边界内，比例为 50:58。这些是本地素材检查，不代表酒馆实机或 Pages 远程显示已经验收。

审计依据：[原始缺图清单](<E:/web/落第/output/asterisk-avatar-audit-20261116/audit.json>)；[A 组](<E:/web/落第/output/asterisk-avatar-audit-20261116/group-a/group-a.json>), [B 组](<E:/web/落第/output/asterisk-avatar-audit-20261116/group-b/group-b.json>), [C 组](<E:/web/落第/output/asterisk-avatar-audit-20261116/group-c.json>), [关](<E:/web/落第/output/asterisk-avatar-audit-20261116/root-guan.json>), [最后 5 人](<E:/web/落第/output/asterisk-avatar-audit-20261116/root-extra.json>)。各清单保存来源、尺寸、裁切框、SHA256 和身份核验说明。原发布包备份在本目录 `before/`；临时检索图和来源页面分别保存在 `group-a/`、`group-b/`、`group-c/`、`root/`、`root-extra/`。
