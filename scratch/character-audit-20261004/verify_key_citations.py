from pathlib import Path
import sys

sys.stdout.reconfigure(encoding='utf-8')
base = Path(__file__).resolve().parent
checks = [
    ('五', 1041, '珠雫才惊觉对方的身高和眼前的人一模一样', '05', 'Chapter001'),
    ('五', 1397, '身材娇小，肌肤也有点糟糕，感觉营养状况不好呢', '05', 'Chapter001'),
    ('六', 341, '半永久性的黑眼圈，完全消不掉', '06', 'Chapter001'),
    ('十二', 4809, '巧克力比较类似工作报酬，是劳动的代价', '12', 'Chapter003'),
    ('十二', 4907, '我大概也能稍微对这份卑贱的工作感到自豪吧', '12', 'Chapter003'),
    ('十三', 4355, '受了伤的「因果」反弹给对手', '13', 'Chapter004'),
    ('十三', 5335, '她的左手被扯了下来', '13', 'Chapter004'),
    ('十三', 5539, '行星行走于宇宙的力量', '13', 'Chapter004'),
    ('十五', 6104, '大约花上一年就能重操旧业', '15', 'Chapter004'),
    ('十五', 6590, '我的名字是「菲亚」', '15', 'Chapter004'),
    ('十一', 1793, '绝不会杀死宿主', '11', 'Chapter002'),
    ('十一', 5196, '垂枝而下的漆黑花朵', '11', 'Chapter005'),
    ('十一', 6450, '吸血女王', '11', 'Chapter005'),
    ('十九', 6993, '我会去参加，不要每一分钟都发讯息来', '19', 'chapter6'),
]

def normalize(s):
    return s.replace('「', '').replace('」', '').replace('『', '').replace('』', '').replace('著', '着').replace('彷佛', '仿佛')

failures = []
for cn, line, phrase, number, member in checks:
    lines = (base / 'txt' / f'落第骑士英雄谭 第{cn}卷 gbk.txt').read_text(encoding='utf-8').split('\n')
    folder = f'[台版]落第骑士英雄谭 {number}' if number != '19' else '落第骑士英雄谭 - 19'
    epub = (base / 'epub' / folder / f'OEBPS__Text__{member}.xhtml.txt').read_text(encoding='utf-8')
    if normalize(phrase) not in normalize(lines[line-1]):
        failures.append(f'TXT 卷{cn} L{line}: {phrase}')
    if normalize(phrase) not in normalize(epub):
        failures.append(f'EPUB 卷{cn} {member}: {phrase}')

profile = (base / 'epub' / '[台版]落第骑士英雄谭 06' / 'OEBPS__Text__Chapter001.xhtml.txt').read_text(encoding='utf-8')
block = profile[profile.index('多多良幽衣YUI TATARA'):]
compact = ''.join(block.split())
for fact in ['伐刀者等级：B', '攻击力C防御力A', '魔力量D魔力控制C', '体能B运气C']:
    if fact not in compact:
        failures.append(f'EPUB profile: {fact}')

if failures:
    print('\n'.join(failures))
    raise SystemExit(1)
print(f'PASS: {len(checks)} key quotations match exact original TXT lines and EPUB chapter members; B rank and all six attributes verified.')
