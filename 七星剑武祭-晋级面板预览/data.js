// 根据《世界观/七星剑武祭考据/32强分区与赛制.md》整理。
// slot 仅为展示位置。winner 记录已知晋级者；bye/cancelled/unknown 均不能渲染成实战 WIN。
window.TOURNAMENT_DATA = {
  "players": {
    "ikki": {
      "name": "黑铁一辉",
      "school": "破军学园",
      "unnamed": false
    },
    "stella": {
      "name": "史黛菈·法米利昂",
      "school": "破军学园",
      "unnamed": false
    },
    "ouma": {
      "name": "黑铁王马",
      "school": "晓学园",
      "unnamed": false
    },
    "amane": {
      "name": "紫乃宫天音",
      "school": "晓学园",
      "unnamed": false
    },
    "shizuku": {
      "name": "黑铁珠雫",
      "school": "破军学园",
      "unnamed": false
    },
    "sara": {
      "name": "莎拉·布拉德莉莉",
      "school": "晓学园",
      "unnamed": false
    },
    "byakuya": {
      "name": "城之崎白夜",
      "school": "武曲学园",
      "unnamed": false
    },
    "moroboshi": {
      "name": "诸星雄大",
      "school": "武曲学园",
      "unnamed": false
    },
    "kurado": {
      "name": "仓敷藏人",
      "school": "贪狼学园",
      "unnamed": false
    },
    "momiji": {
      "name": "浅木椛",
      "school": "武曲学园",
      "unnamed": false
    },
    "kiriko": {
      "name": "药师雾子",
      "school": "廉贞学园",
      "unnamed": false
    },
    "kaga": {
      "name": "加我恋司",
      "school": "禄存学园",
      "unnamed": false
    },
    "hiraga": {
      "name": "平贺玲泉",
      "school": "晓学园",
      "identityNote": "原著身份揭秘：平贺是欧尔·格尔远程操纵的机关人偶中继站。这里显示的是参赛人偶；人偶被毁不等于欧尔本人死亡。依据第6卷第五章、第11卷第八章。",
      "unnamed": false
    },
    "rinna": {
      "name": "风祭凛奈",
      "school": "晓学园",
      "unnamed": false
    },
    "tatara": {
      "name": "多多良幽衣",
      "school": "晓学园",
      "unnamed": false
    },
    "mikoto": {
      "name": "鹤屋美琴",
      "school": "巨门学园",
      "unnamed": false
    },
    "komashiro": {
      "name": "驹城",
      "school": "文曲学园",
      "unnamed": false
    },
    "niitome": {
      "name": "新留",
      "school": "廉贞学园",
      "unnamed": false
    },
    "a1": {
      "name": "未具名选手 A-1",
      "school": "学园未详",
      "unnamed": true
    },
    "a2": {
      "name": "未具名选手 A-2",
      "school": "学园未详",
      "unnamed": true
    },
    "a3": {
      "name": "未具名选手 A-3",
      "school": "学园未详",
      "unnamed": true
    },
    "a4": {
      "name": "未具名选手 A-4",
      "school": "学园未详",
      "unnamed": true
    },
    "a5": {
      "name": "未具名选手 A-5",
      "school": "学园未详",
      "unnamed": true
    },
    "a6": {
      "name": "未具名选手 A-6",
      "school": "学园未详",
      "unnamed": true
    },
    "b1": {
      "name": "未具名选手 B-1",
      "school": "学园未详",
      "unnamed": true
    },
    "c1": {
      "name": "未具名选手 C-1",
      "school": "学园未详",
      "unnamed": true
    },
    "c2": {
      "name": "未具名选手 C-2",
      "school": "学园未详",
      "unnamed": true
    },
    "c3": {
      "name": "未具名选手 C-3",
      "school": "学园未详",
      "unnamed": true
    },
    "d1": {
      "name": "未具名选手 D-1",
      "school": "学园未详",
      "unnamed": true
    },
    "d2": {
      "name": "未具名选手 D-2",
      "school": "学园未详",
      "unnamed": true
    },
    "d3": {
      "name": "未具名选手 D-3",
      "school": "学园未详",
      "unnamed": true
    },
    "d4": {
      "name": "未具名选手 D-4",
      "school": "学园未详",
      "unnamed": true
    }
  },
  "regions": [
    {
      "id": "A",
      "name": "A区",
      "accent": "cyan",
      "summary": "王马与加我各自晋级，在第三轮区决赛相遇。",
      "note": "展示位置按已知晋级关系重排，并非官方抽签顺位。A-1至A-6是六名不同的未具名选手；未知首轮胜者保持空白。卷6含混句不能当成王马与加我第二轮互战。",
      "matches": [
        {
          "id": "a-r1-1",
          "round": 1,
          "slot": 0,
          "p1": "ouma",
          "p2": "a1",
          "winner": "ouma",
          "status": "played",
          "label": "首轮 · 王马胜出",
          "detail": "王马首轮胜出；对手姓名与原始场次未详。未知选手编号只用于展示计数。",
          "evidence": [
            "第6卷 L8–10",
            "第7卷 L3619–3633"
          ],
          "from": []
        },
        {
          "id": "a-r1-2",
          "round": 1,
          "slot": 1,
          "p1": "a2",
          "p2": "a3",
          "winner": null,
          "status": "unknown",
          "label": "首轮 · 赛况未详",
          "detail": "按八席淘汰结构补足的一场对局，双方身份和获胜者未详，不随机指定胜者。",
          "evidence": [
            "第5卷 L4454",
            "第7卷 L3619–3633"
          ],
          "from": []
        },
        {
          "id": "a-r1-3",
          "round": 1,
          "slot": 2,
          "p1": "kaga",
          "p2": "a4",
          "winner": "kaga",
          "status": "played",
          "label": "首轮 · 加我胜出",
          "detail": "加我首轮获得压倒性胜利；对手姓名与原始场次未详。",
          "evidence": [
            "第6卷 L8–10"
          ],
          "from": []
        },
        {
          "id": "a-r1-4",
          "round": 1,
          "slot": 3,
          "p1": "a5",
          "p2": "a6",
          "winner": null,
          "status": "unknown",
          "label": "首轮 · 赛况未详",
          "detail": "按八席淘汰结构补足的一场对局，双方身份和获胜者未详，不随机指定胜者。",
          "evidence": [
            "第5卷 L4454",
            "第7卷 L3459–3461"
          ],
          "from": []
        },
        {
          "id": "a-r2-1",
          "round": 2,
          "slot": 0,
          "p1": "ouma",
          "p2": null,
          "winner": "ouma",
          "status": "played",
          "label": "首轮胜者未具名",
          "detail": "王马第二轮晋级，对手是另一场首轮的未具名胜者。不能从A-2、A-3中任意选定其身份。",
          "evidence": [
            "第6卷 L5069",
            "第7卷 L3619–3633"
          ],
          "from": [
            "a-r1-1",
            "a-r1-2"
          ]
        },
        {
          "id": "a-r2-2",
          "round": 2,
          "slot": 1,
          "p1": "kaga",
          "p2": null,
          "winner": "kaga",
          "status": "played",
          "label": "首轮胜者未具名",
          "detail": "加我第二轮晋级，对手未具名。结合第三轮的正式对阵还原，不把此轮写成加我对王马。",
          "evidence": [
            "第6卷 L5069",
            "第7卷 L3459–3461",
            "第7卷 L3687–3971"
          ],
          "from": [
            "a-r1-3",
            "a-r1-4"
          ]
        },
        {
          "id": "a-r3-1",
          "round": 3,
          "slot": 0,
          "p1": "ouma",
          "p2": "kaga",
          "winner": "ouma",
          "status": "played",
          "label": "A区决赛 · 王马晋级",
          "detail": "王马击败加我，取得四强资格。加我受重伤后被救回性命。",
          "evidence": [
            "第7卷 L3559",
            "第7卷 L3687–3971",
            "第7卷 L4083"
          ],
          "from": [
            "a-r2-1",
            "a-r2-2"
          ]
        }
      ]
    },
    {
      "id": "B",
      "name": "B区",
      "accent": "red",
      "summary": "首轮第4场改为1对4；其后两人弃权、平贺失格，史黛菈提前出线。",
      "note": "展示顺位不是官方签位，平贺与风祭首轮的先后未确定。特别赛仍只是一场首轮比赛；第二、三轮取消，不能记为史黛菈又赢了两场实战。驹城、新留在原文仅出现姓氏。",
      "matches": [
        {
          "id": "b-r1-1",
          "round": 1,
          "slot": 0,
          "p1": "hiraga",
          "p2": "b1",
          "winner": "hiraga",
          "status": "played",
          "label": "首轮 · 平贺胜出",
          "detail": "平贺已经赢过自己的首轮；对手未具名。其与风祭的首轮先后次序未确定。",
          "evidence": [
            "第5卷 L8139–8141",
            "第6卷 L12",
            "第6卷 L54"
          ],
          "from": []
        },
        {
          "id": "b-r1-2",
          "round": 1,
          "slot": 1,
          "p1": "rinna",
          "p2": "komashiro",
          "winner": "rinna",
          "status": "played",
          "label": "首轮 · 风祭胜出",
          "detail": "风祭以〈兽王威吓〉限制文曲学园驹城的行动并胜出。驹城仅给姓氏；首轮具体场次顺序未确定。",
          "evidence": [
            "第6卷 L12",
            "第6卷 L385"
          ],
          "from": []
        },
        {
          "id": "b-r1-3",
          "round": 1,
          "slot": 2,
          "p1": "tatara",
          "p2": "niitome",
          "winner": "tatara",
          "status": "played",
          "label": "首轮第3场",
          "detail": "多多良击败使用战斧的廉贞学园新留。新留仅给姓氏，不补造全名。",
          "evidence": [
            "第6卷 L261"
          ],
          "from": []
        },
        {
          "id": "b-r1-4",
          "round": 1,
          "slot": 3,
          "p1": "stella",
          "p2": "mikoto",
          "winner": "stella",
          "status": "special",
          "label": "首轮第4场 · 特别1对4",
          "detail": "原定史黛菈对鹤屋，延后后经同意与批准加入平贺、风祭、多多良三名特别成员。史黛菈击败四人，赢得这一场首轮。",
          "evidence": [
            "第5卷 L4627–4647",
            "第5卷 L8219–8259",
            "第6卷 L2491–2501"
          ],
          "from": []
        },
        {
          "id": "b-r2-1",
          "round": 2,
          "slot": 0,
          "p1": "hiraga",
          "p2": "rinna",
          "winner": null,
          "status": "cancelled",
          "label": "第二轮第1场 · 取消",
          "detail": "原定平贺对风祭。风祭主动弃权，平贺因本人未上场的恶意犯规被抹消资格；两人没有在这场交战。",
          "evidence": [
            "第6卷 L54",
            "第6卷 L2501",
            "第6卷 L5028–5036"
          ],
          "from": [
            "b-r1-1",
            "b-r1-2"
          ]
        },
        {
          "id": "b-r2-2",
          "round": 2,
          "slot": 1,
          "p1": "tatara",
          "p2": "stella",
          "winner": null,
          "status": "cancelled",
          "label": "第二轮第2场 · 取消",
          "detail": "多多良经医生判定无法比赛并提交弃权。原定对阵没有举行，不记录为史黛菈的一场实战胜利。",
          "evidence": [
            "第6卷 L2501",
            "第6卷 L5028–5038"
          ],
          "from": [
            "b-r1-3",
            "b-r1-4"
          ]
        },
        {
          "id": "b-r3-1",
          "round": 3,
          "slot": 0,
          "p1": null,
          "p2": "stella",
          "winner": "stella",
          "status": "cancelled",
          "label": "B区决赛取消 · 史黛菈出线",
          "detail": "两人弃权、平贺失格后，史黛菈成为B区仅存的有效参赛者，获委员会确认晋级准决赛。这里只确认出线资格，区决赛没有开打。",
          "evidence": [
            "第6卷 L5038–5042",
            "第6卷 L5173",
            "第7卷 L251–253"
          ],
          "from": [
            "b-r2-1",
            "b-r2-2"
          ]
        }
      ]
    },
    {
      "id": "C",
      "name": "C区",
      "accent": "violet",
      "summary": "一辉依次面对诸星、白夜与莎拉，获得C区出线资格。",
      "note": "展示位置按已知后续对阵重排，不是官方抽签顺位。莎拉与仓敷首轮各自胜出，但第1、2场的先后及对手姓名未详；C-1至C-3是三名不同选手。",
      "matches": [
        {
          "id": "c-r1-1",
          "round": 1,
          "slot": 0,
          "p1": "sara",
          "p2": "c1",
          "winner": "sara",
          "status": "played",
          "label": "首轮 · 莎拉胜出",
          "detail": "莎拉已赢过首轮，原文提及她以〈色彩魔术〉攻击对手。对手姓名及其与仓敷两场的先后未详。",
          "evidence": [
            "第6卷 L5455–5457",
            "第6卷 L5479–5483",
            "第6卷 L5785"
          ],
          "from": []
        },
        {
          "id": "c-r1-2",
          "round": 1,
          "slot": 1,
          "p1": "kurado",
          "p2": "c2",
          "winner": "kurado",
          "status": "played",
          "label": "首轮 · 仓敷胜出",
          "detail": "仓敷已经进入第二轮，首轮对手未具名；本位置只根据下一轮对阵设置。",
          "evidence": [
            "第6卷 L5455–5457",
            "第6卷 L5479–5483"
          ],
          "from": []
        },
        {
          "id": "c-r1-3",
          "round": 1,
          "slot": 2,
          "p1": "byakuya",
          "p2": "c3",
          "winner": "byakuya",
          "status": "played",
          "label": "首轮第3场",
          "detail": "白夜令对手出场外，对手十秒未回，白夜获胜。对手姓名未详。",
          "evidence": [
            "第5卷 L5271"
          ],
          "from": []
        },
        {
          "id": "c-r1-4",
          "round": 1,
          "slot": 3,
          "p1": "ikki",
          "p2": "moroboshi",
          "winner": "ikki",
          "status": "played",
          "label": "首轮第4场",
          "detail": "一辉击败上届冠军诸星雄大，进入第二轮。两人分别代表破军与武曲学园。",
          "evidence": [
            "第5卷 L5263",
            "第5卷 L5393–5395",
            "第5卷 L7768–7794"
          ],
          "from": []
        },
        {
          "id": "c-r2-1",
          "round": 2,
          "slot": 0,
          "p1": "sara",
          "p2": "kurado",
          "winner": "sara",
          "status": "played",
          "label": "第二轮第1场",
          "detail": "莎拉击败仓敷藏人，晋级C区决赛。",
          "evidence": [
            "第6卷 L5479–5483",
            "第6卷 L5705–5707",
            "第6卷 L6577"
          ],
          "from": [
            "c-r1-1",
            "c-r1-2"
          ]
        },
        {
          "id": "c-r2-2",
          "round": 2,
          "slot": 1,
          "p1": "byakuya",
          "p2": "ikki",
          "winner": "ikki",
          "status": "played",
          "label": "第二轮第2场",
          "detail": "一辉击败城之崎白夜，晋级C区决赛。第六卷停在开赛，胜负由第七卷开头确认。",
          "evidence": [
            "第6卷 L6826",
            "第7卷 L14–84"
          ],
          "from": [
            "c-r1-3",
            "c-r1-4"
          ]
        },
        {
          "id": "c-r3-1",
          "round": 3,
          "slot": 0,
          "p1": "sara",
          "p2": "ikki",
          "winner": "ikki",
          "status": "played",
          "label": "C区决赛 · 一辉晋级",
          "detail": "一辉击败莎拉，取得四强资格。",
          "evidence": [
            "第7卷 L4493–4559",
            "第7卷 L6235–6295",
            "第7卷 L6450"
          ],
          "from": [
            "c-r2-1",
            "c-r2-2"
          ]
        }
      ]
    },
    {
      "id": "D",
      "name": "D区",
      "accent": "green",
      "summary": "珠雫在第二轮胜浅木；天音因三次未正式交战的结果进入准决赛。",
      "note": "按已知晋级路线重排，非官方签位。原文把珠雫首轮称第3场、天音对雾子称第4场，却又明确两人在区决赛才相遇；不按编号强行相邻连线。浅木首轮仅能由后续晋级推知，未知对手不随机指定。",
      "matches": [
        {
          "id": "d-r1-1",
          "round": 1,
          "slot": 0,
          "p1": "amane",
          "p2": "kiriko",
          "winner": "amane",
          "status": "bye",
          "label": "首轮 · 雾子急诊缺席",
          "detail": "雾子因医院病患突发急症离场，天音不战而胜。原文称本对阵为D区第4场，本图位置按晋级路线调整。",
          "evidence": [
            "第6卷 L2660–2668",
            "第6卷 L3054",
            "第6卷 L3090–3154",
            "第6卷 L3538–3540"
          ],
          "from": []
        },
        {
          "id": "d-r1-2",
          "round": 1,
          "slot": 1,
          "p1": "d1",
          "p2": "d2",
          "winner": null,
          "status": "unknown",
          "label": "首轮 · 赛况未详",
          "detail": "本场按八席淘汰结构复原。胜者随后对上天音，但无法辨认其身份；不从D-1、D-2中任意指定胜者。",
          "evidence": [
            "第5卷 L4454",
            "第7卷 L6476",
            "第7卷 L6530–6532"
          ],
          "from": []
        },
        {
          "id": "d-r1-3",
          "round": 1,
          "slot": 2,
          "p1": "shizuku",
          "p2": "d3",
          "winner": "shizuku",
          "status": "played",
          "label": "首轮 · 珠雫胜出",
          "detail": "珠雫毫发无伤地击败首轮对手。原文称D区第3场，对手未具名；本图不据场次认定下一轮对手。",
          "evidence": [
            "第6卷 L3540",
            "第6卷 L3624"
          ],
          "from": []
        },
        {
          "id": "d-r1-4",
          "round": 1,
          "slot": 3,
          "p1": "momiji",
          "p2": "d4",
          "winner": "momiji",
          "status": "unknown",
          "label": "首轮 · 浅木赛况未详",
          "detail": "仅根据浅木进入第二轮推知其占有首轮晋级席位。对手和具体过程未写；这里只确认她已经晋级，不能据此认定首轮如何获胜。",
          "evidence": [
            "第7卷 L193–243"
          ],
          "from": []
        },
        {
          "id": "d-r2-1",
          "round": 2,
          "slot": 0,
          "p1": "amane",
          "p2": null,
          "winner": "amane",
          "status": "bye",
          "label": "第二轮 · 对手食物中毒",
          "detail": "天音的未具名对手因食物中毒弃权，天音不战而胜。具体身份未明，不能绑定为D-1或D-2。",
          "evidence": [
            "第7卷 L6476",
            "第7卷 L6530–6532"
          ],
          "from": [
            "d-r1-1",
            "d-r1-2"
          ]
        },
        {
          "id": "d-r2-2",
          "round": 2,
          "slot": 1,
          "p1": "shizuku",
          "p2": "momiji",
          "winner": "shizuku",
          "status": "played",
          "label": "第二轮第2场",
          "detail": "珠雫击败浅木椛，取得D区决赛资格。",
          "evidence": [
            "第7卷 L193–243"
          ],
          "from": [
            "d-r1-3",
            "d-r1-4"
          ]
        },
        {
          "id": "d-r3-1",
          "round": 3,
          "slot": 0,
          "p1": "amane",
          "p2": "shizuku",
          "winner": "amane",
          "status": "bye",
          "label": "D区决赛未开打 · 天音晋级",
          "detail": "珠雫赛前袭击天音失败，双方没有正式入场交战。珠雫被判失格，天音晋级；准备室冲突不是有效的区决赛。",
          "evidence": [
            "第7卷 L6514–6598",
            "第8卷 L737–753"
          ],
          "from": [
            "d-r2-1",
            "d-r2-2"
          ]
        }
      ]
    }
  ],
  "finals": [
    {
      "id": "sf-1",
      "round": 4,
      "slot": 0,
      "p1": "ouma",
      "p2": "stella",
      "winner": "stella",
      "status": "played",
      "label": "准决赛第一场 · A区对B区",
      "detail": "史黛菈击败王马，取得决赛资格。",
      "evidence": [
        "第8卷 L3122–3126"
      ],
      "from": [
        "a-r3-1",
        "b-r3-1"
      ]
    },
    {
      "id": "sf-2",
      "round": 4,
      "slot": 1,
      "p1": "ikki",
      "p2": "amane",
      "winner": "ikki",
      "status": "played",
      "label": "准决赛第二场 · C区对D区",
      "detail": "一辉在正式比赛中获裁判判胜。天音此后失控追击属于赛后事件，不是另一场准决赛。",
      "evidence": [
        "第8卷 L4883–4889"
      ],
      "from": [
        "c-r3-1",
        "d-r3-1"
      ]
    },
    {
      "id": "final",
      "round": 5,
      "slot": 0,
      "p1": "stella",
      "p2": "ikki",
      "winner": "ikki",
      "status": "played",
      "label": "决赛 · 一辉夺冠",
      "detail": "一辉击败史黛菈，获得冠军，史黛菈为亚军。王马因天音严重犯规自动取得季军，原文没有另打一场季军战。",
      "evidence": [
        "第9卷 L5959–5973",
        "第9卷 L7430–7450"
      ],
      "from": [
        "sf-1",
        "sf-2"
      ]
    }
  ],
  "special": {
    "title": "B区首轮第4场 · 史黛菈1对4",
    "participants": [
      "stella",
      "mikoto",
      "hiraga",
      "rinna",
      "tatara"
    ],
    "winner": "stella",
    "detail": "原定史黛菈对鹤屋；已经各赢过首轮的平贺、风祭、多多良作为特别成员加入鹤屋一方。经有关选手同意、委员会许可，史黛菈须击败四人才获胜；鹤屋或任一特别成员击败史黛菈，均视为鹤屋获胜。史黛菈赢下特别战后，另经两人弃权、平贺失格而提前出线；并非一胜自动记作三轮胜利。",
    "evidence": [
      "第5卷 L8139–8141",
      "第5卷 L8219–8239",
      "第6卷 L2491–2501",
      "第6卷 L5028–5042"
    ]
  }
};
