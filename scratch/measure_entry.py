import re, sys
sys.stdout.reconfigure(encoding='utf-8')
p = r'DLC/学战研究/第一卷-世界书整理/词条与设定条目/天雾辰明流_剑术组讨术招式体系全卷总览.md'
t = open(p, encoding='utf-8').read()
m = re.search(r"```xml\s*(<[\s\S]+?>)\s*```", t)
xml = m.group(1)
cjk = len(re.findall(r'[\u4e00-\u9fff]', xml))
cp = len(re.findall(r'[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]', xml))
other = len(xml) - cp
print('xml len', len(xml), 'cjk', cjk, 'est tokens', int(cp*0.95 + other*0.30))
print('has CH-/#L:', bool(re.search(r'CH-\d+|#L\d+', xml)))
print('has ***:', '***' in t)
