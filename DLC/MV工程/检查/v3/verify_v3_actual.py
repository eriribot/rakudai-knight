import json,hashlib,subprocess,concurrent.futures,math
from pathlib import Path
import cv2
from PIL import Image,ImageDraw
P=Path(__file__).resolve().parents[2];O=Path(__file__).resolve().parent
F=P.parent/'学战都市×落第骑士英雄谭_联合MV_V3_蓝光对位版.mp4'
SRC=next(P.parent.parent.glob('*Asterisk*.mp4'))
FF=r'E:\devtools\Anconda\Lib\site-packages\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v7.1.exe'
FP=r'E:\devtools\Anconda\envs\LLM_Train\Library\bin\ffprobe.exe'
def audio(p):
 x=subprocess.run([FF,'-v','error','-i',str(p),'-map','0:a:0','-c:a','copy','-f','adts','pipe:1'],capture_output=True,check=True)
 return {'sha256':hashlib.sha256(x.stdout).hexdigest(),'bytes':len(x.stdout)}
def probe(p):
 return json.loads(subprocess.check_output([FP,'-v','error','-show_format','-show_streams','-of','json',str(p)]))
def decode():
 r=subprocess.run([FF,'-v','error','-i',str(F),'-map','0:v:0','-map','0:a:0','-f','null','-'],capture_output=True)
 return {'exit_code':r.returncode,'stderr':r.stderr.decode('utf-8','replace')}
pool=concurrent.futures.ThreadPoolExecutor(5)
fa=pool.submit(audio,F);sa=pool.submit(audio,SRC);fp=pool.submit(probe,F);sp=pool.submit(probe,SRC);de=pool.submit(decode)
cap=cv2.VideoCapture(str(F))
def contact(numbers,name,cols=4,width=384):
 height=width*9//16;sheet=Image.new('RGB',(cols*width,math.ceil(len(numbers)/cols)*(height+24)),(20,20,20));d=ImageDraw.Draw(sheet)
 for i,n in enumerate(numbers):
  cap.set(cv2.CAP_PROP_POS_FRAMES,n);ok,f=cap.read()
  if not ok:raise RuntimeError(n)
  im=Image.fromarray(cv2.cvtColor(f,cv2.COLOR_BGR2RGB)).resize((width,height));x=i%cols*width;y=i//cols*(height+24)
  sheet.paste(im,(x,y));d.text((x+4,y+height+2),f'{n/25:.2f} f{n}',fill='white')
 sheet.save(O/name,quality=94)
for i in range(2):contact(list(range(279+i*24,min(327,279+(i+1)*24))),f'actual_roster_{i}.jpg')
a=json.loads((P/'edit_plan_v3.json').read_text('utf-8'))
edits=[x for x in a['edits'] if 63<=x['start']<76]
for i in range(2):
 nums=[]
 for x in edits[i*5:(i+1)*5]:
  first=round(x['start']*25);last=round(x['end']*25)-1;nums += [first,(first+last)//2,last]
 contact(nums,f'actual_exchange1_{i}.jpg',3,512)
for i in range(2):contact(list(range(1773+i*21,min(1814,1773+(i+1)*21))),f'actual_mecha_fix_{i}.jpg')
contact([3254,3255,3265,3278,3279,3290,3311,3312,3327,3328,3349,3350,3360,3361,3380,3399,3400], 'actual_blue_power.jpg')
cap.release()
fm=fp.result();sm=sp.result();fau=fa.result();sau=sa.result();dr=de.result()
v=next(x for x in fm['streams'] if x['codec_type']=='video');au=next(x for x in fm['streams'] if x['codec_type']=='audio')
result={'file':str(F),'sha256':hashlib.sha256(F.read_bytes()).hexdigest(),'video':{k:v.get(k) for k in ['width','height','r_frame_rate','nb_frames','duration']},'audio':{k:au.get(k) for k in ['codec_name','duration','sample_rate','channels']},'format_duration':fm['format']['duration'],'source_format_duration':sm['format']['duration'],'audio_copy':fau,'original_audio':sau,'audio_identical':fau==sau,'full_decode':dr,'visual_status':'pending image inspection','contacts':[str(q) for q in O.glob('actual_*.jpg')]}
(O/'verify_actual_result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in result.items() if k not in ['file','contacts']},ensure_ascii=False))
