from pathlib import Path
import json

root = Path(__file__).resolve().parents[1]
epub = root / 'resource/knightavatars/research/epub'
main_path = epub / 'character-evidence.json'
main = json.loads(main_path.read_text(encoding='utf-8'))
new = json.loads((epub / 'volume-5-9-evidence.json').read_text(encoding='utf-8'))['characters']
ein = json.loads((epub / 'ein-evidence.json').read_text(encoding='utf-8'))
ein['evidence'] = ein.pop('identityEvidence')
new.append(ein)

def portable(item):
    if isinstance(item, dict):
        return {k: portable(v) for k, v in item.items()}
    if isinstance(item, list):
        return [portable(v) for v in item]
    if isinstance(item, str) and item.startswith(str(root).replace('\\','/')+'/'):
        return item[len(str(root))+1:]
    return item

for item in new:
    item = portable(item)
    if item['id'] == 'rinna':
        item['imageIdentityNote'] += ' 本地终端使用该图的内置imagegen上色衍生头像，原黑白文件仍在novel/rinna-original.jpg存档。'
        item['colorizationRecord'] = 'research/epub/rinna-colorization.json'
    old = next((i for i,c in enumerate(main['characters']) if c['id']==item['id']), None)
    if old is None:
        main['characters'].append(item)
    else:
        main['characters'][old] = item
main_path.write_text(json.dumps(main,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
record_path = epub / 'rinna-colorization.json'
record = json.loads(record_path.read_text(encoding='utf-8'))
record['inputs'][1]['sourceMember'] = 'OEBPS/Images/190216.jpg'
record['inputs'][1]['note'] = '第18卷190216.jpg右侧凛奈的头脸裁片；仅参考淡粉红发与红褐眼色，具名正文依据见character-evidence.json#rinna的colorReference。'
record['preservedOriginalBw'] = 'resource/knightavatars/novel/rinna-original.jpg'
record['scope'] = '上色步骤生成衍生图；主清单另保存原黑白来源，并记录AI上色状态、来源与裁盾结果。'
record_path.write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(f"Evidence: {len(main['characters'])} novel characters.")
