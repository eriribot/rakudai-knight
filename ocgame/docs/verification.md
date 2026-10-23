# OC Demo 验证记录

日期：2026-10-23。范围：独立本机网页，无 MVU 或 SillyTavern 宿主集成。

## 结果

- `node --check`：`app.js`、`engine.mjs`、`serve.cjs` 通过。
- `node --test ocgame/engine.test.mjs`：7 项通过；三种武器均有可胜出的完整回合路径，牌数与唯一 ID 守恒，正常回收弃牌。
- 实际 Chromium 浏览器：两份脚本合计 57 项检查通过，无捕获到的 JavaScript 异常。
- `check-ui.js`：27 项，包括改名／武器设置持久化、卡牌伤害与消耗、防御、支援限制、动作三个组成部分、途中重开、减少动态效果、手机卡面。
- `check-finish.js`：30 项，包括六种尺寸的页面几何、实际点击完成胜利与失败、结算重新开始。
- 人工看图检查：桌面、1024 × 768、390 × 844、绚濑完整卡面和手机展开卡。
- 自动检查不代替用户对角色还原度、卡面和动作手感的评价；本轮未记录用户对新 Demo 的最终视觉验收。

## 动作实测

浏览器逐帧采样持续约 1151 ms，共 262 个采样点。观察到 `cut` 姿势、两个人物残影和入镜斩光；结束时回到 `ready`，残影与斩光消失。挥砍姿势首末采样间隔约 173 ms，包含挥砍与归位两段。所有采到的角色变换矩阵缩放均为 1，只有整个人物的位移。

完整动作的代码预算为 275 ms；敌方回合另有两端各 240 ms 的意图与结果停留，便于看清数值。没有将回合停留误记为挥剑持续时间。

## 布局

检查尺寸：1024 × 768、1440 × 900、1920 × 1080、768 × 900、360 × 760、390 × 844。

每个尺寸均检查：页面无横向溢出、人物顶部低于状态栏、行动点与玩家状态区分开、角色台词位于手牌计数上方。手机手牌在自身区域横向滚动。小于 780 px 的手机窗口允许页面纵向滚动。

## 可复查文件

- `output/playwright/ocgame/check-ui.js`
- `output/playwright/ocgame/check-finish.js`
- `output/playwright/ocgame/desktop-final.png`
- `output/playwright/ocgame/mobile-final.png`
- `output/playwright/ocgame/tablet.png`
- `output/playwright/ocgame/ayase-card.png`
- `output/playwright/ocgame/mobile-card.png`
- `output/playwright/ocgame/victory.png`

两张新美术的生成原件及参考来源见 `assets/manifest.json`，PNG 原始像素未通过脚本修改。史黛菈用 CSS 图集窗口与共享像素比例注册，所有斩击效果由页面单独绘制。
