/* Original fan-written support scene. This is not dialogue from the source work. */
(function () {
  'use strict';

  const lines = [
    { speaker: 'stella', emotion: 'firm', text: '一辉，等一下。刚才最后那一招，你为什么往后退？' },
    { speaker: 'ikki', emotion: 'neutral', text: '因为再慢一点，我明天大概就拿不稳剑了。' },
    { speaker: 'stella', emotion: 'firm', text: '我有控制力道！……你是不是觉得，陪我练到这里就够了？' },
    { speaker: 'ikki', emotion: 'soft', text: '没有。你前两次进攻都留了余力，第三次却把重心压得很低。我想看看你接下来会怎么变招。' },
    { speaker: 'stella', emotion: 'neutral', text: '所以你退开，是故意把那个空位留给我？' },
    { speaker: 'ikki', emotion: 'neutral', text: '嗯。结果你没有追。剑尖停在我原来准备反击的位置上。' },
    { speaker: 'stella', emotion: 'soft', text: '同一种办法，你还想骗我第三次？' },
    { speaker: 'ikki', emotion: 'soft', text: '看来明天得换一种了。' },
    { speaker: 'stella', emotion: 'neutral', text: '……可我还是没碰到你。明明你已经连着练了那么久。' },
    { speaker: 'ikki', emotion: 'neutral', text: '我只是很熟悉自己会在哪里输。练得多了，有些地方就记住了。' },
    { speaker: 'stella', emotion: 'soft', text: '你说得倒轻松。每次都得先输一次，才能记住吧。' },
    { speaker: 'ikki', emotion: 'soft', text: '有的地方，一次还不太够。' },
    { speaker: 'stella', emotion: 'firm', text: '那再陪我练十分钟。这回你尽管换办法，我会追上来的。' },
    { speaker: 'ikki', emotion: 'neutral', text: '史黛拉，你握剑的手已经开始抖了。' },
    { speaker: 'stella', emotion: 'firm', text: '……你的也一样。' },
    { speaker: 'ikki', emotion: 'soft', text: '被你发现了。那就明天？我把刚才那几招整理一下，带给你看。' },
    { speaker: 'stella', emotion: 'soft', text: '明天这个时间。还有，下次想看我怎么变招，就好好站稳了看。' },
    { speaker: 'ikki', emotion: 'soft', text: '好。不过，十分钟到了，要记得提醒我。' }
  ];

  Object.defineProperty(window, 'SupportDemoStory', {
    configurable: false,
    writable: false,
    value: Object.freeze({
      id: 'stella-ikki-c',
      title: '再陪我练十分钟',
      rank: 'C',
      subtitle: '训练场 · 放课后',
      provenance: '原创同人支援事件 · 概念演示，非原作台词',
      speakers: Object.freeze({ ikki: '黑铁一辉', stella: '史黛拉' }),
      lines: Object.freeze(lines.map(function (line) { return Object.freeze(line); }))
    })
  });
}());
