"""Non-destructive V2 edit with source trims, matched directions and paired close-ups."""
from pathlib import Path
import argparse,json,subprocess,time
import cv2
import numpy as np
from PIL import Image,ImageDraw,ImageFont
from roster_video import roster_frame

P=Path(__file__).resolve().parent
ROOT=P.parent.parent
ORIGINAL=next(ROOT.glob('*Asterisk*.mp4'))
BASE=P.parent/'学战都市×落第骑士英雄谭_联合MV.mp4'
CLEAN=P.parent/'学战都市_去水印母版.mp4'
if not CLEAN.exists():CLEAN=P/'学战都市_去水印母版.mp4'
FFMPEG=r'E:\devtools\Anconda\Lib\site-packages\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v7.1.exe'
FPS,W,H=25,1280,720
JP=ImageFont.truetype(r'C:\Windows\Fonts\YuGothM.ttc',33)
ZH=ImageFont.truetype(r'C:\Windows\Fonts\msjh.ttc',34)

class Clips:
    def __init__(self):self.opened={}
    def frame(self,desc,offset):
        path=CLEAN if desc['file']=='clean' else P/desc['file']
        key=str(path)
        if key not in self.opened:
            cap=cv2.VideoCapture(key)
            if not cap.isOpened():raise RuntimeError(f'Cannot open {path}')
            self.opened[key]=[cap,-1,None]
        record=self.opened[key];cap,last,cached=record
        fps=cap.get(cv2.CAP_PROP_FPS)
        index=round((desc.get('clip_start',0)+offset*desc.get('speed',1))*fps)
        total=int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        if index>=total:raise RuntimeError(f'Clip too short: {path} frame {index}/{total}')
        if index==last:frame=cached.copy()
        else:
            if index!=last+1:cap.set(cv2.CAP_PROP_POS_FRAMES,index)
            ok,frame=cap.read()
            if not ok:raise RuntimeError(f'Decode failed: {path} frame {index}')
            record[1:]=[index,frame.copy()]
        default=[100,0,1080,608] if desc['file']=='clean' else [32,0,576,324]
        x,y,w,h=desc.get('crop',default)
        patch=frame[y:y+h,x:x+w]
        if hasattr(self,'prepare_crop'):patch=self.prepare_crop(patch,desc)
        frame=cv2.resize(patch,(W,H),interpolation=cv2.INTER_LANCZOS4)
        if hasattr(self,'finish_resize'):frame=self.finish_resize(frame,desc)
        if desc.get('flip'):frame=cv2.flip(frame,1)
        if desc.get('arena_blue'):
            # Match the green-lit Rakudai arena to the cold Asterisk fight background.
            hsv=cv2.cvtColor(frame,cv2.COLOR_BGR2HSV)
            weight=np.minimum(np.clip((hsv[:,:,0].astype(float)-35)/12,0,1),np.clip((88-hsv[:,:,0].astype(float))/12,0,1))
            weight*=np.clip((hsv[:,:,1].astype(float)-45)/50,0,1)
            hsv[:,:,0]=np.clip(hsv[:,:,0]+weight*35,0,179).astype(np.uint8)
            frame=cv2.cvtColor(hsv,cv2.COLOR_HSV2BGR)
        tint=desc.get('tint')
        if tint:
            gray=cv2.cvtColor(frame,cv2.COLOR_BGR2GRAY).astype(np.float32)/255
            palette={'blue':(240,90,25),'red':(35,35,235),'green':(75,205,45),'violet':(205,45,165)}[tint]
            frame=np.stack([gray*c for c in palette],axis=2).astype(np.uint8)
        return frame
    def close(self):
        for cap,_,_ in self.opened.values():cap.release()

def pair_frame(clips,item,offset):
    left=clips.frame(item['left'],offset);right=clips.frame(item['right'],offset)
    for frame,desc,target in [(left,item['left'],330),(right,item['right'],950)]:
        focus=desc.get('focus_x',target)
        if focus!=target:
            moved=cv2.warpAffine(frame,np.float32([[1,0,target-focus],[0,1,0]]),(W,H),borderMode=cv2.BORDER_REFLECT_101)
            frame[:]=moved
    yy,xx=np.mgrid[:H,:W]
    split=640+(yy-360)*-.28
    mask=np.clip((split-xx+2)/4,0,1)[...,None]
    out=(left*mask+right*(1-mask)).astype(np.uint8)
    cv2.line(out,(741,0),(539,719),(235,245,255),3,cv2.LINE_AA)
    return out

def render_item(clips,item,offset):
    if item.get('kind')=='pair':return pair_frame(clips,item,offset)
    if item.get('kind')=='roster':
        bg=clips.frame({'file':'clean','clip_start':13.36,'speed':.25,'crop':[0,0,1280,720]},offset)
        return roster_frame(bg,item['characters'],offset,item['end']-item['start'])
    frame=clips.frame(item,offset)
    if item.get('caption'):
        im=Image.fromarray(cv2.cvtColor(frame,cv2.COLOR_BGR2RGB));d=ImageDraw.Draw(im)
        f=ImageFont.truetype(r'C:\Windows\Fonts\YuGothM.ttc',46)
        d.text((42,40),item['caption'],font=f,fill=(227,247,255),stroke_width=2,stroke_fill=(17,43,71))
        frame=cv2.cvtColor(np.array(im),cv2.COLOR_RGB2BGR)
    return frame

