"""Objective final V3 verification. Run only after the encoder has completed."""
from pathlib import Path
import argparse,csv,hashlib,json,math,subprocess,time
import cv2
import numpy as np
from PIL import Image,ImageDraw,ImageFont

P=Path(__file__).resolve().parent
ROOT=P.parent.parent
V3=P.parent/'学战都市×落第骑士英雄谭_联合MV_V3_蓝光对位版.mp4'
V1=P.parent/'学战都市×落第骑士英雄谭_联合MV.mp4'
ORIGINAL=next(ROOT.glob('*Asterisk*.mp4'))
Q=P/'检查/v3/final'
FFMPEG=r'E:\devtools\Anconda\Lib\site-packages\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v7.1.exe'
FFPROBE=r'E:\devtools\Anconda\envs\LLM_Train\Library\bin\ffprobe.exe'
FPS=25
EXPECTED_FRAMES=5267
ENDING_START=round(181.48*FPS)
SHOT_TIMES=[11.56,12.52,131.00,131.60,135.60,154.00]

def probe(path):
    cmd=[FFPROBE,'-v','error','-show_streams','-show_format','-of','json',str(path)]
    return json.loads(subprocess.check_output(cmd))

def audio_hash(path):
    cmd=[FFMPEG,'-v','error','-i',str(path),'-map','0:a:0','-c:a','copy','-f','adts','pipe:1']
    proc=subprocess.Popen(cmd,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    sha=hashlib.sha256();size=0
    while block:=proc.stdout.read(1024*1024):
        sha.update(block);size+=len(block)
    err=proc.stderr.read().decode('utf-8',errors='replace')
    if proc.wait():raise RuntimeError(err)
    return dict(sha256=sha.hexdigest(),bytes=size)

def write_jpg(path,frame):
    assert cv2.imencode('.jpg',frame,[cv2.IMWRITE_JPEG_QUALITY,95])[0]
    cv2.imencode('.jpg',frame,[cv2.IMWRITE_JPEG_QUALITY,95])[1].tofile(path)

def contact(frames,labels,path,cols=2):
    w,h=640,360;stride=390
    im=Image.new('RGB',(w*cols,stride*((len(frames)+cols-1)//cols)),(22,22,25))
    d=ImageDraw.Draw(im);font=ImageFont.truetype(r'C:\Windows\Fonts\msjh.ttc',19)
    for i,(frame,label) in enumerate(zip(frames,labels)):
        x=i%cols*w;y=i//cols*stride
        im.paste(Image.fromarray(cv2.cvtColor(cv2.resize(frame,(w,h)),cv2.COLOR_BGR2RGB)),(x,y))
        d.text((x+4,y+h+2),label,font=font,fill='white')
    im.save(path,quality=94)

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--run',action='store_true');args=ap.parse_args()
    if not args.run:raise SystemExit('Prepared only. Pass --run after encoder completion.')
    started=time.monotonic();Q.mkdir(parents=True,exist_ok=True)
    result={'output':str(V3),'reference_v1':str(V1),'original_audio':str(ORIGINAL),'checks':{},'screenshots':[]}
    final_probe=probe(V3);original_probe=probe(ORIGINAL)
    (Q/'ffprobe_v3.json').write_text(json.dumps(final_probe,ensure_ascii=False,indent=2),encoding='utf-8')
    v=next(x for x in final_probe['streams'] if x['codec_type']=='video')
    a=next(x for x in final_probe['streams'] if x['codec_type']=='audio')
    result['metadata']={'video_codec':v['codec_name'],'width':v['width'],'height':v['height'],'fps':v['avg_frame_rate'],'frames':int(v['nb_frames']),'video_duration':float(v['duration']),'audio_codec':a['codec_name'],'audio_duration':float(a['duration']),'sample_rate':int(a['sample_rate']),'channels':a['channels'],'container_duration':float(final_probe['format']['duration']),'bytes':V3.stat().st_size}
    result['checks']['metadata']=(v['width']==1280 and v['height']==720 and v['avg_frame_rate']=='25/1' and int(v['nb_frames'])==EXPECTED_FRAMES and abs(float(v['duration'])-210.68)<.001 and a['codec_name']=='aac' and int(a['sample_rate'])==48000 and a['channels']==2 and abs(float(final_probe['format']['duration'])-float(original_probe['format']['duration']))<.005)
    decoded=subprocess.run([FFMPEG,'-v','error','-xerror','-i',str(V3),'-map','0:v:0','-map','0:a:0','-f','null','-'],capture_output=True,text=True)
    (Q/'full_decode.log').write_text(decoded.stderr,encoding='utf-8')
    result['checks']['complete_decode']=decoded.returncode==0 and not decoded.stderr.strip()
    print('Metadata and complete decode checked.',flush=True)
    result['audio_adts']={'original':audio_hash(ORIGINAL),'v3':audio_hash(V3)}
    result['checks']['aac_bit_exact']=result['audio_adts']['original']==result['audio_adts']['v3']
    print('AAC ADTS SHA256 compared.',flush=True)

    caps=[cv2.VideoCapture(str(x)) for x in [V1,V3]]
    assert all(c.isOpened() for c in caps)
    for c in caps:c.set(cv2.CAP_PROP_POS_FRAMES,ENDING_START)
    rows=[];worst=[]
    for n in range(ENDING_START,EXPECTED_FRAMES):
        decoded_frames=[c.read() for c in caps]
        if not all(ok for ok,_ in decoded_frames):raise RuntimeError(f'Ending decode failed at {n}')
        f1,f3=[f for _,f in decoded_frames]
        assert f1.shape==f3.shape==(720,1280,3)
        mse=cv2.norm(f1,f3,cv2.NORM_L2SQR)/f1.size
        psnr=10*math.log10(255**2/mse) if mse else float('inf')
        rows.append((n,n/FPS,psnr,mse))
        if len(worst)<6 or psnr<worst[-1][0]:
            worst.append((psnr,n,f1.copy(),f3.copy()));worst.sort(key=lambda z:z[0]);worst=worst[:6]
    extra=[c.read()[0] for c in caps]
    for c in caps:c.release()
    with (Q/'ending_frame_psnr.csv').open('w',encoding='utf-8',newline='') as f:
        writer=csv.writer(f);writer.writerow(['frame','time','rgb_psnr_db','mse']);writer.writerows(rows)
    values=np.array([r[2] for r in rows]);finite=values[np.isfinite(values)]
    min_psnr=float(np.min(values));mse_mean=float(np.mean([r[3] for r in rows]))
    result['ending_comparison']={'from_seconds':181.48,'first_frame':ENDING_START,'last_frame':EXPECTED_FRAMES-1,'frames_compared':len(rows),'min_rgb_psnr_db':min_psnr,'median_rgb_psnr_db':float(np.median(values)),'aggregate_rgb_psnr_db':10*math.log10(255**2/mse_mean) if mse_mean else 'infinite','frames_below_30db':int(np.sum(values<30)),'frames_below_35db':int(np.sum(values<35)),'worst_frame':min(rows,key=lambda z:z[2])[0],'extra_frames_after_expected':extra,'method':'Corresponding decoded BGR frames, full resolution. RGB PSNR permits lossy re-encoding; visual review of worst six pairs required.'}
    result['checks']['ending_count']=len(rows)==EXPECTED_FRAMES-ENDING_START and extra==[False,False]
    result['checks']['ending_reencoding_similarity']=min_psnr>=30
    worst_frames=[];worst_labels=[]
    for psnr,n,f1,f3 in worst:
        worst_frames.extend([f1,f3]);worst_labels.extend([f'V1 {n/FPS:.2f}s frame {n}',f'V3 {n/FPS:.2f}s PSNR {psnr:.2f} dB'])
    contact(worst_frames,worst_labels,Q/'ending_worst_pairs.jpg')
    print(f'Ending checked: {len(rows)} frames, minimum PSNR {min_psnr:.2f} dB.',flush=True)

    cap=cv2.VideoCapture(str(V3));frames=[];labels=[]
    for seconds in SHOT_TIMES:
        n=round(seconds*FPS);cap.set(cv2.CAP_PROP_POS_FRAMES,n);ok,frame=cap.read()
        if not ok:raise RuntimeError(f'Screenshot decode failed at {seconds}')
        out=Q/f'frame_{seconds:06.2f}.jpg';write_jpg(out,frame)
        result['screenshots'].append(str(out));frames.append(frame);labels.append(f'V3 {seconds:.2f}s / frame {n}')
    cap.release();contact(frames,labels,Q/'requested_screenshots.jpg')
    result['objective_pass']=all(result['checks'].values())
    result['visual_review']='pending agent inspection of ending_worst_pairs.jpg and requested_screenshots.jpg'
    result['elapsed_seconds']=round(time.monotonic()-started,2)
    (Q/'verification_result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(result,ensure_ascii=False,indent=2),flush=True)
    if not result['objective_pass']:raise SystemExit(2)

if __name__=='__main__':main()
