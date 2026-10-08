from pathlib import Path
import json
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT.parent / 'edelweiss-jeans' / 'source' / 'edelweiss-jeans-vol09-original.jpg'
WIDTH, HEIGHT = 1062, 1600
layers = []

def add(name, kind, polygons, **kwargs):
    layers.append(dict(name=name, kind=kind, polygons=polygons, blur=0.6, **kwargs))

# Broad undercoats are intentionally allowed behind the foreground character.
add('sky-soft-morning-blue', 'sky', [[[0,0],[1061,0],[1061,1599],[0,1599]]], opacity=0.52)
add('central-concrete-building', 'building', [[[329,191],[441,137],[459,142],[510,118],[532,118],[651,316],[674,486],[532,598],[345,495]]], opacity=0.62)
add('central-building-right-facet', 'stone', [[[470,140],[510,119],[532,119],[648,314],[637,395],[590,469],[540,435]]], opacity=0.55)
add('lower-background-pale-stone', 'stone', [[[0,535],[612,418],[1061,669],[1061,1599],[0,1599]]], opacity=0.42)
add('left-building-deep-shade', 'building', [[[0,798],[36,836],[194,1035],[296,1188],[370,1341],[0,1227]]], opacity=0.46)
add('cafe-glass-under-awning', 'glass', [[[967,0],[1061,0],[1061,828],[641,474],[698,378],[850,256],[939,93]]], opacity=0.38)
add('pavement-warm-gray-bricks', 'pavement', [[[0,1294],[478,1124],[1061,890],[1061,1599],[0,1599]]], opacity=0.58)

# Roof and structural members: simple hard geometry; original lines stay visible.
add('awning-gray-brown-roof', 'awning', [[[802,0],[995,0],[932,124],[852,256],[744,334],[652,398],[701,240],[756,83]]], opacity=0.72)
add('awning-stone-front-rim', 'stone', [[[766,0],[802,0],[693,289],[650,428],[641,452],[628,426],[672,288]]], opacity=0.66)
add('cafe-dark-window-mullions', 'wood', [
    [[980,30],[1004,49],[1061,135],[1061,193],[1011,115],[965,62]],
    [[937,149],[959,170],[1061,328],[1061,382],[1012,296],[924,171]],
    [[850,252],[870,270],[1061,551],[1061,596],[1023,543],[837,274]],
], opacity=0.64)
add('right-upper-stone-wall-strips', 'building', [
    [[1000,0],[1030,0],[1061,110],[1061,151],[1026,52]],
    [[1031,0],[1061,0],[1061,117],[1050,81]],
], opacity=0.5)

# Only nonwhite pixels in these leaf contours receive green. Reflections are weaker.
add('tree-left-visible-canopy', 'foliage', [[[643,155],[664,140],[682,145],[702,117],[718,122],[732,97],[754,100],[746,182],[727,252],[707,319],[670,378],[660,420],[642,443],[598,458],[586,442],[575,430],[590,408],[576,383],[602,360],[580,344],[603,313],[586,287],[607,270],[599,243],[618,217],[605,198],[627,194],[623,175]]], gray_max=190, opacity=0.54)
layers[-1]['holes'] = [
    [[766,0],[802,0],[693,289],[650,428],[641,452],[628,426],[672,288]],
    [[802,0],[995,0],[932,124],[852,256],[744,334],[652,398],[701,240],[756,83]],
]
add('tree-lower-visible-leaves', 'foliage', [[[654,476],[671,450],[681,435],[701,422],[722,413],[739,421],[748,410],[770,427],[799,444],[807,466],[785,480],[789,501],[777,512],[754,506],[731,523],[704,543],[678,530],[647,526],[637,507]]], gray_max=185, opacity=0.52)
add('tree-reflection-upper-glass', 'foliage', [[[886,220],[910,183],[930,221],[951,205],[973,237],[1001,267],[1036,280],[1033,311],[991,321],[970,346],[932,324],[908,302],[879,282]]], gray_max=190, opacity=0.27)
add('tree-reflection-middle-glass', 'foliage', [[[818,316],[840,319],[849,344],[866,338],[879,359],[914,367],[930,391],[943,394],[962,423],[951,456],[929,461],[904,443],[882,460],[857,444],[834,419],[817,390],[801,347]]], gray_max=190, opacity=0.29)
add('tree-dark-branches', 'trunk', [
    [[825,354],[836,388],[862,448],[888,491],[924,529],[970,565],[1017,599],[1061,616],[1061,640],[1025,620],[980,601],[935,577],[904,552],[879,529],[852,526],[807,517],[796,503],[779,486],[757,464],[747,456],[754,452],[771,466],[789,476],[804,491],[850,510],[870,510],[854,473],[835,429],[820,394],[811,367]],
    [[720,321],[735,336],[766,352],[796,382],[811,409],[807,414],[790,385],[763,361],[732,343],[714,335]],
], gray_max=175, opacity=0.66)

