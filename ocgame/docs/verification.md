# OC Demo 验证记录

日期：2026-10-23。范围：独立本机网页，包含轻小说封面×彩插风 UI 与自定义固有灵装三轴 Build 引擎，无 MVU 或 SillyTavern 宿主集成。

## 结果

- `node --check`：`app.js`、`engine.mjs`、`serve.cjs` 通过。
- `node --test ocgame/engine.test.mjs`：**11 项全部通过**；涵盖基础护盾与行动点、三种武器形态、四大伐刀异能系别（看破／残火／爪痕／幻影）、四类灵装回路契约、局内手牌词条铭刻（`evolveCard`）、伐刀绝技解放（`useNobleArt`）、牌数与唯一 ID 守恒及完整胜负路径。
- 实际 Chromium 浏览器：三份脚本合计 **69 项检查全部通过**，无捕获到的 JavaScript 异常。
  - `check-ui.js`：27 项，包括改名／武器设置持久化、卡牌伤害与消耗、防御、支援限制、动作三个组成部分、途中重开、减少动态效果、手机卡面。
  - `check-finish.js`：30 项，包括六种尺寸（1024×768、1440×900、1920×1080、768×900、360×760、390×844）的页面几何、实际点击完成胜利与失败、结算重新开始。
  - `check-build.js`：12 项，包括三轴灵装锻造与一键 OC 流派预设（`crimson_dragon`／`worst_blade`）、流派主题切换、局内「临场变招·词条铭刻」弹窗与手牌 `★连斩` 徽章渲染、灵装同调率蓄满后解放「伐刀绝技」斜切 Cut-in 特写及穿透高伤结算。
- 人工看图检查：桌面（`desktop-final.png`）、平板（`tablet.png`）、手机（`mobile-final.png`）、绚濑完整卡面（`ayase-card.png`）、灵装锻造台（`custom-forge.png`）、剑技推演词条铭刻（`evolve-modal.png`）、伐刀绝技解放特写（`noble-cutin.png`）与胜利结算（`victory.png`）。

## 动作实测

浏览器逐帧采样观察到 `cut` 姿势、两个人物残影和入镜斩光；结束时回到 `ready`，残影与斩光消失。所有采到的角色变换矩阵缩放均为 1，只有整个人物的位移。

完整动作的代码预算为 275 ms；敌方回合另有两端各 240 ms 的意图与结果停留，便于看清数值。伐刀绝技解放时额外展示斜切特写横幅（`#cutin-banner`），在 `prefers-reduced-motion: reduce` 模式下自动缩短停留时间。

## 布局

检查尺寸：1024 × 768、1440 × 900、1920 × 1080、768 × 900、360 × 760、390 × 844。

每个尺寸均检查：页面无横向溢出、人物顶部低于状态栏、行动点与玩家状态区分开、角色台词位于手牌计数上方、左侧羁绊栏与右侧固有灵装终端互不遮挡。手机手牌在自身区域横向滚动。

## 可复查文件

- `output/playwright/ocgame/check-ui.js`
- `output/playwright/ocgame/check-finish.js`
- `output/playwright/ocgame/check-build.js`
- `output/playwright/ocgame/desktop-final.png`
- `output/playwright/ocgame/mobile-final.png`
- `output/playwright/ocgame/tablet.png`
- `output/playwright/ocgame/ayase-card.png`
- `output/playwright/ocgame/custom-forge.png`
- `output/playwright/ocgame/evolve-modal.png`
- `output/playwright/ocgame/noble-cutin.png`
- `output/playwright/ocgame/victory.png`
