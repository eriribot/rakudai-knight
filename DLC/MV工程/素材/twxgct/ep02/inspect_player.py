import re
import requests
from urllib.parse import urljoin

s = requests.Session()
s.trust_env = False
url = 'https://pframe.xgcartoon.com/pframe/player.htm?vid=fea1d2b2-9f95-4729-a15d-3a04fa99df95'
r = s.get(url, timeout=20)
print(r.status_code)
scripts = re.findall(r'<script[^>]+src=[\"\x27]([^\"\x27]+)', r.text)
print(scripts)
for script in scripts:
    if 'pdriver' in script:
        text = s.get(urljoin(url, script), timeout=20).text
        for match in re.finditer(r'.{0,250}(?:video_seek_pic_urls|thumbnailCount|\.jpg).{0,350}', text):
            print(match.group(0))