def lyric_overlays(rows):
    result=[]
    for row in rows:
        layer=Image.new('RGBA',(W,H),(0,0,0,0));draw=ImageDraw.Draw(layer)
        for key,font,y in [('jp',JP,629),('zh',ZH,668)]:
            text=row[key]
            box=draw.textbbox((0,0),text,font=font)
            width=box[2]-box[0]
            if width>W-24:raise ValueError(f'Lyric too wide: {text}')
            draw.text(((W-width)/2,y),text,font=font,fill='white',stroke_width=2,stroke_fill=(24,27,34),anchor='lt')
        arr=np.array(layer);rgb=cv2.cvtColor(arr[:,:,:3],cv2.COLOR_RGB2BGR)
        result.append((round(row['start']*FPS),round(row['end']*FPS),rgb,arr[:,:,3:4].astype(np.float32)/255))
    return result

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--plan',default=str(P/'edit_plan_v2.json'));ap.add_argument('--preview',action='store_true');args=ap.parse_args()
    plan=json.loads(Path(args.plan).read_text(encoding='utf-8'))
    lyrics=json.loads((P/'lyrics_timeline.json').read_text(encoding='utf-8'))
    if isinstance(lyrics,dict):lyrics=lyrics.get('segments',lyrics.get('lyrics'))
    overlays=lyric_overlays(lyrics)
    edits=sorted(plan['edits'],key=lambda x:x['start'])
    for a,b in zip(edits,edits[1:]):
        if round(a['end']*FPS)>round(b['start']*FPS):raise ValueError('Overlapping edit intervals')
    assert all(x['end']<=181.48 for x in edits),'The approved ending must remain intact.'
    clips=Clips();cap=cv2.VideoCapture(str(BASE))
    output=P.parent/plan['output'];check=P/plan.get('check_directory','检查/v2');check.mkdir(exist_ok=True,parents=True)
    preview_frames={round((x['start']+min(.24,(x['end']-x['start'])/2))*FPS):x for x in edits}
    if args.preview:
        for n,item in preview_frames.items():
            offset=n/FPS-item['start'];frame=render_item(clips,item,offset)
            for start,end,rgb,alpha in overlays:
                if start<=n<end:frame=np.clip(frame*(1-alpha)+rgb*alpha,0,255).astype(np.uint8);break
            cv2.imencode('.jpg',frame)[1].tofile(check/f'edit_{n:04}.jpg')
        clips.close();cap.release();return
    cmd=[FFMPEG,'-hide_banner','-loglevel','warning','-y','-f','rawvideo','-pix_fmt','bgr24','-s','1280x720','-r','25','-i','pipe:0','-i',str(ORIGINAL),'-map','0:v:0','-map','1:a:0','-c:v','libx264','-crf',str(plan.get('crf',18)),'-preset',plan.get('preset','medium'),'-pix_fmt','yuv420p','-c:a','copy','-movflags','+faststart','-metadata','title='+plan.get('title','The Asterisk War x Rakudai - Cross Duel V2'),str(output)]
    started=time.monotonic();n=0;active=0
    with (check/'encode.log').open('w',encoding='utf-8') as log:
        proc=subprocess.Popen(cmd,stdin=subprocess.PIPE,stderr=log)
        try:
            while True:
                ok,frame=cap.read()
                if not ok:break
                while active<len(edits) and n>=round(edits[active]['end']*FPS):active+=1
                if active<len(edits):
                    item=edits[active]
                    if round(item['start']*FPS)<=n<round(item['end']*FPS):
                        offset=(n-round(item['start']*FPS))/FPS
                        frame=render_item(clips,item,offset)
                        for hit in plan.get('impacts',[]):
                            d=n-round(hit*FPS)
                            if 0<=d<3:
                                a=[.34,.13,.03][d];frame=cv2.addWeighted(frame,1-a,np.full_like(frame,255),a,0)
                        for start,end,rgb,alpha in overlays:
                            if start<=n<end:frame=np.clip(frame*(1-alpha)+rgb*alpha,0,255).astype(np.uint8);break
                proc.stdin.write(frame.tobytes());n+=1
                if n%1000==0:print(f'Rendered {n}/5267',flush=True)
        finally:cap.release();clips.close();proc.stdin.close()
        if proc.wait()!=0:raise RuntimeError('Encode failed')
    assert n==5267
    result={'output':str(output),'frames':n,'render_seconds':round(time.monotonic()-started,2),'edit_count':len(edits),'edits':edits,'ending_preserved_from':181.48,'audio':'Original AAC copied'}
    (check/'render_result.json').write_text(json.dumps(result,indent=2,ensure_ascii=False),encoding='utf-8')
    print(str(output),flush=True)

if __name__=='__main__':main()
