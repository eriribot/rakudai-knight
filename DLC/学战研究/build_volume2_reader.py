# -*- coding: utf-8 -*-
"""
Build upgraded Obsidian full-text reader & highlight-driven Worldbook workbench
for Volume 2 of The Asterisk War (《学战都市Asterisk 02 银绮觉醒》).

Key Refinements over Volume 1 template:
1. Highlight-first workflow: Top collapsible cheat-sheet for `==原文== %%批注%%` + multi-color <mark> classes.
2. Bugfix for inline Duokan footnotes (`note.png`): Never drops paragraphs containing footnote icons;
   converts `<a class="duokan-footnote">` + `<aside epub:type="footnote">` into native Obsidian hoverable `[^note1]` footnotes.
3. Skill-aligned chapter & act callouts: Zero '截胡' bias; structured prompts for anime-first visuals,
   dialogue personality slices, universal emotional triggers (angry / happy / shy), canonical skill whitelist,
   chapter completion trigger, and uncertain-item verification queue.
4. Pre-creates `人物条目/`, `场景条目/`, and `词条与设定条目/` directories ready for chapter-by-chapter compilation.
"""

import os
import re
import sys
import zipfile
import bs4

sys.stdout.reconfigure(encoding="utf-8")

EPUB_PATH = r"E:\web\落第\DLC\学战都市Asterisk 02 银绮觉醒.epub"
OUTPUT_DIR = r"E:\web\落第\DLC\学战研究\第二卷-世界书整理"

for sub in ["人物条目", "场景条目", "词条与设定条目"]:
    os.makedirs(os.path.join(OUTPUT_DIR, sub), exist_ok=True)

ILLUS_CAPTIONS = {
    "001.jpg": "图：星导馆国中部附近——绫斗赶路途中意外撞倒国中部一年级少女刀藤绮凛，伸手扶她起身",
    "002.jpg": "图：训练室外的意外访客——雷士达·马可菲尔与沙沙宫纱夜结伴现身",
    "003.jpg": "图：阿勒坎特研究院来访——〈雕刻派〉艾涅丝妲·裘奈与卡蜜拉·帕蕾特登场，艾涅丝妲当众坦白塞拉斯事件幕后雇主身份",
    "004.jpg": "图：序列第一的剑威——刀藤钢一郎逼战之下，绫斗解放《黑炉魔剑》迎战星导馆序列第一《疾风刃雷》刀藤绮凛",
    "005.jpg": "图：男生宿舍会客室——刀藤绮凛端坐沙发并向绫斗郑重鞠躬致歉",
    "006.jpg": "图：树下突袭——沙沙宫纱夜从高处树枝跃下扑抱在绫斗背上，追问《凤凰星武祭》组队答复",
    "007.jpg": "图：北方食堂午餐——绫斗主动交换特辣咖哩，尤莉丝微红着脸露出罕见的坦率娇羞道谢",
    "008.jpg": "图：阿勒坎特研究室——戴着卡通眼睛图案眼罩打瞌睡流口水的艾涅丝妲惊醒狡辩",
    "009.jpg": "图：浓雾陷阱落水之后——身穿内衣烘干衣物的刀藤绮凛与绫斗背靠背倾诉五年前父亲刀藤诚二郎入狱真相",
    "010.jpg": "图：护身名刀与小太刀术交锋——绫斗左手反握小太刀施展「天雾辰明流小太刀术──『士茅薙』」破解绮凛连击",
}

HIGHLIGHT_GUIDE_CALLOUT = """> [!TIP]- 🖍️ 本章高亮色标与极速批注指南（点击展开，可直接复制圆点）
> - **1秒划重点**：选中原句连按两次 `=` 键包裹为 `==原文==`，可在开头放圆点分类（不放圆点也完全兼容）：
>   - `==🟠原文==` **世界观与设定词条**（落星雨、六花园会议、学园/财团规则）
>   - `==🟣原文==` **性格切片与泛用交互**（台词语气、为什么生气/高兴/害羞破防）
>   - `==🔵原文==` **招式白名单与武装机制**（刀藤流、天雾辰明流、魔女招式、纯星煌式武装）
>   - `==🟢原文==` **人物外貌与服饰细节**（成书时自动对照 TV 动画官网人设防幻觉）
>   - `==🔴原文==` **章节完成标识 / 悬疑伏笔 / 存疑待查项**（先汇报不入正文）
> - **随手加批注**：紧跟高亮后按 `Ctrl + /` 输入 `%%你的想法或联动点子%%`（实时预览下显示为醒目的**紫罗兰胶囊**，零手抄原文！）"""

