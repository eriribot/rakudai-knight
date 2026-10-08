// 只修复已被 MVU 解析的对象型 add/replace 批次；不猜字段、不改原状态或业务校验。
export function normalizeRakudaiMvuCommands(commands, state) {
  if (!Array.isArray(commands) || !commands.length) return commands;
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const reserved = key => ['__proto__', 'prototype', 'constructor'].includes(key);
  const safeValue = value => value === null || ['string', 'boolean'].includes(typeof value) ||
    typeof value === 'number' && Number.isFinite(value) ||
    value && typeof value === 'object' && Object.entries(value).every(([key, child]) => !reserved(key) && safeValue(child));
  const commandPath = parts => parts.map(part => '[' + JSON.stringify(part) + ']').join('');
  const pointer = parts => '/' + parts.map(part => part.replace(/~/g, '~0').replace(/\//g, '~1')).join('/');
  const commandFor = (original, op, parts) => ({ ...original, type: op.op === 'replace' ? 'set' : 'insert',
    full_match: JSON.stringify(op), args: op.op === 'replace' ? [commandPath(parts), JSON.stringify(op.value)] :
      [commandPath(parts.slice(0, -1)), /^\d+$/.test(parts.at(-1)) ? parts.at(-1) : JSON.stringify(parts.at(-1)), JSON.stringify(op.value)] });
  // 只复制命中的父路径；不为一次新人物补丁深拷贝全部历史与 $internal 镜像。
  const draft = object(state) ? { ...state } : null, groups = new Map(), rows = [];
  try {
    for (const command of commands) {
      if (command?.reason !== 'json_patch') return commands;
      const op = JSON.parse(command.full_match);
      if (!['add', 'replace'].includes(op?.op) || typeof op.path !== 'string' || !op.path.startsWith('/') ||
          /~(?![01])/.test(op.path) || !Object.hasOwn(op, 'value') || !safeValue(op.value)) return commands;
      const parts = op.path.slice(1).split('/').map(part => part.replace(/~1/g, '/').replace(/~0/g, '~'));
      if (parts.length < 2 || !['玩家', '场景', '人际'].includes(parts[0]) || parts.some(part => !part || reserved(part))) return commands;
      const expected = commandFor(command, op, parts);
      // 其他监听器已经修正的命令不从 full_match 还原，避免覆盖它们的处理结果。
      if (command.type !== expected.type || JSON.stringify(command.args) !== JSON.stringify(expected.args)) return commands;
      let original = state, parent = draft, missing;
      for (let index = 0; index < parts.length; index++) {
        const key = parts[index], last = index === parts.length - 1;
        if (!object(parent)) return commands; // null、原始值和数组父级均不自动覆盖或猜类型。
        if (!missing) {
          if (!object(original)) return commands;
          if (!Object.hasOwn(original, key)) missing = parts.slice(0, index + 1);
          else original = original[key];
        }
        if (last) {
          // 已有容器的整对象替换保留原命令语义，不在此展开、合并或重新排序。
          if (!missing && (original !== null && typeof original === 'object' || op.value !== null && typeof op.value === 'object')) return commands;
          parent[key] = structuredClone(op.value);
        } else {
          if (!Object.hasOwn(parent, key)) parent[key] = {};
          else if (object(parent[key])) parent[key] = { ...parent[key] };
          parent = parent[key];
        }
      }
      const groupKey = missing ? pointer(missing) : null;
      if (groupKey && !groups.has(groupKey)) groups.set(groupKey, { parts: missing, first: rows.length });
      rows.push({ command, groupKey });
    }
  } catch (_) { return commands; }
  let changed = false;
  const result = rows.flatMap(({ command, groupKey }, index) => {
    if (!groupKey) return [command];
    const group = groups.get(groupKey);
    if (group.first !== index) { changed = true; return []; }
    const value = group.parts.reduce((node, key) => node[key], draft);
    const op = { op: 'add', path: groupKey, value };
    const next = commandFor(command, op, group.parts);
    if (next.type === command.type && JSON.stringify(next.args) === JSON.stringify(command.args)) return [command];
    changed = true;
    return [next];
  });
  return changed ? result : commands;
}
