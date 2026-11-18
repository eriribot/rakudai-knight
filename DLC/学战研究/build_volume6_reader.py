# -*- coding: utf-8 -*-
"""
生成《学战都市Asterisk 06 怀国凯战》Obsidian 正文精读与高亮世界书工作台。
遵循本仓 asterisk-worldbook-workflow 规范：
- 零 *** 分隔符（统一使用 ---）
- 正确对齐 2013 年 10 月新学期至 2013 年 12 月下旬（接近除夕）～ 2014 年 1 月上旬（小寒前夕）日历时间轴
- 原位嵌入轻小说彩色与黑白插图
- 原文模板内绝不混入过早剧情分析与剧透总结，完整保留每幕随手批注栏供精读标注
"""
import os
import re
import zipfile
from bs4 import BeautifulSoup, NavigableString, Tag

EPUB_PATH = r"E:\web\落第\DLC\学战都市Asterisk 06 怀国凯战.epub"
OUT_DIR = r"E:\web\落第\DLC\学战研究\第六卷-世界书整理"
ILLUS_PREFIX = "插图/学战都市Asterisk 06 怀国凯战"

CHAPTERS = [
    {
        "sec": "summary.xhtml",
        "file": "第六卷_00_卷首简介.md",
        "title": "第六卷 卷首简介与制作信息",
        "date": "2013-10～2014-01上旬（导读概览）",
        "summary": "官方卷首简介（称霸凤凰星武祭后受莱泽塔尼亚国王约伯特招待前往欧洲，路过慕尼黑纱夜双亲家后入境莱泽塔尼亚，卷入凯旋游行、王宫夜宴与《孤毒魔女》再会）及作者、电子书制作信息。",
        "prev": "00_第六卷_彩页插图与卷首设定",
        "next": "第六卷_01_第一章_各自的序章",
    },
    {
        "sec": "Section001.xhtml",
        "file": "第六卷_01_第一章_各自的序章.md",
        "title": "第一章 各自的序章",
        "date": "2013-10（十月·下学期初）",
        "summary": "晚秋月夜克劳蒂雅密筹《狮鹫星武祭》计划；校园餐厅众人商讨冬休安排之际，星猎警备队队长赫尔加·林多瓦尔首次现身星导馆，偕绫斗前往辅导室披露前运营委员长达尼罗·贝尔托尼、《蚀武祭》内幕及黑猫机关金眼七号追查近况。",
        "prev": "第六卷_00_卷首简介",
        "next": "第六卷_02_第二章_亲爱的人们",
    },
    {
        "sec": "Section002.xhtml",
        "file": "第六卷_02_第二章_亲爱的人们.md",
        "title": "第二章 亲爱的人们",
        "date": "2013-12月下旬（接近除夕／冬休第 1 日）",
        "summary": "北关东浮空机场候机室内，席尔薇雅微服来电与克劳蒂雅暗自交锋并托付绫斗秘密；一行五人乘莱泽塔尼亚王室专机飞赴德国，傍晚抵达慕尼黑郊外沙沙宫宅受到纱夜之母香夜与全像投影现身的创一热情款待。",
        "prev": "第六卷_01_第一章_各自的序章",
        "next": "第六卷_03_第三章_莱泽塔尼亚",
    },
    {
        "sec": "Section003.xhtml",
        "file": "第六卷_03_第三章_莱泽塔尼亚.md",
        "title": "第三章 莱泽塔尼亚",
        "date": "2013-12月下旬（冬休第 2 日·隔日晨至夜宴）",
        "summary": "辞别香夜经国境进入莱泽塔尼亚首都斯托莱尔，国王约伯特与王妃玛丽亚暗中安排优胜凯旋游行与王宫夜宴；宴会中突现身手不凡的壮年绅士与神话奇美拉袭向绫斗，湖面暗影亦随之蠢动。",
        "prev": "第六卷_02_第二章_亲爱的人们",
        "next": "第六卷_04_第四章_尤莉丝与孤儿院",
    },
    {
        "sec": "Section004.xhtml",
        "file": "第六卷_04_第四章_尤莉丝与孤儿院.md",
        "title": "第四章 尤莉丝与孤儿院",
        "date": "2013-12月下旬（冬休第 3 日·夜宴次日）",
        "summary": "进宫厘清袭击者为《翡翠黄昏》逃犯兼《创兽魔术师》久史塔伍·马尔洛；约伯特坦言忌惮尤莉丝声望威胁王位。傍晚造访已转归尤莉丝名下的孤儿院后，公主独自前往旧研究所废墟再会昔日挚友奥菲莉亚。",
        "prev": "第六卷_03_第三章_莱泽塔尼亚",
        "next": "第六卷_05_第五章_《孤毒魔女》",
    },
    {
        "sec": "Section005.xhtml",
        "file": "第六卷_05_第五章_《孤毒魔女》.md",
        "title": "第五章 《孤毒魔女》",
        "date": "2013-12月下旬～2014-01上旬（雪原激战与昏迷三日）",
        "summary": "雪原废墟中尤莉丝与奥菲莉亚信念决裂交手，绫斗强行护主迎战却受限于双方次元差距与久史塔伍派出双头犬、三头犬伏击，最终身中阻断星辰力的《孤毒》昏睡三日方醒。",
        "prev": "第六卷_04_第四章_尤莉丝与孤儿院",
        "next": "第六卷_06_第六章_魔龙讨伐",
    },
    {
        "sec": "Section006.xhtml",
        "file": "第六卷_06_第六章_魔龙讨伐.md",
        "title": "第六章 魔龙讨伐",
        "date": "2014-01上旬（苏醒当夜～拂晓前）",
        "summary": "芙萝拉惊慌通报城内魔龙骚动，众人识破久史塔伍调虎离山之计奔赴孤儿院与王城湖畔，迎战其耗时三年构筑的三十公尺魔法阵九头魔龙及奇袭。",
        "prev": "第六卷_05_第五章_《孤毒魔女》",
        "next": "第六卷_07_第七章_重逢",
    },
    {
        "sec": "Section007.xhtml",
        "file": "第六卷_07_第七章_重逢.md",
        "title": "第七章 重逢",
        "date": "2014-01上旬（拂晓回宫～半日返抵 Asterisk 夜）",
        "summary": "黎明回宫见证尤莉丝向约伯特表明留校决心；早一步返抵 Asterisk 的绫斗在赫尔加、马迪亚斯与治疗院院长阳·科贝尔带领下终与沉睡五年的姐姐天雾遥重逢，门外更遇上阿勒坎特《超人派》领袖《大博士》希儿妲·珍·罗兰兹。同时银河内尼可拉斯·恩菲尔德雇凶失手被克劳蒂雅抓握把柄。",
        "prev": "第六卷_06_第六章_魔龙讨伐",
        "next": "第六卷_08_终章",
    },
    {
        "sec": "Section008.xhtml",
        "file": "第六卷_08_终章.md",
        "title": "终章",
        "date": "2014-01上旬（三日后／小寒前夕，学生会室）",
        "summary": "尤莉丝等四人返回 Asterisk，克劳蒂雅坦承事件黑手为其父尼可拉斯与背后的银河势力，双方达成《狮鹫星武祭》携手参战的最后决断。",
        "prev": "第六卷_07_第七章_重逢",
        "next": "第六卷_09_后记",
    },
    {
        "sec": "Postscript.xhtml",
        "file": "第六卷_09_后记.md",
        "title": "第六卷 后记",
        "date": "2014-05（出版随笔）",
        "summary": "三屋咲悠谈脱离 Asterisk 舞台深入莱泽塔尼亚描绘尤莉丝背景、延后绮凛老家篇、预告第七卷春季学园祭与《狮鹫星武祭》群雄并起及外传漫画开启。",
        "prev": "第六卷_08_终章",
        "next": "00_第六卷_正文精读与评注导航",
    },
]

