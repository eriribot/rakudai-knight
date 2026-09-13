from pathlib import Path
import copy
import json
import re

base = Path(__file__).resolve().parent
queries = json.loads((base / 'query-receipts.json').read_text(encoding='utf-8'))
records = {r['id']: r for r in queries[0]['result']['records']}
assert len(records) == 4
def prose(group):
    return records['lunaseyes-v10-' + group]['body'].split('\n\n', 1)[1]

profile = prose('profile').replace('第十卷未给出确切年龄、身高、发长、惯常发型或常服；未明确其个人伐刀者能力。', '')
relations = prose('relationship').replace('本卷并未说明两人是恋爱关系。', '')
manner = prose('manner').split('\n\n')[0]
manner += '\n\n行为概括：从这些对白可把握她直率、会调侃、做事有主见的一面。'
events = prose('event')
events += '\n\n行为概括：她会预留援助手段、安排条件并借公开承诺推进事情；这可从备用广播、取得父王首肯和向国民宣告的行动看出。'

parts = [
    ('露娜艾丝｜身份、外貌与工作', profile.strip(), ['lunaseyes-v10-profile']),
    ('露娜艾丝｜说话、相处与人物关系', manner + '\n\n' + relations, ['lunaseyes-v10-manner', 'lunaseyes-v10-relationship']),
    ('露娜艾丝｜婚约试题与外交行动', events, ['lunaseyes-v10-event', 'lunaseyes-v10-manner'])
]
template = json.loads((base.parent / 'inputs/entry-template.json').read_text(encoding='utf-8-sig'))
entries = {}
md = '# 露娜艾丝·法米利昂世界书\n\n知识范围：原作小说第十卷结束时。\n'
mapping = {}
for uid, (title, content, source_ids) in enumerate(parts):
    item = copy.deepcopy(template)
    item.update(uid=uid, displayIndex=uid, order=100 + uid, comment=title, content=content,
                key=['露娜艾丝', '露娜', '露娜姊', '露娜姐', '史黛菈的姐姐', '史黛菈的姊姊'])
    entries[str(uid)] = item
    mapping[str(uid)] = [{'id': rid, 'markdown_sha256': records[rid]['markdown_sha256'],
                         'source_path': 'library/' + records[rid]['source_path']} for rid in source_ids]
    md += '\n## 条目 ' + str(uid) + '｜' + title + '\n\n触发词：' + '、'.join(item['key']) + '\n\n' + content + '\n'

for name in ('worldbook.md', 'worldbook.json', 'evidence.json'):
    assert not (base / name).exists(), 'Final output already exists: ' + name
(base / 'worldbook.md').write_text(md, encoding='utf-8', newline='\n')
(base / 'worldbook.json').write_text(json.dumps({'entries': entries}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')
evidence = json.loads((base / 'candidate-evidence.json').read_text(encoding='utf-8'))
evidence['entry_sources'] = mapping
evidence['status_note'] = 'direct 表示该措辞可由原文直接核对；人物转述仍保留据约翰、似乎等限制。inference 是明确标注的行为概括，不自动升格为原文设定。'
(base / 'evidence.json').write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')
all_content = ''.join(e['content'] for e in entries.values())
print(json.dumps({'entries': len(entries), 'content_unicode_characters': len(all_content),
                  'content_cjk_characters': len(re.findall(r'[\u3400-\u4dbf\u4e00-\u9fff]', all_content))}, ensure_ascii=False))
print(md)
