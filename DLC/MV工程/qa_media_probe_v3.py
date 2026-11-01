"""Independent shot and preview QA; does not mutate plan or renderer."""
from pathlib import Path
import sys,json,subprocess
import cv2,numpy as np
from PIL import Image,ImageDraw,ImageFont
P=Path(__file__).resolve().parent
sys.path.insert(0,str(P))
import render_crossover_v2 as engine
Q=P/'检查/v3/media_probe'
Q.mkdir(parents=True,exist_ok=True)
plan=json.loads((P/'edit_plan_v3.json').read_text(encoding='utf-8'))
lyrics=json.loads((P/'lyrics_timeline.json').read_text(encoding='utf-8'))
if isinstance(lyrics,dict):lyrics=lyrics.get('segments',lyrics.get('lyrics'))
overlays=engine.lyric_overlays(lyrics)
edits=plan['edits']
font=ImageFont.truetype(r'C:\Windows\Fonts\msjh.ttc',17)
clips=engine.Clips()
def save_sheet(frames,labels,out,cols=4):
    w,h=400,225;stride=255
    sheet=Image.new('RGB',(w*cols,stride*((len(frames)+cols-1)//cols)),(22,22,26))
    draw=ImageDraw.Draw(sheet)
    for i,(f,label) in enumerate(zip(frames,labels)):
        x=i%cols*w;y=i//cols*stride
        sheet.paste(Image.fromarray(cv2.cvtColor(cv2.resize(f,(w,h)),cv2.COLOR_BGR2RGB)),(x,y))
        draw.text((x+3,y+h+2),label,font=font,fill='white')
    sheet.save(out,quality=93)

records=[];frames=[];labels=[]
for item in edits:
    if not item.get('file','').startswith('素材/v3/'):
        continue
    path=P/item['file'];cap=cv2.VideoCapture(str(path))
    total=int(cap.get(cv2.CAP_PROP_FRAME_COUNT));fps=cap.get(cv2.CAP_PROP_FPS);cap.release()
    n=round(item['end']*25)-round(item['start']*25)
    sample_offsets=[0,round((n-1)/3)/25,round(2*(n-1)/3)/25,(n-1)/25]
    source_indices=[round((item.get('clip_start',0)+i/25*item.get('speed',1))*fps) for i in range(n)]
    assert min(source_indices)>=0 and max(source_indices)<total,(item,source_indices[-1],total)
    records.append(dict(label=item['label'],mv_range=[item['start'],item['end']],file=item['file'],source_total=total,source_first=source_indices[0],source_last=source_indices[-1],frame_count=n,first_source_time=source_indices[0]/fps,last_source_time=source_indices[-1]/fps))
    for off in sample_offsets:
        frames.append(engine.render_item(clips,item,off));labels.append(f"{item['start']+off:.2f}s {path.stem} {off:.2f}")
save_sheet(frames,labels,Q/'new_shot_boundaries.jpg')
(Q/'new_shot_index_audit.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')

def preview(start,end,name):
    cap=cv2.VideoCapture(str(engine.BASE));cap.set(cv2.CAP_PROP_POS_FRAMES,round(start*25))
    out=Q/(name+'.mp4')
    cmd=[engine.FFMPEG,'-hide_banner','-loglevel','warning','-y','-f','rawvideo','-pix_fmt','bgr24','-s','1280x720','-r','25','-i','pipe:0','-ss',str(start),'-i',str(engine.ORIGINAL),'-t',str(end-start),'-map','0:v:0','-map','1:a:0','-c:v','libx264','-preset','fast','-crf','19','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-movflags','+faststart',str(out)]
    proc=subprocess.Popen(cmd,stdin=subprocess.PIPE,stderr=subprocess.PIPE)
    contact=[];labels=[]
    for n in range(round(start*25),round(end*25)):
        ok,frame=cap.read();assert ok
        item=next((x for x in edits if round(x['start']*25)<=n<round(x['end']*25)),None)
        if item:
            frame=engine.render_item(clips,item,(n-round(item['start']*25))/25)
            for hit in plan.get('impacts',[]):
                d=n-round(hit*25)
                if 0<=d<3:
                    a=[.34,.13,.03][d];frame=cv2.addWeighted(frame,1-a,np.full_like(frame,255),a,0)
            for a,b,rgb,alpha in overlays:
                if a<=n<b:
                    frame=np.clip(frame*(1-alpha)+rgb*alpha,0,255).astype(np.uint8);break
        proc.stdin.write(frame.tobytes())
        if (n-round(start*25))%6==0:
            contact.append(frame.copy());labels.append(f'{n/25:.2f}s '+(item['label'] if item else 'base'))
    proc.stdin.close();err=proc.stderr.read().decode('utf-8',errors='replace');assert proc.wait()==0,err
    cap.release();save_sheet(contact,labels,Q/(name+'_contact.jpg'))
    print(str(out),flush=True)

preview(131,136,'preview_131_136')
preview(148.48,159.28,'preview_14848_15928')
clips.close()
print(json.dumps(records,ensure_ascii=False,indent=2))
