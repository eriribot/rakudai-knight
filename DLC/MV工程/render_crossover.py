"""Frame-exact crossover edit; original audio is remuxed without re-encoding."""
from pathlib import Path
import argparse
import json
import subprocess
import time

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

PROJECT = Path(__file__).resolve().parent
ROOT = PROJECT.parent.parent
SOURCE = PROJECT.parent / '学战都市_去水印母版.mp4'
if not SOURCE.exists():
    SOURCE = PROJECT / '学战都市_去水印母版.mp4'
ORIGINAL = next(ROOT.glob('*Asterisk*.mp4'))
FFMPEG = r'E:\devtools\Anconda\Lib\site-packages\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v7.1.exe'
FPS, WIDTH, HEIGHT = 25, 1280, 720
JP = ImageFont.truetype(r'C:\Windows\Fonts\YuGothM.ttc', 33)
ZH = ImageFont.truetype(r'C:\Windows\Fonts\msjh.ttc', 34)


def load_video(path):
    cap = cv2.VideoCapture(str(path))
    fps = cap.get(cv2.CAP_PROP_FPS)
    frames = []
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        frames.append(frame)
    cap.release()
    if not frames:
        raise RuntimeError(f'No decodable frames: {path}')
    return frames, fps


def prepare_insert(item):
    frames, fps = load_video(PROJECT / item['file'])
    start = item.get('clip_start', 0)
    duration = item['end'] - item['start']
    speed = item.get('speed', 1)
    needed = start + (duration - 1 / FPS) * speed
    if needed > len(frames) / fps + 0.1:
        raise ValueError(f'Insufficient clip duration: {item["file"]}: {len(frames)/fps:.3f} < {needed:.3f}')
    output = []
    for n in range(round(duration * FPS)):
        index = min(len(frames)-1, round((start + n/FPS*speed)*fps))
        frame = frames[index]
        x, y, w, h = item.get('crop', [32, 0, 576, 324])
        frame = cv2.resize(frame[y:y+h, x:x+w], (WIDTH, HEIGHT), interpolation=cv2.INTER_LANCZOS4)
        if item.get('blue_tint'):
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255
            # The source character montage is blue; carry its palette into Ikki's introduction.
            frame = np.stack([np.clip(gray*230 + 10, 0, 255), gray*88, gray*24], axis=2).astype(np.uint8)
        output.append(frame)
    return output


def lyrics(t):
    if 27 <= t < 28.20:
        return ('戦場の太陽は高く揺れて 感情に棲み着く陰を落とす', '戰場的太陽在高空搖曳 拂落寄宿于感情中的陰影')
    if 28.20 <= t < 29:
        return ('知らないまま 痛みに変わること悟るように', '為了點醒我 它將在不知不覺中轉變為痛處')
    if 51 <= t < 53:
        return ('響いて ただ駆け抜けた 胸に眩い衝動', '響徹嘹亮 一心向前奮力趕超 心中深藏的耀眼沖動')
    if 94 <= t < 97:
        return ('失敗から 間違いない自分を作り出して', '从失敗中不斷創造出自己')
    if 183.4 <= t < 187.64:
        return ('蘇る 時間 この場所で 僕ら絶対譲れない願いを', '復蘇的時間 將我們絕不退讓的愿望 銘刻在這个地方')
    if 187.64 <= t < 189.96:
        return ('ただ一つ この声で 強く刻んで行け This is The Asterisk War', '用這道唯一的呐喊 留下深深的烙印 This is The Asterisk War')
    return None


def add_lyrics(frame, t):
    lines = lyrics(t)
    if lines is None:
        return frame
    im = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
    draw = ImageDraw.Draw(im)
    for text, font, y in [(lines[0], JP, 629), (lines[1], ZH, 668)]:
        # Match the original two-line placement and use a clean dark outline.
        box = draw.textbbox((0, 0), text, font=font)
        x = (WIDTH - (box[2]-box[0]))/2
        draw.text((x, y), text, font=font, fill='white', stroke_width=2, stroke_fill=(24, 27, 34), anchor='lt')
    return cv2.cvtColor(np.asarray(im), cv2.COLOR_RGB2BGR)


