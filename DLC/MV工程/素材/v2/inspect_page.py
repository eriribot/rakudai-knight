from pathlib import Path
from urllib.parse import urljoin
import re
import requests
import sys

url = sys.argv[1]
s=requests.Session()
s.trust_env=False
r=s.get(url,timeout=25)
print('STATUS',r.status_code)
r.raise_for_status()
text=r.text
print('TITLE',re.findall(r'<title>(.*?)</title>',text,re.S))
for match in re.finditer(r'.{0,180}(?:iframe|7ai2iQZGHa|第10|第十|播放列表|playlist|video_list|videoList|pframe|episode).{0,260}',text,re.I):
    print(match.group(0))
for href in re.findall(r'href=[\"\x27]([^\"\x27]+)',text):
    if 'luodiqishiyingxiongtan' in href:
        print('EP_LINK',urljoin(url,href))
out=Path(__file__).resolve().parent/'pages'
out.mkdir(exist_ok=True)
(out/(Path(url.split('?')[0]).stem+'.html')).write_text(text,encoding='utf-8')
