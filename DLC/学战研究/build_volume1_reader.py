# -*- coding: utf-8 -*-
"""
Build full Markdown reader notes for Volume 1 of Asterisk War in Obsidian.
Preserves 100% of authentic original text, embeds inline illustrations,
and provides interactive Obsidian callout blocks for user annotations and worldbook notes.
"""

import os
import sys
import zipfile
import shutil
import bs4

sys.stdout.reconfigure(encoding='utf-8')

EPUB_PATH = r"E:\web\落第\DLC\学战都市Asterisk 01 姬焰邂逅.epub"
OUTPUT_DIR = r"E:\web\落第\DLC\学战研究\第一卷-世界书整理"
os.makedirs(OUTPUT_DIR, exist_ok=True)

ILLUS_CAPTIONS = {
    "001.jpg": "图：第一训练场上的对峙——〈华焰魔女〉尤莉丝手持〈白姬之花〉对准天雾绫斗",
    "002.jpg": "图：星导馆普通科教室——情报通夜吹英士郎向绫斗解释Asterisk与尤莉丝的公主传闻",
    "003.jpg": "图：学生会长室——星导馆学园学生会长克劳蒂雅·恩菲尔德为绫斗沏红茶",
    "004.jpg": "图：第七训练场——青梅竹马沙沙宫纱夜登场与巨型炮式煌式武装测试",
    "005.jpg": "图：宿舍庭院水池长椅——天雾绫斗与沙沙宫纱夜的重逢与谈心",
    "006.jpg": "图：学生食堂骚乱——尤莉丝、沙沙宫纱夜与绫斗同桌用餐遭遇挑衅",
    "007.jpg": "图：星导馆地下武装库——绫斗与纯星煌式武装〈黑炉魔剑〉认主契合",
    "008.jpg": "图：水上都市商业区假日购物——尤莉丝挑选衣服时的少女娇羞神态",
    "009.jpg": "图：商业区地下通道遇袭——雷渥夫黑学园刺客伏击尤莉丝与绫斗",
    "010.jpg": "图：绫斗解放封印——纯星煌式武装〈黑炉魔剑〉炽烈白刃斩裂强敌",
    "011.jpg": "图：作者三屋咲悠与插画okiura后记角色致谢插图",
    "012.jpg": "图：官方世界观设定解说图解（万应素、星脉世代、星武祭、六大财团）",
}

