import json
import shutil
from pathlib import Path

root = Path(__file__).resolve().parents[1]

new_content = """<ByakuyaJogasaki>
【身份与头衔】
- 武曲学园高等部三年级主力，去年度（第六十一届）七星剑武祭全国亚军。C级伐刀者，称号〈天眼（Heavenly Eye）〉。
- 与主将诸星雄大、浅木椛并列为武曲“黄金世代”三巨头。

【官方六维参数（加加美鉴定·第七卷壁报）】
- 攻击力：D　防御力：D　魔力量：D　魔力控制：C　体能：D　运气：D

【容貌与气质】
- 身姿挺拔端正的眼镜青年，利落中分黑发，琥珀色丹凤眼，神态知性清冷，习惯推扶镜架，从头到脚散发出一丝不苟的严谨书生武者气质。
- 肖像资源：resource/knightavatars/prepared/byakuya.png

【固有灵装与绝技】
- 固有灵装：〈白色之手（White Hand）〉，刀/短刃型灵装。
- 伐刀绝技：〈白手（God Hand）〉。空间移动系（Teleport），以自身为中心半径50米内将目标瞬间移动至指定坐标。对静态物体可隔空转移；对活动人体需以灵装触碰或斩伤锁定后方可强制传送。擅长利用规则达成出界10秒倒数KO战术。

【称号〈天眼〉与洞察真髓】
- 以赛前超量情报搜集闻名。能从日常生活细节中精准挖掘对手思考的根源——『概念』。比赛哨响瞬间即彻底掌握对手全局动向，犹如洞悉万物的神之眼。

【战术致命盲区（判定硬约束）】
- 属于极致的“概率与理性推演信徒”。算准了一辉同日二连战面对晚间强敌莎拉必不敢消耗全天唯一杀手锏〈一刀修罗〉，并预设了“二十三手棋谱”；然而面对一辉开局直接赌上全天一切的【一刀罗刹】0.0秒爆发豪赌，推演因果瞬间崩溃，遭遇转瞬秒杀！
</ByakuyaJogasaki>"""

new_keys = ['城之崎白夜', '城之崎', '天眼', '白色之手', '白手', '二十三手棋谱', 'Byakuya Jogasaki']

for fn in ['落第骑士英雄谭v0.02.json', '落第骑士英雄谭 (1).json']:
    target = root / fn
    if target.exists():
        with open(target, 'r', encoding='utf-8') as f:
            data = json.load(f)
        if '132' in data.get('entries', {}):
            e = data['entries']['132']
            e['key'] = new_keys
            e['content'] = new_content
            with open(target, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            print(f'Successfully updated {fn} entry 132')