CHAPTERS_INFO = [
    {
        "file": "第二卷_00_序幕_银绮序曲.md",
        "title": "序幕 银绮序曲（卷首简介）",
        "xhtml": "OEBPS/Text/summary.xhtml",
        "prev": "00_第二卷_彩页插图与卷首设定",
        "next": "第二卷_01_第一章_六花园会议",
        "chars": ["天雾绫斗", "尤莉丝·爱雷克西亚·冯·里斯妃特", "刀藤绮凛"],
        "location": "水上学园都市「六花」Asterisk · 星导馆学园",
        "summary": "绫斗与尤莉丝正式结成搭档备战《凤凰星武祭》，却偶遇年仅十三岁便君临星导馆序列第一的银发剑士少女——《疾风刃雷》刀藤绮凛，神速之剑再度交锋。",
        "completion_hint": "阅读完卷首导引，进入第一章《六花园会议》。",
        "illus_list": "无（参见卷首彩页 co1/co2/co5）",
        "todos": [
            "确认第二卷核心主线：备战《凤凰星武祭》＋ 星导馆序列第一《疾风刃雷》刀藤绮凛篇",
        ],
    },
    {
        "file": "第二卷_01_第一章_六花园会议.md",
        "title": "第一章 六花园会议",
        "xhtml": "OEBPS/Text/Section001.xhtml",
        "prev": "第二卷_00_序幕_银绮序曲",
        "next": "第二卷_02_第二章_昏枭暗跃",
        "chars": ["克劳蒂雅·恩菲尔德", "六大学园学生会长群", "天雾绫斗", "刀藤绮凛", "尤莉丝"],
        "location": "中央区厄托那饭店顶层巨蛋空中庭园 → 星导馆国中部周边校道",
        "summary": "每月一度的六大学园最高合议机关《六花园会议》召开，各校学生会长围绕《凤凰星武祭》与第一卷人偶事件暗流交锋；另一边，赶赴特训的绫斗在校道意外撞倒毫无气息的银发国中少女刀藤绮凛。",
        "completion_hint": "绫斗扶起绮凛道别后发现特训迟到，接起尤莉丝兴师问罪的空间视窗来电。",
        "illus_list": "001.jpg（校道偶遇撞倒刀藤绮凛）",
        "todos": [
            "提炼设定词条：【六花园会议】与厄托那饭店顶层空中庭园、六大学园学生会长席位",
            "提炼人物初登场细节：【刀藤绮凛】国中部制服、银发、毫无气息的步伐、佩真剑特征（核对动画人设）",
            "记录其他学园学生会长露脸设定与说话语气（防后续卷串味）",
        ],
    },
    {
        "file": "第二卷_02_第二章_昏枭暗跃.md",
        "title": "第二章 昏枭暗跃",
        "xhtml": "OEBPS/Text/Section002.xhtml",
        "prev": "第二卷_01_第一章_六花园会议",
        "next": "第二卷_03_第三章_疾风刃雷",
        "chars": ["天雾绫斗", "尤莉丝", "沙沙宫纱夜", "雷士达·马可菲尔", "克劳蒂雅", "艾涅丝妲·裘奈", "卡蜜拉·帕蕾特"],
        "location": "星导馆训练室 → 学生会长室（虚拟南国海滩） → 校内会面",
        "summary": "绫斗与尤莉丝进行搭档特训（尤莉丝展露新招『赤圆灼斩花』），纱夜与雷士达意外同访；随后克劳蒂雅在虚拟南国泳装会长室召见绫斗，阿勒坎特〈雕刻派〉天才艾涅丝妲与卡蜜拉造访星导馆并当众承认雇佣塞拉斯的往事。",
        "completion_hint": "艾涅丝妲与卡蜜拉离开星导馆，艾涅丝妲盘算借《凤凰星武祭》挑动各方实测拟形体。",
        "illus_list": "002.jpg（雷士达与纱夜同访）、003.jpg（艾涅丝妲与卡蜜拉登场）、卷首彩页 co4.jpg（会长室虚拟南国比基尼）",
        "todos": [
            "新建人物条目准备：【艾涅丝妲·裘奈】与【卡蜜拉·帕蕾特】（核对动画人设服装、口癖与性格反差）",
            "既有角色增量补充：尤莉丝新增招式『赤圆灼斩花』；克劳蒂雅会长室全息南国恶作剧细节；雷士达与纱夜互动",
            "提炼设定词条：阿勒坎特研究院派阀（〈雕刻派〉等）与自律拟形体研发企图",
        ],
    },
    {
        "file": "第二卷_03_第三章_疾风刃雷.md",
        "title": "第三章 疾风刃雷",
        "xhtml": "OEBPS/Text/Section003.xhtml",
        "prev": "第二卷_02_第二章_昏枭暗跃",
        "next": "第二卷_04_第四章_错综的思绪",
        "chars": ["天雾绫斗", "夜吹英士郎", "刀藤绮凛", "刀藤钢一郎", "尤莉丝"],
        "location": "一年三班教室 → 星导馆校庭林荫处",
        "summary": "绫斗向英士郎打听阿勒坎特二人组情报；放学后目睹银河干部刀藤钢一郎严词斥责甚至欲掌掴侄女刀藤绮凛，绫斗挺身阻止，被迫与星导馆序列第一《疾风刃雷》绮凛展开公式排名决斗，在纯正刀藤流神速连击前败北。",
        "completion_hint": "决斗分出胜负、钢一郎带走绮凛后，赶到现场的尤莉丝拉走绫斗追问与序列第一决斗的原委。",
        "illus_list": "004.jpg（绫斗启动《黑炉魔剑》对峙序列第一刀藤绮凛）、卷首彩页 co5.jpg",
        "todos": [
            "提炼核心人物：【刀藤绮凛】序列第一《疾风刃雷》称号、并非魔女/魔术师却凭纯剑技登顶的机制、『连鹤』神速连击原理",
            "新建配角档案准备：【刀藤钢一郎】（银河财团第七教导调查室、将绮凛当工具的冷酷伯父形象）",
            "核对战斗细节：《黑炉魔剑》首次败北原因（五分钟封印限制、无法对持真剑的少女下死手、刀藤流连击压制）",
        ],
    },
    {
        "file": "第二卷_04_第四章_错综的思绪.md",
        "title": "第四章 错综的思绪",
        "xhtml": "OEBPS/Text/Section004.xhtml",
        "prev": "第二卷_03_第三章_疾风刃雷",
        "next": "第二卷_05_第五章_少女素颜",
        "chars": ["刀藤绮凛", "刀藤钢一郎", "天雾绫斗", "尤莉丝", "沙沙宫纱夜", "夜吹英士郎"],
        "location": "学园相关人士专用通道 → 尤莉丝宿舍/训练场 → 男生宿舍会客室门前",
        "summary": "钢一郎借击败持有纯星煌式武装的绫斗大肆造势；绫斗向尤莉丝坦白经过并获搭档体谅，同时纱夜也向绫斗抛出《凤凰星武祭》搭档请求；章末刀藤绮凛独自来到男生宿舍会客室拜访绫斗。",
        "completion_hint": "绫斗推开男生宿舍会客室房门，见到紧张端坐在沙发上的刀藤绮凛。",
        "illus_list": "无",
        "todos": [
            "提炼绮凛心理切片：在伯父高压控制下的顺从与愧疚感",
            "提炼尤莉丝与纱夜在本章的性格对话与泛用情绪反应细节",
        ],
    },
    {
        "file": "第二卷_05_第五章_少女素颜.md",
        "title": "第五章 少女素颜",
        "xhtml": "OEBPS/Text/Section005.xhtml",
        "prev": "第二卷_04_第四章_错综的思绪",
        "next": "第二卷_06_第六章_雾中魔手",
        "chars": ["天雾绫斗", "刀藤绮凛", "沙沙宫纱夜"],
        "location": "男生宿舍会客室 → 校园林道 → 刀藤流晨练场地",
        "summary": "绮凛为决斗之事向绫斗诚恳致歉，两人同为古流剑术传人围绕剑道意气相投并约定清晨陪练；途中纱夜从树上跃下抱住绫斗追问组队答复；次日清晨绫斗戴上重力环与绮凛展开剑术修行。",
        "completion_hint": "清晨绫斗佩戴绮凛准备的重力环负重装备，跟随绮凛前往修行场所。",
        "illus_list": "005.jpg（会客室绮凛鞠躬致歉）、006.jpg（纱夜树下扑背追问组队）",
        "todos": [
            "提炼【刀藤绮凛】泛用交互核心：谈及古流剑术时的纯真热情（高兴点）vs 平时怯生生小动物反差",
            "提炼【沙沙宫纱夜】泛用交互补充：树上蹲守、扑背直球行动派细节",
            "提炼设定细节：训练用负重装备（重力环/负重环）修行法",
        ],
    },
    {
        "file": "第二卷_06_第六章_雾中魔手.md",
        "title": "第六章 雾中魔手",
        "xhtml": "OEBPS/Text/Section006.xhtml",
        "prev": "第二卷_05_第五章_少女素颜",
        "next": "第二卷_07_第七章_决意与决斗",
        "chars": ["天雾绫斗", "尤莉丝", "刀藤绮凛", "艾涅丝妲·裘奈", "卡蜜拉·帕蕾特", "阿勒坎特〈超人派〉袭击者"],
        "location": "星导馆北方食堂 → 阿勒坎特研究室 → 再开发区/人工湖畔浓雾陷阱 → 废弃建筑避难处",
        "summary": "北方食堂里吃醋的尤莉丝误点特辣咖哩，绫斗体贴换餐令尤莉丝脸红道谢；阿勒坎特〈超人派〉私自行动设下浓雾魔术与人偶伏击绫斗和绮凛；两人坠水脱困后，绮凛首次向绫斗吐露五年前父亲刀藤诚二郎为救自己失手杀人入狱、自己受制于伯父的沉重真相。",
        "completion_hint": "绮凛倾诉完父亲往事，绫斗轻抚绮凛头顶给予温柔安慰，绮凛展露安心神色。",
        "illus_list": "007.jpg（尤莉丝换吃咖哩脸红道谢）、008.jpg（卡通眼罩打瞌睡的艾涅丝妲）、009.jpg（落水后内衣烘干背靠背倾诉往事）",
        "todos": [
            "重点提炼【尤莉丝】傲娇动态平衡名场面：因绮凛吃醋嘴硬 → 误点特辣咖哩硬撑 → 换餐后微红脸坦率说谢谢",
            "重点提炼【刀藤绮凛】核心前史与动机：五年前八岁遭遇强盗人质事件、父亲刀藤诚二郎护女杀人入狱、为救父沦为钢一郎工具的枷锁",
            "核对阿勒坎特〈超人派〉袭击者名字、能力机制与剑道构势脚注",
        ],
    },
    {
        "file": "第二卷_07_第七章_决意与决斗.md",
        "title": "第七章 决意与决斗",
        "xhtml": "OEBPS/Text/Section007.xhtml",
        "prev": "第二卷_06_第六章_雾中魔手",
        "next": "第二卷_08_终章",
        "chars": ["天雾绫斗", "刀藤绮凛", "刀藤钢一郎", "尤莉丝", "沙沙宫纱夜", "夜吹英士郎"],
        "location": "银河Asterisk分部 → 决斗场地",
        "summary": "面对再度以父亲冤狱相逼的钢一郎，绫斗借来护身小太刀再战序列第一刀藤绮凛！绫斗以天雾辰明流小太刀术『士茅薙』等奇策看破『连鹤』死角击败绮凛，并当众震慑钢一郎，助绮凛斩断傀儡枷锁、重拾自己的剑道意志。",
        "completion_hint": "绮凛摆脱伯父精神枷锁，红着脸请求绫斗直接称呼名字，绫斗微笑唤出「绮凛妹妹」。",
        "illus_list": "010.jpg（绫斗反手施展天雾辰明流小太刀术『士茅薙』迎击绮凛）",
        "todos": [
            "提炼【天雾绫斗】新增招式与双刀/小太刀战术：护身名刀渊源、天雾辰明流小太刀术『士茅薙』、破解『连鹤』机制",
            "提炼【刀藤绮凛】角色弧光收束与称呼变化（「天雾学长」与「绮凛妹妹」、名刀《千羽切》规格）",
            "确认本章最终完成标识与序列第一更替规则细节（私斗 vs 公式排名战判定）",
        ],
    },
    {
        "file": "第二卷_08_终章.md",
        "title": "终章",
        "xhtml": "OEBPS/Text/Section008.xhtml",
        "prev": "第二卷_07_第七章_决意与决斗",
        "next": "第二卷_09_后记",
        "chars": ["阿勒坎特测试员", "艾涅丝妲", "卡蜜拉", "刀藤绮凛", "沙沙宫纱夜"],
        "location": "阿勒坎特研究院地下特别竞技场 → 星导馆校园",
        "summary": "阿勒坎特地下竞技场内，艾涅丝妲研发的自律型拟形体展现惊人战力，为即将开幕的《凤凰星武祭》埋下强敌伏笔；与此同时，重获自由的刀藤绮凛面前出现了沙沙宫纱夜，纱夜正式向绮凛发出《凤凰星武祭》组队邀请！",
        "completion_hint": "沙沙宫纱夜向刀藤绮凛说出「要不要──和我一起组队？」，第二卷正篇圆满落幕。",
        "illus_list": "无",
        "todos": [
            "提炼终章伏笔：阿勒坎特两具自律型拟形体（阿尔迪＆莉姆希）战力表现预热（注意防跨卷提前剧透名字）",
            "提炼纱夜×绮凛组队契机，衔接第三卷《凤凰乱武》",
        ],
    },
    {
        "file": "第二卷_09_后记.md",
        "title": "后记",
        "xhtml": "OEBPS/Text/Postscript.xhtml",
        "prev": "第二卷_08_终章",
        "next": "00_第二卷_正文精读与评注导航",
        "chars": ["三屋咲悠", "okiura"],
        "location": "作者后记",
        "summary": "原作者三屋咲悠回顾第二卷新女主角刀藤绮凛、六花园会议各校会长及阿勒坎特阵营角色的塑造初衷与致谢。",
        "completion_hint": "第二卷全卷阅读完毕！可按章节或全卷呼叫 AI 启动 `asterisk-worldbook-workflow` 汇总成书。",
        "illus_list": "无",
        "todos": [
            "核对作者后记中对刀藤绮凛与第二卷群像定位的官方补充说明",
        ],
    },
]