CHAPTERS_INFO = [
    {
        "file": "第一卷_00_序幕_倏然疾风.md",
        "title": "序幕 倏然疾风",
        "xhtml": "OEBPS/Text/summary.xhtml",
        "prev": "00_第一卷_彩页插图与卷首设定",
        "next": "第一卷_01_第一章_华焰魔女",
        "chars": ["天雾绫斗", "尤莉丝·爱雷克西亚·冯·里斯妃特"],
        "location": "水上学园都市「六花」Asterisk",
        "summary": "落星雨之后的新世界，天雾绫斗在学生会长克劳蒂雅的邀请下踏入水上学园都市六花，揭开星武祭霸业与命运邂逅的序幕。",
    },
    {
        "file": "第一卷_01_第一章_华焰魔女.md",
        "title": "第一章 华焰魔女",
        "xhtml": "OEBPS/Text/Section001.xhtml",
        "prev": "第一卷_00_序幕_倏然疾风",
        "next": "第一卷_02_第二章_学战都市",
        "chars": ["天雾绫斗", "尤莉丝·爱雷克西亚", "克劳蒂雅·恩菲尔德"],
        "location": "星导馆一年级女生宿舍 → 第一训练场",
        "summary": "拾起手帕意外从窗台跃入更衣室，绫斗被迫接受孤傲皇女〈华焰魔女〉尤莉丝的决斗宣战。校庭激斗中突现冷枪偷袭，绫斗飞身护美挡弹，学生会长克劳蒂雅现身调停。",
    },
    {
        "file": "第一卷_02_第二章_学战都市.md",
        "title": "第二章 学战都市",
        "xhtml": "OEBPS/Text/Section002.xhtml",
        "prev": "第一卷_01_第一章_华焰魔女",
        "next": "第一卷_03_第三章_凛凛眼神",
        "chars": ["天雾绫斗", "夜吹英士郎", "克劳蒂雅·恩菲尔德", "八津崎匡子"],
        "location": "星导馆一年三班教室 → 学生会长室",
        "summary": "与情报通夜吹英士郎结识，获悉Asterisk六大学园制衡与尤莉丝真实皇女身份。随后绫斗应邀赴学生会长室与克劳蒂雅会面，探讨转学星导馆寻找失踪姐姐天雾遥的隐情。",
    },
    {
        "file": "第一卷_03_第三章_凛凛眼神.md",
        "title": "第三章 凛凛眼神",
        "xhtml": "OEBPS/Text/Section003.xhtml",
        "prev": "第一卷_02_第二章_学战都市",
        "next": "第一卷_04_第四章_回忆与重逢",
        "chars": ["天雾绫斗", "尤莉丝·爱雷克西亚", "沙沙宫纱夜", "克劳蒂雅·恩菲尔德"],
        "location": "第七训练场 → 星导馆校道",
        "summary": "绫斗在训练场目睹手持巨大炮式煌式武装试射的蓝发少女，正是六年前分别的青梅竹马沙沙宫纱夜。随后尤莉丝赶到，两位少女针锋相对，修罗场初显。",
    },
    {
        "file": "第一卷_04_第四章_回忆与重逢.md",
        "title": "第四章 回忆与重逢",
        "xhtml": "OEBPS/Text/Section004.xhtml",
        "prev": "第一卷_03_第三章_凛凛眼神",
        "next": "第一卷_05_第五章_黑炉魔剑",
        "chars": ["天雾绫斗", "沙沙宫纱夜", "尤莉丝·爱雷克西亚", "雷渥夫黑学园挑衅者"],
        "location": "宿舍中庭水池长椅 → 学生食堂",
        "summary": "绫斗与纱夜月下长椅谈心，回忆当年天雾道场与机械落星技术的往事。次日食堂三人同桌引发瞩目，雷渥夫黑学园学生挑衅生事，尤莉丝与纱夜联手震慑全场。",
    },
    {
        "file": "第一卷_05_第五章_黑炉魔剑.md",
        "title": "第五章 黑炉魔剑",
        "xhtml": "OEBPS/Text/Section005.xhtml",
        "prev": "第一卷_04_第四章_回忆与重逢",
        "next": "第一卷_06_第六章_两人的假日",
        "chars": ["天雾绫斗", "克劳蒂雅·恩菲尔德", "夜吹英士郎"],
        "location": "星导馆地下深层纯星煌式武装保管库",
        "summary": "克劳蒂雅带领绫斗前往地下武器库，挑选专属武装。绫斗与拥有四大形态、温度高达上万度的终极纯星煌式武装〈黑炉魔剑〉共鸣认主，展现惊人相适度。",
    },
    {
        "file": "第一卷_06_第六章_两人的假日.md",
        "title": "第六章 两人的假日",
        "xhtml": "OEBPS/Text/Section006.xhtml",
        "prev": "第一卷_05_第五章_黑炉魔剑",
        "next": "第一卷_07_第七章_解放者",
        "chars": ["天雾绫斗", "尤莉丝·爱雷克西亚"],
        "location": "六花中央商业区 → 服装精品店 → 咖啡厅",
        "summary": "尤莉丝主动邀请绫斗在假日陪同进城购物。两人漫步商业区，尤莉丝展现出不为人知的少女娇羞一面，并在咖啡厅向绫斗倾诉自己参加星武祭的真正愿望与孤儿院羁绊。",
    },
    {
        "file": "第一卷_07_第七章_解放者.md",
        "title": "第七章 解放者",
        "xhtml": "OEBPS/Text/Section007.xhtml",
        "prev": "第一卷_06_第六章_两人的假日",
        "next": "第一卷_08_终章_并肩之誓",
        "chars": ["天雾绫斗", "尤莉丝·爱雷克西亚", "沙沙宫纱夜", "雷渥夫黑学园刺客群", "赛拉斯·诺曼"],
        "location": "六花中央商业区地下通路",
        "summary": "归途中遭遇雷渥夫黑学园刺客伏击，尤莉丝为保护绫斗星辰力濒临耗尽。生死关头绫斗强行冲破体内封印，黑炉魔剑白刃出鞘，以绝对压倒性剑威斩灭强敌，救下尤莉丝。",
    },
    {
        "file": "第一卷_08_终章_并肩之誓.md",
        "title": "终章 并肩之誓",
        "xhtml": "OEBPS/Text/Section008.xhtml",
        "prev": "第一卷_07_第七章_解放者",
        "next": "第一卷_09_后记与世界观解说",
        "chars": ["天雾绫斗", "尤莉丝·爱雷克西亚", "沙沙宫纱夜", "克劳蒂雅·恩菲尔德"],
        "location": "星导馆医务室 → 校园林荫道",
        "summary": "战斗落幕，绫斗与尤莉丝互通心意，正式结为〈凤凰星武祭〉搭档。同伴们汇聚身侧，六花学园都市的全新物语正式拉开大幕。",
    },
    {
        "file": "第一卷_09_后记与世界观解说.md",
        "title": "后记与世界观解说",
        "xhtml": "OEBPS/Text/Postscript.xhtml",
        "prev": "第一卷_08_终章_并肩之誓",
        "next": "00_第一卷_正文精读与评注导航",
        "chars": ["三屋咲悠", "okiura"],
        "location": "现实 / Asterisk 设定档案馆",
        "summary": "原作者三屋咲悠与插画家 okiura 的全卷后记、创作心路历程，以及附带的官方全套世界观设定解说图解（万应素、星脉世代、星武祭、六大企业财团）。",
    },
]

