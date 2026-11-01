from pathlib import Path
from PIL import Image,ImageDraw
import subprocess,json,cv2,math
ROOT=Path(__file__).resolve().parent
OUT=ROOT/'selected';OUT.mkdir(exist_ok=True)
FFMPEG=r'E:\devtools\Anconda\Lib\site-packages\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v7.1.exe'
# Frame intervals are [start,end), on normalized 25fps MP4s, never raw TS.
specs=[
 ('ikki_eye_open','ep04/ikki_closed_eye_guard_raw.mp4',65,125,'Ikki','closed eyes to open eyes, raises vertical sword','frontal',''),
 ('itto_shura_start','ep04/itto_shura_true_activation_raw.mp4',11,152,'Ikki','verified Ittou Shura: vertical sword, full-body energy release','frontal','Source subtitle names 一刀修羅; original pale/white-blue energy, no synthetic recoloring.'),
 ('touka_horizontal_slash','ep09/touka_new_draw_raw.mp4',0,15,'Touka','sword drawn horizontally across face','horizontal',''),
 ('touka_sword_close','ep09/touka_new_draw_raw.mp4',36,52,'Touka','sword/side-face close-up','profile','Original shot has cinematic black bars.'),
 ('touka_eye','ep09/touka_new_draw_raw.mp4',72,99,'Touka','amber eye and glasses close-up','frontal','Original shot has cinematic black bars.'),
 ('touka_thunder_burst','ep09/touka_new_draw_raw.mp4',106,144,'Touka','lightning discharge and flash','outward','Strong original strobe/white flash; use briefly.'),
 ('touka_lightning_entry','ep09/touka_new_draw_raw.mp4',205,250,'Touka','solo full-body lightning stance','frontal',''),
 ('touka_lightning_hold','ep09/touka_lightning_stance_raw.mp4',0,41,'Touka','lightning trails dissipate around her','frontal','Ends before golem is revealed.'),
 ('touka_guard_turn','ep09/touka_lightning_stance_raw.mp4',120,234,'Touka','turns into new sword-draw stance, then glasses profile','left-facing to screen right','No golem in this selected interval.'),
 ('ikki_lower_sword','ep06/ikki_parry_finish_raw.mp4',78,200,'Ikki','lowers blade after victory, camera rises to face','frontal / low angle','First part of raw file is Tomaru; excluded here.'),
 ('stella_new_eyes','ep06/stella_heavy_guard_raw.mp4',102,164,'Stella','confident eyes closed to open, clean portrait','frontal','Portrait rather than an attack. Original opponent excluded.'),
 ('stella_morning_slash','ep03/morning_sparring_raw.mp4',0,43,'Stella','eye/face into flaming side slash','toward camera / diagonal','Very fast source action contains native 360p compression artifacts.'),
 ('ikki_morning_evade','ep03/morning_sparring_raw.mp4',43,80,'Ikki','sidesteps and swings his sword back','lateral / toward camera','A flame blade crosses foreground, but no opponent face/body.'),
 ('stella_morning_turn','ep03/morning_sparring_raw.mp4',80,102,'Stella','turns and readies her flaming sword','toward camera',''),
 ('stella_morning_guard','ep03/morning_sparring_raw.mp4',102,136,'Stella','raised sword blocks/counters','overhead','Original opponent black sword remains in foreground; no opponent person. Optional if weapon continuity is acceptable.'),
 ('stella_morning_downstrike','ep03/morning_sparring_raw.mp4',211,227,'Stella','close overhead descending strike','down toward camera',''),
 ('ikki_morning_guard','ep03/ikki_morning_block_raw.mp4',8,80,'Ikki','frontal sword block then lowers sword','frontal','Original opponent gold/fire blade in foreground, no opponent person.'),
]
manifest=[];mids=[]
for name,rel,a,b,char,action,direction,note in specs:
    src=ROOT/rel;dst=OUT/(name+'.mp4');n=b-a
    vf=f'trim=start_frame={a}:end_frame={b},setpts=N/(25*TB),fps=25'
    subprocess.run([FFMPEG,'-hide_banner','-loglevel','error','-i',str(src),'-vf',vf,'-an','-c:v','libx264','-preset','fast','-crf','17','-r','25','-fps_mode','cfr','-frames:v',str(n),'-movflags','+faststart','-y',str(dst)],check=True)
    cap=cv2.VideoCapture(str(dst));frames=[]
    while True:
        ok,f=cap.read()
        if not ok:break
        frames.append(f)
    fps=cap.get(cv2.CAP_PROP_FPS);cap.release()
    assert len(frames)==n and abs(fps-25)<.01,(name,len(frames),n,fps)
    provenance=json.loads(src.with_suffix('.json').read_text(encoding='utf-8'))
    item={'name':name,'file':str(dst),'source_file':str(src),'source_url':provenance['source_url'],'source_start':round(provenance['source_start']+a/25,6),'source_end':round(provenance['source_start']+b/25,6),'source_frames':[a,b],'frames':n,'fps':25,'duration':n/25,'character':char,'action':action,'direction':direction,'note':note,'color_changes':'none','default_crop':[32,0,576,324]}
    dst.with_suffix('.json').write_text(json.dumps(item,ensure_ascii=False,indent=2),encoding='utf-8');manifest.append(item)
    mids.append((name,char,n/25,frames[len(frames)//2]))

# Prove no selected source interval intersects any prior captured V2 source, even rejected candidates.
previous=[]
for p in (ROOT.parent/'v2').glob('ep*/**/*.json'):
    try:d=json.loads(p.read_text(encoding='utf-8'))
    except Exception:continue
    if isinstance(d,dict) and {'source_url','source_start','duration_requested'}<=d.keys():previous.append(d)
for item in manifest:
    for old in previous:
        assert not (item['source_url']==old['source_url'] and item['source_start']<old['source_start']+old['duration_requested'] and item['source_end']>old['source_start']),'old footage overlap'
total=round(sum(x['duration'] for x in manifest),2)
result={'status':'complete','workflow':'web research first, then new public 360p excerpts; no prior footage reused','research_plan':str(ROOT/'research_plan.md'),'mv_alignment_anchor_seconds':131,'selected_clips':len(manifest),'selected_total_seconds':total,'native_resolution':[640,360],'fps':25,'audio':'none','verification':'every selected output decoded completely with exact expected frame count; no interval overlaps V1/V2 source ranges (V1 episodes1/2/12, V3 episodes3/4/6/9)','clips':manifest}
(ROOT/'ready_manifest.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
w,h,cols=320,210,4;im=Image.new('RGB',(w*cols,h*math.ceil(len(mids)/cols)),(20,20,20));draw=ImageDraw.Draw(im)
for k,(name,char,dur,fr) in enumerate(mids):
    x,y=k%cols*w,k//cols*h
    draw.text((x+5,y+4),f'{name} | {dur:.2f}s',fill='white')
    thumb=Image.fromarray(cv2.cvtColor(fr,cv2.COLOR_BGR2RGB)).resize((320,180));im.paste(thumb,(x,y+28))
im.save(OUT/'overview.jpg',quality=90)
print(json.dumps({'selected_clips':len(manifest),'duration':total,'manifest':str(ROOT/'ready_manifest.json'),'overview':str(OUT/'overview.jpg')},ensure_ascii=False))