def make_title_card():
    y, x = np.mgrid[0:HEIGHT, 0:WIDTH]
    glow = np.exp(-(((x-640)/700)**2+((y-310)/400)**2))
    rgb = np.empty((HEIGHT, WIDTH, 3), np.float32)
    for c, edge in enumerate([212, 229, 245]):
        rgb[:, :, c] = edge + (253-edge)*glow
    bg = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8)).convert('RGBA')
    draw = ImageDraw.Draw(bg)
    for off in [0, 9]:
        draw.line([(20+off,115),(75+off,60),(440,60)], fill=(139,177,201,95), width=1)
        draw.line([(1260-off,480),(1205-off,535),(860,535)], fill=(139,177,201,95), width=1)
    for yy in range(10, 590, 5):
        draw.line((0, yy, WIDTH, yy), fill=(244,249,253,40), width=1)
    source = Image.open(PROJECT/'检查/title_source.png').convert('RGB').crop((150,85,1130,555))
    source.thumbnail((550,270), Image.Resampling.LANCZOS)
    # Recover colored/dark title ink while removing its pale rectangular video background.
    rgb_source = np.asarray(source)
    hsv = cv2.cvtColor(rgb_source, cv2.COLOR_RGB2HSV).astype(np.float32)
    saturation, value = hsv[:,:,1]/255, hsv[:,:,2]
    alpha = np.maximum((saturation-.24)/.20, (165-value)/65)
    alpha = np.clip(alpha,0,1)
    original_logo = Image.fromarray(np.dstack([rgb_source,(alpha*255).astype(np.uint8)]),'RGBA')
    bg.alpha_composite(original_logo, (50,165))
    rakudai = Image.open(ROOT/'rakudai-logo.png').convert('RGBA')
    rakudai.thumbnail((535,245), Image.Resampling.LANCZOS)
    bg.alpha_composite(rakudai, (704,213))
    draw = ImageDraw.Draw(bg)
    draw.line((632,291,657,316), fill=(86,120,145,255), width=3)
    draw.line((657,291,632,316), fill=(86,120,145,255), width=3)
    return cv2.cvtColor(np.asarray(bg.convert('RGB')), cv2.COLOR_RGB2BGR)


def title_frame(base, card, t):
    # First let the Asterisk logo settle; dual title then dissolves into its own shattering exit.
    enter = np.clip((t-19.08)/0.24,0,1)
    leave = np.clip((20.96-t)/0.24,0,1)
    alpha = float(enter*leave)
    if alpha == 0:
        return base
    mixed = cv2.addWeighted(base, 1-alpha, card, alpha, 0)
    # Preserve original music credits at the foot of the card.
    for y in range(556, 601):
        a = (y-556)/44
        mixed[y] = np.clip(mixed[y]*(1-a)+base[y]*a,0,255)
    mixed[601:] = base[601:]
    return mixed


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--plan', default=str(PROJECT/'edit_plan.json'))
    ap.add_argument('--preview-title', action='store_true')
    args=ap.parse_args()
    card = make_title_card()
    if args.preview_title:
        cv2.imencode('.png',card)[1].tofile(PROJECT/'检查/dual_title_preview.png')
        return
    plan=json.loads(Path(args.plan).read_text(encoding='utf-8'))
    inserts=[(item,prepare_insert(item)) for item in plan['inserts']]
    output=PROJECT.parent/plan['output']
    cap=cv2.VideoCapture(str(SOURCE))
    count=int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    cmd=[FFMPEG,'-hide_banner','-loglevel','warning','-y','-f','rawvideo','-pix_fmt','bgr24','-s','1280x720','-r','25','-i','pipe:0',
         '-i',str(ORIGINAL),'-map','0:v:0','-map','1:a:0','-c:v','libx264','-crf','18','-preset','medium','-pix_fmt','yuv420p',
         '-c:a','copy','-movflags','+faststart','-metadata','title=The Asterisk War x Rakudai Kishi no Cavalry',str(output)]
    start=time.monotonic()
    with (PROJECT/'检查/crossover_encode.log').open('w',encoding='utf-8') as log:
        proc=subprocess.Popen(cmd,stdin=subprocess.PIPE,stderr=log)
        n=0
        try:
            while True:
                ok,frame=cap.read()
                if not ok:break
                t=n/FPS
                for item,frames in inserts:
                    offset=n-round(item['start']*FPS)
                    if 0 <= offset < len(frames):
                        frame=add_lyrics(frames[offset].copy(),t)
                        break
                if 19.08 <= t < 20.96:frame=title_frame(frame,card,t)
                proc.stdin.write(frame.tobytes())
                n+=1
                if n%1000==0:print(f'Rendered {n}/{count}',flush=True)
        finally:
            cap.release();proc.stdin.close()
        if proc.wait()!=0:raise RuntimeError('Encode failure')
    assert n==5267
    result={'output':str(output),'frames':n,'fps':25,'render_seconds':round(time.monotonic()-start,2),'inserts':plan['inserts'],
            'source_quality':'Rakudai excerpts 640x360, cropped to remove dialogue captions, scaled to720p; original MV720p',
            'audio':'Original AAC copied without trimming/re-encoding'}
    (PROJECT/'检查/crossover_render_result.json').write_text(json.dumps(result,indent=2,ensure_ascii=False),encoding='utf-8')
    print(str(output),flush=True)


if __name__=='__main__':main()
