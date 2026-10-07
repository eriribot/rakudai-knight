// Narrow source definition for the attached Izumi display-regex defect.
// Only the existing findRegex and leading stylesheet wrapper change. The CSS,
// remaining template/scripts, stable ID and every other metadata field stay exact.
export const izumiPlanningRepair = Object.freeze({
  id:'a1a57b61-8f66-4956-bd0c-386c0356e232',
  originalFindRegex:'/([\\s\\S]*)<\\/konatan_planning~>/g',
  findRegex:'/<konatan_planning~>([\\s\\S]*?)<\\/konatan_planning~>/g',
});

export function wrapIzumiPlanningStyle(replacement) {
  if (typeof replacement !== 'string') throw new Error('Izumi planning replacement 不是字符串');
  if (/^<pre hidden><style>[\s\S]*?<\/style><\/pre>/.test(replacement)) return replacement;
  const leadingStyle = replacement.match(/^<style>[\s\S]*?<\/style>/)?.[0];
  if (!leadingStyle) throw new Error('Izumi planning 首段样式结构未知，不能覆盖未知模板');
  return '<pre hidden>' + leadingStyle + '</pre>' + replacement.slice(leadingStyle.length);
}

export function buildIzumiPlanningRepair(preset) {
  const rules = preset?.extensions?.regex_scripts;
  const source = Array.isArray(rules) && rules.find(rule => rule.id === izumiPlanningRepair.id);
  if (!source) throw new Error('找不到所验证的 Izumi planning 美化稳定 ID');
  if (![izumiPlanningRepair.originalFindRegex, izumiPlanningRepair.findRegex].includes(source.findRegex)) {
    throw new Error('Izumi planning 查找模式与验证版本不同，不能覆盖未知修订');
  }
  return {...source,findRegex:izumiPlanningRepair.findRegex,replaceString:wrapIzumiPlanningStyle(source.replaceString)};
}
