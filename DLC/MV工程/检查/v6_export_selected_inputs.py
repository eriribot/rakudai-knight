import sys,json,hashlib
from pathlib import Path
import cv2
from PIL import Image,ImageDraw
P=Path(__file__).resolve().parents[1];O=P/'素材/v6/imagegen_inputs';O.mkdir(parents=True,exist_ok=True)
sys.path.insert(0,str(P))
from render_crossover_v2 import Clips
plan_path=P/'edit_plan_v4.json';plan=json.loads(plan_path.read_text('utf-8'));clips=Clips()
selection=[('touka',48.88,'profile_turn','Side-profile identity, braid, glasses region and uniform remain legible.'),('touka',50.44,'raikiri_guard','Sword across face with lightning; preserves eyes, hands and blade composition.'),('touka',51.64,'raikiri_body','Recognizable full-body Raikiri pose with yellow lightning; no pure-white flash.'),('ikki',64.12,'sword_guard','Frontal horizontal sword guard with both arms and torso visible.'),('ikki',68.52,'aerial_rush','Overhead forward rush: body, face direction and extended dark sword visible.'),('ikki',69.60,'downstroke','Low-angle overhead slash before the very blurred foreshortened close-up.'),('stella',154.12,'morning_turn','Forest turn with face, crown-like ornaments, torso and upright flame blade visible.'),('stella',154.64,'morning_downstrike','Beginning of descending strike, before heavy face/block smear at154.80.'),('stella',157.32,'fire_counter','Raised-sword fire-counter pose, torso and face recognizable; current blue arena matching retained.')]
rows=[];sheet=Image.new('RGB',(1280,3*264),(15,15,15));draw=ImageDraw.Draw(sheet)
for j,(who,t,action,reason) in enumerate(selection):
 n=round(t*25);t=n/25;i,x=next((i,x) for i,x in enumerate(plan['edits']) if x['start']<=t<x['end']);offset=t-x['start']
 frame=clips.frame(x,offset);file=f'{j+1:02}_{who}_{action}_t{t:06.2f}.png';dest=O/file;cv2.imencode('.png',frame)[1].tofile(str(dest))
 source_path=P/x['file'];cap=clips.opened[str(source_path)][0];fps=cap.get(cv2.CAP_PROP_FPS);local=x.get('clip_start',0)+offset*x.get('speed',1);source_index=round(local*fps)
 prov_path=source_path.with_suffix('.json');prov=json.loads(prov_path.read_text('utf-8')) if prov_path.exists() else {}
 row={'id':j+1,'character':who,'action':action,'input_png':str(dest),'width':1280,'height':720,'target_seconds':t,'target_frame_index_0based':n,'plan_item_index_0based':i,'plan_item_range':[x['start'],x['end']],'source_file':str(source_path),'source_fps':fps,'source_frame_index_0based':source_index,'source_local_seconds_requested':round(local,6),'source_local_seconds_actual':round(source_index/fps,6),'nominal_episode_source_seconds':round(prov['source_start']+source_index/fps,6) if 'source_start' in prov else None,'source_provenance':str(prov_path) if prov_path.exists() else None,'transforms':{k:x[k] for k in ['crop','flip','arena_blue','tint'] if k in x},'default_crop_if_unspecified':[32,0,576,324],'selection_reason':reason,'png_sha256':hashlib.sha256(dest.read_bytes()).hexdigest()}
 rows.append(row)
 im=Image.fromarray(cv2.cvtColor(frame,cv2.COLOR_BGR2RGB)).resize((426,240));xx=j%3*426;yy=j//3*264;sheet.paste(im,(xx,yy));draw.text((xx+4,yy+242),f'{j+1:02} {who} {t:.2f}s item{i} srcf{source_index}',fill='white')
clips.close();sheet.save(O/'selected_contact.jpg',quality=95)
manifest={'purpose':'ImageGen input selection only; no timeline or final-video changes.','plan':str(plan_path),'plan_sha256':hashlib.sha256(plan_path.read_bytes()).hexdigest(),'count':len(rows),'processing':'Original source decoded through unmodified render_crossover_v2.Clips only: V4 plan crop / mirror / arena color matching / Lanczos resize to720p. No lyrics, impact flashes, V4 enhancement hooks, V5 super-resolution, or extra sharpening.','contact':str(O/'selected_contact.jpg'),'frame_selection':'Avoided pure-white flash and unreadable smear extremes. Low native resolution and compression are deliberately preserved for ImageGen to correct.','items':rows}
(O/'selected_inputs.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print(str(O));print('9 PNG + selected_contact.jpg + selected_inputs.json')
