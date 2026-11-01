"""Align short replacement footage to existing source clips without changing color."""
from pathlib import Path
import cv2,numpy as np,subprocess,json
from PIL import Image,ImageDraw,ImageFont
P=Path(__file__).resolve().parent;S=P.parent;D=P/'matched';D.mkdir(exist_ok=True)
FF=r'E:\devtools\Anconda\Lib\site-packages\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v7.1.exe'
def features(p):
 c=cv2.VideoCapture(str(p));v=[];size=None
 while True:
  ok,f=c.read()
  if not ok:break
  h,w=f.shape[:2];size=(w,h);g=cv2.cvtColor(cv2.resize(f[int(h*.08):int(h*.83),int(w*.08):int(w*.92)],(96,54)),cv2.COLOR_BGR2GRAY).astype(np.float32).ravel();g-=g.mean();g/=max(np.linalg.norm(g),1e-6);v.append(g)
 c.release();return np.stack(v),size

combined=P/'ep10_combined_1089.mp4'
if not combined.exists():
 subprocess.run([FF,'-hide_banner','-loglevel','error','-y','-i',str(P/'ep10_1089.00_6.00.mp4'),'-i',str(P/'ep10_1094.00_10.00.mp4'),'-filter_complex','[0:v]trim=end_frame=125,setpts=PTS-STARTPTS[a];[1:v]setpts=PTS-STARTPTS[b];[a][b]concat=n=2:v=1:a=0[v]','-map','[v]','-an','-c:v','libx264','-crf','17','-preset','fast',str(combined)],check=True)

