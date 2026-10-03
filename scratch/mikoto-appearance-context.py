from pathlib import Path
import zipfile,re,json,sys
sys.stdout.reconfigure(encoding='utf-8')
root=Path(__file__).resolve().parents[1]
hits=[]
for epub in sorted((root/'39688').glob('*.epub')):
    with zipfile.ZipFile(epub) as z:
        for member in z.namelist():
            if not member.endswith(('.xhtml','.html','.htm')): continue
            lines=z.read(member).decode('utf-8',errors='replace').splitlines()
            contexts=set()
            for i,line in enumerate(lines):
                if '鹤屋' in line or '鶴屋' in line: contexts.update(range(max(0,i-7),min(len(lines),i+8)))
            for i in sorted(contexts):
                text=re.sub('<[^>]+>','',lines[i]).strip()
                if re.search('金|灰|瞳|眼睛|虹膜|发丝|髮|制服|衣服|白色|黑色|青白|绿|绿色|蓝色|紫色|褐色',text):
                    hits.append({'sourceEpub':epub.relative_to(root).as_posix(),'xhtml':member,'line':i+1,'text':text})
out=root/'resource/knightavatars/research/epub/mikoto-appearance-search.json'
out.write_text(json.dumps(hits,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
for h in hits: print(h['sourceEpub'],h['xhtml'],h['line'],h['text'])
