// 赛事子页只接收终端已经选定的 MVU 快照，不另读消息或保存变量。
var tournamentPanelFrame = null;
var tournamentPanelSource = null;

function pushTournamentPanel() {
  var frame = tournamentPanelFrame;
  if (!frame || !frame.contentWindow.RK_MATCH_PREVIEW) return;
  var child = frame.contentWindow;
  child.RK_TERMINAL_ACTIONS = {
    editSelection: function() {
      var scheduleIndex = currentStack.lastIndexOf('scr-schedule');
      if (scheduleIndex >= 0) {
        while (currentStack.length - 1 > scheduleIndex) goBack();
        renderSchedule();
        return;
      }
      if (currentStack[currentStack.length - 1] === 'scr-arena') goBack();
      openApp('schedule');
    }
  };
  var key = sourceKey(stateSource);
  var portrait = resolveKnightAvatar(resolvePlayer().name, { player: true });
  child.RK_MATCH_PREVIEW.setSnapshot({
    state: stat,
    source: stateSource,
    pending: dataStatus !== 'ready',
    view: tournamentView()
  }, {
    avatarUrl: portrait && portrait.src,
    sourceLabel: sourceLabel(stateSource),
    reset: tournamentPanelSource !== key
  });
  tournamentPanelSource = key;
}

function renderTournamentPanel() {
  var body = document.getElementById('arena-body');
  if (!body) return;
  var unlocked = tournamentPanelUnlocked();
  var title = unlocked ? '七星剑斗祭 · 赛事面板' : '七星剑斗祭 · 预览';
  document.getElementById('arena-title').textContent = title;
  document.getElementById('arena-preview-notice').hidden = unlocked;
  if (!tournamentPanelFrame) {
    var frame = document.createElement('iframe');
    frame.id = 'rk-tournament-frame';
    frame.onload = function() { if (tournamentPanelFrame === frame) pushTournamentPanel(); };
    frame.srcdoc = RK_TOURNAMENT_PANEL_HTML;
    tournamentPanelFrame = frame;
    body.replaceChildren(frame);
  } else pushTournamentPanel();
  tournamentPanelFrame.title = title;
}

function destroyTournamentPanel() {
  if (tournamentPanelFrame) {
    tournamentPanelFrame.onload = null;
    tournamentPanelFrame.remove();
  }
  tournamentPanelFrame = null;
  tournamentPanelSource = null;
}