ILLUS_CAPTIONS = {
    "001.jpg": "插图 001：晚秋月夜的室内，克劳蒂雅•恩菲尔德披着浴袍靠坐沙发，借空间视窗推进《狮鹫星武祭》筹备",
    "002.jpg": "插图 002：浮空机场候机室内，微服的席尔薇雅•琉奈海姆于空间视窗中俏皮眨眼，令尤莉丝与绮凛疑窦丛生",
    "003.jpg": "插图 003：莱泽塔尼亚边境，身穿猫耳女仆装的芙萝拉•克蕾姆从王室礼宾车回眸招呼",
    "004.jpg": "插图 004：雪原废墟上瘴气鬼手汹涌，白发红眸的《孤毒魔女》奥菲莉亚•兰朵露芬仅凭星辰力便徒手接下并捏碎尤莉丝大绝招火炎战轮",
}


def convert_inline(el) -> str:
    if isinstance(el, NavigableString):
        return str(el).replace("\r", "").replace("\n", "")
    if not isinstance(el, Tag):
        return ""
    name = el.name.lower()
    if name == "br":
        return "\n"
    if name == "img":
        src = el.get("src", "")
        fname = os.path.basename(src)
        if not fname or fname in {"note.png", "t1.png"}:
            return ""
        cap = ILLUS_CAPTIONS.get(fname, f"插图 {fname}")
        return f"\n\n![[{ILLUS_PREFIX}/{fname}]]\n*{cap}*\n\n"
    if name == "ruby":
        rb_parts = []
        rt_parts = []
        for child in el.children:
            if isinstance(child, Tag) and child.name.lower() == "rt":
                rt_parts.append(child.get_text(strip=True))
            elif isinstance(child, Tag) and child.name.lower() == "rp":
                continue
            else:
                rb_parts.append(convert_inline(child))
        rb = "".join(rb_parts).strip()
        rt = "".join(rt_parts).strip()
        return f"{rb}（{rt}）" if rt else rb
    return "".join(convert_inline(c) for c in el.children)


