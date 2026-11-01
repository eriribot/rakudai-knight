"""V6: replace problematic shots with native sources and motion-propagated ImageGen repair."""
from pathlib import Path
import json,subprocess,time
import cv2,numpy as np
import render_crossover_v2 as engine
from roster_video_v5_imagegen import roster_frame
P=Path(__file__).resolve().parent
Q=P/'导出记录/v6';Q.mkdir(parents=True,exist_ok=True)
FPS,W,H=25,1280,720
def main():
    plan=json.loads((P/'repair_plan_v6.json').read_text(encoding='utf-8'))
    manifest=json.loads((P/'素材/v6/repaired_clips/manifest.json').read_text(encoding='utf-8'))
    rows=[dict(x,start=x['target_start'],end=x['target_end']) for x in manifest['clips']]
    rows=sorted(rows,key=lambda x:x['start'])
    lyrics=json.loads((P/'lyrics_timeline.json').read_text(encoding='utf-8'))
    overlays=engine.lyric_overlays(lyrics['segments'] if isinstance(lyrics,dict) else lyrics)
    output=P.parent/plan['output'];base=P.parent/plan['base']
    source=cv2.VideoCapture(str(base));clean=cv2.VideoCapture(str(engine.CLEAN))
    command=[engine.FFMPEG,'-hide_banner','-loglevel','warning','-y','-f','rawvideo','-pix_fmt','bgr24','-s','1280x720','-r','25','-i','pipe:0',
        '-i',str(engine.ORIGINAL),'-map','0:v:0','-map','1:a:0','-c:v','libx264','-crf','16','-preset','fast','-pix_fmt','yuv420p','-c:a','copy',
        '-movflags','+faststart','-metadata','title=The Asterisk War x Rakudai - Restored Action V6',str(output)]
    started=time.monotonic();n=0;index=0;replacement=None;opened_index=-1
    with (Q/'encode.log').open('w',encoding='utf-8') as log:
        encoder=subprocess.Popen(command,stdin=subprocess.PIPE,stderr=log)
        try:
            while True:
                ok,frame=source.read()
                if not ok:break
                while index<len(rows) and n>=round(rows[index]['end']*FPS):index+=1
                if 279<=n<326:
                    clean.set(cv2.CAP_PROP_POS_FRAMES,n);ok,bg=clean.read()
                    if not ok:raise RuntimeError('Missing arena source')
                    frame=roster_frame(bg,['ikki','stella'] if n<302 else ['toka','shizuku'],n/FPS)
                elif index<len(rows) and round(rows[index]['start']*FPS)<=n<round(rows[index]['end']*FPS):
                    row=rows[index]
                    if opened_index!=index:
                        if replacement is not None:replacement.release()
                        replacement=cv2.VideoCapture(str(Path(row['file'])));opened_index=index
                    ok,frame=replacement.read()
                    if not ok:raise RuntimeError(f'Replacement ended early: {row["file"]}')
                    for hit in plan.get('impacts',[]):
                        d=n-round(hit*FPS)
                        if 0<=d<3:
                            a=[.34,.13,.03][d];frame=cv2.addWeighted(frame,1-a,np.full_like(frame,255),a,0)
                    for start,end,rgb,alpha in overlays:
                        if start<=n<end:
                            frame=np.clip(frame*(1-alpha)+rgb*alpha,0,255).astype(np.uint8);break
                encoder.stdin.write(frame.tobytes());n+=1
                if n%1000==0:print(f'Encoded {n}/5267',flush=True)
        finally:
            source.release();clean.release()
            if replacement is not None:replacement.release()
            encoder.stdin.close()
        if encoder.wait()!=0:raise RuntimeError('Export failed')
    receipt=dict(output=str(output),frames=n,replacement_count=len(rows),base=str(base),
        actual_repairs=manifest,elapsed_seconds=round(time.monotonic()-started,1),
        previous_sr_removed=True,roster='Previous ImageGen transparent portraits retained',
        qa='No full-film QA suite; operational errors stop export')
    (Q/'export_receipt.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2),encoding='utf-8')
    print(str(output),flush=True)
if __name__=='__main__':main()