def parse_xhtml_to_markdown(z, ch_info):
    xhtml_path = ch_info["xhtml"]
    raw_data = z.read(xhtml_path)
    soup = bs4.BeautifulSoup(raw_data, "html.parser")
    
    main_div = soup.find("div")
    elements = main_div.children if main_div else soup.body.children
    
    cur_curtain = 1
    content_blocks = []
    
    for el in elements:
        if not hasattr(el, 'name') or not el.name:
            continue
        
        # Check for image
        img = el.find('img') if el.name != 'img' else el
        if img:
            src = img.get('src').split('/')[-1]
            caption = ILLUS_CAPTIONS.get(src, f"插图：{src}")
            content_blocks.append(f"\n![[插图/学战都市Asterisk 01 姬焰邂逅/{src}]]\n*{caption}*\n")
            continue
        
        t = el.text.strip()
        if not t:
            continue
        
        # Check for break
        if "＊＊＊" in t:
            content_blocks.append(f"""
---

> [!NOTE] ✍️ 第 {cur_curtain} 幕读者评注 / 随手备忘（点击此处即可直接批注）
> - 

### ❖ 第 {cur_curtain + 1} 幕
""")
            cur_curtain += 1
        elif t.startswith("第一章") or t.startswith("第二章") or t.startswith("第三章") or \
             t.startswith("第四章") or t.startswith("第五章") or t.startswith("第六章") or \
             t.startswith("第七章") or t.startswith("终章") or t == "简介" or t == "后记":
            # Skip chapter title header as it's displayed at top
            continue
        else:
            content_blocks.append(f"{t}\n")
            
    body_text = "\n".join(content_blocks)
    
    # Companion illustrations for postscript
    extra_illus_text = ""
    if ch_info["file"] == "第一卷_09_后记与世界观解说.md":
        extra_illus_text = f"""
---

### ❖ 后记附录插图与官方世界观解说图解

![[插图/学战都市Asterisk 01 姬焰邂逅/011.jpg]]
*{ILLUS_CAPTIONS["011.jpg"]}*

![[插图/学战都市Asterisk 01 姬焰邂逅/012.jpg]]
*{ILLUS_CAPTIONS["012.jpg"]}*
"""
    
    # Generate full markdown
    prev_link = f"[[{ch_info['prev']}|⏮️ 上一章]]" if ch_info['prev'] else ""
    next_link = f"[[{ch_info['next']}|⏭️ 下一章]]" if ch_info['next'] else ""
    nav_line = f"> **导航**：[[00_第一卷_正文精读与评注导航|📋 第一卷目录]] | {prev_link} | {next_link}"
    
    chars_str = "、".join(ch_info['chars'])
    
    md = f"""# 《学战都市Asterisk》第一卷·{ch_info['title']}

{nav_line}

> [!ABSTRACT] 📖 章节核心导览
> - **核心出场**：{chars_str}
> - **主要舞台**：{ch_info['location']}
> - **剧情脉络**：{ch_info['summary']}

---

### ❖ 第 1 幕

{body_text}
{extra_illus_text}
---

> [!NOTE] ✍️ 第 {cur_curtain} 幕读者评注 / 随手备忘（点击此处即可直接批注）
> - 

---

## ✍️ 本章读者评注与世界书整理工作区

> [!NOTE] 💡 章节总评与个人感想（点击此处即可直接编辑）
> - 

> [!TIP] ⚔️ 战力规则、武器与设定提炼（点击此处即可直接编辑）
> - 

> [!EXAMPLE] 👤 角色印象、性格细节与好感轨迹（点击此处即可直接编辑）
> - 

> [!CHECK] 🌐 世界书条目待办与录入清单（点击打勾或追加）
> - [ ] 

---
{nav_line}
"""
    return md

