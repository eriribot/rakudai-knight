"""Animated arena roster panels using the TV-anime's original character sheets."""
from pathlib import Path
import cv2,numpy as np
from PIL import Image,ImageDraw,ImageFont
P=Path(__file__).resolve().parent
PORTRAITS=P/'素材/v2/portraits'
FONT=ImageFont.truetype(r'C:\Windows\Fonts\msjh.ttc',31)
SMALL=ImageFont.truetype(r'C:\Windows\Fonts\arial.ttf',20)
SCHOOL=ImageFont.truetype(r'C:\Windows\Fonts\msjh.ttc',22)
META={
 'ikki':([451,160,180,280],'黑鐵一輝','IKKI KUROGANE'),
 'stella':([385,200,255,340],'史黛菈','STELLA VERMILLION'),
 'toka':([425,120,220,330],'東堂刀華','TOKA TODO'),
 'shizuku':([400,120,250,330],'黑鐵珠雫','SHIZUKU KUROGANE')}
CACHE={}

def portrait(key):
    if key in CACHE:return CACHE[key].copy()
    image=Image.open(PORTRAITS/f'{key}_anime_official.jpg').convert('RGB')
    x,y,w,h=META[key][0]
    im=np.array(image.crop((x,y,x+w,y+h)).resize((440,550),Image.Resampling.LANCZOS))
    bgr=cv2.cvtColor(im,cv2.COLOR_RGB2BGR)
    gray=cv2.cvtColor(bgr,cv2.COLOR_BGR2GRAY).astype(np.float32)
    blue=np.stack([gray*.7+65,gray*.7+35,gray*.45+20],axis=2)
    bgr=np.clip(blue*.82+bgr*.18,0,255).astype(np.uint8)
    bgr[::3]=(bgr[::3]*.72).astype(np.uint8)
    CACHE[key]=bgr
    return bgr.copy()

def centered(draw,xy,text,font,fill):
    box=draw.textbbox((0,0),text,font=font)
    draw.text((xy[0]-(box[2]-box[0])/2,xy[1]),text,font=font,fill=fill,anchor='lt')

def roster_frame(background,keys,offset,duration):
    # A new broadcast graphic covers the old roster completely; no old-face crossfade.
    frame=(cv2.GaussianBlur(background,(0,0),26)*.24).astype(np.uint8)
    yy,xx=np.mgrid[:720,:1280]
    beam=np.exp(-((xx-640)/300)**2)*np.clip(1-yy/900,0,1)
    frame=np.clip(frame+beam[:,:,None]*np.array([37,18,5]),0,255).astype(np.uint8)
    amount=min(1,offset/.12)
    drift=(1-amount)*26
    quads=[np.float32([[70-drift,30],[535-drift,55],[545-drift,554],[105-drift,585]]),
           np.float32([[745+drift,55],[1210+drift,30],[1175+drift,585],[735+drift,554]])]
    for key,q in zip(keys,quads):
        im=portrait(key)
        mat=cv2.getPerspectiveTransform(np.float32([[0,0],[439,0],[439,549],[0,549]]),q)
        warped=cv2.warpPerspective(im,mat,(1280,720),flags=cv2.INTER_LINEAR)
        mask=cv2.warpPerspective(np.ones((550,440),np.uint8)*255,mat,(1280,720))
        alpha=mask[:,:,None].astype(np.float32)/255
        frame=(frame*(1-alpha)+warped*alpha).astype(np.uint8)
        cv2.polylines(frame,[q.astype(np.int32)],True,(255,192,91),2,cv2.LINE_AA)
    # Scan-in is applied to the new screens rather than blending back to prior participants.
    if amount<1:
        scan_y=int(40+amount*545)
        frame[scan_y:585]=(frame[scan_y:585]*.22).astype(np.uint8)
        cv2.line(frame,(70,scan_y),(1210,scan_y),(255,246,196),2,cv2.LINE_AA)
    cv2.line(frame,(100,606),(1180,606),(220,142,54),1,cv2.LINE_AA)
    im=Image.fromarray(cv2.cvtColor(frame,cv2.COLOR_BGR2RGB));d=ImageDraw.Draw(im)
    for key,cx in zip(keys,[320,960]):
        centered(d,(cx,620),META[key][1],FONT,(226,243,255))
        centered(d,(cx,660),META[key][2],SMALL,(140,191,229))
    d.polygon([(640,578),(665,603),(640,628),(615,603)],fill=(8,35,69),outline=(101,195,255),width=2)
    centered(d,(640,588),'破軍',SCHOOL,(226,244,255))
    return cv2.cvtColor(np.array(im),cv2.COLOR_RGB2BGR)
