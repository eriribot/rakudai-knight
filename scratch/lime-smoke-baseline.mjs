import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const terminal = path.join(root, 'scripts', '黑白ADV轮盘终端');
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
const normalized = target => path.resolve(target instanceof URL ? fileURLToPath(target) : String(target)).toLowerCase();
const changed = git(['-c', 'core.quotepath=false', 'diff', '--name-only', '--', 'scripts/黑白ADV轮盘终端'])
  .trim().split(/\r?\n/).filter(Boolean);
const overrides = new Map(changed.map(file => [normalized(path.join(root, file)), git(['show', 'HEAD:' + file])]));
const readOriginal = fs.readFileSync;
fs.readFileSync = function readBaseline(target, options) {
  const replacement = overrides.get(normalized(target));
  if (replacement === undefined) return readOriginal.call(this, target, options);
  const encoding = typeof options === 'string' ? options : options?.encoding;
  return encoding ? replacement : Buffer.from(replacement);
};
function moduleSource(relativePath, source, redirect = {}) {
  const moduleUrl = pathToFileURL(path.join(terminal, relativePath));
  const require = createRequire(moduleUrl);
  return source.replace(/from (['"])([^'"]+)\1/g, (_, quote, specifier) => {
    const resolved = redirect[specifier] || (specifier.startsWith('node:') ? specifier :
      specifier.startsWith('.') ? new URL(specifier, moduleUrl).href : pathToFileURL(require.resolve(specifier)).href);
    return 'from ' + quote + resolved + quote;
  }).replaceAll('import.meta.url', JSON.stringify(moduleUrl.href));
}
const baselineBundle = moduleSource('bundle.mjs', git(['show', 'HEAD:scripts/黑白ADV轮盘终端/bundle.mjs']));
const bundleUrl = 'data:text/javascript;base64,' + Buffer.from(baselineBundle).toString('base64');
const baselineSmoke = moduleSource('smoke-test.mjs', git(['show', 'HEAD:scripts/黑白ADV轮盘终端/smoke-test.mjs']), { './bundle.mjs': bundleUrl });
const captured = [], log = console.log;
console.log = (...args) => { captured.push(args.join(' ')); };
await import('data:text/javascript;base64,' + Buffer.from(baselineSmoke).toString('base64'));
console.log = log;
const result = JSON.parse(captured.at(-1));
const report = {
  method: 'HEAD bundle/main/app/html/package held in memory through fs.readFileSync overrides; HEAD smoke test executes isolated data URL modules with original dependency paths; no maintained files rewritten',
  baselineCommit: git(['rev-parse', 'HEAD']).trim(),
  overridePaths: changed,
  passed: result.passed, total: result.total,
  failed: result.results.filter(item => !item.passed).map(item => ({ name: item.name, error: item.error.split('\n\n    at ')[0] })),
  results: result.results,
};
fs.writeFileSync(path.join(root, 'scratch', 'lime-smoke-baseline-results.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ baselineCommit: report.baselineCommit, overridePaths: changed, passed: report.passed, total: report.total, failed: report.failed }, null, 2));
process.exitCode = 0;
