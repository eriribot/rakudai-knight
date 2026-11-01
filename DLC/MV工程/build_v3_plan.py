"""V3: retain native arena roster, unique source actions, power match at 02:11."""
from pathlib import Path
import json
P=Path(__file__).resolve().parent
E=[]
def shot(a,b,rel,src,label,**kw):
    E.append(dict(start=a,end=b,file=rel,clip_start=src,label=label,**kw))
def old(a,b,ep,name,src,label,**kw):
    shot(a,b,f'素材/v2/{ep}/{name}_raw.mp4',src,label,**kw)
def new(a,b,name,src,label,**kw):
    shot(a,b,f'素材/v3/selected/{name}.mp4',src,label,**kw)
def ast(a,b,src,label,**kw):shot(a,b,'clean',src,label,**kw)
E.extend([
    dict(start=11.16,end=12.08,kind='roster',characters=['ikki','stella'],label='原舞台：一辉／史黛菈与破军校徽'),
    dict(start=12.08,end=13.04,kind='roster',characters=['toka','shizuku'],label='原舞台：刀华／珠雫与破军校徽')])
old(22.32,24.16,'ep02','academy_establishing',1.12,'破军学院入场')
old(25,26.96,'ep01','stella_charge',.88,'史黛菈红色登场',speed=.44,tint='red')
old(29.12,31.32,'ep10','shizuku_face',1.44,'刀华绿色登场',speed=.55,tint='green')
old(31.32,33.92,'ep10','shizuku_face',2.68,'珠雫紫色登场',speed=.76,tint='violet')
old(37,41,'ep12','ikki_exhausted',2,'一辉伤痕与踉跄')
old(45.12,48.44,'ep01','stella_fire',.56,'史黛菈蓄焰',speed=.83,crop=[64,32,512,288],arena_blue=True)
new(48.44,50.28,'touka_guard_turn',.24,'新镜头：刀华回身拔刀',speed=1.35)
old(50.28,54.84,'ep10','touka_raikiri',2.8,'刀华雷切')
old(54.84,58.04,'ep10','shizuku_water',3,'珠雫展开水流')
old(58.04,60.16,'ep10','shizuku_water',6.20,'珠雫手中水流聚拢')

# All Ayato actions here originate inside this same overwritten window.
# No copies of the untouched 110 / 117 / 125 / 127 second shots.
old(63.12,64.64,'ep01','stella_charge',3.44,'一辉架刀',speed=.44,arena_blue=True)
old(64.64,66.24,'ep01','ikki_counter',4.64,'一辉残像：全片仅一次',arena_blue=True)
old(66.24,66.96,'ep01','ikki_counter',8.24,'一辉锁定',speed=.72,arena_blue=True)
ast(66.96,67.68,67.36,'绫斗举剑',crop=[0,0,1080,608])
old(67.68,68.72,'ep01','ikki_dodge',2.2,'一辉冲近',arena_blue=True)
ast(68.72,69.60,68.08,'绫斗迎面突进',flip=True)
old(69.60,70.92,'ep01','ikki_dodge',7.68,'一辉迎面下劈',crop=[48,0,544,306],arena_blue=True)
ast(70.92,71.80,70.68,'绫斗挥剑反斩前半',speed=.77,flip=True)
ast(71.80,72.56,71.72,'绫斗反斩后半：跳过原机甲对手特写',speed=.78,flip=True)
new(72.56,76,'ikki_lower_sword',1.44,'新镜头：一辉收刀')

# Exact user anchor: Ayato cyan face at 131s, and authentic episode 4 Ittou Shura.
ast(130.20,131.16,130.20,'02:11：天雾闭眼蓝光')
new(131.16,132.48,'ikki_eye_open',0,'一辉闭眼转睁眼',speed=1.4)
ast(132.48,133.12,131.16,'蓝光呼应')
new(133.12,134,'itto_shura_start',0,'一辉竖刀起势',speed=1.2)
ast(134,134.44,131.80,'天雾光芒推进')
new(134.44,136,'itto_shura_start',3.68,'一刀修罗真实爆气',speed=1.2)
old(136,139.24,'ep10','touka_face',.40,'刀华与珠雫水雾雷光')

# Stella/Julis exchange: each pose and strike has one continuous use.
new(148.48,150.16,'stella_new_eyes',.32,'新镜头：史黛菈睁眼迎战',speed=1.15,arena_blue=True)
ast(150.16,151.68,150.16,'尤莉丝向左举剑')
new(151.68,152.88,'stella_morning_slash',.04,'新镜头：史黛菈迎面挥剑',speed=1.35)
ast(152.88,153.72,151.68,'尤莉丝横向火焰斩')
new(153.72,154.44,'stella_morning_turn',.24,'新镜头：史黛菈回身举剑',speed=.8)
new(154.44,155.20,'stella_morning_downstrike',0,'新镜头：史黛菈下劈',speed=.8)
old(155.20,156.44,'ep01','stella_block',0,'史黛菈横剑回防',speed=.62,arena_blue=True)
old(156.44,157.84,'ep01','stella_fire',6.16,'史黛菈火焰剑反攻',crop=[80,40,480,270],flip=True,arena_blue=True)
ast(157.84,158.76,50.92,'尤莉丝火焰回应：原50秒已由刀华替换')
old(158.76,159.28,'ep01','ikki_counter',.48,'史黛菈收势',arena_blue=True)

plan=dict(output='学战都市×落第骑士英雄谭_联合MV_V3_蓝光对位版.mp4',
    title='The Asterisk War x Rakudai - Cross Duel V3',check_directory='检查/v3',
    base='V1; all frames from 181.48 seconds remain intact',edits=sorted(E,key=lambda x:x['start']),
    impacts=[69.60,70.92,151.68,154.44,157.84],
    roster_art='Official TV anime pixels; BellFine licensed Hagun crest; original arena geometry retained',
    power_pair='Ayato exact 130.20–133.28 shot vs verified episode 4 Itto Shura',
    sources='素材/v3/research_plan.md and 素材/v3/ready_manifest.json')
(P/'edit_plan_v3.json').write_text(json.dumps(plan,ensure_ascii=False,indent=2),encoding='utf-8')
print(f'{len(E)} edits; {sum(x["end"]-x["start"] for x in E):.2f} seconds edited')
