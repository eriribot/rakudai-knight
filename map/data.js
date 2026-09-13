/**
 * 落第骑士英雄谭 - WORLD ATLAS 数据中心 (实景二次元东京地图版本)
 * 精确锚定东京都、多摩地区、新宿区、千代田区与奥多摩真实经纬度
 */

const RAKUDAI_WORLD_DATA = {
  currentStatus: {
    region: "东京都 · 破军学园 (多摩)",
    weather: "晴朗 24℃",
    date: "10月12日 (周六)",
    scaleText: "21个地点 · 关东全域",
    anchorText: "驻留点：破军学园"
  },

  // 侧边栏层级列表结构（对标圣地巡礼地图册的树状导航）
  groups: [
    {
      id: "tokyo_group",
      name: "东京",
      subTitle: "23区 + 多摩 · 可自由缩放",
      count: 21,
      tag: "主舞台",
      expanded: true,
      clusters: [
        {
          id: "hagun_cluster",
          title: "破军学园核心校区",
          region: "多摩丘陵 · 八王子市",
          count: 12,
          placeIds: [
            "hagun_main", "hagun_arena_1", "hagun_arena_4", "hagun_arena_6",
            "hagun_student_council", "hagun_director_office", "hagun_dorm_1",
            "hagun_dorm_2", "hagun_gate", "hagun_slope", "hagun_station", "hagun_trail"
          ]
        },
        {
          id: "suburb_cluster",
          title: "破军周边生活圈",
          region: "八王子 · 立川 · 多摩中心",
          count: 4,
          placeIds: ["old_ayatsuji_dojo", "family_restaurant", "shopping_mall", "shishido_hospital"]
        },
        {
          id: "metro_cluster",
          title: "东京都心与地下暗层",
          region: "新宿区 · 千代田区秋叶原",
          count: 3,
          placeIds: ["shinjuku_league_hq", "shinjuku_underground_colosseum", "akihabara_street"]
        },
        {
          id: "okutama_cluster",
          title: "西多摩与奥多摩深山",
          region: "西多摩郡奥多摩町 · 御岳",
          count: 3,
          placeIds: ["okutama_camp", "storm_shelter_cabin", "nene_gravity_crater"]
        }
      ]
    },
    {
      id: "osaka_group",
      name: "大阪",
      subTitle: "湾岸海埔新生地 · 巨蛋赛场",
      count: 8,
      tag: "七星剑武祭",
      expanded: false,
      clusters: [
        {
          id: "wangan_cluster",
          title: "湾岸海埔新生地",
          region: "大阪港 · 咲洲宇宙广场",
          count: 5,
          placeIds: ["wangan_dome", "wangan_station", "athlete_hotel", "capsule_center", "operation_office"]
        },
        {
          id: "osaka_downtown",
          title: "大阪市中心老街",
          region: "道顿堀 · 心斋桥 · 新大阪",
          count: 3,
          placeIds: ["dotonbori_food", "shin_osaka_station", "bukyoku_hq"]
        }
      ]
    },
    {
      id: "national_group",
      name: "全国",
      subTitle: "北斗七星骑士名校网络",
      count: 14,
      tag: "各大名门",
      expanded: false,
      clusters: [
        {
          id: "seven_academies",
          title: "北斗七校本部",
          region: "关东 · 东北 · 北海道 · 近畿 · 九州",
          count: 8,
          placeIds: []
        }
      ]
    }
  ],

  // 具体点位明细 (精确对应真实东京地图坐标)
  places: [
    // --- 破军学园核心校区 (真实坐标：东京都八王子/多摩丘陵，占地10个东京巨蛋) ---
    {
      id: "hagun_main",
      name: "破军学园 (正门本部)",
      clusterId: "hagun_cluster",
      type: "facility",
      lat: 35.6528,
      lng: 139.3420, // 八王子丘陵广阔校区
      isMainAnchor: true,
      tag: "学园中枢",
      slogan: "剑が繋ぐ、俺たちの青春——",
      characters: ["黑铁一辉", "史黛菈·法米利昂", "新宫寺黑乃", "东堂刀华"],
      bookRef: "第1卷 序章",
      shortDesc: "占地约十座东京巨蛋的广大骑士学园，一辉与史黛菈英雄谭的起点。",
      fullDesc: "坐落于东京都多摩丘陵，依山傍水。新任理事长新宫寺黑乃推行实力选拔战改革，为无魔力劣等生黑铁一辉打破了血统桎梏。",
      thumb: "assets/hagun_campus_hero.jpg"
    },
    {
      id: "hagun_arena_1",
      name: "第一训练场 (巨蛋竞技场)",
      clusterId: "hagun_cluster",
      type: "facility",
      lat: 35.6565,
      lng: 139.3480,
      tag: "决战擂台",
      characters: ["黑铁一辉", "东堂刀华"],
      bookRef: "第3卷 第四章",
      shortDesc: "校内最大室内穹顶竞技场，一辉以「一刀罗刹」力克东堂刀华「雷切」之地。",
      fullDesc: "配备顶级防魔结界的环形挑高巨蛋。在全校狂热呐喊中，一辉在此逆袭突破自身极限，赢得了通往七星剑武祭的出赛代表权。",
      thumb: "assets/p3.jpg"
    },
    {
      id: "hagun_arena_4",
      name: "第四训练场 (露天演习场)",
      clusterId: "hagun_cluster",
      type: "facility",
      lat: 35.6510,
      lng: 139.3360,
      tag: "契约之战",
      characters: ["黑铁一辉", "史黛菈·法米利昂"],
      bookRef: "第1卷 序章",
      shortDesc: "开学首日一辉与史黛菈模拟战交锋地，F级无冕剑王一击斩落A级红莲皇女。",
      fullDesc: "开阔的露天演习场地。面对史黛菈漫天狂暴的龙之火焰，一辉凭借完全看破其斩击轨迹的自研剑术一招制胜。",
      thumb: "assets/no1.jpg"
    },
    {
      id: "hagun_arena_6",
      name: "第六训练场 (看台赛场)",
      clusterId: "hagun_cluster",
      type: "facility",
      lat: 35.6580,
      lng: 139.3400,
      tag: "选拔赛场",
      characters: ["黑铁一辉", "绫辻绚濑"],
      bookRef: "第2卷 第四章",
      shortDesc: "选拔战第11轮，一辉破除绚濑「风之陷阱」并传授绫辻一刀流奥义之地。",
      fullDesc: "带有金属铁网护栏的实战擂台。绚濑在此布满隐形风刃陷阱，一辉看破后以身涉险，用手中的木刀唤醒了其剑士尊严。",
      thumb: "assets/p2.jpg"
    },
    {
      id: "hagun_student_council",
      name: "学生会本部大楼",
      clusterId: "hagun_cluster",
      type: "facility",
      lat: 35.6545,
      lng: 139.3465,
      tag: "精锐中枢",
      characters: ["东堂刀华", "御祓泡沫", "贵德原彼方", "兔丸恋恋", "碎城雷"],
      bookRef: "第3卷 第一章",
      shortDesc: "东堂刀华常驻的洋风行政大楼，破军最强学生干部们的战略与日常基地。",
      fullDesc: "沙发上总堆着刀华老家寄来的新鲜番茄与黄瓜，御祓泡沫在此品茶谈天，见证了破军学园秩序与荣耀的维护。",
      thumb: "assets/p2.jpg"
    },
    {
      id: "hagun_director_office",
      name: "理事长室 (校舍顶层)",
      clusterId: "hagun_cluster",
      type: "facility",
      lat: 35.6538,
      lng: 139.3440,
      tag: "最高全景",
      characters: ["新宫寺黑乃", "西京宁音"],
      bookRef: "第1卷 第一章",
      shortDesc: "新宫寺黑乃带落地巨窗的顶层办公室，俯瞰整个多摩丘陵与校内选拔擂台。",
      fullDesc: "常年弥漫着清凉薄荷香烟气息的威严房间。新宫寺黑乃在此顶住黑铁本家政界压力，坚定推行「靠剑说话」的晋级规则。",
      thumb: "assets/p6.jpg"
    },
    {
      id: "hagun_dorm_1",
      name: "第一学生宿舍 (405室)",
      clusterId: "hagun_cluster",
      type: "facility",
      lat: 35.6495,
      lng: 139.3385,
      tag: "同居寝室",
      characters: ["黑铁一辉", "史黛菈·法米利昂"],
      bookRef: "第1卷 序章",
      shortDesc: "一辉与史黛菈命运相遇的405号寝室，三坪大房间＋两层式床铺。",
      fullDesc: "第一学生宿舍405号室，三坪大房间＋两层式床铺。因电脑重名失误将男女王牌误分至同一间寝室，引发出撞见更衣决斗名场面。房内挂着一辉晨练竹剑与史黛菈的皇室饰物。",
      thumb: "assets/p1.jpg"
    },
    {
      id: "hagun_dorm_2",
      name: "第二学生宿舍",
      clusterId: "hagun_cluster",
      type: "facility",
      lat: 35.6550,
      lng: 139.3350,
      tag: "女子宿舍",
      characters: ["黑铁珠雫", "有栖院凪"],
      bookRef: "第1卷 第一章",
      shortDesc: "黑铁珠雫与有栖院凪（爱丽丝）所住的宿舍楼，与第一宿舍隔校舍相对立。",
      fullDesc: "珠雫在房中贴满了哥哥一辉的剪报相片，有栖院则优雅地在阳台沏红茶，两人共同在此见证一辉的一步步崛起。",
      thumb: "assets/p6.jpg"
    },
    {
      id: "hagun_gate",
      name: "校门前广场",
      clusterId: "hagun_cluster",
      type: "facility",
      lat: 35.6480,
      lng: 139.3430,
      tag: "集合接头点",
      characters: ["黑铁一辉", "史黛菈", "黑铁珠雫", "有栖院凪"],
      bookRef: "第1卷 第三章",
      shortDesc: "高耸雕花大铁门前的广场，周末四人外出看电影聚会的接头地点。",
      fullDesc: "连接长坡道与学园腹地的正门。在这里，精心打扮的珠雫与傲娇吃醋的史黛菈多次为争夺一辉身旁的位置引发名场面。",
      thumb: "assets/p1.jpg"
    },
    {
      id: "hagun_slope",
      name: "一公里长坡道",
      clusterId: "hagun_cluster",
      type: "story",
      lat: 35.6435,
      lng: 139.3455,
      tag: "誓约之路",
      characters: ["黑铁一辉", "全校师生"],
      bookRef: "第3卷 第四章",
      shortDesc: "连接车站与校门的林荫长缓坡，晨跑路线与第3卷全校师生夹道守候的泪目之路。",
      fullDesc: "长达一公里的长坡。被伦理委员会折磨至肺部窒息脱力的一辉在此一步步向上攀爬，坡道两旁站满了前来为他加油护航的同窗。",
      thumb: "assets/p1.jpg"
    },
    {
      id: "hagun_station",
      name: "学园专属单线电车站",
      clusterId: "hagun_cluster",
      type: "facility",
      lat: 35.6385,
      lng: 139.3480,
      tag: "单轨终点",
      characters: ["黑铁一辉", "电车站长"],
      bookRef: "第3卷 第四章",
      shortDesc: "离破军最近的电车站，平日几乎仅有学园师生进出。",
      fullDesc: "单轨电车驶入的静谧站台。选拔战决赛清晨，身受重伤的一辉踉跄走出车门，站长震惊目睹这位被媒体污名化的少年决然踏向战场。",
      thumb: "assets/p6.jpg"
    },
    {
      id: "hagun_trail",
      name: "学园后山步道",
      clusterId: "hagun_cluster",
      type: "nature",
      lat: 35.6590,
      lng: 139.3320,
      tag: "挥剑深林",
      characters: ["黑铁一辉", "史黛菈·法米利昂", "绫辻绚濑"],
      bookRef: "第1卷 序章",
      shortDesc: "丘陵山林间的幽静石阶，一辉每日清晨负重慢跑、挥剑万次的修行之地。",
      fullDesc: "多摩丘陵茂盛的杂木林。常年遭受家族冷落的一辉多年来在此孤独打磨剑术，后来这里成为史黛菈与绚濑加入的晨练道。",
      thumb: "assets/p5.jpg"
    },

    // --- 破军周边生活圈 (八王子 · 立川 · 多摩中心) ---
    {
      id: "old_ayatsuji_dojo",
      name: "旧绫辻剑道场",
      clusterId: "suburb_cluster",
      type: "story",
      lat: 35.6420,
      lng: 139.3250, // 八王子老街区
      tag: "武家名门",
      characters: ["绫辻海斗", "绫辻绚濑", "黑铁一辉", "仓敷藏人"],
      bookRef: "第2卷 第四章",
      shortDesc: "「最后武士」绫辻海斗宗家道场，放学步行可达的传统武家古宅街区。",
      fullDesc: "白墙黑瓦的传统剑道场。曾遭贪狼王牌仓敷藏人及其同伙泼漆强占破坏，后由一辉持木刀踢馆，击败藏人替绚濑夺回尊严。",
      thumb: "assets/p2.jpg"
    },
    {
      id: "family_restaurant",
      name: "平价家庭餐厅",
      clusterId: "suburb_cluster",
      type: "story",
      lat: 35.6370,
      lng: 139.3520, // 车站前商街
      tag: "挑衅冲突",
      characters: ["黑铁一辉", "史黛菈", "绫辻绚濑", "仓敷藏人"],
      bookRef: "第2卷 第一章",
      shortDesc: "车站前萨莉亚风格平价餐厅，藏人突然现身以啤酒瓶暴击一辉后脑勺处。",
      fullDesc: "三人训练后大快朵颐排餐时，贪狼学园仓敷藏人从吸烟区狂暴闯入，以酒瓶挑衅一辉，一辉顾全大局未在店内拔刀违规。",
      thumb: "assets/p3.jpg"
    },
    {
      id: "shopping_mall",
      name: "多摩大型购物中心",
      clusterId: "suburb_cluster",
      type: "story",
      lat: 35.6880,
      lng: 139.4180, // 立川/多摩商圈 (如LaLaport立川立飞风格)
      tag: "四人约会",
      characters: ["黑铁一辉", "史黛菈", "黑铁珠雫", "有栖院凪"],
      bookRef: "第1卷 第三章",
      shortDesc: "全国规模商城，1F极品鲜奶油可丽饼、4F电影院的约会名场面圣地。",
      fullDesc: "宽阔的现代化购物大厦。有栖院强烈推荐了一楼的美食街甜点，史黛菈与珠雫一路争夺一辉视线，洋溢着青春的日常喧闹。",
      thumb: "assets/p6.jpg"
    },
    {
      id: "shishido_hospital",
      name: "宍户综合医院",
      clusterId: "suburb_cluster",
      type: "facility",
      lat: 35.6260,
      lng: 139.3120, // 八王子医疗中心一带，电车约15分钟
      tag: "重症看护",
      characters: ["绫辻绚濑", "绫辻海斗", "凉香姑姑"],
      bookRef: "第2卷 第二章",
      shortDesc: "离破军最近的公立综合大医院，绫辻海斗病重昏睡住院处 (515单人房)。",
      fullDesc: "盛夏阳光下耀眼洁白的高楼。绚濑在选拔战期间常来此看望陷入昏迷的父亲，并在病榻前暗暗立下夺回道场与荣耀的重誓。",
      thumb: "assets/p6.jpg"
    },

    // --- 东京都心与地下暗层 (新宿区 · 千代田区秋叶原) ---
    {
      id: "shinjuku_league_hq",
      name: "国际魔法骑士联盟 · 日本分部",
      clusterId: "metro_cluster",
      type: "facility",
      lat: 35.6895,
      lng: 139.6917, // 西新宿摩天楼群
      tag: "联盟总部",
      characters: ["黑铁严", "月影总理"],
      bookRef: "第3卷 第二章",
      shortDesc: "西新宿摩天大楼群中约30层高耸大厦，日本分部长·黑铁严办公室所在。",
      fullDesc: "全日本伐刀者司法与政治最高中枢。黑铁严在此彻夜掌控伦理委员会，并代表联盟与法米利昂皇室展开外交博弈。",
      thumb: "assets/p3.jpg"
    },
    {
      id: "shinjuku_underground_colosseum",
      name: "新宿地下斗技场",
      clusterId: "metro_cluster",
      type: "battle",
      lat: 35.6955,
      lng: 139.7025, // 歌舞伎町地下深层
      tag: "黑市擂台",
      characters: ["东堂刀华", "御祓泡沫"],
      bookRef: "第16卷",
      shortDesc: "新宿商业闹区地下的非法伐刀者赌博死斗场，被刀华与泡沫雷霆端掉。",
      fullDesc: "暗无天日的地下犯罪网络。御祓泡沫发动「绝对不确定性」黑盒导航，东堂刀华以雷霆万钧的「雷切」突入敌阵将其一举剿灭。",
      thumb: "assets/p3.jpg"
    },
    {
      id: "akihabara_street",
      name: "秋叶原电气街",
      clusterId: "metro_cluster",
      type: "facility",
      lat: 35.6983,
      lng: 139.7731, // 秋叶原JR站前
      tag: "阿宅圣地",
      characters: ["有栖院凪"],
      bookRef: "第零卷",
      shortDesc: "有栖院凪为排队购买催泪乙女神作《私立王子学园》通宵熬夜排队地。",
      fullDesc: "霓虹闪烁的御宅文化中心。平日冷峻神秘的刺客爱丽丝在此彻夜驻足排队，买下游戏后在破军学生会激动地安利所有人。",
      thumb: "assets/p6.jpg"
    },

    // --- 西多摩与奥多摩深山 (东京都西多摩郡奥多摩町) ---
    {
      id: "okutama_camp",
      name: "破军学园 · 奥多摩集训场",
      clusterId: "okutama_cluster",
      type: "battle",
      lat: 35.8080,
      lng: 139.0950, // 奥多摩深山原始林
      tag: "深山遇袭",
      characters: ["黑铁一辉", "史黛菈", "东堂刀华", "平贺玲泉", "黑铁王马"],
      bookRef: "第3卷 第二章",
      shortDesc: "破军管理的森林高山集训设施，著名「奥多摩巨人石偶事件」发生地。",
      fullDesc: "原始针叶林与险峰密布的封闭集训场。晓学园平贺玲泉操纵岩石巨偶发起伏击，黑铁王马携狂暴风岚从天而降，展露压倒性实力。",
      thumb: "assets/p5.jpg"
    },
    {
      id: "storm_shelter_cabin",
      name: "暴风雨避难小木屋",
      clusterId: "okutama_cluster",
      type: "nature",
      lat: 35.8010,
      lng: 139.1150,
      tag: "避雨誓约",
      characters: ["黑铁一辉", "史黛菈·法米利昂"],
      bookRef: "第3卷 第二章",
      shortDesc: "奥多摩山林避险小木屋，一辉背负受寒的史黛菈避雨生火的温情之处。",
      fullDesc: "倾盆狂风暴雨中伫立的木造小屋。二人在此依偎取暖，一辉恪守绅士之礼，许下了必将堂堂正正见她双亲提亲的郑重誓言。",
      thumb: "assets/p5.jpg"
    },
    {
      id: "nene_gravity_crater",
      name: "西京宁音重力特训坑",
      clusterId: "okutama_cluster",
      type: "battle",
      lat: 35.7920,
      lng: 139.1350,
      tag: "黑洞引力",
      characters: ["西京宁音", "史黛菈·法米利昂"],
      bookRef: "第8卷 第二章",
      shortDesc: "世界第三夜叉姬为史黛菈施加数十倍超重力、觉醒龙神火力的地狱试炼地。",
      fullDesc: "被重力撕裂塌陷的荒芜采石谷。宁音毫不留情布下拟似黑洞引力场，逼迫史黛菈在生死边缘撕碎魔力瓶颈，觉醒魔人之姿。",
      thumb: "assets/no4.jpg"
    }
  ],

  views: {
    tokyo: {
      center: [35.6600, 139.4200],
      zoom: 11
    },
    kanto: {
      center: [35.6600, 139.4200],
      zoom: 11
    },
    hagun: {
      center: [35.6528, 139.3420],
      zoom: 14
    },
    shinjuku: {
      center: [35.6930, 139.7000],
      zoom: 13
    },
    okutama: {
      center: [35.8050, 139.1100],
      zoom: 12
    }
  }
};