# Two visitors at the cafe, behind the rail and shrubs.
add('cafe-woman-muted-dress', 'person_shirt', [[[848,644],[871,650],[885,667],[893,692],[911,703],[893,728],[893,759],[912,789],[930,841],[922,893],[900,901],[877,864],[840,804],[789,748],[786,708],[811,683],[842,680]]], opacity=0.48)
add('cafe-woman-dark-long-hair', 'person_hair', [[[809,608],[823,602],[842,607],[855,624],[864,646],[861,670],[877,675],[886,694],[879,702],[861,700],[847,690],[831,685],[818,675],[810,656],[809,636],[804,628]]], opacity=0.64)
add('cafe-woman-small-face-and-hands', 'person_skin', [
    [[851,644],[866,650],[876,666],[866,674],[857,667]],
    [[876,678],[888,681],[903,688],[917,688],[930,697],[917,703],[899,699],[884,695]],
], opacity=0.5)
add('cafe-man-muted-shirt', 'person_shirt', [[[956,653],[977,642],[995,650],[1003,665],[1006,705],[984,724],[966,705],[941,691],[921,695],[902,689],[919,676],[937,681],[947,685]]], opacity=0.46)
add('cafe-man-dark-trousers', 'person_pants', [[[972,711],[997,718],[1019,810],[1008,868],[975,865],[953,754]]], opacity=0.48)
add('cafe-man-dark-hair', 'person_hair', [[[927,607],[940,603],[951,611],[960,627],[956,642],[947,648],[937,642],[930,646],[920,633],[920,619]]], opacity=0.62)
add('cafe-man-face-and-left-hand', 'person_skin', [
    [[944,625],[957,633],[963,644],[956,655],[947,660],[939,650],[935,640]],
    [[899,679],[915,679],[929,686],[934,692],[921,696],[905,691]],
], opacity=0.48)

# Rail/table geometry: gray threshold limits tinting to the existing metal strokes.
add('cafe-table-and-metal-rail', 'cafe_metal', [
    [[883,713],[929,712],[951,725],[958,740],[928,752],[900,741],[886,730]],
    [[928,719],[956,719],[1061,790],[1061,835],[1029,841],[1003,827],[977,790],[944,758],[916,741]],
    [[1008,830],[1020,835],[1054,906],[1051,918],[1043,908],[1013,852]],
], gray_max=175, opacity=0.65)
add('cafe-shrub-right-edge', 'foliage', [[[979,636],[998,639],[1011,621],[1034,625],[1061,602],[1061,787],[1045,799],[1027,784],[1007,772],[989,754],[971,755],[948,739],[947,718],[955,696],[944,683],[955,663]]], gray_max=175, opacity=0.57)

