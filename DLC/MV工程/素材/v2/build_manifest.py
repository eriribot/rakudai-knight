from pathlib import Path
import json,cv2
ROOT=Path(__file__).resolve().parent

def pick(start,end,character,action,direction='',exact=True):
    return dict(local_start=start,local_end=end,character=character,action=action,motion_direction=direction,frame_boundaries_verified=exact)

selection={
'stella_charge_raw':[
 pick(0,.88,'Ikki','eyes close-up'),
 pick(.88,1.76,'Stella','clean profile / preparing to charge','screen right'),
 pick(2.64,3.44,'Stella','single-character forward charge','screen right / toward camera'),
 pick(3.44,4.12,'Ikki','raises sword to counter','toward camera'),
 pick(4.12,4.52,'Stella','frontal overhead sword swing','downward'),
],
'stella_block_raw':[pick(0,.88,'Stella','face with gold sword guarding','guard across upper right',False)],
'stella_fire_raw':[
 pick(.6,5.6,'Stella','solo fire pillar / power-up','vertical fire',False),
 pick(5.6,7.7,'Stella','face close-up into huge flaming blade attack','toward screen left; mirror to match Julis',False),
],
'ikki_dodge_raw':[
 pick(0,.72,'Stella','solo flame-blade swing','screen right',False),
 pick(.84,1,'Ikki','four-frame face close-up','toward camera'),
 pick(1.24,3.44,'Ikki','single-character rush from distant view toward camera','toward camera'),
 pick(4.8,6.08,'Ikki','crosses fire column with sword','horizontal',False),
 pick(7.68,9.04,'Ikki','blue-lit overhead sword strike, face visible; last .20s blade crosses camera','downward / toward camera'),
],
'ikki_counter_raw':[
 pick(.32,1.68,'Stella','reels backward, only her face/body visible','backward',False),
 pick(2.16,2.48,'Ikki','single-character counter-swing close-up','downward',False),
 pick(4.8,7.8,'Ikki','multiple afterimages of Ikki, no opponent','stance / speed afterimages',False),
 pick(8.04,8.76,'Ikki','post-strike profile','face toward screen left',False),
],
'touka_raikiri_raw':[
 pick(.56,1.12,'Shizuku','reaction, not Touka'),
 pick(2.8,7.36,'Touka','Raikiri draw and lightning attack; face visible only 2.80–2.96','frontal then lightning'),
 pick(7.36,8,'Shizuku','reaction, not Touka'),
],
'shizuku_water_raw':[
 pick(1.2,4.4,'Shizuku','solo water swirl from rear','water rotating around her'),
 pick(3,6.2,'Shizuku','alternative water-swirl interval; overlaps previous','water rotating around her'),
],
'shizuku_face_raw':[
 pick(0,1.44,'Shizuku','single-character full-body front view'),
 pick(1.44,2.68,'Touka','clear brown-haired / amber-eyed front portrait; despite source filename'),
 pick(2.68,4.72,'Shizuku','clear white-blue-haired / green-eyed face into short-sword stance'),
],
'touka_face_raw':[
 pick(.72,1.44,'Shizuku','short-sword forward rush, not Touka','forward'),
 pick(1.44,2.4,'Touka','single-character sword close-up amid purple lightning and water ring'),
],
'itto_shura_build_raw':[
 pick(0,.6,'Ikki','verified Ittou Shura declaration; burned-in subtitle explicitly names 一刀修羅'),
],
'itto_shura_call_raw':[
 pick(0,1.28,'Ikki','verified Ittou Shura stance/declaration; pale energy trails, not a large blue explosion'),
],
'itto_shura_release_raw':[
 pick(.44,3.16,'Ikki','lowers head and raises eyes in the same activated Ittou Shura sequence; do not claim a blue-flame explosion'),
],
'academy_establishing_raw':[
 pick(1.12,3.76,'Hagun Academy','school entrance/campus with cherry blossoms, no credits overlay'),
 pick(6.76,10,'Hagun Academy','uninterrupted campus establishing pan, 3.24 seconds'),
],
'ikki_exhausted_raw':[
 pick(.08,2.72,'Ikki','alone, exhausted and staggering across a bridge; monochrome'),
 pick(2.72,6,'Ikki','head bowed and body bruised in bleak monochrome; continues without other character'),
 pick(2,6,'Ikki','recommended four-second lyric response: bridge into exhausted face/body; overlaps previous intervals'),
],
}
items=[]
for p in sorted(ROOT.glob('ep*/*_raw.mp4')):
    cap=cv2.VideoCapture(str(p));fps=cap.get(cv2.CAP_PROP_FPS);frames=int(cap.get(cv2.CAP_PROP_FRAME_COUNT));w=int(cap.get(cv2.CAP_PROP_FRAME_WIDTH));h=int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT));cap.release()
    raw=json.loads(p.with_suffix('.json').read_text(encoding='utf-8'))
    item={
      'file':str(p),'contact_sheet':str(p.with_name(p.stem+'_contact.jpg')),
      'width':w,'height':h,'fps':fps,'frames':frames,'duration':frames/fps,
      'source_page':'https://www.twxgct.com/video/luodiqishiyingxiongtanriyu-haikonglu/'+{'ep01':'7ai2iQZGHa','ep02':'rQGfo6rZSk','ep10':'SHr7cMjM7X','ep12':'xlNMvxdzGB'}[p.parent.name]+'.html',
      'source':raw,'suggested_shots':selection[p.stem],
      'crop_suggestion':{'w':512,'h':288,'x':64,'y':32} if p.stem=='stella_fire_raw' else {'w':576,'h':324,'x':32,'y':0},
    }
    items.append(item)
