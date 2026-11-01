"""Fetch a bounded excerpt from an already observed public 360p HLS playlist.

Never selects a higher/login-only rendition. Honors server Retry-After. Does
not download complete episodes; each request is limited to 20 seconds.
"""
from pathlib import Path
from urllib.parse import urljoin
import argparse
import json
import subprocess
import time

import requests

FFMPEG = r'E:\devtools\Anconda\Lib\site-packages\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v7.1.exe'


def fetch(session, url):
    for attempt in range(2):
        response = session.get(url, timeout=20)
        if response.status_code != 429:
            response.raise_for_status()
            return response
        delay = int(response.headers.get('Retry-After', '30')) + 2
        print(f'Server rate limit; waiting {delay}s (attempt {attempt + 1}/2)', flush=True)
        if attempt == 0:
            time.sleep(min(delay, 60))
    raise RuntimeError('HTTP 429 persists; stopped without changing identity or quality')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('url')
    ap.add_argument('start', type=float)
    ap.add_argument('duration', type=float)
    ap.add_argument('output', type=Path)
    args = ap.parse_args()
    assert '/640x360/' in args.url
    assert 0 < args.duration <= 20
    session = requests.Session()
    # Use the machine's ordinary direct connection; the inherited proxy returns
    # HTTP 429 for media while the same public 360p resource plays in Chrome.
    session.trust_env = False
    session.headers.update({'Referer': 'https://pframe.xgcartoon.com/', 'Origin': 'https://pframe.xgcartoon.com'})
    playlist = fetch(session, args.url).text
    if '#EXT-X-KEY' in playlist:
        raise RuntimeError('This helper only accepts an unencrypted public playlist')
    segments = []
    cursor, duration = 0.0, None
    for line in playlist.splitlines():
        if line.startswith('#EXTINF:'):
            duration = float(line.split(':', 1)[1].rstrip(','))
        elif line and not line.startswith('#') and duration is not None:
            if cursor < args.start + args.duration and cursor + duration > args.start:
                segments.append((cursor, duration, urljoin(args.url, line)))
            cursor += duration
            duration = None
    assert segments and len(segments) <= 10
    cache = args.output.parent / (args.output.stem + '_segments')
    cache.mkdir(parents=True, exist_ok=True)
    lines = ['#EXTM3U', '#EXT-X-VERSION:3', '#EXT-X-TARGETDURATION:10', '#EXT-X-MEDIA-SEQUENCE:0']
    for index, (start, dur, url) in enumerate(segments):
        path = cache / f'{index:02}.ts'
        if not path.exists():
            response = fetch(session, url)
            if len(response.content) < 188 or response.content[0] != 0x47:
                raise RuntimeError(f'Expected MPEG-TS media at {start:.3f}s')
            path.write_bytes(response.content)
            print(f'Captured source {start:.3f}-{start + dur:.3f}s, {len(response.content)} bytes', flush=True)
            time.sleep(2)
        lines += [f'#EXTINF:{dur:.6f},', path.name]
    lines.append('#EXT-X-ENDLIST')
    local = cache / 'excerpt.m3u8'
    local.write_text('\n'.join(lines) + '\n', encoding='utf-8')
    relative = args.start-segments[0][0]
    trim = f'setpts=PTS-STARTPTS,trim=start={relative}:duration={args.duration},setpts=PTS-STARTPTS,fps=25'
    cmd = [FFMPEG, '-hide_banner', '-loglevel', 'error', '-i', str(local), '-vf', trim,
           '-an', '-c:v', 'libx264', '-crf', '17',
           '-preset', 'fast', '-movflags', '+faststart', '-y', str(args.output)]
    subprocess.run(cmd, check=True)
    args.output.with_suffix('.json').write_text(json.dumps({'playlist': args.url, 'source_start': args.start,
        'duration': args.duration, 'quality': 'public 640x360 rendition', 'segments': len(segments)}, indent=2), encoding='utf-8')
    print(str(args.output), flush=True)


if __name__ == '__main__':
    main()
