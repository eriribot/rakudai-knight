"""Color the original Won scan through traced masks, without generative redraw."""
from pathlib import Path
import json
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / 'original-vol09.jpg'
original = Image.open(SOURCE).convert('RGB')
W, H = original.size
src = np.asarray(original, dtype=np.float32)
gray = src.mean(axis=2) / 255.
SCALE = 4

# All knots preserve the source tonal ordering. The source supplies every fold,
# facial mark, denim hatch, background texture and piece of linework.
PALETTES = {
    'sky': [(0,(0,0,0)), (.35,(73,106,133)), (.65,(151,193,217)), (.85,(206,229,239)), (1,(248,252,252))],
    'building': [(0,(0,0,0)), (.3,(77,72,69)), (.55,(146,139,127)), (.8,(213,206,190)), (1,(251,247,234))],
    'stone': [(0,(0,0,0)), (.3,(77,78,76)), (.55,(144,145,137)), (.8,(211,209,196)), (1,(250,249,239))],
    'awning': [(0,(0,0,0)), (.25,(51,49,46)), (.5,(113,102,86)), (.75,(178,159,135)), (1,(244,229,207))],
    'wood': [(0,(0,0,0)), (.3,(71,55,45)), (.55,(130,103,76)), (.8,(206,173,134)), (1,(249,234,203))],
    'glass': [(0,(0,0,0)), (.3,(48,61,64)), (.55,(114,145,151)), (.8,(188,214,213)), (1,(246,253,248))],
    'foliage': [(0,(0,0,0)), (.25,(34,49,34)), (.5,(75,106,59)), (.7,(125,151,98)), (.88,(199,211,160)), (1,(249,249,229))],
    'trunk': [(0,(0,0,0)), (.3,(65,58,48)), (.55,(128,115,91)), (.8,(201,190,162)), (1,(247,242,221))],
    'pavement': [(0,(0,0,0)), (.3,(83,85,89)), (.55,(149,150,151)), (.8,(212,211,202)), (1,(255,251,240))],
    'cafe_metal': [(0,(0,0,0)), (.3,(53,62,62)), (.55,(116,130,128)), (.8,(196,205,198)), (1,(248,250,239))],
    'person_shirt': [(0,(0,0,0)), (.3,(76,78,82)), (.55,(140,141,151)), (.8,(209,208,218)), (1,(248,247,248))],
    'person_pants': [(0,(0,0,0)), (.3,(55,55,67)), (.55,(113,113,132)), (.8,(186,187,202)), (1,(241,244,248))],
    'person_hair': [(0,(0,0,0)), (.3,(62,48,42)), (.55,(124,98,79)), (.8,(206,177,140)), (1,(251,233,201))],
    'person_skin': [(0,(0,0,0)), (.3,(88,67,59)), (.55,(155,127,109)), (.8,(217,191,163)), (1,(253,235,210))],
    'hair': [(0,(0,0,0)), (.25,(53,60,60)), (.5,(150,160,159)), (.7,(207,214,210)), (.85,(235,239,232)), (1,(255,255,249))],
    'skin': [(0,(0,0,0)), (.25,(77,53,53)), (.5,(169,129,122)), (.7,(228,190,165)), (.85,(250,221,196)), (1,(255,241,221))],
    'iris': [(0,(0,0,0)), (.2,(38,38,43)), (.45,(101,102,115)), (.7,(174,176,185)), (.85,(218,221,225)), (1,(255,255,250))],
    'sclera': [(0,(0,0,0)), (.25,(56,58,61)), (.5,(128,132,135)), (.7,(185,189,191)), (.85,(224,227,227)), (1,(255,254,249))],
    'lips': [(0,(0,0,0)), (.35,(103,74,74)), (.65,(193,151,145)), (.85,(245,208,191)), (1,(255,238,216))],
    'shirt': [(0,(0,0,0)), (.25,(55,55,61)), (.5,(130,130,141)), (.7,(194,194,202)), (.85,(228,228,231)), (1,(255,254,247))],
    'denim': [(0,(0,0,0)), (.2,(19,28,44)), (.4,(36,62,95)), (.55,(51,93,139)), (.7,(84,126,168)), (.85,(153,178,204)), (1,(242,247,251))],
    'belt': [(0,(0,0,0)), (.25,(36,33,33)), (.5,(82,75,69)), (.75,(154,143,128)), (1,(241,232,214))],
    'bracelet': [(0,(0,0,0)), (.25,(36,35,38)), (.5,(82,81,88)), (.75,(155,155,164)), (1,(242,242,243))],
    'metal': [(0,(0,0,0)), (.25,(42,47,52)), (.5,(103,113,121)), (.75,(185,195,195)), (1,(255,253,242))],
}

