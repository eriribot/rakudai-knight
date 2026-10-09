# 酒馆助手角色替换：启用状态条件复现

日期：2026-10-09。范围：公开上游源码与中性离线数据。未读取玩家配置、聊天或凭据，未替换角色卡，未改酒馆安装。现场玩家助手版本和开关状态未知，以下不能作为现场根因已确认的结论。

## 可执行结果

运行 `node scripts/正文气泡/验证记录/角色替换排查-20261009/helper/reproduce-enablement.mjs`。

脚本加载目录内固定 commit 的官方 `src/store/scripts.ts`，仅去掉 TypeScript 类型及模块绑定，在 Node VM 内执行真实 `createScriptsStore`。Vue/Pinia/Lodash 使用同步桩，因此覆盖启用判定，不覆盖宿主事件、弹窗或浏览器渲染。8 个场景全部通过，完整结果见 `reproduction-result.json`。

共同条件：原本已启用，单项脚本 enabled=true；替换后 avatar 保持不变，角色显示名从 Neutral Card v0.07 改成 Neutral Card v0.08。这是中性条件模型，没有加载真实角色卡。

| 官方版本 | 本卡白名单键 | 名称改变后总开关 | 单项开关 | 可执行候选数 |
| --- | --- | --- | --- | --- |
| 4.8.19 | name | true → false | 保持 true | 1 → 0 |
| 4.10.0 | name | true → false | 保持 true | 1 → 0 |
| 4.11.0 | avatar | 保持 true | 保持 true | 保持 1 |
| 4.11.3 | avatar | 保持 true | 保持 true | 保持 1 |

每个版本另外验证：如果新卡脚本条目自身 enabled=false，即使本卡总开关打开，候选数仍是 0。因此应区分本卡总开关与小手机条目开关。

结论可信度：源码条件结论高；玩家现场归因未确认。旧版按 name 保存许可，是名称带版本号的更新包导致手机停止的强候选。这条证据不解释 SillyTavern 原生正则，也不能断言玩家真的看到了开关被关闭。

## 版本界线

- 4.10.0 发布 bundle：`cd689ceae578282f35003c12be9752ff5386edd7`，2026-09-18 17:12:14 UTC。
- name → avatar 源码变更：`bf19f07d87a2a6723b124c9a400393bb14549053`，2026-09-21 20:51:54 UTC；此提交 manifest 仍写 4.10.0，不能据此称 4.10.0 发布版已修正。
- 4.11.0 发布 bundle：`360db45dff7e1c221ccc5e9d07d9445b179a1272`，2026-09-21 20:52:47 UTC（台北时间 9 月 22 日 04:52）。已确认采用 avatar 键。
- 检索时最新固定快照：`ed8b2360b32d9cfb96770d44e5c4ae45c2071a86`，manifest 4.11.3，2026-10-07。

版本日期来自官方 GitHub commit；manifest 文件已保存为快照。以上是发布 bundle 时间，不是已知玩家的安装时间。

## 生命周期与限制

替换文件入口监听下一次 CHAT_CHANGED，重新读取当前卡的 tavern_helper 设置，并忽略这次读取触发的保存。该入口没有无条件禁用所有脚本的代码。新卡自身脚本 enabled 值会随新设置生效。

旧版更名会让本卡总开关的 name 白名单匹配失败，但可能出现一次启用确认弹窗；用户确认能重新启用。因此离线结果是弹窗确认前、或未确认时的判定。弹窗代码先记录“已弹过”，再等待确认；取消后不会自动启用。这也解释为什么需要询问总开关和单项开关，而不能只问是否看到弹窗。

次要条件：4.11.x 的历史白名单迁移通过给旧 name 补 `.png`，没有按照实际 avatar 查找映射。若显示名与头像文件名不同，迁移后键仍可能不匹配。此处仅为源码条件推论，未归因为玩家现场。

## 精确官方来源

- [4.10.0 name 白名单与候选过滤，scripts.ts 55–92](https://github.com/N0VI028/JS-Slash-Runner/blob/cd689ceae578282f35003c12be9752ff5386edd7/src/store/scripts.ts#L55-L92)
- [4.11.0 avatar 白名单，scripts.ts 55–79](https://github.com/N0VI028/JS-Slash-Runner/blob/360db45dff7e1c221ccc5e9d07d9445b179a1272/src/store/scripts.ts#L55-L79)
- [4.10.0 替换入口刷新，character.ts 73–94](https://github.com/N0VI028/JS-Slash-Runner/blob/cd689ceae578282f35003c12be9752ff5386edd7/src/store/settings/character.ts#L73-L94)
- [4.10.0 启用弹窗，use_check_enablement_popup.ts 83–115](https://github.com/N0VI028/JS-Slash-Runner/blob/cd689ceae578282f35003c12be9752ff5386edd7/src/panel/script/use_check_enablement_popup.ts#L83-L115)
- [4.11.3 旧白名单迁移，global.ts 40–56](https://github.com/N0VI028/JS-Slash-Runner/blob/ed8b2360b32d9cfb96770d44e5c4ae45c2071a86/src/store/settings/global.ts#L40-L56)
- [name → avatar 源码变更](https://github.com/N0VI028/JS-Slash-Runner/commit/bf19f07d87a2a6723b124c9a400393bb14549053)
- [4.11.0 发布 bundle](https://github.com/N0VI028/JS-Slash-Runner/commit/360db45dff7e1c221ccc5e9d07d9445b179a1272)
- [4.10.0 发布 bundle](https://github.com/N0VI028/JS-Slash-Runner/commit/cd689ceae578282f35003c12be9752ff5386edd7)

## 最小现场判别信息

只需玩家提供助手版本、本卡脚本总开关、小手机条目开关、原生正则是否另有启用授权；若方便，再比对替换前后 name 与 avatar。没有这些信息时，应保留“条件复现成功，现场根因待证”的表述。
