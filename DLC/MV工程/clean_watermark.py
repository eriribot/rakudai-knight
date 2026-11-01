"""Remove the fixed top-right watermark without cropping or changing the audio.

Uses a measured lettering mask and local OpenCV inpainting. This is a repair,
not recovery of original pixels hidden by the watermark.
"""
from pathlib import Path
import json
import subprocess
import time

import cv2
import numpy as np

PROJECT = Path(__file__).resolve().parent
ROOT = PROJECT.parent.parent
SOURCE = next(ROOT.glob('*Asterisk*.mp4'))
OUTPUT = PROJECT.parent / '学战都市_去水印母版.mp4'
FFMPEG = Path(r'E:\devtools\Anconda\Lib\site-packages\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v7.1.exe')


def main():
    cap = cv2.VideoCapture(str(SOURCE))
    count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    assert (width, height, fps) == (1280, 720, 25.0)
    mask = cv2.imdecode(np.fromfile(PROJECT / '检查/watermark_mask.png', dtype=np.uint8), cv2.IMREAD_GRAYSCALE)
    assert mask.shape == (75, 265)
    cmd = [str(FFMPEG), '-hide_banner', '-loglevel', 'warning', '-y',
           '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', '1280x720', '-r', '25', '-i', 'pipe:0',
           '-i', str(SOURCE), '-map', '0:v:0', '-map', '1:a:0',
           '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
           '-c:a', 'copy', '-movflags', '+faststart',
           '-metadata', 'comment=Fixed top-right watermark repaired by lettering-mask inpainting; original audio preserved.',
           str(OUTPUT)]
    start = time.monotonic()
    with (PROJECT / '检查/clean_encode.log').open('w', encoding='utf-8') as log:
        proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stderr=log)
        n = 0
        try:
            while True:
                ok, frame = cap.read()
                if not ok:
                    break
                frame[10:85, 1010:1275] = cv2.inpaint(frame[10:85, 1010:1275], mask, 3, cv2.INPAINT_TELEA)
                proc.stdin.write(frame.tobytes())
                n += 1
                if n % 1000 == 0:
                    print(f'Repaired {n}/{count} frames ({time.monotonic()-start:.1f}s)', flush=True)
        finally:
            cap.release()
            proc.stdin.close()
        if proc.wait() != 0:
            raise RuntimeError('Encoding failed; see clean_encode.log')
    assert n == count
    result = {'source': str(SOURCE), 'output': str(OUTPUT), 'frames': n, 'fps': fps,
              'size': [width, height], 'audio': 'stream copy, not re-encoded or truncated',
              'watermark_roi': {'x': 1010, 'y': 10, 'width': 265, 'height': 75},
              'changed_pixels_in_roi': int(np.count_nonzero(mask)),
              'method': 'lettering-mask OpenCV Telea inpaint radius 3; original composition and lyrics retained',
              'limitation': 'covered detail is synthesized locally; slight softness can remain on complex backgrounds',
              'seconds_elapsed': round(time.monotonic()-start, 2)}
    (PROJECT / '检查/clean_result.json').write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding='utf-8')
    print(json.dumps(result, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    main()