def region(layer):
    canvas = Image.new('L', (W*SCALE,H*SCALE), 0)
    draw = ImageDraw.Draw(canvas)
    for poly in layer.get('polygons',[]):
        draw.polygon([(round(x*SCALE),round(y*SCALE)) for x,y in poly], fill=255)
    for path in layer.get('paths',[]):
        points = path['points'] if isinstance(path,dict) else path
        width = path.get('width',1.2) if isinstance(path,dict) else layer.get('path_width',1.2)
        draw.line([(round(x*SCALE),round(y*SCALE)) for x,y in points],fill=255,width=max(1,round(width*SCALE)),joint='curve')
    for poly in layer.get('holes',[]):
        draw.polygon([(round(x*SCALE),round(y*SCALE)) for x,y in poly],fill=0)
    canvas = canvas.resize((W,H),Image.Resampling.LANCZOS)
    if layer.get('blur',.16):
        canvas = canvas.filter(ImageFilter.GaussianBlur(layer.get('blur',.16)))
    m = np.asarray(canvas,dtype=np.float32)/255.
    if 'gray_max' in layer:
        m *= np.clip((layer['gray_max']-gray)/layer.get('gray_feather',.06),0,1)
    if 'gray_min' in layer:
        m *= np.clip((gray-layer['gray_min'])/layer.get('gray_feather',.06),0,1)
    return m

def mapping(kind):
    knots=PALETTES[kind]
    return np.stack([np.interp(gray,[k[0] for k in knots],[k[1][c] for k in knots]) for c in range(3)],axis=2).astype(np.float32)

out = src.copy()
all_masks={}
def apply(layer):
    global out
    m=region(layer)
    opacity=m*np.clip((gray-.025)/.065,0,1)*layer.get('opacity',1.)
    out=out*(1-opacity[:,:,None])+mapping(layer['kind'])*opacity[:,:,None]
    all_masks[layer['name']]=m

apply({'name':'sky-base','kind':'sky','polygons':[[[0,0],[W,0],[W,H],[0,H]]],'blur':0})
late_accessories=[]
for filename in ('background-masks.json','clothing-masks.json','hair-skin-masks.json','detail-fixes.json'):
    if not (ROOT/filename).exists():
        if filename == 'detail-fixes.json':
            continue
        raise FileNotFoundError(filename)
    data=json.loads((ROOT/filename).read_text(encoding='utf-8-sig'))
    assert (data['width'],data['height']) == (W,H), filename
    for layer in data['layers']:
        if filename == 'clothing-masks.json' and layer['kind'] == 'bracelet':
            late_accessories.append(layer)
            continue
        apply(layer)
for layer in late_accessories:
    apply(layer)

# A small blush stays inside the traced face; no shape or outline is changed.
face_masks=[m for n,m in all_masks.items() if 'face' in n.lower()]
if face_masks:
    face=np.maximum.reduce(face_masks)
    yy,xx=np.mgrid[0:H,0:W]
    blush=(np.exp(-(((xx-234)/29)**2+((yy-429)/16)**2)/2)+np.exp(-(((xx-366)/19)**2+((yy-407)/17)**2)/2))*.26
    blush*=face*np.clip((gray-.55)/.25,0,1)
    out+=blush[:,:,None]*np.array([2,-6,-5],dtype=np.float32)

# Retain the author's printed credit exactly.
out[22:64,35:121]=src[22:64,35:121]
result=Image.fromarray(np.clip(out,0,255).round().astype(np.uint8))
stem='edelweiss-vol09-blue-jeans-colored'
result.save(ROOT/f'{stem}.png')
result.resize((W*3,H*3),Image.Resampling.LANCZOS).save(ROOT/f'{stem}-3x.png')
comparison=Image.new('RGB',(W*2+24,H),(250,248,241))
comparison.paste(original,(0,0));comparison.paste(result,(W+24,0))
comparison.save(ROOT/'before-after.png')
result.crop((125,310,492,708)).resize((734,796),Image.Resampling.LANCZOS).save(ROOT/'face-neck-color-review.png')
result.crop((717,716,1062,1131)).resize((690,830),Image.Resampling.LANCZOS).save(ROOT/'wrist-sleeve-color-review.png')
assert result.size==original.size
assert np.array_equal(np.asarray(result)[22:64,35:121],np.asarray(original)[22:64,35:121])
print(json.dumps({'source_size':[W,H],'output':str(ROOT/f'{stem}.png'),'upscale':str(ROOT/f'{stem}-3x.png'),'layer_count':len(all_masks)},ensure_ascii=False))
