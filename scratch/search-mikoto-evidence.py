from pathlib import Path
import zipfile,re,json
root=Path(__file__).resolve().parents[1]
hits=[]
patterns=['鹤屋','鶴屋','灰金','冰霜冷笑','TSURUYA','Mikoto','京文学','京文學']
for epub in sorted((root/'39688').glob('*.epub')):
    with zipfile.ZipFile(epub) as z:
        for member in z.namelist():
            if not member.endswith(('.xhtml','.html','.htm')): continue
            raw=z.read(member).decode('utf-8',errors='replace')
            lines=raw.splitlines()
            for i,line in enumerate(lines):
                if any(p in line for p in patterns):
                    text=re.sub('<[^>]+>','',line).strip()
                    before=re.sub('<[^>]+>','',lines[max(0,i-2)]).strip()
                    after=re.sub('<[^>]+>','',lines[min(len(lines)-1,i+2)]).strip()
                    images=[]
                    for j in range(max(0,i-12),min(len(lines),i+13)):
                        for src in re.findall(r'<img[^>]+src="([^"]+)"',lines[j]):
                            images.append({'line':j+1,'src':src})
                    hits.append({'book':epub.name,'xhtml':member,'line':i+1,'text':text,'before':before,'after':after,'nearbyImages':images})
out=root/'resource/knightavatars/research/epub/mikoto-text-search.json'
out.write_text(json.dumps(hits,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
for h in hits:
    print(h['book'],h['xhtml'],h['line'],h['text'][:420],h['nearbyImages'])
