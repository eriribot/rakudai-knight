"""Restore the two white collar panels without changing the original ink geometry."""
from pathlib import Path
import json
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent
SOURCE = Path(r"C:\Users\eriri\AppData\Local\Temp\codex-clipboard-1cdcef14-d216-43af-8c13-d3ab1d3e32a9.png")
original = Image.open(SOURCE).convert("RGB")
previous = Image.open(ROOT/"nene-vol14-colored-v2.png").convert("RGB")
W,H = original.size
gray = np.asarray(original,dtype=np.float32).mean(axis=2)/255
base = np.asarray(previous,dtype=np.float32)

def mask(polygons, holes=()):
    canvas=Image.new("L",(W*4,H*4))
    draw=ImageDraw.Draw(canvas)
    for poly in polygons:
        draw.polygon([(round(x*4),round(y*4)) for x,y in poly],fill=255)
    for poly in holes:
        draw.polygon([(round(x*4),round(y*4)) for x,y in poly],fill=0)
    return np.asarray(canvas.resize((W,H),Image.Resampling.LANCZOS).filter(ImageFilter.GaussianBlur(.18)),dtype=np.float32)/255

data=json.loads((ROOT/"collar-fix-masks.json").read_text(encoding="utf-8-sig"))
assert (data["width"],data["height"]) == (W,H)
collar = np.zeros((H,W),dtype=np.float32)
for layer in data["layers"]:
    collar=np.maximum(collar,mask(layer["polygons"],layer.get("holes",[])))

# Protect the original hair and scarf. The source's dark ink protects the navy
# piping itself; the earlier approximate piping mask included some white cloth.
protected=np.zeros((H,W),dtype=np.float32)
for filename in ("hair-masks.json","clothing-masks.json"):
    old=json.loads((ROOT/filename).read_text(encoding="utf-8-sig"))
    for layer in old["layers"]:
        if layer["kind"] in ("hair","iris","bow","scarf"):
            protected=np.maximum(protected,mask(layer["polygons"],layer.get("holes",[])))
opacity=collar*(1-protected)*np.clip((gray-.10)/.12,0,1)

# Cool, clean cloth whites with the source's existing gray fold and shadow shapes.
palette=[(0,(0,0,0)),(.25,(58,62,72)),(.55,(137,144,156)),(.8,(213,219,226)),(1,(255,255,253))]
tone=np.stack([np.interp(gray,[x for x,_ in palette],[rgb[c] for _,rgb in palette]) for c in range(3)],axis=2)
out=base*(1-opacity[:,:,None])+tone*opacity[:,:,None]
result=Image.fromarray(np.clip(out,0,255).round().astype(np.uint8))
stem="nene-vol14-colored-v3"
result.save(ROOT/f"{stem}.png")
result.resize((W*3,H*3),Image.Resampling.LANCZOS).save(ROOT/f"{stem}-3x.png")

box=(88,142,218,237)
before=previous.crop(box).resize((650,475),Image.Resampling.LANCZOS)
after=result.crop(box).resize((650,475),Image.Resampling.LANCZOS)
review=Image.new("RGB",(1316,475),(245,243,239))
review.paste(before,(0,0)); review.paste(after,(666,0))
review.save(ROOT/"collar-before-after-v3.png")

changed=np.any(np.asarray(previous)!=np.asarray(result),axis=2)
assert not np.any(changed & (collar==0)), "Pixels outside collar changed"
assert not np.any(changed[:135,:]), "Face/hair/eyes changed"
assert not np.any(changed[248:,:]), "Body or background changed"
print(json.dumps({"size":[W,H],"changed_pixels":int(changed.sum()),"outside_collar_changes":int((changed & (collar==0)).sum()),"output":f"{stem}.png"}))
