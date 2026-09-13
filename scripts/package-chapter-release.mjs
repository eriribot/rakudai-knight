// Explicit delivery allowlist. No directory recursion, browser access, source deletion or runtime-status changes.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = 'output/chapter-v4/落第骑士-v1.3.6-卷章更新包.zip';
const allowlist = [
  ['output/chapter-v4/落第骑士英雄谭-v1.3.6.json', '正式完整角色卡'],
  ['output/chapter-v4/落第骑士英雄谭-v1.3.6-世界书.json', '正式发布世界书'],
  ['世界书规则/MVU/落第骑士-MVU-v4字段约束.json', 'MVU v4 约束组件'],
  ['scripts/酒馆助手脚本-小手机-黑白ADV轮盘版-v1.3.6.json', '终端 v1.3.6 组件'],
  ['scripts/tavern_helper_ejs_injector.json', '剧情注入器 v3.0.0 组件'],
  ['第一卷-世界书整理/开局页面/index.html', '开局页面'],
  ['世界书规则/MVU/v4_使用与迁移.md', '使用与迁移说明'],
  ['output/chapter-v4/catalogue-check.json', '目录结构与出处检查报告'],
  ['output/chapter-v4/catalogue-01-09.md', '第一至九卷目录校准报告'],
  ['output/chapter-v4/catalogue-10-19.md', '第十至十九卷目录校准报告'],
  ['output/chapter-v4/实施与验收记录.md', '已验证结果与用户接手验收项目'],
];
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const files = allowlist.map(([file, role]) => {
  assert.ok(!/(?:original|prechange|fixture|probe|\.jsonl$)/i.test(file), '正式包不接收备份、聊天或诊断组件');
  const resolved = fs.realpathSync(path.join(root, file));
  const relative = path.relative(root, resolved);
  assert.ok(relative && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative), '文件必须位于项目内');
  const bytes = fs.readFileSync(resolved);
  return { path: file, role, bytes: bytes.length, sha256: sha256(bytes), data: bytes.toString('base64') };
});
assert.equal(new Set(files.map(file => file.path)).size, files.length);
const unpack = file => JSON.parse(Buffer.from(files.find(item => item.path === file).data, 'base64').toString('utf8'));
const card = unpack(allowlist[0][0]);
assert.equal(card.data.character_version, '1.3.6');
for (const file of allowlist.slice(2, 5)) {
  const component = unpack(file[0]);
  const installed = card.data.extensions.tavern_helper.scripts.filter(script => script.name === component.name);
  assert.equal(installed.length, 1, '正式卡组件不唯一：' + component.name);
  assert.equal(installed[0].content, component.content, '正式卡与单独组件不同步：' + component.name);
}
const serializedCard = JSON.stringify(card);
for (const marker of ['__RK_CHAPTER_RUNTIME_PROBE__', 'd03e83b4-5c8a-46a1-9e0c-1a2d46076336', 'RK_EJS_TRUE', '验收员']) {
  assert.equal(serializedCard.includes(marker), false, '正式卡混入合成验收内容：' + marker);
}

const manifest = {
  format: 'rakudai-chapter-release', manifestVersion: 1,
  package: '落第骑士-v1.3.6-卷章更新包',
  versions: { card: '1.3.6', terminal: '1.3.6', stateSchema: 4, stateController: '4.0.0', plotInjector: '3.0.0' },
  layout: '保留仓库相对路径，说明中的正式交付文件链接可在解压后使用。',
  acceptanceRecord: 'output/chapter-v4/实施与验收记录.md',
  packagingDoesNotCertifyRuntime: true,
  excluded: ['原角色卡与原世界书备份', '聊天 JSONL 与其他私聊数据', '合成验收副本', '只读观察器及测试探针', 'prechange.zip', '维护工具与未列入白名单的附件'],
  files: files.map(({ data, ...file }) => file),
};
const manifestBytes = Buffer.from(JSON.stringify(manifest, null, 2) + '\n', 'utf8');
const destination = path.resolve(root, output);
assert.ok(destination.startsWith(root + path.sep));
assert.ok(!files.some(file => path.resolve(root, file.path) === destination));
const payload = {
  destination,
  files: [...files.map(file => ({ path: file.path, data: file.data, sha256: file.sha256 })), { path: 'manifest.json', data: manifestBytes.toString('base64'), sha256: sha256(manifestBytes) }],
};
const python = `import sys,json,base64,hashlib,io,zipfile,pathlib
request=json.loads(sys.stdin.buffer.read().decode('utf-8'))
buffer=io.BytesIO()
with zipfile.ZipFile(buffer,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as archive:
 for item in request['files']:
  data=base64.b64decode(item['data'],validate=True)
  assert hashlib.sha256(data).hexdigest()==item['sha256']
  info=zipfile.ZipInfo(item['path'],date_time=(1980,1,1,0,0,0))
  info.compress_type=zipfile.ZIP_DEFLATED
  info.create_system=3
  info.external_attr=0o100644<<16
  archive.writestr(info,data,compress_type=zipfile.ZIP_DEFLATED,compresslevel=9)
buffer.seek(0)
with zipfile.ZipFile(buffer,'r') as archive:
 assert archive.namelist()==[item['path'] for item in request['files']]
 for item in request['files']:
  assert hashlib.sha256(archive.read(item['path'])).hexdigest()==item['sha256']
pathlib.Path(request['destination']).write_bytes(buffer.getvalue())
print(json.dumps({'entries':len(request['files']),'bytes':len(buffer.getvalue())}))`;
const result = spawnSync('python', ['-c', python], { input: JSON.stringify(payload), encoding: 'utf8', cwd: root, timeout: 30000, maxBuffer: 1024 * 1024 });
assert.equal(result.status, 0, result.error?.message || result.stderr);
const archive = fs.readFileSync(destination);
console.log(JSON.stringify({ output, ...JSON.parse(result.stdout), sha256: sha256(archive), manifestSha256: sha256(manifestBytes), sourceFiles: files.length, runtimeAcceptance: '以随包实施与验收记录为准，本次打包不改变结论' }, null, 2));