def convert_inline_elements(el, footnotes_map: dict, footnote_order: list) -> str:
    """Recursively serialize a paragraph/heading element while turning Duokan footnote links into [^id]."""
    parts = []
    for child in el.children:
        if isinstance(child, bs4.NavigableString):
            parts.append(str(child))
        elif hasattr(child, "name") and child.name:
            if child.name == "a" and (
                "duokan-footnote" in (child.get("class") or [])
                or child.get("epub:type") == "noteref"
            ):
                href = (child.get("href") or "").lstrip("#")
                fn_id = href or f"fn{len(footnote_order) + 1}"
                if fn_id not in footnote_order:
                    footnote_order.append(fn_id)
                parts.append(f"[^{fn_id}]")
            elif child.name == "ruby":
                # Keep base text + ruby reading if present
                rb = "".join(
                    t.get_text() for t in child.find_all(["rb"])
                ) or "".join(
                    str(c) for c in child.children if isinstance(c, bs4.NavigableString)
                )
                rt = "".join(t.get_text() for t in child.find_all("rt"))
                parts.append(f"{rb}（{rt}）" if rt and rb else child.get_text())
            elif child.name == "img":
                src = (child.get("src") or "").split("/")[-1]
                if src != "note.png":
                    caption = ILLUS_CAPTIONS.get(src, f"插图：{src}")
                    parts.append(
                        f"\n\n![[插图/学战都市Asterisk 02 银绮觉醒/{src}]]\n*{caption}*\n\n"
                    )
            else:
                parts.append(convert_inline_elements(child, footnotes_map, footnote_order))
    return "".join(parts)


