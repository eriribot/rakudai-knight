#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { decodeCard, encodeCard, makeCompatibleCard } from './core.mjs';

const usage = `角色卡兼容更新：保留旧卡身份和禁用选择，内容取自新版。

node scripts/角色卡兼容更新/compat-update.mjs --old <旧卡.png|json> --new <新版.png|json> --version <新版版本号> --out <新输出文件> [--write]

默认只校验并显示计划。--write 才创建新的更新包及 .report.json，不覆盖已有文件。
旧卡应是升级前的卡；发行包仅代表作者默认值，不能代表玩家本地开关。
输出必须在原角色的“更多 → 替换/更新”使用；不会修改许可名单或聊天。`;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

function parseArgs(args) {
  const result = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help') return { help: true };
    if (arg === '--write') {
      if (result.write) throw new Error('重复参数 --write');
      result.write = true;
      continue;
    }
    if (!['--old', '--new', '--version', '--out'].includes(arg)) throw new Error('未知参数：' + arg);
    const key = arg.slice(2);
    if (Object.hasOwn(result, key) || !args[i + 1] || args[i + 1].startsWith('--')) throw new Error('重复参数或缺少参数值：' + arg);
    result[key] = args[++i];
  }
  for (const key of ['old', 'new', 'version', 'out']) if (!result[key]) throw new Error('缺少参数 --' + key);
  return result;
}

try {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage);
  } else {
    const oldPath = fs.realpathSync(path.resolve(args.old));
    const newPath = fs.realpathSync(path.resolve(args.new));
    const outputPath = path.resolve(args.out);
    const reportPath = outputPath + '.report.json';
    const canonical = value => process.platform === 'win32' ? value.toLowerCase() : value;
    const paths = [oldPath, newPath].map(canonical);
    if ([outputPath, reportPath].some(value => paths.includes(canonical(value)))) throw new Error('输出不能覆盖输入卡');
    for (const file of [outputPath, reportPath]) {
      try { fs.lstatSync(file); throw new Error('输出已存在，拒绝覆盖：' + file); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    const oldBytes = fs.readFileSync(oldPath);
    const newBytes = fs.readFileSync(newPath);
    const old = decodeCard(oldBytes, oldPath);
    const fresh = decodeCard(newBytes, newPath);
    if (path.extname(outputPath).toLowerCase() !== '.' + fresh.format) throw new Error('输出扩展名须与新版输入格式一致：.' + fresh.format);
    const aliases = JSON.parse(fs.readFileSync(new URL('./known-components.json', import.meta.url), 'utf8'));
    const prepared = makeCompatibleCard(old.card, fresh.card, { version: args.version,
      regexAliasGroups: aliases.regexAliasGroups, helperAliasGroups: aliases.helperAliasGroups });
    const outputBytes = encodeCard(fresh, prepared.card);
    const decodedOutput = decodeCard(outputBytes, outputPath);
    if (!isDeepStrictEqual(decodedOutput.card, prepared.card)) throw new Error('输出重新解码与预期卡不一致');
    const report = {
      schemaVersion: 1, mode: args.write ? 'write-new-file' : 'dry-run',
      tool: path.basename(fileURLToPath(import.meta.url)),
      inputs: { old: { path: oldPath, sha256: hash(oldBytes) }, new: { path: newPath, sha256: hash(newBytes) } },
      output: { path: outputPath, reportPath, bytes: outputBytes.length, sha256: hash(outputBytes), format: fresh.format },
      compatibility: prepared.report,
      boundary: '仅身份和明确匹配组件的禁用选择迁移。新卡代码、世界书、变量定义与资源保留。用户许可、楼层MVU和浏览器头像配置不在PNG中；本工具不读写它们。',
      install: '在原角色中使用更多→替换/更新；不要新增导入为另一张卡。',
      runtimeAcceptance: 'pending; offline artifact validation only',
    };
    if (args.write) {
      // Recheck inputs immediately before writing. Never overwrite a release or export.
      if (hash(fs.readFileSync(oldPath)) !== report.inputs.old.sha256 || hash(fs.readFileSync(newPath)) !== report.inputs.new.sha256) throw new Error('输入在检查期间发生变化');
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      let wroteCard = false;
      try {
        fs.writeFileSync(outputPath, outputBytes, { flag: 'wx' });
        wroteCard = true;
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
      } catch (error) {
        // Roll back only the new file created by this invocation; no recursive deletion.
        if (wroteCard && hash(fs.readFileSync(outputPath)) === report.output.sha256) fs.unlinkSync(outputPath);
        throw error;
      }
    }
    console.log(JSON.stringify(report, null, 2));
  }
} catch (error) {
  console.error('兼容更新未生成：' + error.message);
  process.exitCode = 1;
}
