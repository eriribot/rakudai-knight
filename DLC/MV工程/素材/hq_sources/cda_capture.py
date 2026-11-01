"""Capture only a bounded public CDA video excerpt through normal media access."""
from pathlib import Path
import argparse,json,subprocess,os,sys
P=Path(__file__).resolve().parent
sys.path.insert(0,str(P.parents[1]/'tools/python'))
import yt_dlp
ap=argparse.ArgumentParser();ap.add_argument('episode');ap.add_argument('url');ap.add_argument('start',type=float);ap.add_argument('duration',type=float);args=ap.parse_args()
assert 0<args.duration<=20
meta=P/f'cda_ep{args.episode}_metadata.json'
if meta.exists():data=json.loads(meta.read_text(encoding='utf8'))
else:
    with yt_dlp.YoutubeDL({'quiet':True,'no_warnings':True,'skip_download':True,'socket_timeout':10,'retries':0,'extractor_retries':0}) as y:
        data=y.extract_info(args.url,download=False)
    meta.write_text(json.dumps(data,ensure_ascii=False),encoding='utf8')
formats=[f for f in data['formats'] if f.get('height') and not f.get('has_drm')]
fmt=max(formats,key=lambda x:x['height'])
print('FORMAT',fmt['width'],fmt['height'],data.get('duration'),flush=True)
env=os.environ.copy()
for k in list(env):
    if k.lower() in ['http_proxy','https_proxy','all_proxy']:env.pop(k)
out=P/f'ep{args.episode}_{args.start:.2f}_{args.duration:.2f}.mp4'
cmd=[r'E:\devtools\Anconda\Lib\site-packages\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v7.1.exe','-hide_banner','-loglevel','warning','-y','-rw_timeout','12000000','-headers','Referer: https://www.cda.pl/\r\n','-ss',str(args.start),'-i',fmt['url'],'-t',str(args.duration),'-an','-vf','setpts=PTS-STARTPTS,fps=25','-c:v','libx264','-preset','fast','-crf','17',str(out)]
r=subprocess.run(cmd,env=env,capture_output=True,text=True,timeout=55)
if r.returncode:raise RuntimeError(r.stderr[-1500:])
out.with_suffix('.json').write_text(json.dumps({'page':args.url,'source_start':args.start,'duration':args.duration,'width':fmt['width'],'height':fmt['height'],'format':fmt['format_id'],'content':'public short excerpt only; no complete episode saved'},ensure_ascii=False,indent=2),encoding='utf8')
subprocess.run([sys.executable,'-X','utf8',str(P.parent/'v2/contact.py'),str(out),'--step','0.5'],check=True)
print(str(out),flush=True)
