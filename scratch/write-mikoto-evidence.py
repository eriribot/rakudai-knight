from pathlib import Path
import hashlib,json
from PIL import Image
root=Path(__file__).resolve().parents[1]
assets=root/'resource/knightavatars'
def image_info(relative):
    p=assets/relative
    if not p.exists():return {'file':relative,'present':False}
    with Image.open(p) as im: size=im.size
    return {'file':relative,'width':size[0],'height':size[1],'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
data={
 'schemaVersion':1,
 'id':'mikoto',
 'name':'鹤屋美琴',
 'aliases':['鶴屋美琴','Mikoto Tsuruya','Tsuruya Mikoto','冰霜冷笑'],
 'affiliation':'巨门学园',
 'sourceImage':image_info('research/user-supplied/mikoto-profile-screenshot.png'),
 'colorizationTarget':image_info('novel/mikoto-user-crop.png'),
 'imageIdentityStatus':'user-identified-encyclopedia-portrait',
 'imageProvenanceNote':'使用者提供百科人物页截图，图中日文姓名及罗马字与其说明相符。未核实该黑白插图的原始出版载体与页码，因此不标记为已核实小说插图。目标图为去除百科界面的同一人物裁切。',
 'evidence':[
   {'sourceEpub':'39688/[台版]落第骑士英雄谭 05.epub','xhtml':'OEBPS/Text/Chapter005.xhtml','line':70,'claim':'发色为灰金色；使用者所引段落的精确出处','excerpt':'一名有着灰金色发丝的女性','identityExcerpt':'她就是〈冰霜冷笑〉鹤屋美琴。'},
   {'sourceEpub':'39688/[台版]落第骑士英雄谭 04.epub','xhtml':'OEBPS/Text/Chapter001.xhtml','line':346,'claim':'灰金色发丝的第二处描写','excerpt':'那是有着一头灰金色发丝的女性','identityAnchor':{'line':347,'excerpt':'那该不会是「巨门」的〈冰霜冷笑〉吧？'}},
   {'sourceEpub':'39688/[台版]落第骑士英雄谭 05.epub','xhtml':'OEBPS/Text/Chapter003.xhtml','line':37,'claim':'学校、年级、称号和姓名','excerpt':'巨门学园三年级〈冰霜冷笑〉鹤屋美琴选手！'},
   {'sourceEpub':'39688/[台版]落第骑士英雄谭 06.epub','xhtml':'OEBPS/Text/Chapter001.xhtml','line':964,'claim':'蓝白色是能力魔力的发光颜色，不能当作常态虹膜色','excerpt':'死神之眼闪烁着与方才完全不同层级的蓝白色魔力——'}
 ],
 'paletteBoundary':{
   'hair':{'status':'canonical-novel-text','value':'低饱和灰金色／ash-blonde；避免亮黄色、银白色、粉色'},
   'naturalEyeColor':{'status':'unknown','note':'本地22本EPUB中姓名附近的外貌上下文没有找到明确常态虹膜色；应采用中性深灰视觉补色并标记非官方。'},
   'uniformColors':{'status':'unknown','note':'未找到这套制服的明确官方色彩图或正文配色；可保留黑白线稿明暗，以灰白布料和深色领带作中性补色，不宣称官方制服配色。'},
   'eyeMagicGlow':{'status':'canonical-but-unneeded','value':'蓝白色','note':'本次是无能力特效的常态头像，无需添加眼部发光、冰晶、单眼镜片或新道具。'}
 },
 'searchScope':{
   'localEpubsTextSearched':22,
   'illustrationsVisuallyChecked':[{'volumes':[4,5,6],'count':39,'colorStatus':'monochrome'}],
   'exactMatchingNovelIllustrationFound':False,
   'unverifiedHighResolutionOriginal':'第4至6卷黑白插图中未找到与用户截图精确相同的图；不能宣称整个22本插图库都已做图像比对。',
   'fandomPage':'https://rakudai-kishi.fandom.com/wiki/Mikoto_Tsuruya',
   'fandomAccessResult':'web工具开页内部错误；直接HTTP读取403，未读取人物页内容。'
 }
}
out=assets/'research/epub/mikoto-evidence.json'
out.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(out.relative_to(root).as_posix())
