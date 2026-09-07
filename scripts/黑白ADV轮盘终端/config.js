/**
 * 終端配置文件
 * 統一管理所有可配置項，避免硬編碼
 */

export const CONFIG = {
  // 版本信息
  version: '1.2.1',
  scriptId: 'ee190b2f-d2ba-44b4-9f1b-0695c07fefc5',
  
  // UI 參數
  ui: {
    orbWidth: 68,
    orbHeight: 68,
    minTerminalWidth: 320,
    minTerminalHeight: 500,
    defaultTerminalWidth: 412,
    defaultTerminalHeight: 780,
  },
  
  // 動畫配置
  animation: {
    wheelOpen: {
      duration: '0.3s',           // 增加到 0.3 秒讓動畫更明顯
      easing: 'cubic-bezier(0.68, -0.55, 0.27, 1.55)',  // 彈性效果
      initialScale: 0.75,         // 從 75% 開始放大
    },
    orbHide: {
      duration: '0.2s',
      easing: 'ease-out',
    },
  },
  
  // 輪盤應用列表
  apps: [
    { id: 'blazer', label: '伐刀者档案', icon: 'blazer' },
    { id: 'lime', label: '破军 LIME', icon: 'lime' },
    { id: 'moments', label: '学园圈', icon: 'moments' },
    { id: 'bbs', label: '破军 BBS', icon: 'bbs' },
    { id: 'schedule', label: '选拔赛程', icon: 'schedule' },
    { id: 'gallery', label: '灵装画廊', icon: 'gallery' },
    { id: 'worldbook', label: '世界观资料', icon: 'worldbook' },
    { id: 'settings', label: '终端设置', icon: 'settings' },
  ],
  
  // 測試模式（開發用）
  dev: {
    enableTestData: false,       // ⚠️ 設為 false 禁用測試數據
    testUserName: '開發者',      // 測試用戶名（不會在生產環境顯示）
    mockMVU: false,              // 是否模擬 MVU 數據
  },
  
  // 本地存儲鍵名
  storage: {
    orbPosition: 'rk:orb',
    terminalRect: 'rk:rect',
    lastApp: 'rk:lastApp',
  },
};
