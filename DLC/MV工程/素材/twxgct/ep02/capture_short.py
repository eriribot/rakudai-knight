from pathlib import Path
from urllib.parse import urljoin
import argparse
import json
import subprocess
import time
import requests

HERE = Path(__file__).resolve().parent
STAMP = HERE / 'last_media_request.json'
FFMPEG = r'E:\devtools\Anconda\Lib\site-packages\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v7.1.exe'

def get(session, url):
    stamp = json.loads(STAMP.read_text()) if STAMP.exists() else {}
    last = stamp.get('timestamp',0)
    gap = stamp.get('cooldown',15)
    wait = max(0, gap - (time.time() - last))
    if wait:
        print(f'Quiet cooldown {wait:.1f}s', flush=True)
        time.sleep(wait)
    for attempt in range(2):
        STAMP.write_text(json.dumps({'timestamp': time.time(),'cooldown':gap}))
        r = session.get(url, timeout=25)
        if r.status_code != 429:
            r.raise_for_status()
            return r
        delay = max(45, int(r.headers.get('Retry-After', '30')) + 5)
        gap = 45
        STAMP.write_text(json.dumps({'timestamp': time.time(),'cooldown':gap}))
        print(f'429, honoring quiet period {delay}s', flush=True)
        if attempt == 0:
            time.sleep(delay)
    raise RuntimeError('429 persisted after quiet cooldown; stopped')

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('url')
    ap.add_argument('output', type=Path)
    ap.add_argument('--playlist', type=Path)
    ap.add_argument('--start', type=float)
    ap.add_argument('--duration', type=float)
    args = ap.parse_args()
    s = requests.Session()
    s.trust_env = False
    s.headers.update({'Referer': 'https://pframe.xgcartoon.com/', 'Origin': 'https://pframe.xgcartoon.com'})
    args.output.parent.mkdir(parents=True, exist_ok=True)
    if args.playlist is None:
        r = get(s, args.url)
        args.output.write_bytes(r.content)
        print(f'{r.status_code}, {len(r.content)} bytes: {args.output}', flush=True)
        return
    assert '/640x360/' in args.url and 0 < args.duration <= 10
    pl = args.playlist.read_text(encoding='utf-8')
    assert '#EXT-X-KEY' not in pl
    segments, cursor, dur = [], 0.0, None
    for line in pl.splitlines():
        if line.startswith('#EXTINF:'):
            dur = float(line.split(':',1)[1].rstrip(','))
        elif line and not line.startswith('#') and dur is not None:
            if cursor < args.start+args.duration and cursor+dur > args.start:
                segments.append((cursor,dur,urljoin(args.url,line)))
            cursor += dur
            dur = None
    assert segments and len(segments) <= 5
    cache = args.output.parent/'selected_segments'
    cache.mkdir(exist_ok=True)
    lines = ['#EXTM3U','#EXT-X-VERSION:3','#EXT-X-TARGETDURATION:10','#EXT-X-MEDIA-SEQUENCE:0']
    for start,dur,url in segments:
        dst = cache/Path(url).name
        if not dst.exists():
            r = get(s,url)
            assert len(r.content)>188 and r.content[0]==0x47
            dst.write_bytes(r.content)
            print(f'Captured {start:.3f}-{start+dur:.3f}s: {len(r.content)} bytes',flush=True)
        lines += [f'#EXTINF:{dur:.6f},',dst.name]
    lines.append('#EXT-X-ENDLIST')
    local=cache/(args.output.stem+'.m3u8')
    local.write_text('\n'.join(lines)+'\n',encoding='utf-8')
    offset = args.start-segments[0][0]
    vf = f'setpts=PTS-STARTPTS,trim=start={offset}:duration={args.duration},setpts=PTS-STARTPTS,fps=25'
    subprocess.run([FFMPEG,'-hide_banner','-loglevel','error','-i',str(local),'-vf',vf,'-frames:v',str(round(args.duration*25)),'-an','-c:v','libx264','-preset','fast','-crf','17','-movflags','+faststart','-y',str(args.output)],check=True)
    args.output.with_suffix('.json').write_text(json.dumps({'source_url':args.url,'source_start':args.start,'duration_requested':args.duration,'fps_output':25,'rendition':'public 640x360 only','segments':[{'start':x,'duration':y,'url':z} for x,y,z in segments]},indent=2),encoding='utf-8')
    print(args.output,flush=True)

if __name__=='__main__':
    main()
