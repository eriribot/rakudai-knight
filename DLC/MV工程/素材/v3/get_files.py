from pathlib import Path
import importlib.util,requests,json,sys
ROOT=Path(__file__).resolve().parent
f=ROOT.parent/'twxgct'/'ep02'/'capture_short.py'
sp=importlib.util.spec_from_file_location('capture_short',f);m=importlib.util.module_from_spec(sp);sp.loader.exec_module(m)
s=requests.Session();s.trust_env=False;s.headers.update({'Referer':'https://pframe.xgcartoon.com/','Origin':'https://pframe.xgcartoon.com'})
for item in json.loads(Path(sys.argv[1]).read_text(encoding='utf-8')):
    out=ROOT/item['output'];out.parent.mkdir(parents=True,exist_ok=True)
    if out.exists():print('CACHED',str(out),flush=True);continue
    r=m.get(s,item['url']);out.write_bytes(r.content);print('READY',str(out),len(r.content),flush=True)