jobs=[
 ('stella_morning_slash','v3/selected/stella_morning_slash.mp4','ep3_0.00_16.00.mp4',132,0,3),
 ('stella_morning_turn','v3/selected/stella_morning_turn.mp4','ep3_0.00_16.00.mp4',212,0,3),
 ('stella_morning_downstrike','v3/selected/stella_morning_downstrike.mp4','ep3_0.00_16.00.mp4',343,0,3),
 ('ikki_eye_open','v3/selected/ikki_eye_open.mp4','ep4_973.00_17.00.mp4',29,973,4),
 ('itto_shura_start','v3/selected/itto_shura_start.mp4','ep4_973.00_17.00.mp4',262,973,4),
 ('touka_raikiri_raw','v2/ep10/touka_raikiri_raw.mp4','ep10_combined_1089.mp4',14,1089,10),
 ('stella_charge_raw','v2/ep01/stella_charge_raw.mp4','ep1_874.00_18.00.mp4',36,874,1),
 ('stella_block_raw','v2/ep01/stella_block_raw.mp4','ep1_874.00_18.00.mp4',321,874,1),
]
optional=[
 ('ikki_counter_raw','v2/ep01/ikki_counter_raw.mp4','ep1_891.80_10.00.mp4',4,891.8,1),
 ('stella_fire_raw','v2/ep01/stella_fire_raw.mp4','ep1_943.00_11.00.mp4',11,943,1),
 ('ikki_dodge_raw','v2/ep01/ikki_dodge_raw.mp4','ep1_969.00_11.00.mp4',11,969,1),
]
jobs.extend(j for j in optional if (P/j[2]).exists())
source_features={};records=[];sheet_frames=[];sheet_labels=[]
font=ImageFont.truetype(r'C:\Windows\Fonts\msjh.ttc',17)
for name,old_rel,new_rel,expected,absolute,ep in jobs:
 old=S/old_rel;new=P/new_rel;out=D/(name+'.mp4')
 if out.exists() and out.with_suffix('.json').exists():
  records.append(json.loads(out.with_suffix('.json').read_text(encoding='utf8')));continue
 x,_=features(old)
 if new_rel not in source_features:source_features[new_rel]=features(new)
 y,(w,h)=source_features[new_rel]
 sims=x@y.T;n=len(x);offsets=np.arange(expected-4,expected+5)
 # Dynamic alignment: source progresses by zero, one or two native frames.
 costs=np.full((n,9),np.inf);parents=np.full((n,9),-1,dtype=int)
 for i in range(n):
  for s,off in enumerate(offsets):
   j=i+off
   if not 0<=j<len(y):continue
   c=1-float(sims[i,j])+.0015*abs(off-expected)
   if i==0:costs[i,s]=c;continue
   opts=[]
   for prev in range(9):
    delta=1+off-offsets[prev]
    if 0<=delta<=2:opts.append((costs[i-1,prev]+.002*(delta-1)**2,prev))
   if opts:
    best,prev=min(opts);costs[i,s]=c+best;parents[i,s]=prev
 state=int(np.argmin(costs[-1]));mapping=[]
 for i in range(n-1,-1,-1):
  mapping.append(int(i+offsets[state]));state=parents[i,state]
 mapping=mapping[::-1];corr=[float(sims[i,j]) for i,j in enumerate(mapping)]
 if np.mean(corr)<.8:raise RuntimeError(f'Not a corresponding shot: {name} {np.mean(corr)}')
 cap=cv2.VideoCapture(str(new));oldcap=cv2.VideoCapture(str(old));last=-1;cached=None
 proc=subprocess.Popen([FF,'-hide_banner','-loglevel','error','-y','-f','rawvideo','-pix_fmt','bgr24','-s',f'{w}x{h}','-r','25','-i','pipe:0','-an','-c:v','libx264','-crf','16','-preset','fast','-pix_fmt','yuv420p','-movflags','+faststart',str(out)],stdin=subprocess.PIPE)
 picks={0,n//2,n-1}
 for i,j in enumerate(mapping):
  if j!=last:
   if j!=last+1:cap.set(cv2.CAP_PROP_POS_FRAMES,j)
   ok,cached=cap.read();assert ok
  proc.stdin.write(cached.tobytes());last=j
  if i in picks:
   oldcap.set(cv2.CAP_PROP_POS_FRAMES,i);ok,of=oldcap.read();assert ok
   sheet_frames.extend([of,cached.copy()]);sheet_labels.extend([f'{name} old frame {i}',f'CDA {absolute+j/25:.2f}s corr {corr[i]:.3f}'])
 proc.stdin.close();assert proc.wait()==0;cap.release();oldcap.release()
 crop=[136,36,1008,567] if h==720 else [91,24,672,378]
 rec={'name':name,'file':str(out),'replaces':str(old),'original_frames':n,'frames':n,'fps':25,'duration':n/25,'width':w,'height':h,'native_source':str(new),'source_page':{1:'https://www.cda.pl/video/5791976c3',3:'https://www.cda.pl/video/57920030a',4:'https://www.cda.pl/video/579201204',10:'https://www.cda.pl/video/5792096e9'}[ep],'source_start':absolute+mapping[0]/25,'source_end':absolute+(mapping[-1]+1)/25,'source_frame_mapping':mapping,'mean_matching_correlation':float(np.mean(corr)),'color_changes':'none','suggested_crop':crop,'note':'Same animation frames matched to old duration; native public 480p/720p source, not AI enlargement. Tiny top corner source marks and bottom Polish subtitles are outside suggested crop.'}
 out.with_suffix('.json').write_text(json.dumps(rec,ensure_ascii=False,indent=2),encoding='utf8');records.append(rec);print(name,n,w,h,round(float(np.mean(corr)),3),flush=True)
if sheet_frames:
 sh=Image.new('RGB',(1280,205*((len(sheet_frames)+3)//4)),(20,20,22));d=ImageDraw.Draw(sh)
 for i,(f,label) in enumerate(zip(sheet_frames,sheet_labels)):
  x=i%4*320;y=i//4*205;sh.paste(Image.fromarray(cv2.cvtColor(cv2.resize(f,(320,180)),cv2.COLOR_BGR2RGB)),(x,y));d.text((x+2,y+181),label,font=font,fill='white')
 sh.save(D/'source_comparison.jpg',quality=94)
(D/'manifest.json').write_text(json.dumps({'status':'corresponding action clips','clips':records},ensure_ascii=False,indent=2),encoding='utf8')
