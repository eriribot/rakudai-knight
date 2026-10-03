# 一刀之間 · 卡牌戰鬥概念預覽

黑鐵一輝對史黛菈的單場卡牌戰鬥，面向展示與玩法討論。一輝以動畫右向側臉及官方制服設定重新生成完整人物，再由同一母版延伸動作，頭身共用一套畫法。

## 開啟

直接用瀏覽器開啟 [index.html](index.html)，或在這個資料夾執行：

```powershell
node serve.cjs
```

瀏覽 `http://127.0.0.1:4177/`。無套件安裝、無建置、無外部 CDN。

- [戰鬥預覽](index.html)：實際出牌、前衝、命中、格擋、受擊、退回、勝敗和重開。
- [人物素材對照](references.html)：動畫側臉、使用者原臉型與完整人物母版對照，支援臉部放大，附官方動畫參考及來源。
- [動作預覽](motion.html)：一輝與史黛菈的逐格姿勢、完整接近／揮砍／退回動作。
- [官方素材紀錄](assets/references/ikki-web/manifest.json)：逐張來源、尺寸與 SHA-256。
- [完整人物提示詞](docs/ikki-unified-profile-prompts.md)與[動作提示詞](docs/ikki-unified-motion-prompt.md)：內建 image_gen；人物為透明 PNG。

## 操作

點擊手牌出招，空白鍵結束回合，`1–6` 對應當前手牌，`R` 重新開始。手機可左右滑動手牌。右下「演示連招」會演示一個完整回合，結束後可接手。

首次點擊或按鍵後開始播放通常戰鬥 BGM，右上音符按鈕統一切換音樂與音效。打出「一刀修羅」時，先播放使用者提供的 GIF 一輪（2.25 秒），同步切換專用曲，再進行揮砍與命中；可點「略過動畫」或按 `Esc` 跳過演出。專用曲播完後回到通常 BGM；重新開局會取消演出並從頭播放通常 BGM，勝敗結算會停止音樂。靜音狀態在重開時保留。

每回合恢復 3 AP、抽 5 張。敵方先公開意圖；格擋抵消傷害，在持有者下回合開始時消退。棄牌堆在抽牌堆空時重新洗入。修羅消耗 2 AP，造成 24 傷害、自損 6 體力並在本場移除；雙方同時歸零算敗北。

人物沿地面短促踏步進身，再切換蓄力、揮砍與收勢。普通攻擊約 600ms，必殺約 710ms；正常出擊使用兩張低步幅姿勢，已移除早期反覆抬膝踏步。素材共六關鍵姿勢，逐格頁可全部檢視；沒有骨骼綁定或自動補間。命中數值與揮刀幀同步，重新開局會取消未完成的動作。相似度仍以使用者的審美判斷為準。

## 規則與範圍

借用《殺戮尖塔》式「公開意圖 → 行動預算 → 出牌 → 對手行動」節奏，僅製作一場確定性訓練戰。讀意圖、分配 AP、利用受身與返擊牌序是本版的核心循環。

依 TRPG v0.3 討論稿保留一輝洞察、受身、終結技的展示方向；全部 HP/AP/傷害是獨立演示數值，沒有批准或改寫正式戰鬥參數。AP 不等於原生魔力。一刀修羅不等於魔人覺醒；沒有 S 關係前置或配對綁定，也未連接 MVU、酒館或世界書。

## 素材

目前使用：

- `assets/ikki-unified-profile.png`：動畫右向側臉＋官方制服參考的完整生成小人，頭、頸部、制服一次繪製。
- `assets/stella-idle.png`：動畫官方人設參照的生成小人。
- `assets/arena-duel.png`：無人物的生成競技場背景。
- `assets/ikki-unified-motion.png`、`assets/stella-motion.png`：以各自完整人物為底稿延伸的三欄兩列動作圖，由內建 image_gen 編輯生成。
- `assets/cards/*.jpg`：六張動畫官網劇照，保留原始檔案內容，以 CSS 取景。逐張來源與雜湊見 [manifest.json](assets/cards/manifest.json)。卡名與畫面是演示配圖，並非逐一鑑定為原作同名招式。
- `assets/tenor.gif`：使用者提供的一刀修羅開啟動畫，498 × 280、45 幀。
- `assets/let's_go_ahead.mp3`：使用者提供的一刀修羅專用 BGM。
- `assets/bgm1.mp3`：使用者提供的通常戰鬥 BGM，由專案根目錄同名檔複製，循環播放。

已檢視動畫官網 12 集共 72 張劇照，側臉依據第 5 集第 6 張；原始檔與來源見 `assets/references/ikki-profile-source.json`。早期 v2/v3、首次 `ikki-motion.png`、分離原畫頭層、`skill-atlas.png` 均為淘汰方案，現用戰場不引用。

首要來源：[動畫官方角色頁](https://ittoshura.com/character/)、[劇情頁](https://ittoshura.com/story/)。補充發佈入口：[Animate Times 第 2 話先行圖](https://www.animatetimes.com/news/details.php?id=1444211000)、[第 4 話](https://www.animatetimes.com/news/details.php?id=1445575387)、[第 8 話](https://www.animatetimes.com/news/img.php?id=1447982519&n=1&p=1)。玩法靈感：[Mega Crit 官方介紹](https://www.megacrit.com/press-kits/slay-the-spire/)。

## 驗證

```powershell
node --test battle.test.cjs
```

引擎驗證包含牌堆守恆、格擋生命週期、可重播洗牌、費用限制、修羅代價、勝敗锁定及多種子操作序列。

桌面／手機瀏覽器驗收腳本位於 `../output/playwright/cardgame/acceptance-flow.js`，以真實頁面按鈕測試。畫面與檢查結果也位於該資料夾。

媒體驗收位於 `../output/playwright/cardgame/media-acceptance.js`，涵蓋首次互動解鎖、專用曲切換、完整 GIF、跳過、取消、靜音、曲終返回、手機與離線開啟。音樂伺服器支援 MP3 MIME 與位元組範圍請求。

可觀察驗收：點「演示連招」，第 2 回合開始時一輝 **48/48**、史黛菈 **49/72**。完整勝利路徑：第 1 回合受身→看破→斬擊→返擊；第 2 回合看破→三張斬擊；第 3 回合返擊→看破→一刀修羅，最後一輝 **42 HP**。
