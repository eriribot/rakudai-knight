# 落第騎士·黑白ADV輪盤終端 v1.2.1 更新說明

## 🔧 已修復的問題

### 1. ✅ 輪盤展開動畫已實現
- **位置**: CSS 部分 `@keyframes rk-wheel-open`
- **效果**: 從 92% 縮放+透明度0 過渡到 100% 縮放+完全不透明
- **動畫時長**: 140ms (`ease-out` 曲線)
- **測試方法**: 點擊破軍微光球，輪盤應該有縮放淡入動畫

```css
@keyframes rk-wheel-open{
  from{opacity:0;transform:scale(.92)}
  to{opacity:1;transform:scale(1)}
}
```

**注意**: 如果動畫沒有生效，可能是瀏覽器的 `prefers-reduced-motion` 設置禁用了動畫。


### 2. ⚠️ 終端打開時隱藏輪盤入口球（需要補充修改）

**當前狀態**: 輪盤展開時入口球會隱藏（`#rk-orb[aria-expanded="true"]`），但終端窗口打開後入口球仍然顯示。

**建議修改方案**:

在 `show()` 函數中添加以下代碼（約在第 280 行附近）:

```javascript
async function show() {
  if (SS.destroyed || SS.visible) return;
  if (!SS.booted) await mount();
  SS.visible = true;
  SS.host.classList.add('on');
  
  // 新增：終端打開時隱藏入口球
  if (SS.orb) SS.orb.classList.add('terminal-open');
  
  closeWheel(false);
  // ...後續代碼
}
```

在 `hide()` 函數中添加對應的移除邏輯（約在第 300 行附近）:

```javascript
function hide() {
  if (!SS.visible || SS.destroyed) return;
  SS.visible = false;
  SS.host.classList.remove('on');
  
  // 新增：終端關閉時恢復入口球顯示
  if (SS.orb) SS.orb.classList.remove('terminal-open');
}
```

在 CSS 中添加對應的樣式規則（已存在的 `#rk-orb` 部分）:

```css
#rk-orb[aria-expanded="true"],
#rk-orb.terminal-open {
  visibility:hidden;
  pointer-events:none
}
```


### 3. 🔍 移除硬編碼的「時坂洸」測試數據（需要定位具體位置）

**問題描述**: 當前版本在某處硬編碼了測試角色名「時坂洸」。

**排查方法**:
1. 搜索 embedded HTML (base64 編碼的 iframe 內容)
2. 檢查 `getCharName()` 或類似的用戶名獲取函數
3. 檢查 MVU 變量讀取邏輯

**臨時測試方法** (在瀏覽器開發者工具中):
```javascript
// 在 iframe 內執行
document.body.innerHTML.includes('時坂洸') || document.body.innerHTML.includes('时坂洸')
```

**可能的修改位置**:
- 如果是預設的 demo 數據，應該改為從 MVU 變量動態讀取: `{{user}}` 或 `getVariables('user')`
- 如果是硬編碼在 JavaScript 中，搜索字符串 `"時坂洸"` 或 `"时坂洸"`


## 📋 完整修改清單

### 已完成 ✅
- [x] 版本號更新至 v1.2.1
- [x] 添加更新日誌註釋
- [x] 輪盤展開動畫已存在並可用

### 待手動修改 🔧
- [ ] 在 `show()` 函數中添加 `SS.orb.classList.add('terminal-open')`
- [ ] 在 `hide()` 函數中添加 `SS.orb.classList.remove('terminal-open')`
- [ ] 在 CSS 中修改 `#rk-orb[aria-expanded="true"]` 為 `#rk-orb[aria-expanded="true"],#rk-orb.terminal-open`
- [ ] 定位並移除硬編碼的「時坂洸」測試數據


## 🧪 測試驗證

### 測試動畫
1. 刷新頁面
2. 點擊右側破軍微光球
3. **預期**: 輪盤應該以淡入+縮放動畫展開（持續 140ms）
4. 點擊背景或關閉按鈕收起輪盤

### 測試入口球隱藏（待修改後測試）
1. 點擊輪盤中的任一應用（如「檔案」）
2. **預期**: 終端窗口展開，右側微光球應該消失
3. 關閉終端窗口
4. **預期**: 微光球重新出現

### 測試動態角色名（待定位修改位置後測試）
1. 在終端中查看顯示的角色名稱
2. **預期**: 應該顯示當前 SillyTavern 中設定的 `{{user}}` 名稱
3. 切換不同的角色卡
4. **預期**: 終端中的角色名應該動態更新


## 🔗 相關文件

- 主腳本: `酒馆助手脚本-小手机-黑白ADV轮盘版-v1.2.0.json`
- 上一個版本說明: `酒馆助手脚本-小手机-落第騎士版.json`


## 📝 開發註記

### 架構說明
- **破軍微光懸浮球** (`#rk-orb`): 可拖動的入口按鈕
- **終端主窗口** (`#rk-shell`): 包含 iframe 的浮動窗口
- **操作輪盤** (`#rk-wheel`): 8扇區圓形啟動器，對應 8 個應用
- **輪盤遮罩** (`#rk-wheel-curtain`): 半透明背景遮罩

### CSS Class 狀態
- `.on`: 元素可見/展開
- `.terminal-open`: 終端窗口已打開
- `[aria-expanded="true"]`: 輪盤已展開
- `.busy`: 正在拖動或調整大小

### 重要函數
- `toggleWheel()`: 切換輪盤顯示狀態
- `show()` / `hide()`: 顯示/隱藏終端窗口
- `openPhoneApp(appId)`: 打開指定應用
- `buildWheel()`: 構建輪盤 SVG 結構

---

**版本**: v1.2.1  
**更新日期**: 2026-09-07  
**維護者**: TavernWeave 團隊