def build_color_illustrations_note(z):
    title_raw = z.read("OEBPS/Text/title.xhtml").decode('utf-8', errors='ignore')
    author_raw = z.read("OEBPS/Text/author.xhtml").decode('utf-8', errors='ignore')
    message_raw = z.read("OEBPS/Text/message.xhtml").decode('utf-8', errors='ignore')
    
    author_soup = bs4.BeautifulSoup(author_raw, "html.parser")
    message_soup = bs4.BeautifulSoup(message_raw, "html.parser")
    
    author_text = author_soup.text.strip()
    message_text = message_soup.text.strip()
    
    md = f"""# 《学战都市Asterisk》第一卷·彩页插图与卷首设定

> **导航**：[[00_第一卷_正文精读与评注导航|📋 第一卷目录]] | [[第一卷_00_序幕_倏然疾风|⏭️ 开始阅读序幕]]

> [!ABSTRACT] 🎨 卷首全彩插图存证与出版信息
> 本笔记完整收录《学战都市Asterisk 01 姬焰邂逅》官方全彩拉页、全彩登场人物设定图鉴、水上学园都市「六花」宏观全景地图、目录插图及出版作者信息。

---

## 1. 官方全彩插图全集

### 封面：尤莉丝·爱雷克西亚·冯·里斯妃特 & 天雾绫斗
![[插图/学战都市Asterisk 01 姬焰邂逅/cover.jpg]]
*图：第一卷封面——〈华焰魔女〉尤莉丝与天雾绫斗*

---

### 全彩拉页：华焰之花与烈焰对峙
![[插图/学战都市Asterisk 01 姬焰邂逅/co1.jpg]]
*图：卷首全彩拉页——红莲火焰中的魔女尤莉丝*

---

### 全彩人物图鉴：天雾绫斗 & 尤莉丝·爱雷克西亚
![[插图/学战都市Asterisk 01 姬焰邂逅/co2.jpg]]
*图：官方全彩人物档案——男主角天雾绫斗与女主角尤莉丝·爱雷克西亚·冯·里斯妃特*

---

### 全彩日常插图：沙沙宫纱夜 & 克劳蒂雅·恩菲尔德
![[插图/学战都市Asterisk 01 姬焰邂逅/co3.jpg]]
*图：全彩日常插页——青梅竹马沙沙宫纱夜与学生会长克劳蒂雅*

---

### 全彩决斗插画：第一训练场的相遇与交锋
![[插图/学战都市Asterisk 01 姬焰邂逅/co4.jpg]]
*图：全彩对峙插页——决斗开端，尤莉丝展开火炎阵地*

---

### 全彩目录插画：Contents
![[插图/学战都市Asterisk 01 姬焰邂逅/co5.jpg]]
*图：全彩目录插图*

---

### 水上都市学园「六花」Asterisk 宏观地图与六大学园校徽
![[插图/学战都市Asterisk 01 姬焰邂逅/co6.jpg]]
*图：六花水上都市全景图解——六大水上学园相对位置与六大校徽*

> [!TIP] 🏛️ 六花地理与校徽深度考据联动
> - 完整高清校徽与学园档案见：[[02_六大水上学园/星导馆学园(Seidoukan)|星导馆学园]] | [[02_六大水上学园/雷渥夫黑学园(Le Wolfe)|雷渥夫黑学园]] | [[02_六大水上学园/界龙第七学院(Jie Long)|界龙第七学院]] | [[02_六大水上学园/圣嘉莱多瓦思学园(St. Galahadworth)|圣嘉莱多瓦思学园]] | [[02_六大水上学园/葵恩薇儿女学园(Queenvale)|葵恩薇儿女学园]] | [[02_六大水上学园/阿勒坎特学园(Allekant)|阿勒坎特学园]]
> - 宏观地理论文见：[[01_世界观与核心规则/水上学园都市六花(Asterisk)地理论|六花地理论]]

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

## ✍️ 卷首读者批注与第一印象笔记

> [!NOTE] 💡 卷首初印象与角色外观批注（点击此处直接输入）
> - 

> [!CHECK] 🌐 卷首世界书待提炼条目（点击打勾或追加）
> - [ ] 提炼【水上学园都市六花】基本几何结构与行政区划
> - [ ] 确认【六大学园校徽】与所属统合企业财团对应关系

---
> **下一步**：[[第一卷_00_序幕_倏然疾风|⏭️ 前往：序幕 倏然疾风（正文开始）]]
"""
    return md

