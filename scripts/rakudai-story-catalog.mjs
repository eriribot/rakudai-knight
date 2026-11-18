import firstVolumes from './story/volumes-01-09.json' with { type: 'json' };
import lastVolumes from './story/volumes-10-19.json' with { type: 'json' };

// GBK 原文目录是唯一顺序来源；浏览器产物在构建时内联这些数据和函数。
export const STORY_VOLUMES = [...firstVolumes, ...lastVolumes];
export function getStoryVolume(volume) {
  return Number.isInteger(volume) ? STORY_VOLUMES.find(item => item.volume === volume) || null : null;
}
export function resolveStoryChapter(volume, key) {
  if (typeof key !== 'string' || !key.trim()) return null;
  const chapters = getStoryVolume(volume)?.chapters || [];
  const value = key.trim();
  return chapters.find(chapter => chapter.key === value) ||
    chapters.find(chapter => (chapter.aliases || []).includes(value)) || null;
}
export function firstStoryChapter(volume) {
  return getStoryVolume(volume)?.chapters[0] || null;
}
export function storyPosition(volume, key) {
  const chapter = resolveStoryChapter(volume, key);
  if (!chapter) return -1;
  let offset = 0;
  for (const book of STORY_VOLUMES) {
    if (book.volume === volume) return offset + book.chapters.indexOf(chapter);
    offset += book.chapters.length;
  }
  return -1;
}
export function nextStoryChapter(volume, key) {
  const current = resolveStoryChapter(volume, key), book = getStoryVolume(volume);
  if (!current || !book) return null;
  const next = book.chapters[book.chapters.indexOf(current) + 1];
  if (next) return { volume, chapter: next.key };
  const following = STORY_VOLUMES[STORY_VOLUMES.indexOf(book) + 1];
  return following ? { volume: following.volume, chapter: following.chapters[0].key } : null;
}

// Route is a saved MVU fact. Only the two deliberate hand-off points override
// the catalogue order; every other chapter keeps the ordinary adjacent flow.
export function nextStoryChapterForState(volume, key, state) {
  if (volume === 10 && key === '第二章' && state?.场景?.路线 === 'B') {
    return { volume: 16, chapter: '序章' };
  }
  if (volume === 16 && key === '终章Ⅱ') {
    return { volume: 18, chapter: '第二章' };
  }
  return nextStoryChapter(volume, key);
}