def should_skip_paragraph(txt: str, title: str) -> bool:
    s = re.sub(r"[\s\u3000]+", "", txt)
    t_clean = re.sub(r"[\s\u3000]+", "", title)
    if not s:
        return True
    if s in {"简介", "后记", "终章"}:
        return True
    if re.match(r"^第[一二三四五六七]章", s) and s in t_clean:
        return True
    return False


def build_chapter_md(z: zipfile.ZipFile, ch: dict) -> str:
    raw_html = z.read(f"OEBPS/Text/{ch['sec']}").decode("utf-8", errors="ignore")
    soup = BeautifulSoup(raw_html, "html.parser")
    body = soup.body or soup

    acts = [[]]
    for el in body.children:
        if not isinstance(el, Tag):
            continue
        blocks = (
            el.find_all(["p", "h1", "h2", "h3", "h4", "div"], recursive=False)
            if el.name.lower() == "div" and el.find(["p", "img"])
            else [el]
        )
        if el.name.lower() == "div" and not el.find("p") and el.find("img"):
            blocks = [el]
        for blk in blocks:
            converted = convert_inline(blk).strip()
            if not converted:
                continue
            if "＊＊＊" in converted or re.fullmatch(r"[＊*※\s]+", converted):
                if acts[-1]:
                    acts.append([])
                continue
            if should_skip_paragraph(converted, ch["title"]):
                continue
            converted = converted.replace("***", "——")
            acts[-1].append(converted)

    if ch["sec"] == "summary.xhtml":
        for extra_sec, extra_hdr in [("author.xhtml", "作者与插画师寄语"), ("message.xhtml", "电子书制作信息")]:
            key = f"OEBPS/Text/{extra_sec}"
            if key in z.namelist():
                esoup = BeautifulSoup(z.read(key).decode("utf-8", errors="ignore"), "html.parser")
                ebody = esoup.body or esoup
                lines = []
                for p in ebody.find_all(["p", "h1", "h2", "h3", "h4"]):
                    t = convert_inline(p).strip().replace("***", "——")
                    if t and "───" not in t:
                        lines.append(t)
                if lines:
                    acts.append([f"**【{extra_hdr}】**"] + lines)

    parts = [
        "---",
        f"title: \"{ch['title']}\"",
        f"date: \"{ch['date']}\"",
        "tags: [学战都市Asterisk, 第六卷, 怀国凯战, 正文精读]",
        "---",
        "",
        f"# {ch['title']}",
        "",
        f"> [!info] 📅 剧情时间与导读（[[00_第六卷_正文精读与评注导航|返回第六卷总控导航]]）",
        f"> - **时间定位**：{ch['date']}",
        f"> - **本节提要**：{ch['summary']}",
        "> - **精读用法**：高亮原句 `==文本== %%批注%%`；每幕下方随手记录人物弧光、机制实证或台词金句。",
        f"> - **导航**：← 上一节 [[{ch['prev']}]] ｜ 下一节 [[{ch['next']}]] →",
        "",
        "---",
        "",
    ]

    multi_act = len(acts) > 1
    for i, act_lines in enumerate(acts, 1):
        if multi_act:
            parts.append(f"### ❖ 第 {i} 幕")
            parts.append("")
        for ln in act_lines:
            parts.append(ln)
            parts.append("")
        if multi_act:
            parts.append(f"> [!NOTE] ✍️ 第 {i} 幕随手批注")
            parts.append("> - **核心角色/台词/伏笔观察**：")
            parts.append("> - **人物/场景/词条入库备忘**：")
            parts.append("")
            parts.append("---")
            parts.append("")

    parts.extend([
        "> [!tip] 🏁 本章阅读完结导航",
        f"> ← 上一节 [[{ch['prev']}]] ｜ [[00_第六卷_正文精读与评注导航|第六卷总控导航]] ｜ 下一节 [[{ch['next']}]] →",
        "",
    ])
    out = "\n".join(parts)
    assert "***" not in out, f"Forbidden *** found in {ch['file']}"
    return out