def build_index_nav_note():
    md = """# 《学战都市Asterisk》第一卷·正文精读与世界书整理总览

> 标签：#学战都市 #第一卷 #正文精读 #世界书整理 #精读导航

欢迎进入《学战都市Asterisk》第一卷《姬焰邂逅》正文精读与评注工作台！
本卷所有章节正文均已完整导入 Markdown 笔记，配备**官方原版高清插图内嵌**，并在各幕转场及章末设置了**即点即写的读者评注卡片**，方便您在阅读正文的同时记录心得、提取设定，随时与 AI 一同汇总为高质量的世界书条目。

---

## 📖 全卷章节目录与阅读打卡

| 序号 | 章节名称 | 核心角色 | 对应插图 | 阅读进度 | 快速链接 |
| :---: | :--- | :--- | :--- | :---: | :--- |
| **00** | **全彩插图与卷首设定** | 绫斗、尤莉丝、纱夜、克劳蒂雅 | 封面 + co1~co6 (全彩) | [ ] 已读 | [[00_第一卷_彩页插图与卷首设定|打开卷首彩页]] |
| **00** | **序幕 倏然疾风** | 天雾绫斗、尤莉丝 | — | [ ] 已读 | [[第一卷_00_序幕_倏然疾风|阅读序幕]] |
| **01** | **第一章 华焰魔女** | 绫斗、尤莉丝、克劳蒂雅 | 001.jpg (决斗对峙) | [ ] 已读 | [[第一卷_01_第一章_华焰魔女|阅读第一章]] |
| **02** | **第二章 学战都市** | 绫斗、夜吹英士郎、克劳蒂雅 | 002.jpg (教室), 003.jpg (会长室) | [ ] 已读 | [[第一卷_02_第二章_学战都市|阅读第二章]] |
| **03** | **第三章 凛凛眼神** | 绫斗、沙沙宫纱夜、尤莉丝 | 004.jpg (重炮纱夜) | [ ] 已读 | [[第一卷_03_第三章_凛凛眼神|阅读第三章]] |
| **04** | **第四章 回忆与重逢** | 绫斗、纱夜、尤莉丝 | 005.jpg (长椅谈心), 006.jpg (食堂) | [ ] 已读 | [[第一卷_04_第四章_回忆与重逢|阅读第四章]] |
| **05** | **第五章 黑炉魔剑** | 绫斗、克劳蒂雅、英士郎 | 007.jpg (黑炉认主) | [ ] 已读 | [[第一卷_05_第五章_黑炉魔剑|阅读第五章]] |
| **06** | **第六章 两人的假日** | 绫斗、尤莉丝 | 008.jpg (假日试衣) | [ ] 已读 | [[第一卷_06_第六章_两人的假日|阅读第六章]] |
| **07** | **第七章 解放者** | 绫斗、尤莉丝、刺客群 | 009.jpg (遇袭), 010.jpg (白刃解封) | [ ] 已读 | [[第一卷_07_第七章_解放者|阅读第七章]] |
| **08** | **终章 并肩之誓** | 绫斗、尤莉丝、纱夜、会长 | — | [ ] 已读 | [[第一卷_08_终章_并肩之誓|阅读终章]] |
| **09** | **后记与世界观解说** | 三屋咲悠、okiura | 011.jpg (致谢), 012.jpg (世界观图解) | [ ] 已读 | [[第一卷_09_后记与世界观解说|阅读后记解说]] |

---

## ✍️ 第一卷全卷读者总评工作区

> [!NOTE] 💡 第一卷阅读总评与叙事节奏感想（点击此处即可编辑）
> - 

> [!TIP] ⚔️ 第一卷核心战力与世界观规则提炼总纲
> - 

> [!EXAMPLE] 👤 主要角色好感轨迹与性格弧光总结
> - 

---

## 🌐 第一卷世界书核心词条提炼待办清单

> 此处汇总第一卷关键专有名词与核心设定，阅读完毕后我们将在此逐项整理入库：

### 1. 人物类词条
- [ ] 【天雾绫斗】星导馆特待生、天雾辰明流古流体术、身体深层三道封印
- [ ] 【尤莉丝·爱雷克西亚·冯·里斯妃特】莱泽塔尼亚第一皇女、〈华焰魔女〉、序列五、原初火炎具现
- [ ] 【沙沙宫纱夜】机械开发学者之女、重型煌式武装射手、青梅竹马
- [ ] 【克劳蒂雅·恩菲尔德】星导馆学生会长、银河财团高管千金、潘朵拉持有人
- [ ] 【夜吹英士郎】新闻社情报通、天雾绫斗室友、水下暗桩

### 2. 武器与机制类词条
- [ ] 【煌式武装】万应矿驱动的核心兵器，发动体与星辰力结合展开光刃/光弹
- [ ] 【纯星煌式武装】核心为高纯度万应矿「赤霞」等的特异武装，具备自我意识与严苛相适度判定
- [ ] 【黑炉魔剑(Ser-Veresta)】大剑型纯星煌式武装，万度白刃，斩断并蒸发一切
- [ ] 【白姬之花】尤莉丝专属细剑型煌式武装，火炎魔术引导媒介
- [ ] 【校徽破坏判定】星导馆校徽内置防御力场，被彻底击碎即判定决斗战败

### 3. 世界观与势力类词条
- [ ] 【落星雨(Invertia)】二十世纪的流星雨灾难，带来未知元素「万应素」并导致旧秩序崩溃
- [ ] 【万应素(Mana)】改变地球环境的未知微粒子，催生了具备超常体能与能力的「星脉世代」
- [ ] 【统合企业财团(VMM)】取代旧国家统治世界的六大超级跨国联合财团
- [ ] 【星武祭(Festas)】六大学园在六花共同举办的世界级综合战斗演艺盛事（凤凰、狮鹫、王龙）

---
> **开始精读**：[[第一卷_00_序幕_倏然疾风|🚀 进入序幕：倏然疾风]]
"""
    return md

