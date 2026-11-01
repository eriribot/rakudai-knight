from pathlib import Path
import subprocess,sys,json
ROOT=Path(__file__).resolve().parent
CAPTURE=ROOT.parent/'twxgct'/'ep02'/'capture_short.py'
CONTACT=ROOT.parent/'v2'/'contact.py'
prior=[]
for p in (ROOT.parent/'v2').glob('ep*/**/*.json'):
    try:d=json.loads(p.read_text(encoding='utf-8'))
    except Exception:continue
    if 'source_url' in d and 'source_start' in d and 'duration_requested' in d:
        prior.append((d['source_url'],d['source_start'],d['source_start']+d['duration_requested'],str(p)))
for shot in json.loads(Path(sys.argv[1]).read_text(encoding='utf-8')):
    out=ROOT/shot['episode']/(shot['name']+'.mp4')
    url=f"https://xgct-video.bzcdn.net/{shot['guid']}/640x360/video.m3u8"
    a,b=shot['start'],shot['start']+shot['duration']
    for oldurl,x,y,p in prior:
        assert not (url==oldurl and a<y and b>x),f'Old-source overlap: {shot} with {p}'
    if not out.exists():
        subprocess.run([sys.executable,'-X','utf8',str(CAPTURE),url,str(out),'--playlist',str(out.parent/'playlist_360p.m3u8'),'--start',str(a),'--duration',str(shot['duration'])],check=True)
    subprocess.run([sys.executable,'-X','utf8',str(CONTACT),str(out),'--step','.4'],check=True)
    print('READY NEW SOURCE '+str(out),flush=True)
