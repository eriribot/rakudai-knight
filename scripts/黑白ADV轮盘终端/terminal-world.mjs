// Business identity is independent of the locally selected appearance.
export function resolveTerminalWorld(state) {
  const system = state?.系统;
  if (!system || typeof system !== 'object') return null;
  if (Object.hasOwn(system, '作品')) return ['rakudai', 'asterisk'].includes(system.作品) ? system.作品 : null;
  // Existing saved v4 games predate the world discriminator.
  return system.结构版本 === 4 && system.开局状态 === '已建档' &&
    ['场景', '玩家', '人际'].every(key => state[key] && typeof state[key] === 'object' && !Array.isArray(state[key])) ? 'rakudai' : null;
}
export function normalizeTerminalAppearance(value) {
  return ['auto', 'rakudai', 'asterisk'].includes(value) ? value : 'auto';
}
export function resolveTerminalAppearance(preference, world) {
  const setting = normalizeTerminalAppearance(preference);
  return setting === 'auto' ? (world === 'asterisk' ? 'asterisk' : 'rakudai') : setting;
}
