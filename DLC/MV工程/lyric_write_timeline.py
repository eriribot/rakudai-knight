from pathlib import Path
import json
P=Path(__file__).resolve().parent
texts=[
('戦場の太陽は高く揺れて 感情に棲み着く陰を落とす','戰場的太陽在高空搖曳 拂落寄宿于感情中的陰影'),
('知らないまま 痛みに変わること悟るように','為了點醒我 它將在不知不覺中轉變為痛處'),
('悲しみから生まれた夢も 世界と君が許してくれる','就連誕生自悲傷中的夢 也会得到的世界的原諒'),
('そう 瞼の裏で繰り返す この空が呼ぶ声に','沒錯 縈繞在我腦海中的 這片天空的呼喚'),
('響いて ただ駆け抜けた 胸に眩い衝動','响徹嘹亮 一心向前奮力趕超 心中深藏的耀眼沖動'),
('弾けた想いに My star will shine forever','化為迸裂的意志 My star will shine forever'),
('あの日抱えた全て 強く生きて行け 僕の中で今','那一天心懷的一切 一定要繼續堅強地活下去 此刻在我心中'),
('蘇る 時間 この場所で 僕ら絶対譲れない願いを','復蘇的時間 將我們決不退讓的愿望 銘刻在這个地方'),
('ただ一つ この声で 強く刻んで行け This is The Asterisk War','用這道唯一的呐喊 留下深深的烙印 This is The Asterisk War'),
('愛情が交差して 淡くなっていく 同情はいらない 情けないだろう？','交叉于其中的淡淡的情感 就不該被怜憫和同情嗎？'),
('失敗から 間違いない自分を作り出して','从失敗中不斷創造出自己'),
('君が歌う 希望の歌が 道を塞ぐ棘を溶かした','你所吟唱的希望之歌將路途上的荊棘融化'),
('そう いつか来る笑顔の時を 二人の瞳で捉えて','沒錯 總有一天我們的眼睛会再次綻放曾經的微笑'),
('叫んで 鳴らすのは鼓動 分かち合いたい衝動','一鳴惊人 那跳動的心跳 是內心想要分享的沖動'),
('今わかったんだ My star will shine forever','如今我已明白 My star will shine forever'),
('終わりのない道を 強く歩いていけ そして蘇る','沒有終点的前方 要更加堅強的向前走 然后覺醒'),
('ぬくもりと 守るべき約束を その願いに かけがえのない希望を','溫暖和守護的約定既是我們的愿望 也是我們不可替代的希望'),
('絶対に忘れないで 強く描いて行け This is The Asterisk War','我們絕不能忘 堅定的向前走 This is The Asterisk War'),
('This is The Asterisk War','This is The Asterisk War'),
('響いて この手の中で 確信になる衝動','响徹嘹亮 這份手里緊握着 肯定的沖動'),
('涙乗り越えて My star will shine forever','抑制泪水 My star will shine forever'),
('運命が出した答えを 強く壊して行け 夢のために今','給命运以強烈的回應 為了現在的夢'),
('蘇る 時間 この場所で 僕ら絶対譲れない願いを','復蘇的時間 將我們絕不退讓的愿望 銘刻在這个地方'),
('ただ一つ この声で 強く刻んで行け This is The Asterisk War','用這道唯一的呐喊 留下深深的烙印 This is The Asterisk War')
]
ranges=json.loads((P/'检查/lyric_detect_raw.json').read_text(encoding='utf8'))['ranges']
segments=[]
for r,(jp,zh) in zip(ranges,texts):
    segments.append({'start':r['start'],'end':r['end'],'start_frame':r['start_frame'],'end_frame':r['end_frame'],'jp':jp,'zh':zh})
output={'source':'学战都市第二季OP《The Asterisk War》 - The Asterisk War.mp4','fps':25,'frame_convention':'zero-based; start inclusive, end exclusive','method':'Manual transcription from original burned-in subtitles; white-glyph matching for boundaries, every boundary reviewed at the immediately preceding/following frame. No network lyrics used.','notes':['Chinese subtitles intentionally retain mixed simplified/traditional forms and awkward wording seen in source.','No lyric overlays outside listed intervals. In particular 109.92–110.32 seconds is an intentional blank subtitle gap.','Opening song credits are excluded; preserve original picture in that interval.'],'segments':segments}
(P/'lyrics_timeline.json').write_text(json.dumps(output,ensure_ascii=False,indent=2),encoding='utf8')
print('Wrote',len(segments),'segments')
