"""Actual learned 4x-AnimeSharp SR, preserving V4 editing/color/audio at 720p."""
from pathlib import Path
import json,subprocess,time,hashlib
import cv2,numpy as np
import torch
from torch.nn import functional as F
from spandrel import ModelLoader
from roster_video_v5 import roster_frame

P=Path(__file__).resolve().parent
BASE=P.parent/'学战都市×落第骑士英雄谭_联合MV_V4_彩色清晰版.mp4'
OUT=P.parent/'学战都市×落第骑士英雄谭_联合MV_V5_AI超分720p.mp4'
WEIGHTS=Path(r'F:\ComfyUI-aki-v3\ComfyUI\models\upscale_models\4x-AnimeSharp.safetensors')
FFMPEG=r'E:\devtools\Anconda\Lib\site-packages\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v7.1.exe'
CHECK=P/'导出记录/v5';CHECK.mkdir(parents=True,exist_ok=True)
FPS=25;W=1280;H=720

def visible_rakudai_frames():
    plan=json.loads((P/'edit_plan_v4.json').read_text(encoding='utf-8'))
    active=np.zeros(5267,dtype=bool)
    # V1 material which is present in the V4 base, including the approved ending.
    legacy=json.loads((P/'edit_plan.json').read_text(encoding='utf-8'))['inserts']
    for item in legacy:active[round(item['start']*FPS):round(item['end']*FPS)]=True
    # Later edits override that mask; only Rakudai footage receives neural SR.
    for item in plan['edits']:
        a,b=round(item['start']*FPS),round(item['end']*FPS)
        active[a:b]=item.get('kind')!='roster' and item.get('file')!='clean'
    return active

class AnimeSR:
    def __init__(self):
        torch.set_num_threads(4)
        torch.backends.cudnn.benchmark=True
        torch.backends.cuda.matmul.allow_tf32=True
        self.model=ModelLoader().load_from_file(str(WEIGHTS)).eval().cuda().half()
        self.model.model.to(memory_format=torch.channels_last)
        self.count=0
        print('Loaded learned 4x-AnimeSharp on '+torch.cuda.get_device_name(0),flush=True)
        print('Architecture: '+str(self.model.architecture.name),flush=True)
        self.mask=np.ones((H,1,1),np.float32)
        # The existing music lyrics are retained as exact V4 pixels, not inferred.
        self.mask[590:629,0,0]=np.linspace(1,0,39)
        self.mask[629:]=0
    @torch.inference_mode()
    def __call__(self,frame):
        # V4 is a 720p composite of 360p material. Return to its information
        # density before the learned 4x reconstruction, then resolve to 720p.
        native=cv2.resize(frame,(640,360),interpolation=cv2.INTER_AREA)
        rgb=cv2.cvtColor(native,cv2.COLOR_BGR2RGB)
        inp=torch.from_numpy(np.ascontiguousarray(rgb.transpose(2,0,1))).unsqueeze(0)
        inp=inp.to(device='cuda',dtype=torch.float16).div_(255).contiguous(memory_format=torch.channels_last)
        prediction=self.model(inp)
        prediction=F.interpolate(prediction.float(),size=(H,W),mode='bicubic',align_corners=False,antialias=True)
        arr=prediction.squeeze(0).clamp_(0,1).mul_(255).round_().to(torch.uint8).permute(1,2,0).cpu().numpy()
        neural=cv2.cvtColor(arr,cv2.COLOR_RGB2BGR)
        # Keep V4 chroma and broad lighting exactly; take fine luminance
        # structure from the neural prediction rather than a sharpening filter.
        src=cv2.cvtColor(frame,cv2.COLOR_BGR2YCrCb)
        sr=cv2.cvtColor(neural,cv2.COLOR_BGR2YCrCb)
        y0=src[:,:,0].astype(np.float32);y1=sr[:,:,0].astype(np.float32)
        low_difference=cv2.GaussianBlur(y0-y1,(0,0),9)
        sr[:,:,0]=np.clip(y1+low_difference,0,255).astype(np.uint8)
        sr[:,:,1:]=src[:,:,1:]
        enhanced=cv2.cvtColor(sr,cv2.COLOR_YCrCb2BGR)
        result=np.clip(enhanced*self.mask+frame*(1-self.mask),0,255).astype(np.uint8)
        result[629:]=frame[629:]
        self.count+=1
        if self.count%100==0:print(f'AI reconstructed {self.count} Rakudai frames',flush=True)
        return result

def main():
    started=time.monotonic();active=visible_rakudai_frames();sr=AnimeSR()
    cap=cv2.VideoCapture(str(BASE));clean=cv2.VideoCapture(str(P/'学战都市_去水印母版.mp4'))
    original=next(P.parent.parent.glob('*Asterisk*.mp4'))
    command=[FFMPEG,'-hide_banner','-loglevel','warning','-y','-f','rawvideo','-pix_fmt','bgr24','-s','1280x720','-r','25','-i','pipe:0',
        '-i',str(original),'-map','0:v:0','-map','1:a:0','-c:v','libx264','-crf','16','-preset','fast','-pix_fmt','yuv420p',
        '-c:a','copy','-movflags','+faststart','-metadata','title=The Asterisk War x Rakudai - AnimeSharp AI 720p V5',str(OUT)]
    n=0
    with (CHECK/'encode.log').open('w',encoding='utf-8') as log:
        encoder=subprocess.Popen(command,stdin=subprocess.PIPE,stderr=log)
        try:
            while True:
                ok,frame=cap.read()
                if not ok:break
                if 279<=n<326:
                    clean.set(cv2.CAP_PROP_POS_FRAMES,n);ok,bg=clean.read()
                    if not ok:raise RuntimeError('Cannot read roster background')
                    frame=roster_frame(bg,['ikki','stella'] if n<302 else ['toka','shizuku'],n/FPS)
                elif active[n]:frame=sr(frame)
                encoder.stdin.write(frame.tobytes());n+=1
                if n%1000==0:print(f'Encoded {n}/5267 frames',flush=True)
        finally:
            cap.release();clean.release();encoder.stdin.close()
        if encoder.wait()!=0:raise RuntimeError('Video export failed')
    receipt=dict(output=str(OUT),frames=n,neural_frames=sr.count,model=str(WEIGHTS),
        model_sha256=hashlib.sha256(WEIGHTS.read_bytes()).hexdigest(),
        method='Actual pretrained 4x-AnimeSharp neural inference on CUDA, downsampled to 1280x720; V4 chroma and low frequency luma retained',
        editing='All V4 frame positions, speed, transitions, music lyrics, and audio retained',
        portrait_edges='V5 connected exterior paper removal plus premultiplied alpha transforms',
        elapsed_seconds=round(time.monotonic()-started,1),qa='No QA suite or comparison preview, per user request')
    (CHECK/'export_receipt.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2),encoding='utf-8')
    print(str(OUT),flush=True)
if __name__=='__main__':main()
