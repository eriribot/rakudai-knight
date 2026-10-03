from pathlib import Path
from PIL import Image
root = Path(__file__).resolve().parents[1]
prepared = root / 'resource/knightavatars/prepared'
with Image.open(prepared / 'novel-contact-sheet.png') as im:
    assert im.size == (696,424)
    im.crop((0,212,696,424)).save(prepared / 'additional-contact-sheet.png')
print('Four-person preview saved.')