manifest={
  'status':'captured_and_visually_reviewed','version':2,'raw_clip_count':len(items),
  'total_raw_duration_seconds':round(sum(x['duration'] for x in items),2),
  'access':'ordinary public guest low-quality player; observed 640x360 HLS only; sequential downloads of selected segments',
  'ep10_discovery':{'public_guest_api':'https://www.twxgct.com/user/amp/content_pframe_url?chapter_id=SHr7cMjM7X&level=low&expires=3600','guid':'cb4b9ee0-9b14-4ef4-a4ec-fb8b36e42825'},
  'processing':'selected TS spans normalized to zero PTS, filter-trimmed, H264/25fps/no audio; no full episode downloaded',
  'confirmed_itto_shura_assembly':{
    'total_duration':4.8,
    'shots':[
      {'file':'ep01/itto_shura_call_raw.mp4','local_start':0,'local_end':1.28},
      {'file':'ep01/itto_shura_release_raw.mp4','local_start':.44,'local_end':3.16},
      {'file':'ep01/ikki_dodge_raw.mp4','local_start':2.64,'local_end':3.44},
    ],
    'evidence':'First clip visibly names 一刀修羅. It has pale energy trails rather than a strong blue explosion; any cooler grading must be described as grading.',
  },
  'rejected_sources':[
    {'file':'ep04/rejected/perfect_vision_raw.mp4','reason':'Actual named technique is 完全掌握 / Perfect Vision, not Ittou Shura.'},
    {'file':'ep04/rejected/combat_launch_raw.mp4','reason':'No verified Ittou Shura declaration. Final strong blue flare is Kirihara\'s 驟雨烈閃 / Million Rain; must not be attributed to Ikki.'},
  ],
  'notes':[
    'Total duration is raw material, not the amount used in the finished MV.',
    'Suggested shots may overlap; do not sum their durations as unique footage.',
    'Character identification takes precedence over filenames: shizuku_face_raw contains a Touka portrait, and touka_face_raw contains a Shizuku attack.',
    'Crop bottom burned-in subtitles; stella_fire_raw also has top spell captions and needs the tighter crop.',
    'Native public source is 360p. Fast-motion macroblocking is visible, especially stella_charge_raw local 1.96–2.60; avoid that interval.',
    'Do not use original-opponent two-shots for the fake cross-series duel. Use isolated faces, strikes and reactions.',
    'ikki_dodge_raw local7.44–7.68 still has Stella in foreground. Begin the clean overhead strike at exactly7.68, ending before9.04.',
  ],
  'clips':items,
}
out=ROOT/'ready_manifest.json';out.write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print(out);print('raw clips',len(items),'seconds',manifest['total_raw_duration_seconds'])
