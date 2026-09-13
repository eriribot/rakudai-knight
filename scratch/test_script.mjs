import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('.');
const targetJson = path.join(root, '世界书规则/v0.3/导出/落第骑士英雄谭.json');
const wb = JSON.parse(fs.readFileSync(targetJson, 'utf8'));

// 1. Update [剧情]第一卷.终章 (uid 23)
const epiloguePath = path.join(root, '世界书规则/v0.3/13_终章场景.md');
const epilogueText = fs.readFileSync(epiloguePath, 'utf8');
const epilogueBody = epilogueText.match(/<!-- 正文开始 -->\n([\s\S]*?)\n<!-- 正文结束 -->/)[1].trim();

if (!wb.entries[23]) {
  wb.entries[23] = {
    ...wb.entries[13],
    uid: 23,
    displayIndex: 23,
    comment: '[剧情]第一卷.终章',
  };
}
Object.assign(wb.entries[23], {
  order: 105,
  position: 0,
  disable: true,
  key: [],
  keysecondary: [],
  content: epilogueBody,
});

// Helper template for character entry in worldbook
function makeCharacterEntry(uid, order, comment, keys, content) {
  return {
    key: keys,
    keysecondary: [],
    comment: comment,
    content: content.trim(),
    constant: false,
    vectorized: false,
    selective: true,
    selectiveLogic: 0,
    addMemo: true,
    order: order,
    position: 0, // 角色定义前 (↑ Char)
    disable: false,
    excludeRecursion: true,
    preventRecursion: true,
    matchPersonaDescription: false,
    matchCharacterDescription: false,
    matchCharacterPersonality: false,
    matchCharacterDepthPrompt: false,
    matchScenario: false,
    matchCreatorNotes: false,
    delayUntilRecursion: false,
    probability: 100,
    useProbability: true,
    depth: 4,
    group: '',
    groupOverride: false,
    groupWeight: 100,
    scanDepth: null,
    caseSensitive: null,
    matchWholeWords: null,
    useGroupScoring: null,
    automationId: '',
    role: null,
    sticky: 0,
    cooldown: 0,
    delay: 0,
    uid: uid,
    displayIndex: uid,
    ignoreBudget: false,
    outletName: '',
    triggers: [],
    characterFilter: {
      isExclude: false,
      names: [],
      tags: []
    }
  };
}

// Read character content from first-volume Markdown
function getCharContent(filename, tag) {
  const filePath = path.join(root, '第一卷-世界书整理/人物条目', filename);
  let text = fs.readFileSync(filePath, 'utf8').trim();
  if (text.startsWith('<' + tag) && text.endsWith('</' + tag + '>')) {
    return text;
  }
  // If wrapped in markdown headers, convert to worldbook XML format
  // Remove markdown title # ...
  let lines = text.split('\n');
  // Strip metadata header if present
  let startIdx = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('## 一、') || lines[i].startsWith('## 1.') || lines[i].startsWith('## 身份与第一卷定位') || lines[i].startsWith('## 容貌与身材特征') || lines[i].startsWith('【容貌与身材特征】')) {
      startIdx = i;
      break;
    }
  }
  let bodyLines = lines.slice(startIdx);
  // Clean markdown header levels
  let cleanBody = bodyLines.map(line => {
    return line.replace(/^##\s+[一二三四五六七八九十0-9]+、?\s*/, '【').replace(/^##\s+/, '【').replace(/【(.*)$/, (m, p) => p.endsWith('】') ? '【' + p : '【' + p + '】');
  }).join('\n');

  return `<${tag}>\n${cleanBody}\n</${tag}>`;
}

console.log('Setup completed');
