#!/usr/bin/env node
/**
 * MVU v5 完整性校验脚本
 * 检查新版本文件的结构、引用和一致性
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MVU_DIR = path.join(__dirname, '../世界书规则/MVU');

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m'
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

function logSection(title) {
  console.log();
  log(`${'═'.repeat(60)}`, 'cyan');
  log(title, 'cyan');
  log(`${'═'.repeat(60)}`, 'cyan');
}

// 检查项计数
const checks = {
  passed: 0,
  failed: 0,
  warnings: 0
};

function pass(msg) {
  checks.passed++;
  log(`✓ ${msg}`, 'green');
}

function fail(msg) {
  checks.failed++;
  log(`✗ ${msg}`, 'red');
}

function warn(msg) {
  checks.warnings++;
  log(`⚠ ${msg}`, 'yellow');
}

// 必需文件检查
function checkRequiredFiles() {
  logSection('1. 必需文件检查');
  
  const required = [
    '变量更新规则-v5-优化版.txt',
    '字段定义表-v5.txt',
    '变量输出格式-v5.txt',
    '选拔赛T02规范-v5.txt',
    '[initvar]变量初始化-v5.yaml'
  ];
  
  required.forEach(file => {
    const fullPath = path.join(MVU_DIR, file);
    if (fs.existsSync(fullPath)) {
      pass(`${file} 存在`);
    } else {
      fail(`${file} 缺失`);
    }
  });
}

// 文件内容结构检查
function checkFileStructure() {
  logSection('2. 文件结构检查');
  
  // 检查核心规则文件
  const rulesPath = path.join(MVU_DIR, '变量更新规则-v5-优化版.txt');
  if (fs.existsSync(rulesPath)) {
    const content = fs.readFileSync(rulesPath, 'utf-8');
    
    // 检查关键章节
    const sections = [
      '30秒执行清单',
      '五条铁律',
      '核心字段规范',
      '场景与剧情',
      '操作规范'
    ];
    
    sections.forEach(section => {
      if (content.includes(section)) {
        pass(`规则文件包含章节: ${section}`);
      } else {
        fail(`规则文件缺少章节: ${section}`);
      }
    });
    
    // 检查是否还有过多"不要"指令
    const dontCount = (content.match(/不要|不能|禁止/g) || []).length;
    if (dontCount < 30) {
      pass(`负向指令数量合理: ${dontCount}条`);
    } else {
      warn(`负向指令偏多: ${dontCount}条 (目标<30)`);
    }
  }
  
  // 检查字段定义表
  const fieldsPath = path.join(MVU_DIR, '字段定义表-v5.txt');
  if (fs.existsSync(fieldsPath)) {
    const content = fs.readFileSync(fieldsPath, 'utf-8');
    
    const fieldSections = [
      '系统字段',
      '场景字段',
      '玩家 - 基础字段',
      '玩家 - 成长系统',
      '人际字段',
      '选拔赛字段'
    ];
    
    fieldSections.forEach(section => {
      if (content.includes(section)) {
        pass(`字段表包含: ${section}`);
      } else {
        fail(`字段表缺少: ${section}`);
      }
    });
    
    // 检查关键字段定义
    const keyFields = [
      '/玩家/魔人觉醒',
      '/玩家/成长/经验',
      '/人际/<姓名>/好感',
      '/人际/<姓名>/支援度',
      '/场景/选拔赛'
    ];
    
    keyFields.forEach(field => {
      if (content.includes(field)) {
        pass(`关键字段已定义: ${field}`);
      } else {
        fail(`关键字段缺失: ${field}`);
      }
    });
  }
}

// 交叉引用检查
function checkCrossReferences() {
  logSection('3. 交叉引用检查');
  
  const rulesPath = path.join(MVU_DIR, '变量更新规则-v5-优化版.txt');
  const outputPath = path.join(MVU_DIR, '变量输出格式-v5.txt');
  
  if (fs.existsSync(rulesPath) && fs.existsSync(outputPath)) {
    const rulesContent = fs.readFileSync(rulesPath, 'utf-8');
    const outputContent = fs.readFileSync(outputPath, 'utf-8');
    
    // 检查是否引用了字段定义表
    if (rulesContent.includes('字段定义表') || rulesContent.includes('字段定义')) {
      pass('规则文件引用字段定义表');
    } else {
      warn('规则文件未明确引用字段定义表');
    }
    
    if (outputContent.includes('字段定义表')) {
      pass('输出格式引用字段定义表');
    } else {
      warn('输出格式未明确引用字段定义表');
    }
    
    // 检查版本一致性
    const rulesVersion = rulesContent.match(/v5|版本.*5/i);
    const outputVersion = outputContent.match(/v5|版本.*5/i);
    
    if (rulesVersion && outputVersion) {
      pass('版本标识一致');
    } else {
      warn('版本标识可能不一致');
    }
  }
}

// 初始化文件检查
function checkInitFile() {
  logSection('4. 初始化文件检查');
  
  const initPath = path.join(MVU_DIR, '[initvar]变量初始化-v5.yaml');
  if (fs.existsSync(initPath)) {
    const content = fs.readFileSync(initPath, 'utf-8');
    
    // 检查结构版本
    if (content.includes('结构版本: 5')) {
      pass('结构版本号正确: 5');
    } else {
      fail('结构版本号不是 5');
    }
    
    // 检查必需字段
    const requiredFields = [
      '系统:',
      '场景:',
      '玩家:',
      '人际:',
      '魔人觉醒: false'
    ];
    
    requiredFields.forEach(field => {
      if (content.includes(field)) {
        pass(`初始化包含: ${field}`);
      } else {
        fail(`初始化缺少: ${field}`);
      }
    });
  }
}

// 文档完整性检查
function checkDocumentation() {
  logSection('5. 文档检查');
  
  const docs = [
    'v5-优化版说明.md',
    'v5-快速对比手册.md'
  ];
  
  docs.forEach(doc => {
    const fullPath = path.join(MVU_DIR, doc);
    if (fs.existsSync(fullPath)) {
      pass(`文档存在: ${doc}`);
      
      const content = fs.readFileSync(fullPath, 'utf-8');
      const length = content.length;
      log(`  文档长度: ${length} 字符`, 'dim');
      
      // 检查关键章节
      if (doc === 'v5-优化版说明.md') {
        const sections = ['核心变更', '设计理念', '使用方式'];
        sections.forEach(section => {
          if (content.includes(section)) {
            pass(`  包含章节: ${section}`);
          }
        });
      }
    } else {
      warn(`文档缺失: ${doc}`);
    }
  });
}

// Token 估算
function estimateTokens() {
  logSection('6. Token 使用估算');
  
  const files = [
    '变量更新规则-v5-优化版.txt',
    '变量输出格式-v5.txt',
    '选拔赛T02规范-v5.txt'
  ];
  
  let totalChars = 0;
  
  files.forEach(file => {
    const fullPath = path.join(MVU_DIR, file);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      const chars = content.length;
      const estimatedTokens = Math.ceil(chars / 2.5); // 粗略估算
      totalChars += chars;
      log(`${file}:`, 'dim');
      log(`  字符数: ${chars}, 估算 tokens: ~${estimatedTokens}`, 'dim');
    }
  });
  
  const totalTokens = Math.ceil(totalChars / 2.5);
  log(`\n注入总计 (含选拔赛):`, 'cyan');
  log(`  字符数: ${totalChars}, 估算 tokens: ~${totalTokens}`, 'cyan');
  
  // 计算未开赛时的 token（不含选拔赛规范）
  const withoutTournament = totalTokens - 1465;
  log(`未开赛时: ~${withoutTournament} tokens (不含选拔赛规范)`, 'dim');
  
  // v4 baseline: ~4192 tokens
  if (totalTokens < 4200) {
    pass(`Token 使用优秀: ~${totalTokens} (v4为~4192)`);
  } else if (totalTokens < 5000) {
    warn(`Token 使用可接受: ~${totalTokens} (v4为~4192)`);
  } else {
    fail(`Token 使用过高: ~${totalTokens} (v4为~4192)`);
  }
  
  if (withoutTournament < 3000) {
    pass(`未开赛优化显著: ~${withoutTournament} tokens (-${1465} 通过条件注入)`);
  }
}

// v4 兼容性检查
function checkBackwardCompatibility() {
  logSection('7. v4 兼容性检查');
  
  const v4Files = [
    '变量更新规则.txt',
    '变量输出格式.txt',
    '[initvar]变量初始化.yaml'
  ];
  
  let v4Exists = 0;
  v4Files.forEach(file => {
    if (fs.existsSync(path.join(MVU_DIR, file))) {
      v4Exists++;
    }
  });
  
  if (v4Exists === v4Files.length) {
    pass('v4 文件保留完整，可平滑迁移');
  } else if (v4Exists > 0) {
    warn(`部分 v4 文件保留 (${v4Exists}/${v4Files.length})`);
  } else {
    warn('未保留 v4 文件，无法回滚');
  }
}

// 主函数
function main() {
  log('\n╔═══════════════════════════════════════════════════════════╗', 'cyan');
  log('║         MVU v5 完整性校验脚本                            ║', 'cyan');
  log('╚═══════════════════════════════════════════════════════════╝', 'cyan');
  
  checkRequiredFiles();
  checkFileStructure();
  checkCrossReferences();
  checkInitFile();
  checkDocumentation();
  estimateTokens();
  checkBackwardCompatibility();
  
  // 总结
  logSection('校验结果汇总');
  log(`通过: ${checks.passed}`, 'green');
  log(`失败: ${checks.failed}`, 'red');
  log(`警告: ${checks.warnings}`, 'yellow');
  
  console.log();
  
  if (checks.failed === 0 && checks.warnings === 0) {
    log('✓ v5 文件完整且符合规范，可以投入使用！', 'green');
    process.exit(0);
  } else if (checks.failed === 0) {
    log('⚠ v5 文件基本完整，但有一些警告需要注意', 'yellow');
    process.exit(0);
  } else {
    log('✗ 发现严重问题，建议修复后再使用', 'red');
    process.exit(1);
  }
}

main();
