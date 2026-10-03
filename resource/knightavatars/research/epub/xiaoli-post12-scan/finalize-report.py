import hashlib
import json
import sys
import zipfile
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')
OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[4]
AVATARS = OUT.parents[2]
epub = '39688/落第骑士英雄谭 - 18.epub'
member = 'OEBPS/Images/190226.jpg'
with zipfile.ZipFile(ROOT / epub) as z:
    data = z.read(member)
output = AVATARS / 'novel/xiaoli-vol18-original.jpg'
output.write_bytes(data)
sha = hashlib.sha256(data).hexdigest()
assert hashlib.sha256(output.read_bytes()).hexdigest() == sha
audit = json.loads((OUT / 'zip-image-completeness.json').read_text(encoding='utf-8'))
verified = {
    'volume': 18,
    'epub': epub,
    'member': member,
    'file': str(output.relative_to(ROOT)).replace('\\', '/'),
    'width': 1120,
    'height': 1600,
    'sha256': sha,
    'bytesUnchanged': True,
    'style': 'official-monochrome-illustration',
    'characters': ['福小莉', '爱德怀斯'],
    'xiaoliPosition': '左側，中華風服裝、深色長髮、雙圓紋髮飾，從愛德懷斯身旁探出。',
    'identityEvidence': {
        'xhtml': 'OEBPS/Text/chapter4.xhtml',
        'imageTagLine': 215,
        'descriptionLine': 211,
        'descriptionExcerpt': '一名肤色黝黑的黑发女孩，从爱德怀斯身后冒出来。',
        'clothesLine': 219,
        'clothesExcerpt': '她穿着中华风格的服装，看似个性活泼。',
        'identityLine': 222,
        'identityExcerpt': '〈饕餮〉福小莉。',
    },
}
report = {
    'schemaVersion': 1,
    'character': '福小莉',
    'scope': {
        'volumes': list(range(13, 20)),
        'epubCount': len(audit),
        'note': '本地可用正篇 EPUB 最後到第19卷；第16卷兩個版本均檢查。無第20卷可供掃描。',
        'zipBitmapFileCountIncludingDuplicatesAndDecoration': sum(b['zipImageCount'] for b in audit),
        'methods': ['逐卷檢查 ZIP 圖片清單，補查小尺寸與 SVG 遺漏', '視覺查看全卷封面、彩頁、目錄與正文黑白插圖', '核对插圖所在 XHTML 行號、姓名與場景上下文', '第19卷合照人物另做原圖放大及獨立覆核'],
    },
    'verifiedIllustrations': [verified],
    'volumeResults': [
        {'volume': 13, 'verifiedCount': 0, 'note': '正文有回顧小莉；Chapter003.xhtml:665 的011.jpg實為史黛菈，不能因679行提到小莉而認定畫的是她。'},
        {'volume': 14, 'verifiedCount': 0},
        {'volume': 15, 'verifiedCount': 0, 'note': '正文僅回顧史黛菈與饕餮的戰鬥。'},
        {'volume': 16, 'verifiedCount': 0, 'editionsChecked': ['tw-16', 'cn-16'], 'note': '兩版本為同套基础插圖，重編碼／尺寸不同；不重複計為新場景。'},
        {'volume': 17, 'verifiedCount': 0, 'note': '140446.jpg的黑長髮女性為折木有里，chapter4.xhtml:1780具名，插圖在1826行。'},
        {'volume': 18, 'verifiedCount': 1},
        {'volume': 19, 'verifiedCount': 0, 'note': '小莉有正文出場，但未找到可確認為她的插圖；196521.jpg合照中的候選人物不符合18卷深色長直髮、雙圓紋飾與中華盤扣，未計入。'},
    ],
    'verifiedOfficialColorIllustrationsFound': 0,
    'supportingFiles': ['findings-13-15.json', '16-17-findings.json', '16-17-inventory.json', '18-19-scan.json', '19-independent-review.json', 'zip-image-completeness.json'],
    'limits': '結果限上述本地 EPUB；「未找到可確認圖」不等同其他版本、網路特典或第20卷不存在。未改動現有盾形头像、manifest、世界書或終端打包。',
}
(OUT / 'findings.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
evidence_path = AVATARS / 'research/epub/xiaoli-evidence.json'
evidence = json.loads(evidence_path.read_text(encoding='utf-8-sig'))
evidence['alternativeIllustrations'] = [verified]
evidence['searchScope']['post12IllustrationScan'] = {
    'report': 'research/epub/xiaoli-post12-scan/findings.json',
    'volumes': list(range(13, 20)),
    'epubCount': len(audit),
    'verifiedIllustrations': 1,
    'verifiedOfficialColorIllustrations': 0,
}
evidence_path.write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
(OUT / 'README.md').write_text('''# 福小莉第13卷後插圖掃描

已逐圖查看本地第13–19卷，共8個EPUB（第16卷兩個版本），並核對正文插圖所在位置。ZIP 共152個圖片檔，含封面、旋轉重複、目錄、logo及小「注」圖示，不代表152幅獨立人物插圖。

確認1幅：**第18卷 `OEBPS/Images/190226.jpg`**，小莉與愛德懷斯同框。正文 `chapter4.xhtml:211` 描述黑髮、较深膚色，215行插圖，219行中華服裝，222行具名福小莉。原始位元組另外存為 [小莉第18卷原圖](../../../novel/xiaoli-vol18-original.jpg)，仍是黑白插圖。

第13–17卷及第19卷未找到可確認的小莉插圖。第13卷回顧段旁的011.jpg是史黛菈；第17卷140446.jpg是折木有里。第19卷有小莉正文出場，但合照候選放大後外貌不符合第18卷，未列作小莉圖。

本地正篇來源只到第19卷。未修改现有第12卷囚衣头像、图床URL或终端打包。第18卷原图可作为后续头像候选，目前没有自动替换。

[總報告與原圖SHA](./findings.json)；[ZIP完整性](./zip-image-completeness.json)；[第13–15卷核驗](./findings-13-15.json)；[第16–17卷核驗](./16-17-findings.json)；[第19卷獨立覆核](./19-independent-review.json)。
''', encoding='utf-8')
print(json.dumps({'verifiedIllustrations': 1, 'originalFile': str(output), 'sha256': sha, 'epubs': len(audit), 'zipImages': report['scope']['zipBitmapFileCountIncludingDuplicatesAndDecoration']}, ensure_ascii=False))
