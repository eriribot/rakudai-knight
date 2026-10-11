import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const relativeModule = 'scripts/黑白ADV轮盘终端/state-reader.js';
const relativeTest = 'scripts/黑白ADV轮盘终端/state-reader-test.mjs';
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
const baselineModule = git(['show', 'HEAD:' + relativeModule]);
const baselineTest = git(['show', 'HEAD:' + relativeTest]);
const modulePath = path.resolve(root, relativeModule).toLowerCase();
const readOriginal = fs.readFileSync;
fs.readFileSync = function readBaseline(target, options) {
  const normalized = path.resolve(target instanceof URL ? fileURLToPath(target) : String(target)).toLowerCase();
  if (normalized !== modulePath) return readOriginal.call(this, target, options);
  const encoding = typeof options === 'string' ? options : options?.encoding;
  return encoding ? baselineModule : Buffer.from(baselineModule);
};
const source = baselineTest.replaceAll('import.meta.url', JSON.stringify(pathToFileURL(path.join(root, relativeTest)).href));
const captured = [], log = console.log;
console.log = (...args) => { captured.push(args.join(' ')); };
await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
console.log = log;
const result = JSON.parse(captured.at(-1));
const report = {
  method: 'HEAD state-reader module held in memory with fs.readFileSync override; HEAD test runs as data URL module preserving original fixture path; no maintained files rewritten',
  baselineCommit: git(['rev-parse', 'HEAD']).trim(),
  paths: [relativeModule, relativeTest],
  maintainedDiff: git(['diff', '--name-only', '--', relativeModule, relativeTest]).trim(),
  passed: result.passed, total: result.total,
  failed: result.checks.filter(item => !item.passed).map(item => ({ name: item.name, error: item.error.split('\n    at ')[0] })),
  checks: result.checks,
};
fs.writeFileSync(path.join(root, 'scratch', 'lime-state-reader-baseline-results.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ baselineCommit: report.baselineCommit, maintainedDiff: report.maintainedDiff, passed: report.passed, total: report.total, failed: report.failed }, null, 2));
process.exitCode = 0;
