# 《落第騎士の英雄譚》WORLD ATLAS 地圖冊（非同層 MVU/EJS 插件版）

> **架構說明**：本模組採用獨立 Webview / iframe 形式運行於酒館外掛（SillyTavern Plugin）或 Tavern Helper 側邊欄中，**不佔用聊天主窗口樓層（非同層 #0）**，狀態完全由宿主 MVU 驅動，模板支持 EJS 渲染注入。

---

## 一、 目錄結構

```text
map/
├── index.html        # 主頁面結構（頂部狀態欄、左側地圖冊抽屜、底層視口、圖例、詳情面板）
├── style.css         # 專屬二遊級樣式表（日系低飽和地圖底色、毛玻璃、緋紅強調、櫻花飄落）
├── data.js           # 地圖資料中心（東京都與關東圈 21 個 POI、出處、角色、經緯度）
├── app.js            # 地圖控制器（Leaflet 封裝、圖釘渲染、破軍輻射虛線、抽屜聯動、MVU 橋接）
├── preview.bat       # 一鍵本機啟動預覽腳本 (localhost:8088)
└── assets/
    ├── leaflet/      # 預置的離線 Leaflet 核心函式庫 (CSS + JS)
    ├── concept-mockup.jpg # 視覺概念原圖
    └── *.jpg         # 校園與角色插畫素材
```

---

## 二、 核心特色與還原度

1. **破軍學園核心大圖釘**：
   - 雙環呼吸光環動畫、紅色校徽徽章。
   - 概念圖同款懸浮照片預覽卡（`破軍學園 剣が繋ぐ、俺たちの青春—— ▶`）。
   - 破軍學園與周邊設施間的半透明粉紅虛線放射射線。
2. **多維 POI 標註系統**：
   - ⚔️ **戰鬥 / 事件**（奧多摩集訓場、西京寧音重力特訓坑、新宿地下鬥技場）
   - ⭐ **重要劇情**（舊綾辻道場、大型購物中心、一公里長坡道、平價家庭餐廳）
   - 🏛️ **設施 / 建築**（主校舍、學生會、理事長室、訓練場、宿舍、車站、醫院、聯盟總部、秋葉原）
   - 🌲 **自然 / 特殊地形**（後山步道、暴風雨避難小屋）
3. **沉浸式二遊 UI**：
   - 左側可折疊多級地圖冊抽屜，支持實時模糊檢索（地名、人物、原作出處、劇情關鍵詞）。
   - 右上角動態遊戲時鐘與天氣狀態膠囊。
   - 點擊標記平滑滑出「地點詳情抽屜」，展示插畫、名場面小說引文與「🚀 前往探索」按鈕。
   - 輕量 CSS 飄落櫻花瓣粒子。

---

## 三、 MVU 與 SillyTavern 插件橋接協議

在酒館外掛或 WebView 中，透過 `window.RakudaiAtlas` 或 `postMessage` 實現雙向通信：

### 1. 宿主下發狀態至地圖 (Host → Atlas)
宿主在樓層推進、時間變化或觸發劇情時，通知地圖更新：

```javascript
// 方式 A：直接調用全域物件（同域 / 外掛內）
window.RakudaiAtlas.updateState({
  currentStatus: {
    region: "東京都 · 奧多摩深山",
    weather: "暴風雨 18℃",
    date: "10月15日 (週二)"
  },
  activePlaceId: "okutama_camp" // 自動鏡頭聚焦該點
});

// 方式 B：跨 iframe postMessage
iframeElement.contentWindow.postMessage({
  type: "atlas:state",
  payload: {
    currentStatus: { region: "新宿區 · 聯盟日本分部", weather: "晴朗 22℃" }
  }
}, "*");
```

### 2. 地圖回傳玩家行動至宿主 (Atlas → Host)
當玩家在詳情頁點擊「🚀 前往探索」時，觸發自定義事件：

```javascript
// 監聽地圖發出的前往探索請求
window.addEventListener("rakudai:travel", (e) => {
  const { placeId, placeName, category, bookRef } = e.detail;
  console.log(`玩家申請前往：${placeName} (${placeId})`);
  // 在此調用 MVU 狀態推進或執行酒館指令
});
```

---

## 四、 本地預覽

雙擊運行 `preview.bat`，即可在瀏覽器中體驗完整的互動地圖效果！
