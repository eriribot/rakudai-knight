from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parent
FONT = ImageFont.truetype(r"C:\Windows\Fonts\msyh.ttc", 23)
SMALL = ImageFont.truetype(r"C:\Windows\Fonts\msyh.ttc", 17)
cards = [
    (Path(r"E:\web\落第\resource\knightavatars\nene.jpg"), (70,0,610,270), "动画正脸参考", "主体为低饱和深棕"),
    (Path(r"E:\web\落第\resource\knightavatars\research\epub\xiaoli-post12-scan\tw-14\004.jpg"), (80,0,720,475), "第十四卷 · 同时期彩页", "暖棕发色、深棕至金棕瞳"),
    (ROOT/"nene-vol14-colored.png", (22,8,224,193), "第一版", "头发与虹膜偏紫红"),
    (ROOT/"nene-vol14-colored-v2.png", (22,8,224,193), "修正版", "降低紫调，校准深棕与暖反光"),
]
board = Image.new("RGB", (1600, 450), (247,244,238))
draw = ImageDraw.Draw(board)
for idx,(path,box,title,note) in enumerate(cards):
    image = Image.open(path).convert("RGB").crop(box)
    fitted = ImageOps.contain(image, (380,340), Image.Resampling.LANCZOS)
    x = idx*400+10
    board.paste(fitted, (x+(380-fitted.width)//2,58+(340-fitted.height)//2))
    draw.text((x,14),title,font=FONT,fill=(41,33,30))
    draw.text((x,413),note,font=SMALL,fill=(90,80,73))
board.save(ROOT/"reference-comparison-v2.png")
print("reference-comparison-v2.png")
