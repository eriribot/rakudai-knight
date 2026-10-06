from pathlib import Path
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')
root = Path(__file__).resolve().parents[2]
work = Path(__file__).resolve().parent

def read(path):
    return path.read_text(encoding='utf-8-sig')

def demote(markdown):
    return re.sub(r'^(#+) ', r'##\1 ', markdown.strip(), flags=re.M)

intro = '''# 三人人物条目：考据索引与创作说明

2026-10-04：按用户提供的绚濑范例，将福小莉、艾茵、多多良正文统一为人物标签内的九栏结构。正文用于人物调用；本文件保存原有证据与编辑边界，避免把考据过程一并塞入人物提示词。

- 保留已核实的原著事实与少量准确台词；没有依据的身高、瞳色、六维不补值。
- 福小莉仅写〈仙人／魔人〉境界，不拟造 A–S 六维。多多良保留第六卷官方人物页 B 级及六维；艾茵无已核实的可用等级、六维或魔人身份，不套用他人的数据。
- 艾茵条目仍以第十一卷为默认时间点，后卷揭示明确标出；多多良的伤情随卷次变化，不将疗养期写成终身状态。
- 下方保留的多多良 [Yxx] 是旧稿的证据编号；新版正文不带编号，核验时按能力名、场景与卷次查对应项。

## 福小莉恋爱路线：用户指定的创作方向

用户希望借鉴《空之轨迹》艾丝蒂尔的恋爱历程。本次将其转化为“并肩相处—察觉特别的在意—认清自己的心意—主动表达与共同成长”，写在【与玩家互动指南】并注明创作推演。它不属于《落第骑士英雄谭》的既定恋爱事实。

参考 [Falcom《空之轨迹 SC》官方故事介绍](https://www.falcom.co.jp/ed6_sc/story/story.html)：艾丝蒂尔在共同旅行中越来越明白约修亚的重要，分别后主动踏上寻找他的旅程。这里只借感情逐渐自觉与主动行动的进程，不移植两人的亲属背景、身份秘密或固定离别事件。

小莉的具体反应依她原有性格展开：邀战、同行、吃饭和分享见闻；开始在意时偶有笨拙，想清楚以后直接表达，关系仍取决于双方回应。她保留武道追求、朋友与独立选择。

## 福小莉原著与能力核查

'''
xiaoli_abilities = read(root / 'scratch/xiaoli-entry-abilities/ability-evidence.md')
xiaoli_later = read(root / 'scratch/xiaoli-entry-later-evidence.md')
yui = read(work / 'yui/appendix.md')
ein = read(work / 'ein/appendix.md').replace('(../../', '(../')
combined = (intro + demote(xiaoli_abilities) + '\n\n'
            + demote(xiaoli_later) + '\n\n## 多多良原有考据附录\n\n'
            + demote(yui) + '\n\n## 艾茵原有元数据与考据附录\n\n'
            + demote(ein) + '\n')
output = root / '人物仔细考究/三人人物条目_考据索引与创作说明.md'
output.write_text(combined, encoding='utf-8', newline='\n')

headings = ['容貌与身材特征', '衣着与随身装扮', '核心性格特征', '标志性台词',
            '能力维度与六维属性', '能力与核心战斗风格', '正典关系与状态', '与玩家互动指南', '禁止误写']
targets = [('人物仔细考究/福小莉.md', 'Fu Xiaoli', 'xiaoli/福小莉.before.md'),
           ('人物仔细考究/不转杀手_多多良幽衣_菲亚.md', 'Tatara Yui', 'yui/original.md'),
           ('第十一卷-世界书整理/人物条目/艾茵_恶之华.md', 'Ein', 'ein/original.md')]
for relative, tag, backup in targets:
    current = read(root / relative).strip()
    assert current.startswith(f'<{tag}>') and current.endswith(f'</{tag}>'), relative
    assert current.count(f'<{tag}>') == 1 and current.count(f'</{tag}>') == 1, relative
    assert re.findall(r'^【([^】]+)】$', current, re.M) == headings, relative
    assert '```' not in current and not re.search(r'\[Y\d+\]', current), relative
    previous = read(work / backup)
    print(f'{relative}: {len(previous)} -> {len(current)} characters; nine headings and tags OK')

xiaoli = read(root / targets[0][0])
assert '创作推演' in xiaoli and '不填字母评级' in xiaoli
yui_body = read(root / targets[1][0])
assert '攻击力 C／防御力 A／魔力量 D／魔力控制 C／体能 B／运气 C' in yui_body
assert demote(yui) in combined and demote(ein) in combined
print('Evidence retained; Xiaoli romance and missing stats explicitly separated; Yui official stats unchanged.')