def parse_xhtml_to_markdown(z: zipfile.ZipFile, ch_info: dict) -> str:
    raw_data = z.read(ch_info["xhtml"])
    soup = bs4.BeautifulSoup(raw_data, "html.parser")

    # Collect footnote definitions (<aside epub:type="footnote"> or id="note...")
    footnotes_map = {}
    for aside in soup.find_all(["aside", "div"]):
        aid = aside.get("id")
        if aid and (
            aside.get("epub:type") == "footnote"
            or "footnote" in " ".join(aside.get("class") or [])
            or aid.startswith("note")
        ):
            footnotes_map[aid] = aside.get_text(" ", strip=True)
            aside.decompose()

    main_div = soup.find("div")
    elements = main_div.children if main_div else soup.body.children

    cur_curtain = 1
    content_blocks = []
    footnote_order = []

    skip_titles = {
        "简介", "后记", "终章",
        "第一章　六花园会议", "第一章 六花园会议",
        "第二章　昏枭暗跃", "第二章 昏枭暗跃",
        "第三章　疾风刃雷", "第三章 疾风刃雷",
        "第四章　错综的思绪", "第四章 错综的思绪",
        "第五章　少女素颜", "第五章 少女素颜",
        "第六章　雾中魔手", "第六章 雾中魔手",
        "第七章　决意与决斗", "第七章 决意与决斗",
    }

    for el in elements:
        if not hasattr(el, "name") or not el.name:
            continue

        # Standalone image block (not an inline note.png!)
        imgs = el.find_all("img") if el.name != "img" else [el]
        non_note_imgs = [
            im for im in imgs if (im.get("src") or "").split("/")[-1] != "note.png"
        ]
        plain_text_without_img = el.get_text(strip=True)
        if non_note_imgs and not plain_text_without_img:
            for im in non_note_imgs:
                src = im.get("src").split("/")[-1]
                caption = ILLUS_CAPTIONS.get(src, f"插图：{src}")
                content_blocks.append(
                    f"\n![[插图/学战都市Asterisk 02 银绮觉醒/{src}]]\n*{caption}*\n"
                )
            continue

        t = convert_inline_elements(el, footnotes_map, footnote_order).strip()
        if not t:
            continue

        if "＊＊＊" in t:
            content_blocks.append(
                f"""
---

> [!NOTE] ✍️ 第 {cur_curtain} 幕随手批注（正文直接用 `==高亮== %%批注%%` 标记即可，此处可补幕级小结）
> - 

### ❖ 第 {cur_curtain + 1} 幕
"""
            )
            cur_curtain += 1
        elif t in skip_titles or re.match(r"^第[一二三四五六七]章\s+", t):
            continue
        else:
            content_blocks.append(f"{t}\n")

    body_text = "\n".join(content_blocks)

    footnotes_section = ""
    if footnote_order or footnotes_map:
        fn_lines = ["\n---\n\n### 📌 本章原书剑道与典故注释（鼠标悬停正文角标可预览）\n"]
        ordered_ids = footnote_order + [k for k in footnotes_map if k not in footnote_order]
        for fid in ordered_ids:
            if fid in footnotes_map:
                fn_lines.append(f"[^{fid}]: {footnotes_map[fid]}")
        footnotes_section = "\n".join(fn_lines) + "\n"

    prev_link = f"[[{ch_info['prev']}|⏮️ 上一章]]" if ch_info["prev"] else ""
    next_link = f"[[{ch_info['next']}|⏭️ 下一章]]" if ch_info["next"] else ""
    nav_line = f"> **导航**：[[00_第二卷_正文精读与评注导航|📋 第二卷目录]] | {prev_link} | {next_link}"
    chars_str = "、".join(ch_info["chars"])
    todos_md = "\n".join(f"> - [ ] {item}" for item in ch_info["todos"])

    md = f"""# 《学战都市Asterisk》第二卷·{ch_info['title']}

{nav_line}

> [!ABSTRACT] 📖 章节核心导览与世界书锚点
> - **核心出场**：{chars_str}
> - **主要舞台**：{ch_info['location']}
> - **本篇插图**：{ch_info['illus_list']}
> - **剧情脉络**：{ch_info['summary']}
> - **🎯 预设完成标识（草拟待核）**：{ch_info['completion_hint']}

{HIGHLIGHT_GUIDE_CALLOUT}

---

### ❖ 第 1 幕

{body_text}{footnotes_section}
---

> [!NOTE] ✍️ 第 {cur_curtain} 幕随手批注（正文直接用 `==高亮== %%批注%%` 标记即可，此处可补幕级小结）
> - 

---

## ✍️ 本章世界书整理工作区（读完后呼叫 AI 按 `asterisk-worldbook-workflow` 自动汇总）

> [!NOTE] 💡 章节总评、2013并列时间轴与【完成标识】确认
> - 

> [!EXAMPLE] 👤 角色外貌（动画优先核对）、语句性格切片 & 泛用交互（生气雷点 / 高兴喜好 / 害羞破防）
> - 

> [!TIP] ⚔️ 新增招式白名单、煌式/纯星煌式武装机制与世界观词条（禁脑补名号与六维）
> - 

> [!WARNING] ❓ 存疑待查项（小说 vs 动画差异 / 身高 / 跨卷伏笔，先汇报不入正文）
> - 

> [!CHECK] 🌐 本章世界书条目待办清单
{todos_md}

---
{nav_line}
"""
    return md