// 学战全17卷固定目录：140个剧情节点，worldbook order 200–339。
// 目录存在不代表正文已就绪；终端与注入器共用世界书可用性检查。
// 第一卷沿用旧存档键；后续卷在章名中带卷号，兼容当前卷为 null 的学战 MVU。
export const ASTERISK_VOLUMES = [{
  volume: 1, title: '第1卷 姬焰邂逅',
  chapters: [
    { key: '序章', title: '序章 倏然疾风', aliases: ['序幕'] },
    { key: '第一章', title: '第一章 华焰魔女', aliases: [] },
    { key: '第二章', title: '第二章 学战都市', aliases: [] },
    { key: '第三章', title: '第三章 凛凛眼神', aliases: [] },
    { key: '第四章', title: '第四章 回忆与重逢', aliases: [] },
    { key: '第五章', title: '第五章 黑炉魔剑', aliases: [] },
    { key: '第六章', title: '第六章 两人的假日', aliases: [] },
    { key: '第七章', title: '第七章 解放者', aliases: [] },
    { key: '终章', title: '终章 并肩之誓', aliases: [] },
  ],
}, {
  volume: 2, title: '第2卷 银绮觉醒',
  chapters: [
    { key: '第一章', title: '第一章 六花园会议', aliases: [] },
    { key: '第二章', title: '第二章 昏枭暗跃', aliases: [] },
    { key: '第三章', title: '第三章 疾风刃雷', aliases: [] },
    { key: '第四章', title: '第四章 错综的思绪', aliases: [] },
    { key: '第五章', title: '第五章 少女素颜', aliases: [] },
    { key: '第六章', title: '第六章 雾中魔手', aliases: [] },
    { key: '第七章', title: '第七章 决意与决斗', aliases: [] },
    { key: '终章', title: '终章 蜀山组队', aliases: [] },
  ],
}, {
  volume: 3, title: '第3卷 凤凰乱武',
  chapters: [
    { key: '第一章', title: '第一章 开幕前夜', aliases: [] },
    { key: '第二章', title: '第二章 凤凰星武祭', aliases: [] },
    { key: '第三章', title: '第三章 阿尔第与莉姆希', aliases: [] },
    { key: '第四章', title: '第四章 吸血暴姬', aliases: [] },
    { key: '第五章', title: '第五章 雷渥夫姐妹', aliases: [] },
    { key: '第六章', title: '第六章 力量与代价', aliases: [] },
    { key: '第七章', title: '第七章 霸溃血镰', aliases: [] },
    { key: '终章', title: '终章 余烬与暗流', aliases: [] },
  ],
}, {
  volume: 4, title: "第4卷 追忆斗破",
  chapters: [
    { key: "第一章", title: "第一章 界龙之主", aliases: [] },
    { key: "第二章", title: "第二章 第五轮对战", aliases: [] },
    { key: "第三章", title: "第三章 来访者", aliases: [] },
    { key: "第四章", title: "第四章 迷惘", aliases: [] },
    { key: "第五章", title: "第五章 姐姐与玩伴", aliases: [] },
    { key: "第六章", title: "第六章 第二个关键", aliases: [] },
    { key: "第七章", title: "第七章 坚决的意志", aliases: [] },
    { key: "终章", title: "终章 看台暗影", aliases: [] },
  ],
}, {
  volume: 5, title: "第5卷 霸凰决战",
  chapters: [
    { key: "第一章", title: "第一章 准决赛第一回合", aliases: [] },
    { key: "第二章", title: "第二章 恶辣的操偶线", aliases: [] },
    { key: "第三章", title: "第三章 准决赛第二回合", aliases: [] },
    { key: "第四章", title: "第四章 奔走", aliases: [] },
    { key: "第五章", title: "第五章 偶然邂逅", aliases: [] },
    { key: "第六章", title: "第六章 双方的决战", aliases: [] },
    { key: "第七章", title: "第七章 后夜祭", aliases: [] },
    { key: "终章", title: "终章 沉睡的姐姐", aliases: [] },
  ],
}, {
  volume: 6, title: "第6卷 怀国凯战",
  chapters: [
    { key: "第一章", title: "第一章 各自的序章", aliases: [] },
    { key: "第二章", title: "第二章 亲爱的人们", aliases: [] },
    { key: "第三章", title: "第三章 莱泽塔尼亚", aliases: [] },
    { key: "第四章", title: "第四章 尤莉丝与孤儿院", aliases: [] },
    { key: "第五章", title: "第五章 《孤毒魔女》", aliases: [] },
    { key: "第六章", title: "第六章 魔龙讨伐", aliases: [] },
    { key: "第七章", title: "第七章 重逢", aliases: [] },
    { key: "终章", title: "终章 狮鹫之约", aliases: [] },
  ],
}, {
  volume: 7, title: "第7卷 祭华缭乱",
  chapters: [
    { key: "第一章", title: "第一章 《大博士》的邀约", aliases: [] },
    { key: "第二章", title: "第二章 煌式远距引导武装", aliases: [] },
    { key: "第三章", title: "第三章 学园祭狂想曲Ⅰ", aliases: [] },
    { key: "第四章", title: "第四章 学园祭狂想曲Ⅱ", aliases: [] },
    { key: "第五章", title: "第五章 学园祭狂想曲Ⅲ", aliases: [] },
    { key: "第六章", title: "第六章 顶上竞技场", aliases: [] },
    { key: "第七章", title: "第七章 拉迪斯勒夫的幺子", aliases: [] },
    { key: "终章", title: "终章 携手寻师", aliases: [] },
  ],
}, {
  volume: 8, title: "第8卷 偶像峻烈",
  chapters: [
    { key: "第一章", title: "第一章 教练研磨", aliases: [] },
    { key: "第二章", title: "第二章 《狮鹫星武祭》", aliases: [] },
    { key: "第三章", title: "第三章 活宝女孩们", aliases: [] },
    { key: "第四章", title: "第四章 开始行动的人们", aliases: [] },
    { key: "第五章", title: "第五章 蚀武遗迹", aliases: [] },
    { key: "第六章", title: "第六章 《极北天琴》", aliases: [] },
    { key: "第七章", title: "第七章 骚动之夜", aliases: [] },
    { key: "第八章", title: "第八章 偶像决战", aliases: [] },
    { key: "终章", title: "终章 夕阳告白", aliases: [] },
  ],
}, {
  volume: 9, title: "第9卷 悠日战啾",
  chapters: [
    { key: "第一章", title: "第一章 追忆／前夜", aliases: [] },
    { key: "第二章", title: "第二章 追忆Ⅱ／晓", aliases: [] },
    { key: "第三章", title: "第三章 上半天／追忆Ⅲ", aliases: [] },
    { key: "第四章", title: "第四章 午时", aliases: [] },
    { key: "第五章", title: "第五章 正午", aliases: [] },
    { key: "第六章", title: "第六章 逢魔时", aliases: [] },
    { key: "第七章", title: "第七章 小夜", aliases: [] },
    { key: "第八章", title: "第八章 半宵", aliases: [] },
    { key: "终章", title: "终章 余波与战意", aliases: [] },
  ],
}, {
  volume: 10, title: "第10卷 龙激圣霸",
  chapters: [
    { key: "第一章", title: "第一章 首席徒弟", aliases: [] },
    { key: "第二章", title: "第二章 准决赛", aliases: [] },
    { key: "第三章", title: "第三章 《霸军星君》与《疾风刃雷》", aliases: [] },
    { key: "第四章", title: "第四章 千里眼", aliases: [] },
    { key: "第五章", title: "第五章 《处刑刀》", aliases: [] },
    { key: "第六章", title: "第六章 开幕", aliases: [] },
    { key: "第七章", title: "第七章 兰斯洛特队", aliases: [] },
    { key: "第八章", title: "第八章 恩菲尔德队", aliases: [] },
    { key: "终章", title: "终章 桂冠之后", aliases: [] },
  ],
}, {
  volume: 11, title: "第11卷 刃心切磋",
  chapters: [
    { key: "第一章", title: "第一章 各自的道路", aliases: [] },
    { key: "第二章", title: "第二章 返乡，天雾家", aliases: [] },
    { key: "第三章", title: "第三章 父与母", aliases: [] },
    { key: "第四章", title: "第四章 姐姐天雾遥", aliases: [] },
    { key: "第五章", title: "第五章 返乡，刀藤家", aliases: [] },
    { key: "第六章", title: "第六章 家族之形", aliases: [] },
    { key: "第七章", title: "第七章 跨入内心的深处", aliases: [] },
    { key: "第八章", title: "第八章 决心", aliases: [] },
    { key: "终章", title: "终章 长眠初醒", aliases: [] },
  ],
}, {
  volume: 12, title: "第12卷 刹鬼再应",
  chapters: [
    { key: "第一章", title: "第一章 姐弟重逢", aliases: [] },
    { key: "第二章", title: "第二章 八薙草朱莉", aliases: [] },
    { key: "第三章", title: "第三章 血缘关系", aliases: [] },
    { key: "第四章", title: "第四章 马迪亚斯•梅萨", aliases: [] },
    { key: "第五章", title: "第五章 聚集至王龙的众人", aliases: [] },
    { key: "第六章", title: "第六章 序曲", aliases: [] },
    { key: "第七章", title: "第七章 准备决战", aliases: [] },
    { key: "终章", title: "终章 开幕之晨", aliases: [] },
  ],
}, {
  volume: 13, title: "第13卷 群雄云霞",
  chapters: [
    { key: "第一章", title: "第一章 八薙草朱莉•二", aliases: [] },
    { key: "第二章", title: "第二章 八薙草朱莉•三", aliases: [] },
    { key: "第三章", title: "第三章 《王龙星武祭》开幕", aliases: [] },
    { key: "第四章", title: "第四章 预赛•一", aliases: [] },
    { key: "第五章", title: "第五章 预赛•二", aliases: [] },
    { key: "第六章", title: "第六章 预赛•三", aliases: [] },
    { key: "第七章", title: "第七章 胎动", aliases: [] },
    { key: "第八章", title: "第八章 准备反击", aliases: [] },
    { key: "第九章", title: "第九章 第四轮比赛", aliases: [] },
    { key: "终章", title: "终章 十六强揭晓", aliases: [] },
  ],
}, {
  volume: 14, title: "第14卷 炽烈魂战",
  chapters: [
    { key: "第一章", title: "第一章 纠葛", aliases: [] },
    { key: "第二章", title: "第二章 第五轮比赛•一", aliases: [] },
    { key: "第三章", title: "第三章 第五轮比赛•二", aliases: [] },
    { key: "第四章", title: "第四章 第五轮比赛•三", aliases: [] },
    { key: "第五章", title: "第五章 第五轮比赛•四", aliases: [] },
    { key: "第六章", title: "第六章 交错", aliases: [] },
  ],
}, {
  volume: 15, title: "第15卷 剑云炎华",
  chapters: [
    { key: "第一章", title: "第一章 布石错综", aliases: [] },
    { key: "第二章", title: "第二章 半准决赛第一回合", aliases: [] },
    { key: "第三章", title: "第三章 半准决赛第二回合", aliases: [] },
    { key: "第四章", title: "第四章 半准决赛第三回合", aliases: [] },
    { key: "第五章", title: "第五章 魔剑的继承者", aliases: [] },
    { key: "第六章", title: "第六章 八薙草朱莉与马迪亚斯•梅萨", aliases: [] },
    { key: "第七章", title: "第七章 准决赛第一回合", aliases: [] },
    { key: "终章", title: "终章 决赛之约", aliases: [] },
  ],
}, {
  volume: 16, title: "第16卷 金枝争滥",
  chapters: [
    { key: "第一章", title: "第一章 准决赛第二回合", aliases: [] },
    { key: "第二章", title: "第二章 孤毒与恶辣", aliases: [] },
    { key: "第三章", title: "第三章 异色眼", aliases: [] },
    { key: "第四章", title: "第四章 一线希望", aliases: [] },
    { key: "第五章", title: "第五章 起始的回忆", aliases: [] },
    { key: "第六章", title: "第六章 《圣枪》", aliases: [] },
    { key: "第七章", title: "第七章 决战《瓦尔妲＝瓦欧斯》", aliases: [] },
    { key: "终章", title: "终章 同盟的背叛", aliases: [] },
  ],
}, {
  volume: 17, title: "第17卷 六花团圆",
  chapters: [
    { key: "第一章", title: "第一章 最终决战•一", aliases: [] },
    { key: "第二章", title: "第二章 最终决战•二", aliases: [] },
    { key: "第三章", title: "第三章 最终决战•三", aliases: [] },
    { key: "第四章", title: "第四章 最终决战•四", aliases: [] },
    { key: "第五章", title: "第五章 梦境的结束", aliases: [] },
    { key: "第六章", title: "第六章 全新的日子", aliases: [] },
    { key: "终章", title: "终章 并肩前行", aliases: [] },
  ],
}].map(book => {
  const volumeLabel = ["第一卷", "第二卷", "第三卷", "第四卷", "第五卷", "第六卷", "第七卷", "第八卷", "第九卷", "第十卷", "第十一卷", "第十二卷", "第十三卷", "第十四卷", "第十五卷", "第十六卷", "第十七卷"][book.volume - 1];
  return { ...book, chapters: book.chapters.map(chapter => ({
    ...chapter, volume: book.volume, chapter: chapter.key,
    key: book.volume === 1 ? chapter.key : volumeLabel + '·' + chapter.key,
    title: volumeLabel + '·' + chapter.title,
    entryPrefix: '[剧情]' + volumeLabel + '.' + chapter.key + '.',
  })) };
});

export const STORY_ORDER_BASE = { rakudai: 100, asterisk: 200 };

export function resolveAsteriskChapter(key) {
  if (typeof key !== 'string' || !key.trim()) return null;
  const chapters = ASTERISK_VOLUMES.flatMap(book => book.chapters), value = key.trim();
  return chapters.find(chapter => chapter.key === value) ||
    chapters.find(chapter => (chapter.aliases || []).includes(value)) || null;
}

export function asteriskStoryPosition(key) {
  const chapter = resolveAsteriskChapter(key);
  return chapter ? ASTERISK_VOLUMES.flatMap(book => book.chapters).indexOf(chapter) : -1;
}

export function nextAsteriskChapter(key) {
  const chapter = resolveAsteriskChapter(key);
  if (!chapter) return null;
  const chapters = ASTERISK_VOLUMES.flatMap(book => book.chapters);
  return chapters[chapters.indexOf(chapter) + 1] || null;
}