# Passing visitors at the lower left. Deliberately quiet colors.
add('left-man-gray-jacket', 'person_shirt', [[[0,952],[28,945],[58,939],[71,959],[69,1005],[100,1045],[130,1087],[177,1117],[193,1155],[213,1190],[204,1234],[170,1259],[137,1285],[93,1293],[56,1247],[35,1209],[24,1177],[0,1192]]], opacity=0.46)
add('left-man-dark-trousers', 'person_pants', [[[93,1291],[174,1265],[210,1303],[232,1337],[275,1388],[309,1448],[324,1501],[365,1550],[346,1578],[283,1584],[289,1554],[271,1524],[235,1488],[220,1454],[191,1412],[157,1391],[138,1350],[101,1316]]], opacity=0.52)
add('left-man-dark-hair', 'person_hair', [[[0,918],[25,903],[57,902],[84,916],[81,947],[95,977],[79,1004],[36,1007],[13,978],[0,964]]], opacity=0.58)
add('left-woman-dark-long-hair', 'person_hair', [[[75,969],[101,960],[120,978],[139,1001],[171,1024],[201,1059],[220,1085],[232,1109],[225,1123],[204,1114],[193,1093],[183,1063],[163,1059],[152,1070],[136,1065],[128,1046],[119,1012],[86,1001]]], opacity=0.61)
add('left-woman-light-blouse', 'person_shirt', [[[144,1040],[158,1028],[176,1027],[188,1043],[194,1070],[212,1100],[237,1123],[240,1151],[219,1165],[201,1168],[175,1158],[160,1138],[161,1110],[148,1080]]], opacity=0.32)
add('left-woman-pleated-skirt-and-tights', 'person_pants', [
    [[221,1156],[245,1179],[287,1204],[328,1237],[327,1281],[303,1328],[278,1354],[248,1349],[235,1318],[228,1283],[207,1252],[201,1221]],
    [[300,1285],[329,1280],[340,1318],[375,1364],[390,1414],[414,1480],[413,1524],[391,1538],[355,1546],[337,1538],[335,1516],[357,1492],[341,1464],[317,1429],[307,1386],[286,1360]],
], opacity=0.46)
add('left-front-cropped-light-coat', 'person_shirt', [[[0,1264],[35,1283],[64,1325],[80,1368],[108,1438],[142,1518],[192,1599],[0,1599]]], opacity=0.38)

doc = dict(width=WIDTH, height=HEIGHT, layers=layers,
           notes='Background undercoats are broad behind Edelweiss and must be composited BEFORE her foreground masks. gray_max selects only nonwhite source pixels inside foliage/metal polygons. All palettes for visitors are subdued creative adaptation, not canonical wardrobe colors.')
(ROOT / 'background-masks.json').write_text(json.dumps(doc, ensure_ascii=False, indent=2), encoding='utf-8')

# QA overlay: distinct material colors over the unchanged source luminance.
source = Image.open(SOURCE).convert('RGB')
gray = np.asarray(source.convert('L'), dtype=np.float32)
base = np.asarray(source, dtype=np.float32)
palette = {'sky':(191,218,239),'building':(203,199,192),'stone':(223,216,203),
           'glass':(188,214,223),'pavement':(214,207,196),'awning':(153,140,125),
           'wood':(103,94,87),'foliage':(100,137,110),'trunk':(111,92,72),
           'person_shirt':(158,161,166),'person_pants':(114,123,136),
           'person_hair':(113,98,92),'person_skin':(245,216,188),'cafe_metal':(127,115,98)}
contours = source.copy()
draw = ImageDraw.Draw(contours)
for index, layer in enumerate(layers):
    mask = Image.new('L', (WIDTH,HEIGHT), 0)
    md = ImageDraw.Draw(mask)
    for polygon in layer['polygons']:
        md.polygon([tuple(p) for p in polygon], fill=255)
    for polygon in layer.get('holes',[]):
        md.polygon([tuple(p) for p in polygon], fill=0)
    mask = mask.filter(ImageFilter.GaussianBlur(layer.get('blur',0.6)))
    alpha = np.asarray(mask,dtype=np.float32) / 255
    if 'gray_max' in layer:
        alpha *= np.clip((layer['gray_max'] + 20-gray)/20,0,1)
    alpha *= layer.get('opacity',0.6)
    # Multiplicative tint keeps the original value hierarchy and all linework.
    color = np.array(palette[layer['kind']],dtype=np.float32)
    tinted = gray[:,:,None] * color[None,None,:]/255
    base = base*(1-alpha[:,:,None]) + tinted*alpha[:,:,None]
    edge = tuple(int(c) for c in color)
    for polygon in layer['polygons']:
        draw.line([tuple(p) for p in polygon+[polygon[0]]],fill=edge,width=2)
        # Labels in the first polygon's first vertex are intentionally compact.
    point=layer['polygons'][0][0]
    draw.text((point[0]+2,point[1]+2),f'{index+1} {layer["kind"]}',fill=(170,35,55))
Image.fromarray(np.clip(base,0,255).astype('uint8')).save(ROOT/'background-undercoat-review.png')
contours.save(ROOT/'background-mask-contours.png')
print(f'Saved {len(layers)} layers: {ROOT / "background-masks.json"}')
