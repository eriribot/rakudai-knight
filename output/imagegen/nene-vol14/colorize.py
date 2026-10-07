"""Non-generative, region-masked coloring of the supplied original ink drawing."""
from pathlib import Path
import json
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent
OUTPUT_STEM = "nene-vol14-colored-v2"
SOURCE = Path(r"C:\Users\eriri\AppData\Local\Temp\codex-clipboard-1cdcef14-d216-43af-8c13-d3ab1d3e32a9.png")
original = Image.open(SOURCE).convert("RGB")
W, H = original.size
gray = np.asarray(original, dtype=np.float32).mean(axis=2) / 255.0
SCALE = 4

def mask(polygons, holes=(), blur=0.20):
    canvas = Image.new("L", (W*SCALE, H*SCALE))
    draw = ImageDraw.Draw(canvas)
    for poly in polygons:
        draw.polygon([(round(x*SCALE), round(y*SCALE)) for x, y in poly], fill=255)
    for poly in holes:
        draw.polygon([(round(x*SCALE), round(y*SCALE)) for x, y in poly], fill=0)
    canvas = canvas.resize((W, H), Image.Resampling.LANCZOS)
    if blur:
        canvas = canvas.filter(ImageFilter.GaussianBlur(blur))
    return np.asarray(canvas, dtype=np.float32)/255.0

PALETTES = {
    "chair": [(0, (0,0,0)), (.2,(46,42,46)), (.4,(96,88,91)), (.7,(170,157,150)), (1,(255,255,255))],
    "wallpaper": [(0,(0,0,0)), (.35,(101,93,83)), (.7,(190,177,151)), (1,(255,249,235))],
    "frame": [(0,(0,0,0)), (.3,(76,76,75)), (.65,(160,162,156)), (1,(248,248,240))],
    "window": [(0,(0,0,0)), (.4,(98,110,116)), (.7,(180,191,192)), (1,(245,249,247))],
    "ledge": [(0,(0,0,0)), (.3,(74,76,76)), (.65,(159,163,158)), (1,(250,250,241))],
    "plant": [(0,(0,0,0)), (.3,(43,70,55)), (.7,(136,157,112)), (1,(236,239,214))],
    # Calibrated against multiple anime frames and the same-period LN14 color page.
    # Warm chocolate body / subdued milk-tea highlights, without the old plum cast.
    "hair": [(0,(0,0,0)), (.18,(44,34,31)), (.35,(80,64,59)), (.6,(140,118,109)), (.85,(216,192,170)), (1,(255,241,219))],
    "bow": [(0,(0,0,0)), (.15,(74,20,38)), (.35,(153,42,68)), (.6,(213,86,107)), (.85,(247,161,167)), (1,(255,232,221))],
    "iris": [(0,(0,0,0)), (.2,(54,31,26)), (.5,(122,84,71)), (.8,(205,165,133)), (1,(255,251,247))],
    "skin": [(0,(0,0,0)), (.3,(82,56,57)), (.55,(155,119,116)), (.75,(208,170,155)), (.9,(244,215,193)), (1,(255,237,218))],
    "shirt": [(0,(0,0,0)), (.25,(59,58,68)), (.55,(132,131,146)), (.8,(204,206,216)), (1,(255,253,249))],
    "scarf": [(0,(0,0,0)), (.15,(67,20,35)), (.35,(144,45,66)), (.6,(202,92,108)), (.85,(243,162,167)), (1,(255,234,226))],
    "skirt": [(0,(0,0,0)), (.2,(33,36,52)), (.4,(75,78,96)), (.7,(159,163,177)), (1,(245,246,249))],
    "piping": [(0,(0,0,0)), (.25,(40,42,61)), (.5,(94,99,121)), (.8,(180,186,203)), (1,(249,250,251))],
}

def colored(kind):
    palette = PALETTES[kind]
    xs = [p[0] for p in palette]
    return np.stack([np.interp(gray, xs, [p[1][c] for p in palette]) for c in range(3)], axis=2).astype(np.float32)

out = np.asarray(original, dtype=np.float32).copy()
layer_masks = {}

def apply_layer(layer):
    global out
    m = mask(layer["polygons"], layer.get("holes", []), layer.get("blur", .2))
    # Preserve actual black ink exactly, even where regions overlap an outline.
    ink_protection = np.clip((gray-.025)/.065, 0, 1)
    opacity = m * ink_protection * layer.get("opacity", 1)
    out = out*(1-opacity[:,:,None]) + colored(layer["kind"])*opacity[:,:,None]
    layer_masks[layer["name"]] = m

