"""Pixel-preserving mattes of the official anime portraits and licensed crest."""
from pathlib import Path
import json,cv2,numpy as np
from PIL import Image,ImageDraw
P=Path(__file__).resolve().parent
OUT=P/'素材/v3/roster_assets';OUT.mkdir(parents=True,exist_ok=True)
SOURCE=P/'素材/v2/portraits'
# Manually traced silhouettes in the original 960x700 official character sheets.
# No generative reconstruction: every visible RGB pixel is from the official sheet.
SPECS={
 'ikki':{'points':[(443,259),(464,222),(475,183),(486,159),(482,181),(505,158),(542,153),(590,151),(570,163),(604,176),(630,190),(609,191),(630,216),(643,232),(625,225),(641,271),(625,259),(628,297),(613,278),(603,320),(585,348),(583,361),(610,373),(670,379),(680,386),(684,416),(704,422),(707,435),(720,444),(730,470),(738,481),(724,495),(698,503),(650,485),(638,536),(437,536),(425,507),(411,526),(408,516),(424,490),(419,472),(429,464),(421,430),(423,391),(433,383),(485,378),(516,361),(515,347),(498,331),(488,321),(484,333),(474,315),(465,295),(464,284),(454,299),(457,272)],'fade':(493,535)},
 'stella':{'points':[(393,196),(418,209),(440,237),(448,234),(467,229),(495,226),(519,229),(542,238),(551,207),(577,186),(575,214),(621,215),(598,238),(577,248),(601,254),(616,275),(630,312),(636,356),(635,385),(639,399),(648,396),(645,406),(635,409),(623,399),(613,375),(608,350),(599,314),(587,291),(587,339),(584,376),(591,408),(607,415),(614,436),(624,467),(646,488),(649,510),(643,524),(638,542),(393,542),(381,525),(375,511),(371,500),(374,480),(395,450),(411,424),(420,406),(416,368),(414,338),(407,365),(403,393),(398,407),(388,416),(378,420),(372,417),(373,409),(378,412),(387,410),(392,401),(390,386),(386,349),(384,315),(387,283),(398,258),(385,250),(377,226),(407,232),(401,216)],'fade':(495,540)},
 'toka':{'points':[(525,122),(544,137),(552,155),(579,159),(607,177),(627,203),(638,235),(639,270),(634,299),(635,323),(646,355),(642,371),(620,387),(609,391),(621,412),(630,429),(634,459),(648,492),(651,508),(645,525),(632,541),(447,545),(438,510),(421,503),(408,487),(404,467),(392,473),(366,479),(346,480),(333,471),(334,448),(338,424),(352,410),(372,393),(393,365),(410,344),(425,315),(433,287),(437,276),(441,279),(438,299),(446,283),(448,264),(452,259),(455,271),(455,258),(461,262),(460,235),(464,202),(467,182),(486,173),(519,161),(541,154),(534,139)],'fade':(505,550)},
 'shizuku':{'points':[(489,125),(505,130),(515,141),(537,135),(557,138),(580,154),(600,177),(610,206),(612,226),(623,247),(608,239),(607,265),(600,257),(597,289),(584,310),(576,331),(571,320),(568,340),(561,333),(560,348),(579,359),(606,351),(617,356),(627,377),(638,408),(653,425),(655,437),(648,447),(635,451),(637,467),(648,489),(644,517),(636,529),(610,532),(593,526),(583,505),(574,489),(566,546),(449,546),(446,516),(429,534),(416,536),(404,522),(394,508),(393,496),(398,475),(401,453),(405,438),(398,422),(399,407),(417,400),(428,388),(441,385),(444,372),(456,359),(482,358),(497,348),(483,338),(467,328),(469,339),(457,323),(448,313),(445,322),(434,304),(428,298),(430,313),(418,295),(411,275),(409,250),(411,219),(419,189),(433,169),(447,155),(470,143),(495,139),(503,140)],'fade':(507,550)}
}

def main():
    rows=[];contact=Image.new('RGB',(1000,640),'#06101d');draw=ImageDraw.Draw(contact)
    for j,(key,spec) in enumerate(SPECS.items()):
        source=SOURCE/f'{key}_anime_official.jpg';im=Image.open(source).convert('RGB')
        # Four-times supersampled polygon avoids a paper-coloured fringe at the cutout.
        mask=Image.new('L',(im.width*4,im.height*4));md=ImageDraw.Draw(mask)
        md.polygon([(x*4,y*4) for x,y in spec['points']],fill=255)
        mask=np.array(mask.resize(im.size,Image.Resampling.LANCZOS)).astype(float)/255
        # A one-pixel inward edge suppresses the printed-paper antialias fringe
        # without guessing skin/hair colours or deleting thin animation details.
        mask=cv2.erode(mask.astype(np.float32),np.ones((3,3),np.uint8))
        if key=='stella':
            holes=[[(406,289),(410,317),(414,344),(413,371),(406,394),(403,381),(405,352)],[(586,292),(598,318),(606,355),(608,378),(600,401),(591,404),(586,376)]]
            for hole in holes:cv2.fillPoly(mask,[np.int32(hole)],0)
        a,b=spec['fade'];fade=np.clip((b-np.arange(im.height))/(b-a),0,1)
        mask*=fade[:,None]
        ys,xs=np.where(mask>.005);box=(int(xs.min()),int(ys.min()),int(xs.max()+1),int(ys.max()+1))
        rgba=np.dstack([np.array(im),(mask*255).astype(np.uint8)])
        out=Image.fromarray(rgba).crop(box);path=OUT/f'{key}_anime_matte.png';out.save(path)
        preview=out.copy();preview.thumbnail((245,570));contact.paste(preview,(j*250+(250-preview.width)//2,45),preview)
        draw.text((j*250+8,12),key,fill='white')
        rows.append({'character':key,'source_file':str(source),'source_page':'https://ittoshura.com/character/','source_url':f'https://ittoshura.com/character/chara_{key}.jpg','output':str(path),'method':'manual silhouette alpha matte; original RGB pixels unchanged; lower official print fade masked','crop':box,'size':out.size})
    crest_source=P/'素材/v3/roster_sources/hagun_school_emblem_bellfine_original.jpg'
    crest=np.array(Image.open(crest_source).convert('RGB'))[430:817,258:609]
    # Extract the actual yellow/gold printed emblem. White acrylic and chain are excluded.
    hsv=cv2.cvtColor(crest,cv2.COLOR_RGB2HSV);gold=((hsv[:,:,1]>70)&(hsv[:,:,0]>16)&(hsv[:,:,0]<43)&(hsv[:,:,2]>90)).astype(np.uint8)*255
    alpha=cv2.GaussianBlur(gold,(3,3),.45);rgba=np.dstack([crest,alpha]);Image.fromarray(rgba).save(OUT/'hagun_crest_gold.png')
    rows.append({'asset':'Hagun Academy official school emblem','source_file':str(crest_source),'source_url':'https://bellfine.co.jp/wp-content/uploads/g724405_0.jpg','source_page':'https://bellfine.co.jp/products/characters-goods/strap-key-chain/g724405/','identity_evidence':'Manufacturer product explicitly named 破軍学園校章キーホルダー, JAN 4573347244056, copyright 落第騎士の英雄譚製作委員会. Not the anime website red dragon graphic.','output':str(OUT/'hagun_crest_gold.png'),'method':'extract original gold/yellow ink pixels from licensed product image; no invented/retraced design','crop_xyxy':[258,430,609,817]})
    (OUT/'sources.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')
    contact.save(OUT/'matte_contact.jpg',quality=95)
    print(OUT)
if __name__=='__main__':main()