def build_color_illus_md() -> str:
    content = f"""---
title: "第六卷《怀国凯战》彩页插图与卷首设定总览"
tags: [学战都市Asterisk, 第六卷, 怀国凯战, 彩页设定]
---

# 第六卷《怀国凯战》彩页插图与卷首设定总览

> [!info] 卷首图鉴导读（[[00_第六卷_正文精读与评注导航|返回第六卷总控导航]]）
> 本文件收录《学战都市Asterisk 06 怀国凯战》全部封面、封底及卷首全彩与黑白设定插图（`cover`、`bc`、`co1`～`co7`）。

---

## 🖼️ 封面、封底与卷首彩页折页

### 1. 封面（`cover.jpg`）与封底（`bc.jpg`）
| 封面：《孤毒魔女》奥菲莉亚·兰朵露芬 | 封底：第六卷剧情导语 |
| :---: | :---: |
| ![[{ILLUS_PREFIX}/cover.jpg]] | ![[{ILLUS_PREFIX}/bc.jpg]] |
| *封面：连霸两届《王龙星武祭》、雷渥夫黑学院排名第一《孤毒魔女》奥菲莉亚·兰朵露芬（手持《霸溃血镰》）* | *封底文本：欧洲与莱泽塔尼亚篇开幕、《孤毒魔女》现身、「回来吧，奥菲莉亚。你该待的世界不是那里。」* |

### 2. 卷首单人彩插 `co1.jpg`：礼服回眸的尤莉丝
![[{ILLUS_PREFIX}/co1.jpg]]
*卷首彩插 `co1.jpg`：身着桃红黑紫渐层荷叶边晚礼服、黑丝绸腰带蝴蝶结与蓝紫纱裙摆的尤莉丝（对应第三章莱泽塔尼亚王宫夜宴）。*

### 3. 卷首跨页彩插 `co2.jpg`：清晨房内的刀藤绮凛
![[{ILLUS_PREFIX}/co2.jpg]]
*卷首跨页 `co2.jpg`：微敞淡绿荷叶边睡衣、浅紫睡裤的刀藤绮凛睡眼惺忪轻揉眼角：「绫斗……？你怎么会在这里……啊！」*

### 4. 卷首彩插 `co3.jpg`：《三美姬的飨宴》礼服合照
![[{ILLUS_PREFIX}/co3.jpg]]
*卷首彩插 `co3.jpg`：王宫夜宴晚礼服三美姬——克劳蒂雅（深紫露肩晚礼服）、沙沙宫纱夜（黑蕾丝双马尾礼服）、刀藤绮凛（纯白露肩礼服）。*

### 5. 全卷目录与用语图鉴（`co4`～`co7`）
| 目录与《Ser=Versta》结构图 `co4.jpg` | 星导馆学园角色图鉴＆前情提要 `co5.jpg` |
| :---: | :---: |
| ![[{ILLUS_PREFIX}/co4.jpg]] | ![[{ILLUS_PREFIX}/co5.jpg]] |

| 各学园代表与莱泽塔尼亚人物图鉴 `co6.jpg` | Asterisk 核心用语解说 `co7.jpg` |
| :---: | :---: |
| ![[{ILLUS_PREFIX}/co6.jpg]] | ![[{ILLUS_PREFIX}/co7.jpg]] |

> [!tip] `co6.jpg` 与卷内关键新增人物备忘（OCR 与图鉴核对）
> - **莱泽塔尼亚王室**：**约伯特**（`Jolbert`，尤莉丝之兄、莱泽塔尼亚国王）与王妃**玛丽亚**（`Maria`）。
> - **星猎警备队**：队长**赫尔加·林多瓦尔**（`Helga Lindwall`，第 1 章正式现身，与《孤毒魔女》并称史上最强）。
> - **阿勒坎特研究院《超人派》**：会长**希儿妲·珍·罗兰兹**（`Hilda Jane Rowlands`，《大博士》，第 7 章登场）；退学刺客兼前《翡翠黄昏》逃犯**久史塔伍·马尔洛**（`Gustav Marlo`，《创兽魔术师》）。
> - **沙沙宫家＆其他关联者**：纱夜之母**沙沙宫香夜**（第 2 章慕尼黑登场）、中央区治疗院院长**阳·科贝尔**（第 7 章登场）、克劳蒂雅之父**尼可拉斯·恩菲尔德**（`Nicolas Enfield`，第 7–8 章登场），以及首次于正文正式现身登场的《孤毒魔女》**奥菲莉亚·兰朵露芬**（`Orphelia Landlufen`，已有第 3 卷预建人物档案）。

---

> ← [[00_第六卷_正文精读与评注导航|返回第六卷总控导航]] ｜ [[第六卷_00_卷首简介|开始精读：卷首简介 →]]
"""
    assert "***" not in content
    return content


