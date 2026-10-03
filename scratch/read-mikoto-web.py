from pathlib import Path
import urllib.request,re,sys
sys.stdout.reconfigure(encoding='utf-8')
u='https://rakudai-kishi.fandom.com/wiki/Mikoto_Tsuruya'
req=urllib.request.Request(u,headers={'User-Agent':'Mozilla/5.0'})
try:
    raw=urllib.request.urlopen(req,timeout=15).read().decode('utf-8')
    Path('resource/knightavatars/research/epub/mikoto-fandom-source.html').write_text(raw,encoding='utf-8')
    print('\n'.join(re.findall(r'(?:src|data-src)="([^"]*(?:Mikoto|Tsuruya)[^"]*)"',raw)))
    for s in ['Hair Color','Eye Color','Appearances','Manga','Appearance']:
        start=raw.find(s)
        print(s, re.sub('<[^>]+>',' ',raw[start:start+900]))
except Exception as e: print(type(e).__name__,str(e))