# A restrained leather undertone under the hand-traced foreground layers.
apply_layer({"name":"base_leather", "kind":"chair", "polygons":[[[11,0],[514,0],[514,713],[11,713]]], "blur":0})
apply_layer({"name":"wallpaper", "kind":"wallpaper", "polygons":[[[155,0],[368,0],[368,254],[459,284],[514,307],[514,426],[484,426],[484,415],[480,396],[474,378],[464,359],[453,345],[434,336],[410,326],[375,315],[341,307],[314,302],[304,304],[300,290],[293,273],[286,251],[279,230],[273,211],[268,195],[258,181],[266,169],[252,149],[240,136],[227,128],[214,123],[211,106],[194,101],[155,92]]], "blur":.2})
apply_layer({"name":"upper_frame", "kind":"frame", "polygons":[[[368,0],[410,0],[410,171],[368,181]]], "blur":.15})
apply_layer({"name":"window", "kind":"window", "polygons":[[[410,0],[514,0],[514,191],[410,171]]], "blur":.15})
apply_layer({"name":"window_ledge", "kind":"ledge", "polygons":[[[368,181],[410,171],[514,190],[514,294],[368,248]]], "blur":.15})
apply_layer({"name":"plant", "kind":"plant", "polygons":[[[487,155],[495,154],[509,163],[514,170],[514,175],[507,167]], [[497,133],[498,129],[502,128],[507,134],[514,149],[514,157],[507,142]], [[510,123],[514,123],[514,139],[511,133]]], "blur":.2})

for filename in ("clothing-masks.json", "hair-masks.json", "skin-masks.json"):
    data = json.loads((ROOT/filename).read_text(encoding="utf-8-sig"))
    assert (data["width"], data["height"]) == (W,H), filename
    for layer in data["layers"]:
        apply_layer(layer)

# Subtle warmth on the existing face; does not alter edges or shading shapes.
face_masks = [m for name,m in layer_masks.items() if "face" in name.lower()]
if face_masks:
    face_m = np.maximum.reduce(face_masks)
    yy, xx = np.mgrid[0:H,0:W]
    blush = (np.exp(-(((xx-111)/14)**2+((yy-139)/9)**2)/2) + np.exp(-(((xx-174)/12)**2+((yy-126)/9)**2)/2))*.35
    blush *= face_m*np.clip((gray-.55)/.25,0,1)
    out += blush[:,:,None]*np.array([2,-8,-6], dtype=np.float32)

# Original white scan margins remain white, and the source is never overwritten.
out[:, :10] = np.asarray(original, dtype=np.float32)[:, :10]
out[:, 515:] = np.asarray(original, dtype=np.float32)[:, 515:]
result = Image.fromarray(np.clip(out,0,255).round().astype(np.uint8))
result.save(ROOT/f"{OUTPUT_STEM}.png")
result.resize((W*3,H*3),Image.Resampling.LANCZOS).save(ROOT/f"{OUTPUT_STEM}-3x.png")

preview = Image.new("RGB",(W*2+20,H),(248,245,241))
preview.paste(original,(0,0)); preview.paste(result,(W+20,0))
preview.save(ROOT/"comparison-v2.png")

# Export color-free region evidence for review of mask placement.
debug = Image.new("RGBA", (W,H), (0,0,0,0))
swatches = [(255,50,70),(30,145,255),(220,160,10),(60,200,120),(170,90,230)]
for idx,(name,m) in enumerate(layer_masks.items()):
    if name.startswith("base") or name in ("wallpaper","upper_frame","window","window_ledge","plant"):
        continue
    rgb = swatches[idx%len(swatches)]
    rgba = np.zeros((H,W,4),dtype=np.uint8)
    rgba[:,:,:3] = rgb
    rgba[:,:,3] = (m*100).astype(np.uint8)
    debug = Image.alpha_composite(debug,Image.fromarray(rgba))
Image.alpha_composite(original.convert("RGBA"),debug).convert("RGB").save(ROOT/"mask-review-v2.png")

previous = np.asarray(Image.open(ROOT/"nene-vol14-colored.png").convert("RGB"))
current = np.asarray(result)
region = np.maximum(layer_masks["warm-brown-hair"], layer_masks["muted-brown-mauve-irises"])
changed = np.any(previous != current, axis=2)
assert not np.any(changed & (region == 0)), "Unrelated pixels changed"
assert result.size == original.size
print(json.dumps({"source_size":[W,H],"output":str(ROOT/f"{OUTPUT_STEM}.png"),"upscale":str(ROOT/f"{OUTPUT_STEM}-3x.png"),"mask_layers":len(layer_masks),"changed_pixels":int(changed.sum()),"outside_hair_iris_changes":int((changed & (region==0)).sum())},ensure_ascii=False))