def build_index_md() -> str:
    content = r"""---
title: "第六卷《怀国凯战》正文精读与高亮世界书工作台"
tags: [学战都市Asterisk, 第六卷, 怀国凯战, Obsidian工作台]
---

# 第六卷《怀国凯战》正文精读与高亮世界书工作台

> [!abstract] 本卷核心主题与高亮精读说明
> - **本卷定位**：《凤凰星武祭》夺冠后的欧洲冬休暨《孤毒魔女》现身篇，为后续《狮鹫星武祭》正式组队与主线黑幕切入关键过渡卷。涵盖：十月新学期星猎警备队长**赫尔加·林多瓦尔**密访与达尼罗旧案、除夕前夕赴慕尼黑拜访**沙沙宫创一＆香夜**、莱泽塔尼亚国王**约伯特＆玛丽亚**与凯旋游行、**《创兽魔术师》久史塔伍·马尔洛**袭击夜宴与召唤九头魔龙、尤莉丝同**《孤毒魔女》奥菲莉亚·兰朵露芬**的雪原重逢惨烈激战、以及返回 Asterisk 后于治疗院见着沉睡的**天雾遥**、遭遇**《大博士》希儿妲·珍·罗兰兹**与**尼可拉斯·恩菲尔德**事件收尾。
> - **推荐精读批注语法**：
>   - 高亮关键原文：`==这句描写性格或招式的原句==`
>   - 紧接隐藏批注：`%%待录入世界书：技能机制/好感触发点%%`
>   - 每幕结尾均附带 `> [!NOTE] ✍️ 第 N 幕随手批注` 快捷笔记栏。

---

## 📅 第六卷 2013～2014 跨年真实日历时间轴对齐

承接第五卷终章（`2013 年 9 月下旬`《凤凰星武祭》闭幕后一月），横跨十月下学期开学至年底冬休／翌年一月初（第七卷第一章衔接点明「刚过小寒」一月初）：

| 公历时间段 | 赛程/学园阶段 | 对应章节与核心事件 |
| :--- | :---: | :--- |
| **2013-10（十月）** | 下学期初 | [[第六卷_01_第一章_各自的序章\|第一章 各自的序章]]（克劳蒂雅月夜布局、星导馆餐厅约冬休计划、赫尔加·林多瓦尔首次现身辅导室谈《蚀武祭》与达尼罗·贝尔托尼） |
| **2013-12月下旬（接近除夕）** | 冬休第 1 日（夜） | [[第六卷_02_第二章_亲爱的人们\|第二章 亲爱的人们]]（机场候机室席尔薇雅来电、乘王室专机抵德国慕尼黑、夜宿沙沙宫家见香夜＆创一） |
| **2013-12月下旬（隔日晨～夜）** | 冬休第 2 日 | [[第六卷_03_第三章_莱泽塔尼亚\|第三章 莱泽塔尼亚]]（入境斯托莱尔凯旋游行、王宫见约伯特＆玛丽亚、夜宴遭久史塔伍奇美拉突袭） |
| **2013-12月下旬（夜宴次日）** | 冬休第 3 日 | [[第六卷_04_第四章_尤莉丝与孤儿院\|第四章 尤莉丝与孤儿院]]（进宫分析《创兽魔术师》、造访孤儿院、雪原废墟再会奥菲莉亚） |
| **2013-12月下旬～2014-01上旬** | 冬休第 3～6 日 | [[第六卷_05_第五章_《孤毒魔女》\|第五章 《孤毒魔女》]]（尤莉丝＆绫斗激战奥菲莉亚败退，遭久史塔伍双头/三头犬伏击且中《孤毒》昏睡三日） |
| **2014-01上旬（苏醒夜～拂晓）** | 冬休第 6 日夜～第 7 日晨 | [[第六卷_06_第六章_魔龙讨伐\|第六章 魔龙讨伐]]（湖畔三十公尺魔法阵九头魔龙迎战，绮凛刀背击昏久史塔伍） |
| **2014-01上旬（第 7 日半日后～夜）** | 第 7 日晚 | [[第六卷_07_第七章_重逢\|第七章 重逢]]（尤莉丝表决心留校、绫斗提前返 Asterisk，治疗院见阳·科贝尔与天雾遥、邂逅《大博士》希儿妲；尼可拉斯谋划败露） |
| **2014-01上旬（三日后／小寒前夕）** | 休假尾声 | [[第六卷_08_终章\|终章]]（尤莉丝等四人返校、克劳蒂雅坦白父亲委托刺杀内幕，众人定调出战《狮鹫星武祭》） |

---

## 📜 分章精读导航

| 序号 | 章节文件 | 章节标题 | 时间锚点 | 核心剧情提要 |
| :---: | :--- | :--- | :---: | :--- |
| 00 | [[00_第六卷_彩页插图与卷首设定]] | 彩页插图与卷首设定总览 | 全卷 | 封面奥菲莉亚、`co1`～`co7` 彩页（礼服三美姬/《Ser=Versta》）与用语图鉴 |
| 00b | [[第六卷_00_卷首简介]] | 卷首简介与作者寄语 | 卷首 | 书籍简介、作者插画师寄语与电子书制作信息 |
| 01 | [[第六卷_01_第一章_各自的序章]] | 第一章 各自的序章 | 2013-10 | 克劳蒂雅独白、下学期餐厅议冬休、赫尔加首秀披露达尼罗与黑猫调查 |
| 02 | [[第六卷_02_第二章_亲爱的人们]] | 第二章 亲爱的人们 | 12月下旬（夜） | 机场席尔薇雅视窗致意、慕尼黑拜访沙沙宫香夜与创一 |
| 03 | [[第六卷_03_第三章_莱泽塔尼亚]] | 第三章 莱泽塔尼亚 | 冬休第 2 日 | 斯托莱尔凯旋游行、王宫见约伯特＆玛丽亚、夜宴奇美拉袭击 |
| 04 | [[第六卷_04_第四章_尤莉丝与孤儿院]] | 第四章 尤莉丝与孤儿院 | 冬休第 3 日 | 约伯特谈王位隐忧、孤儿院慰问与旧研究所废墟再会奥菲莉亚 |
| 05 | [[第六卷_05_第五章_《孤毒魔女》]] | 第五章 《孤毒魔女》 | 激战～昏睡 3 日 | 尤莉丝挑战《孤毒魔女》无力回天，绫斗挡双魔兽中毒长眠 |
| 06 | [[第六卷_06_第六章_魔龙讨伐]] | 第六章 魔龙讨伐 | 第 6 日夜～拂晓 | 湖畔迎战久史塔伍三年杰作九头魔龙，绮凛刀背收服犯人 |
| 07 | [[第六卷_07_第七章_重逢]] | 第七章 重逢 | 第 7 日夜 | 绫斗抢先回国于治疗院初见沉睡五年的天雾遥，遇《大博士》希儿妲与科贝尔院长；克劳蒂雅揭穿父亲 |
| 08 | [[第六卷_08_终章]] | 终章 | 3 日后·一月上旬 | 众人返校听克劳蒂雅坦陈黑幕，定下出征《狮鹫星武祭》决断 |
| 09 | [[第六卷_09_后记]] | 后记 | 卷末 | 三屋咲悠谈外界莱泽塔尼亚舞台创作经过与《狮鹫星武祭》预告 |

---

## 🎯 第六卷首次正式登场人物＆待整理场景蓝图

### 1. 第六卷首次正式登场的新人物档案（已随全卷 EPUB 考据建档）
- **核心女性角色（女角色梯度 `3,000–4,500 ST_Tokens`）**
  - [x] [[人物条目/赫尔加·林多瓦尔|赫尔加·林多瓦尔]]（`Helga Lindwall`，星猎警备队队长、半世纪前《王龙星武祭》冠军、操纵自身时间与肉体年龄的《时律魔女》；第 4 卷提及、**第 6 卷第 1 章首次正式登场**）
  - [x] [[人物条目/希儿妲·珍·罗兰兹|希儿妲·珍·罗兰兹]]（`Hilda Jane Rowlands`，阿勒坎特研究院《超人派》会长、《大博士》，奥菲莉亚改造者与生命工学奇才；**第 6 卷第 7 章正式登场**，第 13–14 卷出战《王龙星武祭》）
  - [x] [[人物条目/沙沙宫香夜与玛丽亚|沙沙宫香夜 ＆ 玛丽亚]]（沙沙宫纱夜之母**香夜**［第 2–3 章慕尼黑登场］与莱泽塔尼亚王妃**玛丽亚**［第 3–4、7 章王宫登场］）
- **核心男性对手与关键配角（男角色梯度 `1,800–2,500 ST_Tokens`）**
  - [x] [[人物条目/久史塔伍·马尔洛|久史塔伍·马尔洛]]（`Gustav Marlo`，原阿勒坎特《超人派》退学生、别名《创兽魔术师》，《翡翠黄昏》逃犯与拿钱办事刺客，第 3–7 章主线反派）
  - [x] [[人物条目/约伯特|约伯特]]（`Jolbert`，尤莉丝之兄、莱泽塔尼亚国王，表面轻浮实则老谋深算斡旋两强财团之间，第 3–4、6–7 章重要角色）
  - [x] [[人物条目/阳·科贝尔与尼可拉斯·恩菲尔德|阳·科贝尔 ＆ 尼可拉斯·恩菲尔德]]（Asterisk 中央区治疗院院长**阳·科贝尔**［第 7 章登场］＆ 银河 CRO 辅佐／克劳蒂雅之父**尼可拉斯·恩菲尔德**［`Nicolas Enfield`，第 7–8 章登场］）
- **本卷正文首次亲身现身・已有前期预建档案角色**
  - [x] [[第三卷-世界书整理/人物条目/奥菲莉亚·兰朵露芬|奥菲莉亚·兰朵露芬]]（`Orphelia Landlufen`，《孤毒魔女》，第 3 卷已预建跨卷全史档案；在正传时间线上于**第 6 卷第 5 章雪原废墟方才首次正式现身登场**）
  - [x] [[第三卷-世界书整理/人物条目/沙沙宫创一|沙沙宫创一]]（纱夜之父、罗伯斯迁移式煌式武装专家，第 3 卷已建档；**第 6 卷第 2 章以全像投影正式交互登场**）
- **本卷出现无专名／仅点名提及之人物**
  - **莱泽塔尼亚孤儿院修女**（第 4、6 章仅以「修女」指代未明写姓名，其代表**堤蕾泽修女** `Sister Therese` 至第 11 卷与图鉴方明载全名）
  - **达尼罗·贝尔托尼**（`Danilo Bertoni`，已故，前阳雪出身运营委员长、暗中主导《蚀武祭》，第 1、7 章重点追查对象）
  - **克劳蒂雅之母／伊莎贝拉·恩菲尔德**（银河最高经营干部之一，第 7 章点名其立场，第 9 卷起正式登场）

### 2. 待整理场景条目（随后续精读批注推进）
- [ ] `01_第一章场景_各自的序章.md`
- [ ] `02_第二章场景_亲爱的人们.md`
- [ ] `03_第三章场景_莱泽塔尼亚.md`
- [ ] `04_第四章场景_尤莉丝与孤儿院.md`
- [ ] `05_第五章场景_《孤毒魔女》.md`
- [ ] `06_第六章场景_魔龙讨伐.md`
- [ ] `07_第七章场景_重逢.md`
- [ ] `08_终章场景_星导馆集结.md`
"""
    assert "***" not in content
    return content


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    for sub in ["人物条目", "场景条目", "词条与设定条目"]:
        os.makedirs(os.path.join(OUT_DIR, sub), exist_ok=True)

    with zipfile.ZipFile(EPUB_PATH, "r") as z:
        for ch in CHAPTERS:
            md = build_chapter_md(z, ch)
            out_path = os.path.join(OUT_DIR, ch["file"])
            with open(out_path, "w", encoding="utf-8") as f:
                f.write(md)

    with open(os.path.join(OUT_DIR, "00_第六卷_彩页插图与卷首设定.md"), "w", encoding="utf-8") as f:
        f.write(build_color_illus_md())

    with open(os.path.join(OUT_DIR, "00_第六卷_正文精读与评注导航.md"), "w", encoding="utf-8") as f:
        f.write(build_index_md())

    print("Successfully built Volume 6 Obsidian workbench at:", OUT_DIR)


if __name__ == "__main__":
    main()
