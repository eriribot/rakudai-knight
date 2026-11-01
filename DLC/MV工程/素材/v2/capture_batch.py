from pathlib import Path
import subprocess,sys,json
ROOT=Path(__file__).resolve().parent
CAPTURE=ROOT.parent/'twxgct'/'ep02'/'capture_short.py'
plan=json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
for shot in plan:
    out=ROOT/shot['episode']/(shot['name']+'.mp4')
    url=f"https://xgct-video.bzcdn.net/{shot['guid']}/640x360/video.m3u8"
    if not out.exists():
        subprocess.run([sys.executable,'-X','utf8',str(CAPTURE),url,str(out),'--playlist',str(out.parent/'playlist_360p.m3u8'),'--start',str(shot['start']),'--duration',str(shot['duration'])],check=True)
    subprocess.run([sys.executable,'-X','utf8',str(ROOT/'contact.py'),str(out)],check=True)
    print('READY '+str(out),flush=True)
