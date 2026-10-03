from pathlib import Path
import shutil
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parents[1]
assets = root / 'resource/knightavatars'
pool = assets / 'research/epub/images'
for name, pool_name in [('kiriko', '2ae42c80bff67c163408.jpg'), ('sara', 'fcce3a421ce0e7b2090b.jpg'), ('ein', '05cbc99c5aa0fc168fb9.jpg')]:
    shutil.copyfile(pool / pool_name, assets / 'novel' / f'{name}.jpg')
for name, box, step in [('kiriko', (1350, 180, 2230, 1080), 100), ('sara', (140, 0, 1120, 780), 100)]:
    im = Image.open(assets / 'novel' / f'{name}.jpg').convert('RGB').crop(box)
    draw = ImageDraw.Draw(im)
    for x in range((box[0] // step + 1) * step, box[2], step):
        draw.line((x - box[0], 0, x - box[0], im.height), fill='#858585', width=1)
        draw.text((x - box[0] + 3, 3), str(x), fill='black', stroke_width=1, stroke_fill='white')
    for y in range((box[1] // step + 1) * step, box[3], step):
        draw.line((0, y - box[1], im.width, y - box[1]), fill='#858585', width=1)
        draw.text((3, y - box[1] + 3), str(y), fill='black', stroke_width=1, stroke_fill='white')
    im.save(assets / 'research/epub' / f'{name}-face-grid.png')
print('Copied three original images; two head grids ready.')
shutil.copyfile(pool / 'b82d80e24674d1509072.jpg', assets / 'novel/sara.jpg')
im = Image.open(assets / 'novel/sara.jpg').convert('RGB').crop((450, 150, 1090, 710))
draw = ImageDraw.Draw(im)
for x in range(500, 1090, 50):
    draw.line((x - 450, 0, x - 450, im.height), fill='#858585', width=1)
    draw.text((x - 450 + 3, 3), str(x), fill='black', stroke_width=1, stroke_fill='white')
for y in range(200, 710, 50):
    draw.line((0, y - 150, im.width, y - 150), fill='#858585', width=1)
    draw.text((3, y - 150 + 3), str(y), fill='black', stroke_width=1, stroke_fill='white')
im.save(assets / 'research/epub/sara-vol6-face-grid.png')
print('Sara volume 6 head grid ready.')
