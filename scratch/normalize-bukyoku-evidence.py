from pathlib import Path
import json
root=Path(__file__).resolve().parents[1]
epub=root/'resource/knightavatars/research/epub'
def portable(value):
    if isinstance(value,dict): return {k:portable(v) for k,v in value.items()}
    if isinstance(value,list): return [portable(v) for v in value]
    prefix=root.as_posix()+'/'
    if isinstance(value,str) and value.startswith(prefix): return value[len(prefix):]
    return value
for filename in ['bukyoku-evidence.json','character-evidence.json']:
    target=epub/filename
    data=portable(json.loads(target.read_text(encoding='utf-8')))
    record=next(c for c in data['characters'] if c['name']=='碎城雷')
    record['id']='rai'
    if filename=='character-evidence.json':
        record['colorizationRecord']='research/epub/rai-colorization.json'
        record['displayVariant']='用户提供的小说原图裁片的AI上色衍生头像；本地保存完整EPUB原档。'
    target.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Evidence ID rai and portable book references normalized.')
