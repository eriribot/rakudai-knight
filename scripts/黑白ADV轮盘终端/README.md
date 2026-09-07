# 落第騎士·黑白ADV輪盤終端 - 模塊化開發版

## 📁 項目結構

```
scripts/黑白ADV轮盘终端/
├── main.js              # 主邏輯 - 懸浮球、終端窗口、狀態管理
├── wheel.js             # 輪盤組件 - 八扇區選單、動畫、交互
├── styles.css           # 完整樣式 - 黑白像素風格
├── terminal-app.html    # 內嵌應用頁面 (Base64 編碼後注入)
├── build.js             # 打包工具 - 生成 JSON 腳本
├── package.json         # 項目配置
└── README.md            # 本文件
```

## 🚀 快速開始

### 1. 初始化
```bash
cd "E:\web\落第\scripts\黑白ADV轮盘终端"
npm install
```

### 2. 開發調試
直接修改各個模塊文件：
- `main.js` - 調整核心邏輯
- `wheel.js` - 修改輪盤行為
- `styles.css` - 修改樣式
- `terminal-app.html` - 修改內嵌頁面

### 3. 打包生成 JSON
```bash
npm run build
```

生成的 JSON 文件在：`../../酒馆助手脚本-小手机-黑白ADV轮盘版-v1.2.1.json`

### 4. 快速打包並測試
```bash
npm run dev
```

## ✅ 已修復的問題

### 問題 1：輪盤展開動畫
- ✓ CSS 動畫關鍵幀已存在
- ✓ 展開效果：0.14秒 ease-out 從 92% 縮放到 100%
- 如需更明顯效果，修改 `styles.css` 中 `@keyframes rk-wheel-open`

### 問題 2：終端打開時隱藏輪盤入口球
- ✓ 添加 CSS 規則：`#rk-shell.on ~ #rk-orb { visibility:hidden }`
- ✓ 當終端窗口顯示時，懸浮球自動隱藏

### 問題 3：移除測試數據
- ⚠️ 需要確認"時坂洸"出現的具體位置
- 可能在 `terminal-app.html` 的數據綁定中
- 請告知該測試數據出現的界面/功能

## 📝 開發指南

### 修改樣式
編輯 `styles.css`：
```css
/* 調整動畫效果 */
@keyframes rk-wheel-open {
  from { 
    opacity: 0; 
    transform: scale(0.8); /* 改為 0.8 更明顯 */
  }
  to { 
    opacity: 1; 
    transform: scale(1); 
  }
}

/* 輪盤展開時間 */
#rk-wheel.on {
  animation: rk-wheel-open 0.3s ease-out; /* 改為 0.3s 更慢 */
}
```

### 添加新的輪盤選項
編輯 `wheel.js` 中的 `RADIAL_APPS` 數組：
```javascript
const RADIAL_APPS = [
  'blazer',    // 01 伐刀者檔案
  'lime',      // 02 破軍 LIME
  'moments',   // 03 學園圈
  'bbs',       // 04 破軍 BBS
  'schedule',  // 05 選拔賽程
  'gallery',   // 06 靈裝畫廊
  'worldbook', // 07 世界書
  'settings'   // 08 設置
];
```

### 修改內嵌頁面
編輯 `terminal-app.html`，可以：
- 修改應用列表
- 調整頁面布局
- 添加新功能
- 移除測試數據

## 🔧 打包流程

`build.js` 會：
1. 讀取所有源文件
2. 壓縮 JavaScript 和 CSS
3. Base64 編碼 HTML
4. 生成符合 TavernHelper 規範的 JSON
5. 輸出到項目根目錄

## 📦 輸出格式

生成的 JSON 結構：
```json
{
  "type": "script",
  "enabled": true,
  "name": "落第骑士·黑白ADV轮盘终端 v1.2.1",
  "id": "ee190b2f-d2ba-44b4-9f1b-0695c07fefc5",
  "content": "(async function(){...})();"
}
```

## 🎯 版本歷史

- **v1.2.1** (2026-09-07)
  - ✓ 終端打開時自動隱藏輪盤入口球
  - ✓ 確認輪盤展開動畫存在
  - 模塊化重構，便於維護

- **v1.2.0**
  - 初始黑白 ADV 輪盤版本

## 💡 注意事項

1. 修改文件後必須運行 `npm run build` 才能生效
2. `terminal-app.html` 會被 Base64 編碼，請保持文件體積合理
3. CSS 和 JS 會被自動壓縮
4. 打包後的 JSON 文件可直接導入 SillyTavern

## 🐛 已知問題

- [ ] 需要定位並移除"時坂洸"測試數據
- [ ] 可選：增強輪盤動畫效果（當前已有基礎動畫）

## 📞 需要幫助？

如需進一步調整：
1. 告訴我"時坂洸"測試數據出現的位置
2. 告訴我動畫效果需要如何調整
3. 告訴我其他需要修改的功能
