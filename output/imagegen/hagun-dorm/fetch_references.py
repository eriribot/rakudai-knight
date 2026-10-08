from pathlib import Path
from urllib.request import Request, urlopen
import json

root=Path(__file__).resolve().parent
refs=root/'references'
refs.mkdir(parents=True,exist_ok=True)
sources=[
    ('episode01-bedroom.jpg','https://m.media-amazon.com/images/M/MV5BZWIxOTQzZGUtOWUzMC00OWEyLWJmYmYtMDg1NDI5ODk2NWVkXkEyXkFqcGc%40._V1_.jpg','https://www.imdb.com/title/tt5184216/'),
    ('episode05-living.jpg','https://www.ittoshura.com/story/img/onair_p05_1.jpg','https://www.ittoshura.com/story/epsode5.html'),
    ('episode05-storage.jpg','https://www.ittoshura.com/story/img/onair_p05_2.jpg','https://www.ittoshura.com/story/epsode5.html'),
]
records=[]
for filename,url,page in sources:
    req=Request(url,headers={'User-Agent':'Mozilla/5.0'})
    with urlopen(req,timeout=30) as response:
        data=response.read()
    (refs/filename).write_bytes(data)
    records.append({'file':filename,'image_url':url,'source_page':page})
    print(filename,len(data))
(refs/'sources.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')