def main():
    print(f"Opening EPUB: {EPUB_PATH}")
    with zipfile.ZipFile(EPUB_PATH, "r") as z:
        # 1. Generate Color Illustrations & Intro Note
        color_note_path = os.path.join(OUTPUT_DIR, "00_第一卷_彩页插图与卷首设定.md")
        color_md = build_color_illustrations_note(z)
        with open(color_note_path, "w", encoding="utf-8") as f:
            f.write(color_md)
        print(f"Generated: {color_note_path} ({len(color_md)} chars)")
        
        # 2. Generate Index & Navigation Note
        index_note_path = os.path.join(OUTPUT_DIR, "00_第一卷_正文精读与评注导航.md")
        index_md = build_index_nav_note()
        with open(index_note_path, "w", encoding="utf-8") as f:
            f.write(index_md)
        print(f"Generated: {index_note_path} ({len(index_md)} chars)")
        
        # 3. Generate all chapter notes
        for ch_info in CHAPTERS_INFO:
            out_file = os.path.join(OUTPUT_DIR, ch_info["file"])
            ch_md = parse_xhtml_to_markdown(z, ch_info)
            with open(out_file, "w", encoding="utf-8") as f:
                f.write(ch_md)
            print(f"Generated: {out_file} ({len(ch_md)} chars)")

    # 4. Clean up / archive old txt and summary files so they don't confuse the user
    old_txt_dir = os.path.join(OUTPUT_DIR, "分章正文txt")
    old_comment_dir = os.path.join(OUTPUT_DIR, "分章点评与评注")
    archive_dir = os.path.join(OUTPUT_DIR, "_原始txt与AI初评草稿归档")
    os.makedirs(archive_dir, exist_ok=True)
    
    if os.path.exists(old_txt_dir):
        dest = os.path.join(archive_dir, "分章正文txt")
        if os.path.exists(dest):
            shutil.rmtree(dest)
        shutil.move(old_txt_dir, dest)
        print("Moved old txt folder to archive.")
        
    if os.path.exists(old_comment_dir):
        dest = os.path.join(archive_dir, "分章点评与评注")
        if os.path.exists(dest):
            shutil.rmtree(dest)
        shutil.move(old_comment_dir, dest)
        print("Moved old commentary folder to archive.")

    print("\nAll Volume 1 full text chapters generated successfully!")

if __name__ == "__main__":
    main()