def build_color_illustrations_note(z: zipfile.ZipFile) -> str:
    author_soup = bs4.BeautifulSoup(
        z.read("OEBPS/Text/author.xhtml").decode("utf-8", errors="ignore"),
        "html.parser",
    )
    message_soup = bs4.BeautifulSoup(
        z.read("OEBPS/Text/message.xhtml").decode("utf-8", errors="ignore"),
        "html.parser",
    )
    author_text = author_soup.text.strip()
    message_text = message_soup.text.strip()

    md = f"""# 《学战都市Asterisk》第二卷·彩页插图与卷首设定

> **导航**：[[00_第二卷_正文精读与评注导航|📋 第二卷目录]] | [[第二卷_00_序幕_银绮序曲|⏭️ 开始阅读序幕]]

> [!ABSTRACT] 🎨 卷首全彩插图存证与动画优先核对基准
> 本笔记完整收录《学战都市Asterisk 02 银绮觉醒》官方封面封底、全彩拉页、新登场人物设定彩页（刀藤绮凛、艾涅丝妲·裘奈、卡蜜拉·帕蕾特）、全彩剧情插画、目录页与水上学园都市「六花」全景设定图。
> **⚠️ 外观防幻觉提示**：后续编写人物世界书时，服装细节、发色瞳色与英文名拼写将以 **TV 动画官网设定图 ＋ 本卷官方彩插** 双重核验为准。

---

## 1. 官方全彩插图全集

### 封面：星导馆序列第一《疾风刃雷》刀藤绮凛
![[插图/学战都市Asterisk 02 银绮觉醒/cover.jpg]]
*图：第二卷《银绮觉醒》封面——手持日本刀的银发十三岁少女刀藤绮凛*

---

### 封底简介图（Back Cover）
![[插图/学战都市Asterisk 02 银绮觉醒/bc.jpg]]
*图：第二卷官方封底与剧情导引*

---

### 全彩拉页：银绮拔刀
![[插图/学战都市Asterisk 02 银绮觉醒/co1.jpg]]
*图：卷首全彩拉页——刀藤绮凛拔刀姿态（okiura 绘）*

---

### 全彩人物图鉴 ①：刀藤绮凛（Kirin Toudou）
![[插图/学战都市Asterisk 02 银绮觉醒/co2.jpg]]
*图：官方全彩人物图鉴——星导馆国中部一年级、序列第一《疾风刃雷》刀藤绮凛（「谢、谢谢学长……天雾学长真是体贴。」）*

---

### 全彩人物图鉴 ②：艾涅丝妲·裘奈（Ernesta Kühne）& 卡蜜拉·帕蕾特（Camilla Pareto）
![[插图/学战都市Asterisk 02 银绮觉醒/co3.jpg]]
*图：官方全彩人物图鉴——阿勒坎特研究院〈雕刻派〉天才艾涅丝妲·裘奈与实践班序列第四卡蜜拉·帕蕾特*

---

### 全彩剧情插画 ①：学生会长室的虚拟南国海滩（克劳蒂雅·恩菲尔德）
![[插图/学战都市Asterisk 02 银绮觉醒/co4.jpg]]
*图：全彩跨页插画——克劳蒂雅将会长寝室投影为小小南国泳池风景，身着比基尼迎接绫斗*

---

### 全彩剧情插画 ②：神速白刃交锋（刀藤绮凛 vs 天雾绫斗）
![[插图/学战都市Asterisk 02 银绮觉醒/co5.jpg]]
*图：全彩跨页决斗插画——「……接招吧。」刀藤绮凛神速突刺逼近绫斗胸口*

---

### 全彩目录插画：Contents
![[插图/学战都市Asterisk 02 银绮觉醒/co6.jpg]]
*图：第二卷全彩目录插页（第一章 六花园会议 ～ 终章）*

---

### 水上都市学园「六花」Asterisk 宏观全景与六大校徽
![[插图/学战都市Asterisk 02 银绮觉醒/co7.jpg]]
*图：水上学园都市「六花」全景图解与六大学园校徽设定*

---

## 2. 卷首作者与插画家寄语

```text
{author_text}
```

---

## 3. 出版制作与录入信息

```text
{message_text}
```

---

## ✍️ 卷首视觉核对与读者第一印象笔记

> [!NOTE] 💡 新角色外观与动画人设对比备忘（点击此处直接输入）
> - 

> [!CHECK] 🌐 卷首视觉与名号待核清单
> - [ ] 核对【刀藤绮凛】英文名 `Kirin Toudou`、国中部制服款式、发型发饰与佩刀《千羽切》外观
> - [ ] 核对【艾涅丝妲·裘奈】英文名 `Ernesta Kühne`、头顶机械发箍特征、阿勒坎特白大褂改造制服
> - [ ] 核对【卡蜜拉·帕蕾特】英文名 `Camilla Pareto`、褐色肌肤、阿勒坎特实践班制服与义肢/武装设定

---
> **下一步**：[[第二卷_00_序幕_银绮序曲|⏭️ 前往：序幕 银绮序曲（正文开始）]]
"""
    return md


