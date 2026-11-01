"""Replace the roster in the completed neural-SR movie without rerunning SR."""
from pathlib import Path
import subprocess,json,time
import cv2
from roster_video_v5_imagegen import roster_frame
P=Path(__file__).resolve().parent
BASE=P.parent/'学战都市×落第骑士英雄谭_联合MV_V5_AI超分720p.mp4'
OUT=P.parent/'学战都市×落第骑士英雄谭_联合MV_V5_AI超分720p_ImageGen版.mp4'
FFMPEG=r'E:\devtools\Anconda\Lib\site-packages\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v7.1.exe'
def main():
    start=time.monotonic();cap=cv2.VideoCapture(str(BASE));clean=cv2.VideoCapture(str(P/'学战都市_去水印母版.mp4'))
    command=[FFMPEG,'-hide_banner','-loglevel','warning','-y','-f','rawvideo','-pix_fmt','bgr24','-s','1280x720','-r','25','-i','pipe:0',
        '-i',str(BASE),'-map','0:v:0','-map','1:a:0','-c:v','libx264','-crf','16','-preset','fast','-pix_fmt','yuv420p','-c:a','copy',
        '-movflags','+faststart','-metadata','title=The Asterisk War x Rakudai - AI 720p + ImageGen portraits',str(OUT)]
    n=0;q=P/'导出记录/v5'
    with (q/'imagegen_finish.log').open('w',encoding='utf-8') as log:
        process=subprocess.Popen(command,stdin=subprocess.PIPE,stderr=log)
        try:
            while True:
                ok,frame=cap.read()
                if not ok:break
                if 279<=n<326:
                    clean.set(cv2.CAP_PROP_POS_FRAMES,n);ok,bg=clean.read()
                    if not ok:raise RuntimeError('Cannot read background')
                    frame=roster_frame(bg,['ikki','stella'] if n<302 else ['toka','shizuku'],n/25)
                process.stdin.write(frame.tobytes());n+=1
                if n%1000==0:print(f'Encoded {n}/5267',flush=True)
        finally:cap.release();clean.release();process.stdin.close()
        if process.wait()!=0:raise RuntimeError('Export failed')
    receipt=dict(output=str(OUT),frames=n,roster_frames=47,neural_base=str(BASE),
        imagegen_assets='素材/v5/imagegen',imagegen_tool='Built-in image_gen.imagegen, four identity-preserving background-extraction edits',
        elapsed_seconds=round(time.monotonic()-start,1),qa='No inspection/QA suite, as requested')
    (q/'final_imagegen_receipt.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2),encoding='utf-8')
    print(str(OUT),flush=True)
if __name__=='__main__':main()
