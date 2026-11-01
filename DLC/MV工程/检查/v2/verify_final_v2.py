from pathlib import Path
import json,subprocess,hashlib,time,math
import cv2,numpy as np
from PIL import Image,ImageDraw,ImageFont
OUT=Path(__file__).resolve().parent
P=OUT.parents[1];DLC=P.parent;ROOT=DLC.parent
FFMPEG=r'E:\devtools\Anconda\Lib\site-packages\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v7.1.exe'
FFPROBE=r'E:\devtools\Anconda\envs\LLM_Train\Library\bin\ffprobe.exe'
ORIGINAL=next(ROOT.glob('*Asterisk*.mp4'))
V1=DLC/'学战都市×落第骑士英雄谭_联合MV.mp4'
V2=DLC/'学战都市×落第骑士英雄谭_联合MV_V2_交锋版.mp4'
started=time.time()
def probe(path):
    r=subprocess.run([FFPROBE,'-v','error','-show_streams','-show_format','-of','json',str(path)],capture_output=True,check=True)
    return json.loads(r.stdout)
def adts_hash(path):
    r=subprocess.run([FFMPEG,'-v','error','-i',str(path),'-map','0:a:0','-c:a','copy','-f','adts','pipe:1'],capture_output=True,check=True)
    return {'sha256':hashlib.sha256(r.stdout).hexdigest(),'adts_bytes':len(r.stdout),'stderr':r.stderr.decode('utf-8','replace')}
result={'file':str(V2),'original':str(ORIGINAL),'v1_reference':str(V1),'metadata':{'original':probe(ORIGINAL),'v2':probe(V2)}}
result['audio']={'original':adts_hash(ORIGINAL),'v2':adts_hash(V2)}
result['audio']['identical_adts_packets']=result['audio']['original']['sha256']==result['audio']['v2']['sha256']
print('Metadata and audio checked',flush=True)
r=subprocess.run([FFMPEG,'-v','error','-xerror','-err_detect','explode','-i',str(V2),'-map','0:v:0','-an','-fps_mode','passthrough','-progress','pipe:1','-f','null','-'],capture_output=True)
progress=r.stdout.decode('utf-8','replace');errors=r.stderr.decode('utf-8','replace')
frames=[int(line.split('=',1)[1]) for line in progress.splitlines() if line.startswith('frame=')]
result['full_decode']={'returncode':r.returncode,'error_output':errors,'decoded_frames':frames[-1] if frames else None,'progress_ended':progress.strip().endswith('progress=end')}
(OUT/'verify_final_decode.log').write_text(progress+'\n'+errors,encoding='utf-8')
print('Full decode checked',flush=True)
font=ImageFont.truetype(r'C:\Windows\Fonts\consola.ttf',19)
cap=cv2.VideoCapture(str(V2))
def make_sheet(name,times):
    out=Image.new('RGB',(1280,204*((len(times)+3)//4)),(10,12,18));d=ImageDraw.Draw(out)
    for i,t in enumerate(times):
        n=round(t*25);cap.set(cv2.CAP_PROP_POS_FRAMES,n);ok,f=cap.read()
        if not ok:raise RuntimeError(f'Sample decode failed{n}')
        cv2.imencode('.jpg',f)[1].tofile(OUT/f'verify_final_sample_{n:04}.jpg')
        x=i%4*320;y=i//4*204
        out.paste(Image.fromarray(cv2.cvtColor(f,cv2.COLOR_BGR2RGB)).resize((320,180)),(x,y+24))
        d.text((x+4,y+2),f'{n/25:.2f}s / f{n}',font=font,fill='white')
    out.save(OUT/name,quality=95)
make_sheet('verify_final_new_sections.jpg',[11.16,11.60,12.04,12.08,12.56,13.00,13.36,19.8,22.32,23.20,24.12,25.80,30.2,32.6,37,38.96,40.96,48.8,52.0,56.0,171.96,173.36,173.4,174.04,174.64,174.68,175.4,175.44,176.8,178.12,181.48,182.6,184.5,187.5,193.6,201.0,203.0,205.56,208.0,210.64])
make_sheet('verify_final_exchange1.jpg',[63.12,63.84,64.60,64.64,65.40,66.20,66.24,66.60,66.96,67.00,67.32,67.68,67.72,68.04,68.40,68.44,68.92,69.44,69.48,69.96,70.48,70.52,71.00,71.48,71.52,71.84,72.16,72.20,72.84,73.52,73.56,73.96,74.40,74.44,75.20,75.96,76.0,76.56,76.60])
make_sheet('verify_final_exchange2.jpg',[148.44,148.48,149.04,149.60,149.64,149.88,150.12,150.16,150.88,151.64,151.68,152.24,152.84,152.88,153.28,153.68,153.72,154.04,154.40,154.44,154.80,155.16,155.20,155.80,156.40,156.44,157.12,157.80,157.84,158.28,158.72,158.76,159.00,159.24,159.28,159.48])
cap.release()
print('Actual encoded samples extracted',flush=True)
c1=cv2.VideoCapture(str(V1));c2=cv2.VideoCapture(str(V2));start=4537
c1.set(cv2.CAP_PROP_POS_FRAMES,start);c2.set(cv2.CAP_PROP_POS_FRAMES,start)
errs=[]
for n in range(start,5267):
    ok1,a=c1.read();ok2,b=c2.read()
    if not(ok1 and ok2):raise RuntimeError(f'Ending read failure{n}')
    diff=a.astype(np.float32)-b.astype(np.float32)
    mse=float(np.mean(diff*diff));mae=float(np.mean(abs(diff)));psnr=10*math.log10(255*255/mse) if mse else 100
    errs.append({'frame':n,'seconds':n/25,'mae':round(mae,4),'psnr_db':round(psnr,4)})
c1.release();c2.release()
result['ending_comparison']={'start':181.48,'frames_compared':len(errs),'mean_mae':round(float(np.mean([e['mae'] for e in errs])),4),'max_mae_frame':max(errs,key=lambda x:x['mae']),'min_psnr_frame':min(errs,key=lambda x:x['psnr_db']),'all_frames_mae_below_5':all(e['mae']<5 for e in errs),'note':'Comparison is decoded V2 versus decoded V1; re-encoding differences expected. All frames compared after locked ending point.'}
(OUT/'verify_final_ending_frame_metrics.json').write_text(json.dumps(errs,indent=2),encoding='utf-8')
result['v2_file_sha256']=hashlib.file_digest(V2.open('rb'),'sha256').hexdigest()
result['elapsed_seconds']=round(time.time()-started,2)
v=next(x for x in result['metadata']['v2']['streams'] if x['codec_type']=='video')
result['technical_pass']=r.returncode==0 and not errors.strip() and result['full_decode']['decoded_frames']==5267 and v['width']==1280 and v['height']==720 and v['avg_frame_rate']=='25/1' and result['audio']['identical_adts_packets'] and result['metadata']['v2']['format']['duration']==result['metadata']['original']['format']['duration']
result['visual_review']='Pending independent inspection of actual encoded samples'
(OUT/'verify_final_result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'technical_pass':result['technical_pass'],'decode':result['full_decode'],'audio_identical':result['audio']['identical_adts_packets'],'ending':result['ending_comparison'],'elapsed_seconds':result['elapsed_seconds']},ensure_ascii=False),flush=True)
