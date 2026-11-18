// 两种终端共用的只读校历；作品和章节写入由宿主剧情服务管理。
function createTerminalCalendar({ getState, getBridge, getMatches, esc, toast }) {
// ===== 学园校历 (Calendar) =====
var calendarState = {
  year: null,
  month: null,
  selectedDay: null,
  _initialized: false
};

var calendarLore = { status: 'idle', worldbook: '', entries: [], undatedCount: 0, error: '', revision: 0 };
var calendarStoryOrigin = null;
var calendarLorePending = null;

function resetCalendarLore() {
  closeCalendarStory();
  Object.assign(calendarLore, { status: 'idle', worldbook: '', entries: [], undatedCount: 0, error: '', revision: calendarLore.revision + 1 });
  calendarState._initialized = false;
  calendarLorePending = null;
}

function loadCalendarLore(force) {
  if (!force && calendarLore.status !== 'idle') return calendarLorePending || Promise.resolve();
  var currentBridge = getBridge(), revision = ++calendarLore.revision;
  closeCalendarStory();
  calendarLore.status = 'loading';
  calendarLore.worldbook = ''; calendarLore.entries = []; calendarLore.undatedCount = 0; calendarLore.error = '';
  var pending = Promise.resolve().then(function() {
    if (!currentBridge || !currentBridge.worldbookCalendar || typeof currentBridge.worldbookCalendar.read !== 'function') {
      throw new Error('当前终端未连接主世界书读取接口。');
    }
    return currentBridge.worldbookCalendar.read();
  }).then(function(result) {
    if (revision !== calendarLore.revision || currentBridge !== getBridge()) return;
    if (!result || typeof result.worldbook !== 'string' || !Array.isArray(result.entries)) throw new Error('世界书剧情读取结果无效。');
    calendarLore.status = 'ready';
    calendarLore.worldbook = result.worldbook;
    calendarLore.entries = result.entries;
    calendarLore.undatedCount = result.undatedCount || 0;
    renderCalendar();
  }).catch(function(error) {
    if (revision !== calendarLore.revision || currentBridge !== getBridge()) return;
    calendarLore.status = 'error';
    calendarLore.error = error && error.message || '世界书剧情暂不可用，请重试。';
    renderCalendar();
  });
  calendarLorePending = pending;
  if (force) renderCalendar();
  return pending;
}

function calendarLoreItems(key) {
  return calendarLore.status === 'ready' ? calendarLore.entries.filter(function(entry) {
    return entry.dates.some(function(date) { return date.key === key; });
  }) : [];
}

function calendarStoryButton(entry) {
  return '<button type="button" class="rk-calendar-story-button" onclick="openCalendarStory(' + entry.uid + ')">' +
    esc(entry.name) + '<small>' + esc(entry.dateLabel || '完整日期未明确') + '</small></button>';
}

function renderCalendarLoreStatus() {
  var text = calendarLore.status === 'ready' ? calendarLore.worldbook + ' · ' + calendarLore.entries.filter(function(entry) { return entry.dates.length; }).length + ' 条剧情已标注日期' :
    calendarLore.status === 'error' ? calendarLore.error : '正在读取当前角色主世界书…';
  return '<div class="card1"><div class="ct rk-calendar-lore-heading"><span>世界书剧情</span>' +
    '<button type="button" onclick="loadCalendarLore(true)"' + (calendarLore.status === 'loading' ? ' disabled' : '') + '>刷新剧情</button></div>' +
    '<p class="rk-calendar-lore-note" role="status" aria-live="polite">' + esc(text) + '</p>' +
    '<p class="rk-calendar-lore-note">展示全部作品的剧情资料，仅供查阅；主线推进与注入以本局作品为准。</p>' +
    (calendarLore.status === 'ready' && calendarLore.entries.length ? '<details class="rk-calendar-index"><summary>全部剧情 · ' + calendarLore.entries.length + ' 条</summary>' + calendarLore.entries.map(calendarStoryButton).join('') + '</details>' : '') +
    (calendarLore.status === 'ready' && !calendarLore.entries.length ? '<p>当前主世界书没有可查看的 [剧情] 条目。</p>' : '') + '</div>';
}

function renderUndatedCalendarLore() {
  var entries = calendarLore.status === 'ready' ? calendarLore.entries.filter(function(entry) { return !entry.dates.length; }) : [];
  return entries.length ? '<details class="card1 rk-calendar-undated"><summary>未定日期剧情 · ' + entries.length + ' 条</summary>' +
    '<p class="rk-calendar-lore-note">这些条目未明确完整年月日，点击标题可查看原文。</p>' + entries.map(calendarStoryButton).join('') + '</details>' : '';
}

function calendarStoryDialog() {
  var dialog = document.getElementById('rk-calendar-story');
  if (!dialog || typeof dialog.showModal !== 'function') { toast('当前浏览器无法打开剧情弹窗。'); return null; }
  if (!dialog._rkCalendarBound) {
    dialog._rkCalendarBound = true;
    dialog.addEventListener('keydown', function(event) {
      if (event.key === 'Escape') event.stopPropagation();
    });
    dialog.addEventListener('click', function(event) {
      if (event.target !== dialog) return;
      var rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    });
    dialog.addEventListener('close', function() {
      if (calendarStoryOrigin && calendarStoryOrigin.isConnected !== false && typeof calendarStoryOrigin.focus === 'function') calendarStoryOrigin.focus();
      calendarStoryOrigin = null;
    });
  }
  return dialog;
}

function showCalendarStoryDialog() {
  var dialog = calendarStoryDialog();
  if (!dialog) return;
  if (!dialog.open) { calendarStoryOrigin = document.activeElement; dialog.showModal(); }
  dialog.scrollTop = 0;
}

function closeCalendarStory() {
  var dialog = document.getElementById('rk-calendar-story');
  if (dialog && dialog.open && typeof dialog.close === 'function') dialog.close();
  ['rk-calendar-story-title', 'rk-calendar-story-source', 'rk-calendar-story-content'].forEach(function(id) {
    var node = document.getElementById(id); if (node) node.textContent = '';
  });
  var choices = document.getElementById('rk-calendar-story-choices'); if (choices) choices.innerHTML = '';
}

function openCalendarStory(uid) {
  var entry = calendarLore.status === 'ready' && calendarLore.entries.find(function(item) { return item.uid === uid; });
  if (!entry) { toast('该剧情资料已更新，请刷新日历后查看。'); return; }
  document.getElementById('rk-calendar-story-title').textContent = entry.name;
  document.getElementById('rk-calendar-story-source').textContent = '来源：' + calendarLore.worldbook + '\n世界书时间：' + (entry.dateLabel || '完整日期未明确');
  document.getElementById('rk-calendar-story-choices').innerHTML = '';
  document.getElementById('rk-calendar-story-content').textContent = entry.content;
  showCalendarStoryDialog();
}

function openCalendarStoriesForDate(key) {
  var entries = calendarLoreItems(key);
  if (entries.length === 1) return openCalendarStory(entries[0].uid);
  if (!entries.length) return;
  document.getElementById('rk-calendar-story-title').textContent = key + ' · 世界书剧情';
  document.getElementById('rk-calendar-story-source').textContent = '来源：' + calendarLore.worldbook + ' · 请选择要查看的剧情';
  document.getElementById('rk-calendar-story-content').textContent = '';
  document.getElementById('rk-calendar-story-choices').innerHTML = entries.map(calendarStoryButton).join('');
  showCalendarStoryDialog();
}

// 2013年日本法定国民祝日 (National Holidays)
var JAPAN_HOLIDAYS_2013 = {
  '1-1': { name: '元日', desc: '日本法定祝日 · 迎新春元旦' },
  '1-14': { name: '成人の日', desc: '日本法定祝日 · 成人之日 (1月第2个周一)' },
  '2-11': { name: '建国記念の日', desc: '日本法定祝日 · 建国纪念之日' },
  '3-20': { name: '春分の日', desc: '日本法定祝日 · 自然赞美与春分祭' },
  '4-29': { name: '昭和の日', desc: '日本法定祝日 · 昭和之日 (黄金周首日)' },
  '5-3': { name: '憲法記念日', desc: '日本法定祝日 · 日本国宪法纪念日' },
  '5-4': { name: 'みどりの日', desc: '日本法定祝日 · 绿之日 · 亲近自然' },
  '5-5': { name: 'こどもの日', desc: '日本法定祝日 · 儿童之日 / 端午节句' },
  '5-6': { name: '振替休日', desc: '法定调休日 (儿童之日周日顺延)' },
  '7-15': { name: '海の日', desc: '日本法定祝日 · 海之日 (7月第3个周一)' },
  '9-16': { name: '敬老の日', desc: '日本法定祝日 · 敬老之日 (9月第3个周一)' },
  '9-23': { name: '秋分の日', desc: '日本法定祝日 · 敬祖缅怀与秋分祭' },
  '10-14': { name: '体育の日', desc: '日本法定祝日 · 体育之日 (10月第2个周一)' },
  '11-3': { name: '文化の日', desc: '日本法定祝日 · 文化之日 · 自由与和平' },
  '11-4': { name: '振替休日', desc: '法定调休日 (文化之日周日顺延)' },
  '11-23': { name: '勤労感謝の日', desc: '日本法定祝日 · 勤劳感谢之日' },
  '12-23': { name: '天皇誕生日', desc: '日本法定祝日 · 明仁天皇诞生日 (平成)' }
};

// 日本传统节庆与年中行事 (Traditional Festivals)
var JAPAN_FESTIVALS = {
  '2-3': { name: '节分', desc: '传统岁时 · 节分祭 (撒豆驱鬼与惠方卷)' },
  '3-3': { name: '雏祭', desc: '传统岁时 · 上巳节 / 女儿节 (祈愿平安成长)' },
  '7-7': { name: '七夕祭', desc: '传统行事 · 星祭 (短册挂竹枝许愿)' },
  '8-13': { name: '盂兰盆节·迎火', desc: '夏日行事 · 盂兰盆节首日迎魂火' },
  '8-14': { name: '盂兰盆会', desc: '夏日行事 · 盆踊与寺社法事' },
  '8-15': { name: '盂兰盆会', desc: '夏日行事 · 盂兰盆中日法会' },
  '8-16': { name: '盂兰盆节·送火', desc: '夏日行事 · 京都五山送火与精灵流' },
  '11-15': { name: '七五三', desc: '传统行事 · 三岁、五岁、七岁儿童神社参拜' },
  '12-31': { name: '大晦日', desc: '传统岁时 · 日本除夕 (年越荞麦面与除夜之钟)' }
};

function calendarMonthDays(year, month) {
  if (month === 2) return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  return [4, 6, 9, 11].indexOf(month) >= 0 ? 30 : 31;
}

function validCalendarDate(year, month, day, raw) {
  if (!Number.isInteger(year) || year < 1 || year > 9999 || !Number.isInteger(month) || month < 1 || month > 12 ||
      !Number.isInteger(day) || day < 1 || day > calendarMonthDays(year, month)) return null;
  return { year: year, month: month, day: day, raw: raw || '',
    key: String(year).padStart(4, '0') + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0') };
}

function parseScheduleDate(text) {
  var match = typeof text === 'string' && text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? validCalendarDate(Number(match[1]), Number(match[2]), Number(match[3]), text) : null;
}

function parseSceneDate() {
  var text = getState()?.场景?.时间;
  if (typeof text !== 'string') return null;
  var match = text.match(/(?:^|[^\d])(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/) ||
    text.match(/(?:^|[^\d])(\d{4})\s*-\s*(\d{1,2})\s*-\s*(\d{1,2})(?!\d)/);
  return match ? validCalendarDate(Number(match[1]), Number(match[2]), Number(match[3]), text) : null;
}

function readSceneSchedule() {
  var entries = getState()?.场景?.日程;
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) entries = {};
  // 程序背景只在赛程的收合详情展示，不把全校推演对局塞进手机日历。
  var matches = getMatches();
  var matchIds = new Set(matches.map(function(match) { return match.id; }));
  var items = Object.keys(entries).map(function(name) {
    var entry = entries[name];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
    if (matchIds.has(name) || matchIds.has(entry.比赛ID) || matchIds.has(entry.选拔赛ID)) return null;
    return { name: name, entry: entry, date: parseScheduleDate(entry.日期) };
  }).filter(function(item) { return !!item; });
  matches.forEach(function(match) { items.push({ name: match.name, entry: match.entry, date: parseScheduleDate(match.entry.日期), tournament: true }); });
  return items.sort(function(a, b) {
    var aDate = a.date ? a.date.key : '99999';
    var bDate = b.date ? b.date.key : '99999';
    return aDate < bDate ? -1 : aDate > bDate ? 1 : a.name.localeCompare(b.name, 'zh-CN');
  });
}

function renderScheduleItem(item, sceneDate) {
  var entry = item.entry;
  var status = entry.状态 || '待定';
  var statusLabel = status;
  if (item.date && sceneDate && item.date.key < sceneDate.key && status !== '已完成' && status !== '已取消') {
    statusLabel += ' · 结果待确认';
  }
  var dateLabel = item.date ? item.date.key : entry.日期 ? '日期待核对（' + String(entry.日期) + '）' : '日期待定';
  var participants = Array.isArray(entry.参与者) ? entry.参与者.filter(function(name) { return typeof name === 'string'; }).join('、') : '';
  return '<div class="gba-cal-event hagun-event"' + (status === '已取消' ? ' style="opacity:0.7;"' : '') + '>' +
    '<b>' + (entry.类型 === '比赛' ? '⚔ ' : '• ') + esc(item.name) + '</b>' +
    '<p>' + esc((entry.类型 || '其他') + ' · ' + statusLabel) + '</p>' +
    '<p>' + esc(dateLabel + (entry.时间 ? ' · ' + entry.时间 : '') + ' · ' + (entry.地点 || '地点待定')) + '</p>' +
    (participants ? '<p>参与者：' + esc(participants) + '</p>' : '') +
    (entry.说明 ? '<p style="white-space:pre-wrap;">' + esc(entry.说明) + '</p>' : '') + '</div>';
}

function renderUndatedSchedule(items, sceneDate) {
  if (!items.length) return '';
  return '<div class="card1"><div class="ct">日期待定 / 待核对</div>' +
    items.map(function(item) { return renderScheduleItem(item, sceneDate); }).join('') + '</div>';
}

function changeCalendarMonth(delta) {
  if (!validCalendarDate(calendarState.year, calendarState.month, 1) || (delta !== -1 && delta !== 1)) return;
  var y = calendarState.year;
  var m = calendarState.month + delta;
  if (m > 12) { y++; m = 1; }
  else if (m < 1) { y--; m = 12; }
  if (!validCalendarDate(y, m, 1)) return;
  calendarState.year = y;
  calendarState.month = m;
  calendarState.selectedDay = 1;
  renderCalendar();
}

function selectCalendarDay(day) {
  if (!validCalendarDate(calendarState.year, calendarState.month, day)) return;
  calendarState.selectedDay = day;
  renderCalendar();
  var selected = document.querySelector('[data-calendar-day="' + day + '"]');
  if (selected) selected.focus();
  openCalendarStoriesForDate(validCalendarDate(calendarState.year, calendarState.month, day).key);
}

function jumpToSceneDate() {
  var sceneDate = parseSceneDate();
  if (sceneDate) {
    calendarState.year = sceneDate.year;
    calendarState.month = sceneDate.month;
    calendarState.selectedDay = sceneDate.day;
    calendarState._initialized = true;
    renderCalendar();
    toast('已定位至剧情时间：' + sceneDate.month + '月' + sceneDate.day + '日');
  } else {
    toast('当前剧情时间尚未标明有效的完整年月日。');
  }
}

function renderCalendar() {
  var body = document.getElementById('calendar-body');
  if (!body) return;
  var sub = document.getElementById('calendar-sub');
  if (calendarLore.status === 'idle') loadCalendarLore(false);
  var loreStatus = renderCalendarLoreStatus();
  var undatedLore = renderUndatedCalendarLore();

  var sceneDate = parseSceneDate();
  var schedule = readSceneSchedule();
  var dated = schedule.filter(function(item) { return !!item.date; });
  var undated = schedule.filter(function(item) { return !item.date; });
  if (!calendarState._initialized) {
    var firstLoreDate = calendarLore.entries.flatMap(function(entry) { return entry.dates; }).map(function(date) { return parseScheduleDate(date.key); })
      .filter(function(date) { return !!date; }).sort(function(a, b) { return a.key.localeCompare(b.key); })[0];
    var anchor = sceneDate || (dated.length ? dated[0].date : null) || firstLoreDate;
    calendarState.year = anchor ? anchor.year : null;
    calendarState.month = anchor ? anchor.month : null;
    calendarState.selectedDay = anchor ? anchor.day : null;
    calendarState._initialized = !!anchor;
  }

  var y = calendarState.year;
  var m = calendarState.month;
  var selectedDay = calendarState.selectedDay || 1;
  if (!validCalendarDate(y, m, 1)) {
    if (sub) sub.textContent = '本局年月日尚未确认';
    body.innerHTML = loreStatus + '<div class="card1"><div class="ct">手机日历</div>' +
      '<p>当前场景、日程和世界书剧情均无有效的完整日期，暂不定位月份。</p>' +
      '<p>明确比赛或约定的日期后，会显示在对应日期；尚未定日的安排保留在下方。</p></div>' +
      renderUndatedSchedule(undated, sceneDate) + undatedLore;
    return;
  }

  if (sub) {
    sub.textContent = y + '年' + m + '月 · ' + (sceneDate ? '本局日期：' + sceneDate.key : '本局日期未确认');
  }

  var totalDays = calendarMonthDays(y, m);
  if (selectedDay > totalDays) selectedDay = totalDays;
  calendarState.selectedDay = selectedDay;
  var firstDate = new Date(0);
  firstDate.setUTCFullYear(y, m - 1, 1);
  var firstDayWeekday = firstDate.getUTCDay();
  var byDate = Object.create(null);
  dated.forEach(function(item) {
    if (!byDate[item.date.key]) byDate[item.date.key] = [];
    byDate[item.date.key].push(item);
  });

  var weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  var weekHeaderHtml = weekdays.map(function(w, idx) {
    var cls = (idx === 0) ? 'gba-cal-wh sun' : (idx === 6 ? 'gba-cal-wh sat' : 'gba-cal-wh');
    return '<span class="' + cls + '">' + w + '</span>';
  }).join('');

  var cellsHtml = '';
  for (var p = 0; p < firstDayWeekday; p++) {
    cellsHtml += '<div class="gba-cal-cell gba-cal-pad"></div>';
  }

  for (var d = 1; d <= totalDays; d++) {
    var key = m + '-' + d;
    var holiday = y === 2013 ? JAPAN_HOLIDAYS_2013[key] : null;
    var festival = JAPAN_FESTIVALS[key];
    var dateKey = validCalendarDate(y, m, d).key;
    var dayItems = byDate[dateKey] || [];
    var dayLore = calendarLoreItems(dateKey);
    var activeItems = dayItems.filter(function(item) { return item.entry.状态 !== '已取消'; });
    var hasMatch = activeItems.some(function(item) { return item.entry.类型 === '比赛'; });
    var isSceneToday = (sceneDate && sceneDate.year === y && sceneDate.month === m && sceneDate.day === d);
    var isSelected = (d === selectedDay);

    var weekdayIndex = (firstDayWeekday + d - 1) % 7;
    var cellClass = 'gba-cal-cell';
    if (isSelected) cellClass += ' is-selected';
    if (isSceneToday) cellClass += ' is-scene-today';
    if (activeItems.length) cellClass += ' has-school';
    else if (holiday) cellClass += ' has-holiday';
    if (dayLore.length) cellClass += ' has-lore';
    if (weekdayIndex === 0) cellClass += ' is-sun';
    if (weekdayIndex === 6) cellClass += ' is-sat';

    var marks = '';
    if (isSceneToday) marks += '<span class="gba-cal-mark mark-today" title="当前剧情日">★</span>';
    if (dayItems.length) marks += '<span class="gba-cal-mark mark-school" title="本局日程 ' + dayItems.length + ' 项">' + (hasMatch ? '⚔' : '•') + dayItems.length + '</span>';
    if (dayLore.length) marks += '<span class="gba-cal-mark mark-lore" title="点击查看世界书剧情">剧情' + (dayLore.length > 1 ? dayLore.length : '') + '</span>';
    if (holiday) marks += '<span class="gba-cal-mark mark-holiday" title="2013 年法定祝日">㊗</span>';
    else if (festival) marks += '<span class="gba-cal-mark mark-fest" title="传统节庆">🎋</span>';

    cellsHtml += '<button type="button" class="' + cellClass + '" data-calendar-day="' + d + '" onclick="selectCalendarDay(' + d + ')" aria-pressed="' + isSelected +
      '" aria-label="' + dateKey + '，' + dayItems.length + ' 项本局日程' + (hasMatch ? '，含比赛' : '') + (dayLore.length ? '，' + dayLore.length + ' 条世界书剧情，点击查看' : '') + '">' +
      '<span class="gba-cal-num">' + d + '</span>' +
      '<span class="gba-cal-marks">' + marks + '</span>' +
    '</button>';
  }

  var selKey = m + '-' + selectedDay;
  var selHoliday = y === 2013 ? JAPAN_HOLIDAYS_2013[selKey] : null;
  var selFestival = JAPAN_FESTIVALS[selKey];
  var selectedItems = byDate[validCalendarDate(y, m, selectedDay).key] || [];
  var selectedLore = calendarLoreItems(validCalendarDate(y, m, selectedDay).key);
  var selIsScene = (sceneDate && sceneDate.year === y && sceneDate.month === m && sceneDate.day === selectedDay);
  var selWeekdayName = weekdays[(firstDayWeekday + selectedDay - 1) % 7];

  var detailTags = '';
  if (selIsScene) detailTags += '<span class="gba-badge-today">★ 当前剧情时间</span> ';
  if (selectedItems.length) detailTags += '<span class="gba-badge-school">本局日程 ' + selectedItems.length + ' 项</span> ';
  if (selectedLore.length) detailTags += '<span class="gba-badge-school">世界书剧情 ' + selectedLore.length + ' 条</span> ';
  if (selHoliday) detailTags += '<span class="gba-badge-holiday">㊗ ' + esc(selHoliday.name) + '</span> ';
  if (selFestival) detailTags += '<span class="gba-badge-fest">🎋 ' + esc(selFestival.name) + '</span> ';

  var detailNotes = selectedItems.map(function(item) { return renderScheduleItem(item, sceneDate); });
  if (selectedLore.length) detailNotes.push('<div class="gba-cal-event"><b>【世界书剧情】</b>' + selectedLore.map(calendarStoryButton).join('') + '</div>');
  if (!selectedItems.length) detailNotes.push('<div style="font-size:12px;color:var(--muted);padding:4px 0;">当日暂无本局已登记的比赛或约定。</div>');
  if (selHoliday) {
    detailNotes.push('<div class="gba-cal-event holiday-event"><b>【法定祝日】' + esc(selHoliday.name) + '</b><p>' + esc(selHoliday.desc) + '</p></div>');
  }
  if (selFestival) {
    detailNotes.push('<div class="gba-cal-event fest-event"><b>【传统节庆】' + esc(selFestival.name) + '</b><p>' + esc(selFestival.desc) + '</p></div>');
  }
  if (selIsScene) {
    detailNotes.push('<div class="gba-cal-event scene-event"><b>【剧情推进基准】</b><p>' + esc(sceneDate.raw) + '</p></div>');
  }

  var html = 
    loreStatus + '<div class="gba-cal-panel">' +
      '<div class="gba-cal-nav">' +
        '<button type="button" class="gba-btn-sm" onclick="changeCalendarMonth(-1)">◀ 上月</button>' +
        '<span class="gba-cal-cur-title">' + y + ' 年 ' + m + ' 月</span>' +
        '<button type="button" class="gba-btn-sm" onclick="changeCalendarMonth(1)">下月 ▶</button>' +
        '<button type="button" class="gba-btn-sm gba-btn-jump" onclick="jumpToSceneDate()">🎯 定位剧情</button>' +
      '</div>' +
      '<div class="gba-cal-week-row">' + weekHeaderHtml + '</div>' +
      '<div class="gba-cal-grid">' + cellsHtml + '</div>' +
      '<p style="font-size:11px;color:var(--muted);">⚔ 比赛 · • 其他日程 · ★ 本局日期 · 剧情：点击查看世界书原文。</p>' +
      (y === 2013 ? '' : '<p style="font-size:11px;color:var(--muted);">该年的法定祝日尚未配置，节庆提示不代表本局活动。</p>') +
    '</div>' +
    '<div class="card1 gba-cal-detail">' +
      '<div class="ct" style="display:flex;justify-content:space-between;align-items:center;">' +
        '<span>' + y + '年' + m + '月' + selectedDay + '日 (星期' + selWeekdayName + ')</span>' +
        '<small style="font-family:var(--font-num);font-weight:normal;color:var(--muted);">GBA CALENDAR</small>' +
      '</div>' +
      (detailTags ? '<div class="gba-cal-tags" style="margin-bottom:8px;">' + detailTags + '</div>' : '') +
      '<div class="gba-cal-desc-list">' + detailNotes.join('') + '</div>' +
    '</div>' + renderUndatedSchedule(undated, sceneDate) + undatedLore;

  body.innerHTML = html;
}


return { state: calendarState, lore: calendarLore, actions: { resetCalendarLore, loadCalendarLore, calendarLoreItems, parseSceneDate, readSceneSchedule, renderScheduleItem, renderUndatedSchedule, renderCalendar, changeCalendarMonth, selectCalendarDay, jumpToSceneDate, openCalendarStory, openCalendarStoriesForDate, closeCalendarStory } };
}
