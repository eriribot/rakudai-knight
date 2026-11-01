from pathlib import Path
import json
P=Path(__file__).resolve().parent
E=[]
def shot(a,b,rel,src,label,**kw):
    item={'start':a,'end':b,'file':rel,'clip_start':src,'label':label};item.update(kw);E.append(item)
def rak(a,b,episode,name,src,label,**kw):shot(a,b,f'素材/v2/{episode}/{name}_raw.mp4',src,label,**kw)
def ast(a,b,src,label,**kw):shot(a,b,'clean',src,label,**kw)
def duo(a,b,left,right,label):E.append({'start':a,'end':b,'kind':'pair','left':left,'right':right,'label':label})

E.extend([
 {'start':11.16,'end':12.08,'kind':'roster','characters':['ikki','stella'],'label':'破军参战：一辉／史黛菈（官方动画图）'},
 {'start':12.08,'end':13.04,'kind':'roster','characters':['toka','shizuku'],'label':'破军参战：刀华／珠雫（官方动画图）'}])
rak(22.32,24.16,'ep02','academy_establishing',1.12,'破军校园加入学院入场')
rak(25.00,26.96,'ep01','stella_charge',.88,'红色：史黛菈登场',speed=.44,tint='red')
rak(29.12,31.32,'ep10','shizuku_face',1.44,'绿色：刀华登场',speed=.55,tint='green')
rak(31.32,33.92,'ep10','shizuku_face',2.68,'紫色：珠雫登场',speed=.76,tint='violet')
rak(37.00,41.00,'ep12','ikki_exhausted',2.00,'一辉伤痕与踉跄，对应悲伤歌词')
rak(45.12,48.44,'ep01','stella_fire',.56,'史黛菈蓄焰',speed=.83,crop=[64,32,512,288],arena_blue=True)
rak(48.44,50.28,'ep10','shizuku_face',1.44,'刀华定神',speed=.65)
rak(50.28,54.84,'ep10','touka_raikiri',2.80,'刀华雷切')
rak(54.84,58.04,'ep10','shizuku_water',3.00,'珠雫展开水流')
rak(58.04,60.16,'ep10','shizuku_face',2.68,'珠雫正面持剑',speed=.90)

# Establish the two swordsmen, then alternate attacks and response shots on a stable axis.
rak(63.12,64.64,'ep01','stella_charge',3.44,'一辉架刀',speed=.44,arena_blue=True)
rak(64.64,66.24,'ep01','ikki_counter',4.64,'一辉残像准备',arena_blue=True)
duo(66.24,67.00,
 {'file':'素材/v2/ep01/ikki_counter_raw.mp4','clip_start':8.24,'speed':.8,'arena_blue':True,'focus_x':670},
 {'file':'clean','clip_start':127.16,'speed':.8,'flip':True,'focus_x':700},'一辉／绫斗对峙')
rak(67.00,67.72,'ep01','ikki_counter',8.24,'一辉锁定对手',speed=.8,arena_blue=True)
ast(67.72,68.44,67.36,'绫斗出剑迎战',crop=[0,0,1080,608])
rak(68.44,69.48,'ep01','ikki_dodge',2.20,'一辉冲近',arena_blue=True)
ast(69.48,70.52,117.68,'绫斗跃起反攻')
rak(70.52,71.52,'ep01','stella_charge',4.56,'一辉横剑接招（短镜慢放）',speed=.16,arena_blue=True)
ast(71.52,72.20,118.72,'绫斗斩落与刀光碰撞')
rak(72.20,73.56,'ep01','ikki_dodge',7.68,'一辉迎面下劈',arena_blue=True)
ast(73.56,74.44,127.16,'绫斗竖剑接住',flip=True)
rak(74.44,76.00,'ep01','ikki_counter',5.04,'一辉收势与残像',arena_blue=True)

rak(136.00,139.24,'ep10','touka_face',.40,'刀华与珠雫：水雾雷光交锋')

# Fire-rapier duel: Stella left/rightward, Julis right/leftward.
duo(148.48,149.64,
 {'file':'素材/v2/ep01/stella_charge_raw.mp4','clip_start':.92,'speed':.28,'arena_blue':True,'focus_x':330},
 {'file':'clean','clip_start':110.0,'speed':.28,'focus_x':950},'史黛菈／尤莉丝对峙')
rak(149.64,150.16,'ep01','stella_charge',1.00,'史黛菈望向右侧',arena_blue=True)
ast(150.16,151.68,150.16,'尤莉丝举细剑向左')
rak(151.68,152.88,'ep01','stella_block',0,'史黛菈横剑接招',speed=.66,arena_blue=True)
ast(152.88,153.72,151.68,'尤莉丝火焰横扫')
rak(153.72,154.44,'ep01','stella_charge',2.68,'史黛菈俯冲反击',arena_blue=True)
shot(154.44,155.20,'素材/twxgct/ep01/stella_attack_candidate.mp4',2.60,'史黛菈向右挥斩',arena_blue=True)
ast(155.20,156.44,125.92,'尤莉丝被逼退后稳住')
rak(156.44,157.84,'ep01','stella_fire',6.16,'史黛菈火焰剑反攻',crop=[80,40,480,270],flip=True,arena_blue=True)
ast(157.84,158.76,50.92,'尤莉丝正面火焰回应')
rak(158.76,159.28,'ep01','ikki_counter',.48,'史黛菈收势',arena_blue=True)

# Keep every frame of Ayato's real blue release, intercut with the verified Itto Shura sequence.
rak(173.40,174.68,'ep01','itto_shura_call',0,'一刀修罗宣言',arena_blue=True,caption='一刀修羅')
ast(174.68,175.44,173.40,'绫斗蓝光爆发后半')
rak(175.44,178.16,'ep01','itto_shura_release',.44,'一刀修罗抬眼与气流',arena_blue=True)

plan={'output':'学战都市×落第骑士英雄谭_联合MV_V2_交锋版.mp4','base':'V1; ending from181.48s preserved','edits':sorted(E,key=lambda x:x['start']),'impacts':[70.52,72.20,73.56,151.68,155.20,157.84],
 'roster_art':'Official TV anime character sheets, not novel portraits',
 'power_pair':'Real Ayato blue release171.96–174.16 preserved by intercut; ep1 Itto Shura verified from source skill caption'}
(P/'edit_plan_v2.json').write_text(json.dumps(plan,ensure_ascii=False,indent=2),encoding='utf-8')
print(f'{len(E)} edits; {sum(x["end"]-x["start"] for x in E):.2f} seconds edited')
