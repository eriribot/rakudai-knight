# 🚀 快速開始

## 使用打包好的腳本（推薦）
\\\ash
# 文件位置
E:/web/落第/酒馆助手脚本-小手机-黑白ADV轮盘版-v1.2.1.json

# 導入步驟
1. 打開 SillyTavern
2. 進入 TavernHelper 管理界面
3. 導入上述 JSON 文件
4. 啟用腳本並刷新頁面
\\\

## 修改和重新打包
\\\ash
cd scripts/黑白ADV轮盘终端
npm install      # 首次需要
npm run build    # 重新打包
\\\

## 文件說明
- \main.js\ - 修改核心邏輯
- \styles.css\ - 修改樣式
- \config.js\ - 修改配置（動畫、測試數據）
- \wheel.js\ - 修改輪盤行為
- \	erminal-app.html\ - 修改內嵌應用頁面

## 問題排查
1. 如果輪盤不顯示 → 檢查 \styles.css\ 中的動畫
2. 如果測試數據錯誤 → 檢查 \config.js\
3. 如果終端不隱藏球 → 檢查 CSS 選擇器

詳細文檔見 **開發指南.md**