def build_index_nav_note() -> str:
    md = r"""# 《学战都市Asterisk》第二卷《银绮觉醒》·正文精读与高亮世界书工作台

> 标签：#学战都市 #第二卷 #银绮觉醒 #正文精读 #世界书整理 #高亮工作流
> **上级导航**：[[../00_总览与知识图谱/学战都市Asterisk_研究总览|🗺️ 返回学战研究总览]] ｜ [[../第一卷-世界书整理/00_第一卷_正文精读与评注导航|⏮️ 回顾第一卷工作台]]

欢迎进入《学战都市Asterisk》第二卷《银绮觉醒》升级版 **Obsidian 高亮精读与世界书整理工作台**！
本工作台已针对你的阅读习惯完成模板升级，并配置了专属 Obsidian 高亮与行内胶囊批注样式（`.obsidian/snippets/worldbook-highlights.css`）。

---

## 🖍️ 升级版 Obsidian 高亮色标与行内胶囊批注工作流（1秒标记，零手抄原文！）

> [!IMPORTANT] 核心用法：`==圆点+原文==` ＋ `%%随手批注%%`（完美兼容你在第一卷第二章使用的 `==🟠...==` 习惯！）
> 1. **直接高亮原句 + 五色圆点分类**（选中句子连按两次 `=` 即可包裹 `==...==`，圆点可加可不加）：
>    - `==🟠原文==` —— **世界观与设定词条**（如落星雨、六花园会议、六大财团、星武祭规则）
>    - `==🟣原文==` —— **性格切片与泛用交互**（台词潜台词、为什么生气/雷点、为什么高兴/喜好、为什么害羞/破防）
>    - `==🔵原文==` —— **战斗招式与武装机制**（刀藤流、天雾辰明流、火炎新招、纯星煌式武装破绽）
>    - `==🟢原文==` —— **外貌体态与服饰**（提醒 AI 对照 TV 动画设定图核验，防刻板脑补）
>    - `==🔴原文==` —— **章节完成标识 / 关键伏笔 / 存疑待查项**（不确定处先向你汇报，绝不擅入正文）
> 2. **紧跟紫罗兰胶囊批注**：在高亮后面按 **`Ctrl + /`**（或输入 `%%你的想法%%`），实时预览中会渲染为醒目的**紫罗兰圆角胶囊**（阅读视图自动隐藏；也支持多色 `<mark>` 色卡，详见 [[../_Obsidian批注与高亮模板/01_高亮标记与行内批注速查模板|🎨 高亮色标与批注模板]]）。
>    - 示例：`==🟣看到一脸担心的尤莉丝歪着头，绫斗将自己的鸡肉咖哩和她的特辣咖哩交换。「……谢、谢谢你。」== %%嘴硬逞强翻车时体贴给台阶，会微红着脸坦率道谢%%`
> 3. **一键呼叫成书**：每读完一章（或几章），直接对我说 **“按 skill 总结第二卷第 X 章”**，提取脚本会自动按色标分类导出所有高亮原句、行号 `#Lx` 与胶囊批注，严格按防幻觉六大铁律生成世界书！

---

## 📖 第二卷全卷章节目录与精读进度表

| 序号 | 章节名称 | 核心登场人物 | 内嵌插图 | 阅读/标注进度 | 快速入口（原文精读 ｜ 场景世界书待建） |
| :---: | :--- | :--- | :--- | :---: | :--- |
| **00** | **全彩插图与卷首设定** | 刀藤绮凛、艾涅丝妲、卡蜜拉、克劳蒂雅 | cover + bc + co1~co7 | [ ] 待读 | [[00_第二卷_彩页插图与卷首设定\|🎨 打开卷首彩页]] |
| **00** | **序幕 银绮序曲** | 天雾绫斗、尤莉丝、刀藤绮凛 | — | [ ] 待读 | [[第二卷_00_序幕_银绮序曲\|📖 阅读序幕]] |
| **01** | **第一章 六花园会议** | 克劳蒂雅、六校会长、绫斗、刀藤绮凛 | 001.jpg (撞倒绮凛) | [ ] 待读 | [[第二卷_01_第一章_六花园会议\|📖 阅读第一章]] |
| **02** | **第二章 昏枭暗跃** | 绫斗、尤莉丝、纱夜、雷士达、艾涅丝妲、卡蜜拉 | 002.jpg, 003.jpg (+co4) | [ ] 待读 | [[第二卷_02_第二章_昏枭暗跃\|📖 阅读第二章]] |
| **03** | **第三章 疾风刃雷** | 绫斗、英士郎、刀藤绮凛、刀藤钢一郎、尤莉丝 | 004.jpg (+co5 决斗) | [ ] 待读 | [[第二卷_03_第三章_疾风刃雷\|📖 阅读第三章]] |
| **04** | **第四章 错综的思绪** | 刀藤绮凛、钢一郎、绫斗、尤莉丝、纱夜 | — | [ ] 待读 | [[第二卷_04_第四章_错综的思绪\|📖 阅读第四章]] |
| **05** | **第五章 少女素颜** | 绫斗、刀藤绮凛、沙沙宫纱夜 | 005.jpg (致歉), 006.jpg (扑背) | [ ] 待读 | [[第二卷_05_第五章_少女素颜\|📖 阅读第五章]] |
| **06** | **第六章 雾中魔手** | 绫斗、尤莉丝、刀藤绮凛、艾涅丝妲、超人派 | 007.jpg, 008.jpg, 009.jpg | [ ] 待读 | [[第二卷_06_第六章_雾中魔手\|📖 阅读第六章]] |
| **07** | **第七章 决意与决斗** | 绫斗、刀藤绮凛、刀藤钢一郎、尤莉丝、纱夜 | 010.jpg (士茅薙) | [ ] 待读 | [[第二卷_07_第七章_决意与决斗\|📖 阅读第七章]] |
| **08** | **终章** | 艾涅丝妲、卡蜜拉、刀藤绮凛、沙沙宫纱夜 | — | [ ] 待读 | [[第二卷_08_终章\|📖 阅读终章]] |
| **09** | **后记** | 三屋咲悠、okiura | — | [ ] 待读 | [[第二卷_09_后记\|📖 阅读后记]] |

---

## 🌐 第二卷世界书预计产出与增量更新蓝图（随阅读进度勾选）

### 1. 新建人物条目（`第二卷-世界书整理/人物条目/`）
- [ ] **【刀藤绮凛（Kirin Toudou）】**（女角色 3000–3500 Token）：星导馆国中部一年级、13岁序列第一《疾风刃雷》、名刀《千羽切》、刀藤流剑术『连鹤』、父亲刀藤诚二郎护女入狱前史、小动物怯弱与剑士凛然反差、可攻略性格商讨与泛用交互指南
- [ ] **【艾涅丝妲·裘奈（Ernesta Kühne）】**（女角色 3000–3500 Token）：阿勒坎特研究院〈雕刻派〉代表天才、塞拉斯幕后雇主、自律型拟形体研发狂人、慵懒猫系腹黑科学家性格与泛用交互指南
- [ ] **【卡蜜拉·帕蕾特（Camilla Pareto）】**（女角色 3000–3500 Token）：阿勒坎特实践班序列第四、艾涅丝妲挚友兼吐槽役照顾者、全能型拟形体与火器战技、过往创伤与泛用交互指南
- [ ] **【刀藤钢一郎】**（男配角 1800–2500 Token）：银河财团第七教导调查室室长、绮凛伯父、功利冷酷的家族利用派反派定位与交互雷点
- [ ] *（视阅读批注按需扩充）* 六花园会议露脸各校学生会长（圣嘉莱多瓦思、界龙、雷渥夫、葵恩薇儿、阿勒坎特代表）与阿勒坎特〈超人派〉袭击者

### 2. 第一卷老角色第二卷增量校准
- [ ] **【尤莉丝】**：新增火炎战轮招式『赤圆灼斩花』、北方食堂吃醋与特辣咖哩交换名场面
- [ ] **【天雾绫斗】**：新增借用护身名刀双刀流/反手小太刀术『士茅薙』、重力环修行、破解『连鹤』战术
- [ ] **【沙沙宫纱夜】**：新增树枝蹲守扑背直球、终章主动邀请刀藤绮凛组队参加《凤凰星武祭》
- [ ] **【克劳蒂雅】**：新增《六花园会议》外交锋芒、会长室全息南国海滩比基尼恶作剧

### 3. 新建词条与分章场景世界书（`词条与设定条目/` & `场景条目/`）
- [ ] **【六花园会议（Garden Conference）】**：厄托那饭店顶层巨蛋空中庭园、每月例会权限与六校学生会长博弈机制
- [ ] **【刀藤流剑术与护身名刀《千羽切》】**：非煌式武装实体真剑流派、『连鹤』无穷连击原理与古流剑道构势
- [ ] **【阿勒坎特研究院三大派阀（雕刻派 / 超人派等）】**：学术成果主义与自律拟形体伦理之争
- [ ] **【第二卷全卷 9 篇分章场景世界书】**（`00_序幕` ～ `08_终章`，对齐 2013 年初夏日历与星期）

---
> **🚀 立即开读**：[[00_第二卷_彩页插图与卷首设定|🎨 先看第二卷全彩插图]] ｜ [[第二卷_01_第一章_六花园会议|📖 直接进入第一章：六花园会议]]
"""
    return md


def main():
    print(f"Opening EPUB: {EPUB_PATH}")
    with zipfile.ZipFile(EPUB_PATH, "r") as z:
        color_path = os.path.join(OUTPUT_DIR, "00_第二卷_彩页插图与卷首设定.md")
        color_md = build_color_illustrations_note(z)
        with open(color_path, "w", encoding="utf-8") as f:
            f.write(color_md)
        print(f"Generated: {color_path} ({len(color_md)} chars)")

        index_path = os.path.join(OUTPUT_DIR, "00_第二卷_正文精读与评注导航.md")
        index_md = build_index_nav_note()
        with open(index_path, "w", encoding="utf-8") as f:
            f.write(index_md)
        print(f"Generated: {index_path} ({len(index_md)} chars)")

        for ch_info in CHAPTERS_INFO:
            out_file = os.path.join(OUTPUT_DIR, ch_info["file"])
            ch_md = parse_xhtml_to_markdown(z, ch_info)
            with open(out_file, "w", encoding="utf-8") as f:
                f.write(ch_md)
            print(f"Generated: {out_file} ({len(ch_md)} chars)")

    print("\nAll Volume 2 Obsidian reader notes generated successfully!")


if __name__ == "__main__":
    main()
