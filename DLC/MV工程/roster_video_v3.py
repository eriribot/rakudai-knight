"""Replace only the contents of the original moving six-sided arena displays.

Public interface: roster_frame(background_bgr, characters, target_time_seconds).
background_bgr must be the clean ORIGINAL frame at that absolute timeline time.
The actual stage, physical panel rims, central beam and animated name bars remain.
"""
from pathlib import Path
from functools import lru_cache
import json,cv2,numpy as np
from PIL import Image,ImageDraw,ImageFont
P=Path(__file__).resolve().parent
A=P/'素材/v3/roster_assets'
W,H=1280,720
FONT=ImageFont.truetype(r'C:\Windows\Fonts\arial.ttf',30)
META={'ikki':'Ikki Kurogane','stella':'Stella Vermillion','toka':'Toka Todo','touka':'Toka Todo','shizuku':'Shizuku Kurogane'}
DATA=json.loads((P/'检查/V2学战动作/screen_compositor_anchors.json').read_text(encoding='utf-8'))
GROUPS={x['id']:x for x in DATA['panels']}
# Inner, not outer, physical panel contours at the anchor reference frame.
# Upper vertices are beyond the crop of the original camera.
POLYS={
 'doroteo_elliott':{'left':[[-55,300],[180,-150],[432,-60],[577,306],[498,489],[237,529]],'right':[[730,312],[841,-80],[1080,-55],[1250,300],[1016,489],[790,465]]},
 'ard_rmc':{'left':[[-26,299],[184,-150],[436,-75],[542,307],[466,493],[181,519]],'right':[[725,309],[840,-115],[1124,-75],[1342,306],[1105,540],[798,504]]}}
OLD={
 'doroteo_elliott':{'left':[[268,104],[394,98],[432,155],[433,259],[451,288],[538,321],[556,385],[501,491],[237,529],[104,352],[221,310],[275,292],[294,269],[283,199]],'right':[[823,154],[895,130],[947,153],[964,217],[952,272],[941,297],[1021,325],[1043,428],[1017,490],[790,466],[775,361],[790,332],[836,320],[838,291],[821,265],[805,227],[811,189]]},
 'ard_rmc':{'left':[[164,89],[305,65],[362,87],[446,109],[514,174],[543,306],[521,411],[466,496],[180,521],[149,447],[140,235]],'right':[[829,55],[1045,9],[1106,60],[1132,170],[1172,230],[1236,352],[1246,401],[1136,468],[1107,542],[800,509],[764,388],[793,299],[814,209]]}}
PLACE={
 'doroteo_elliott':{'left':(334,330,445),'right':(928,330,395)},
 'ard_rmc':{'left':(330,323,445),'right':(1013,333,475)}}
# Inner medallion vertices, clockwise from the same material-space top vertex.
# The offscreen vertices preserve the actual spinning/camera-sweep projection.
TRANSITIONS={
295:[[[819,113],[1054,239],[1066,490],[848,630],[621,510],[611,268]]],
296:[[[1153,-47],[1264,220],[1127,416],[880,410],[787,190],[907,-54]]],
297:[[[291,628],[437,777],[370,983],[160,1030],[10,870],[81,683]],[[1240,348],[1390,475],[1350,670],[1160,733],[1026,585],[1065,407]]],
298:[[[518,458],[645,539],[632,700],[474,785],[342,684],[361,515]],[[1378,-15],[1520,100],[1490,330],[1330,420],[1184,310],[1204,125]]],
299:[[[575,366],[716,450],[710,610],[575,685],[429,609],[430,444]],[[1380,-130],[1530,-20],[1520,170],[1370,250],[1215,185],[1217,0]]],
300:[[[604,325],[745,400],[747,570],[609,642],[465,565],[463,398]],[[1390,-200],[1540,-90],[1530,100],[1380,180],[1225,115],[1227,-70]]],
301:[[[620,315],[765,389],[761,548],[625,624],[478,552],[476,388]],[[1390,-240],[1540,-130],[1530,60],[1380,140],[1225,75],[1227,-110]]],
320:[[[906,476],[1019,592],[960,770],[801,807],[702,665],[745,517]],[[67,644],[195,800],[140,978],[-50,1020],[-200,860],[-138,685]]],
321:[[[906,476],[1019,592],[960,770],[801,807],[702,665],[745,517]],[[67,644],[195,800],[140,978],[-50,1020],[-200,860],[-138,685]]],
322:[[[183,-26],[306,54],[315,206],[193,275],[61,215],[58,71]]],
323:[[[300,113],[445,159],[478,306],[367,396],[231,356],[201,213]]],
324:[[[362,153],[502,193],[544,332],[443,434],[302,393],[269,258]]],
325:[[[393,175],[535,206],[573,344],[476,448],[335,418],[298,282]]]
}

@lru_cache(maxsize=8)
def _portrait(key):
    key='toka' if key=='touka' else key
    rgba=np.array(Image.open(A/f'{key}_anime_matte.png').convert('RGBA'))
    rgb=rgba[:,:,:3].astype(np.float32);gray=cv2.cvtColor(rgb,cv2.COLOR_RGB2GRAY)
    # Original arena displays are cyan/blue monochrome CRT projections.
    blue=np.stack([gray*.57+16,gray*.83+28,gray*.94+35],axis=2)
    rgb=np.clip(blue*.94+rgb*.06,0,255).astype(np.uint8)
    return np.dstack([cv2.cvtColor(rgb,cv2.COLOR_RGB2BGR),rgba[:,:,3]])

def _quad(group,side,t):
    samples=group['samples'];pairs=list(zip(samples,samples[1:]))
    a,b=next(((a,b) for a,b in pairs if a['seconds']<=t<=b['seconds']),pairs[0] if t<samples[0]['seconds'] else pairs[-1])
    f=(t-a['seconds'])/(b['seconds']-a['seconds'])
    return np.float32(a['quads'][side])*(1-f)+np.float32(b['quads'][side])*f

def _transform(group,side,t):
    ref=next(x for x in group['samples'] if x['frame']==group['reference'])
    return cv2.getPerspectiveTransform(np.float32(ref['quads'][side]),_quad(group,side,t))

@lru_cache(maxsize=4)
def _reference_blank(group_id,side):
    group=GROUPS[group_id];cap=cv2.VideoCapture(str(P/'学战都市_去水印母版.mp4'))
    cap.set(cv2.CAP_PROP_POS_FRAMES,group['reference']);ok,ref=cap.read();cap.release()
    if not ok:raise RuntimeError('Cannot read original roster reference')
    mask=np.zeros((H,W),np.uint8);cv2.fillPoly(mask,[np.int32(OLD[group_id][side])],255)
    mask=cv2.dilate(mask,np.ones((25,25),np.uint8))
    screen=np.zeros((H,W),np.uint8);cv2.fillConvexPoly(screen,np.int32(POLYS[group_id][side]),255)
    sample=(screen>0)&(mask==0)
    row=np.full((H,3),np.nan)
    for y in range(H):
        if sample[y].sum()>12:row[y]=np.median(ref[y,sample[y]],axis=0)
    for c in range(3):
        good=np.isfinite(row[:,c]);row[:,c]=np.interp(np.arange(H),np.where(good)[0],row[good,c])
    row=cv2.GaussianBlur(row.astype(np.float32),(1,0),sigmaY=12,sigmaX=0)
    return np.tile(row[:,None,:],(1,W,1)).astype(np.uint8)

def _screen(group_id,side,key,t,original):
    group=GROUPS[group_id];mat=_transform(group,side,t)
    poly=cv2.perspectiveTransform(np.float32(POLYS[group_id][side])[None],mat)[0]
    mask=np.zeros((H,W),np.uint8);cv2.fillConvexPoly(mask,np.round(poly).astype(np.int32),255,cv2.LINE_AA)
    yy,xx=np.mgrid[:H,:W]
    offset=t-group['interval'][0];progress=np.clip(offset/.24,0,1)
    old_poly=cv2.perspectiveTransform(np.float32(OLD[group_id][side])[None],mat)[0]
    old_mask=np.zeros((H,W),np.uint8);cv2.fillPoly(old_mask,[np.round(old_poly).astype(np.int32)],255)
    old_mask=cv2.dilate(old_mask,np.ones((23,23),np.uint8))
    old_mask=cv2.bitwise_and(old_mask,mask)
    # Early source frames contain both sides of a rotating old portrait. Erase the
    # whole inner display only during that reveal; otherwise erase its silhouette.
    if progress<1:old_mask=mask.copy()
    # Local harmonic fill follows the actual projected blue glass and light beams.
    # Downsampling estimates lighting, not a substitute frame or a blurred stage.
    small=cv2.resize(original,(320,180),interpolation=cv2.INTER_AREA)
    sm=cv2.resize(old_mask,(320,180),interpolation=cv2.INTER_NEAREST)
    sm=cv2.dilate(sm,np.ones((3,3),np.uint8))
    if progress<1:
        filled=cv2.warpPerspective(_reference_blank(group_id,side),mat,(W,H),flags=cv2.INTER_LINEAR,borderMode=cv2.BORDER_REPLICATE)
        # Original reveal starts under a bright moving camera flare. Match that
        # foreground illumination using the character-free top edge of this shot.
        topmask=(mask[:65]>0)
        if topmask.any():
            delta=np.maximum(np.median(original[:65][topmask],axis=0)-np.median(filled[:65][topmask],axis=0),0)
            filled=np.clip(filled.astype(float)+np.exp(-yy/135)[:,:,None]*delta,0,255).astype(np.uint8)
    else:
        filled=cv2.inpaint(small,sm,3,cv2.INPAINT_TELEA)
        filled=cv2.resize(filled,(W,H),interpolation=cv2.INTER_CUBIC)
    old_alpha=old_mask[:,:,None].astype(float)/255
    face=original.astype(float)*(1-old_alpha)+filled.astype(float)*old_alpha
    portrait=_portrait(key);cx,cy,height=PLACE[group_id][side]
    scale=height/portrait.shape[0];width=round(portrait.shape[1]*scale)
    port=cv2.resize(portrait,(width,height),interpolation=cv2.INTER_LANCZOS4)
    canvas=np.zeros((H,W,4),np.uint8);x=round(cx-width/2);y=round(cy-height/2)
    canvas[y:y+height,x:x+width]=port
    warped=cv2.warpPerspective(canvas,mat,(W,H),flags=cv2.INTER_LINEAR)
    alpha=warped[:,:,3:4].astype(float)/255
    scan_y=540-(progress*550)
    reveal=np.clip((yy-scan_y)/5,0,1)
    alpha*=(.16+.84*reveal)[:,:,None]
    projected=warped[:,:,:3].astype(float)
    projected[::2]*=.82
    # Retain the native blue flare over the newly projected people as well.
    ambient=filled.astype(float)
    projected=np.clip(projected+ambient*.26,0,255)
    face=face*(1-alpha)+projected*alpha
    # Same bottom-to-top projection reveal; old faces never bleed into this one.
    if progress<1:
        beam=np.exp(-((yy-scan_y)/5)**2)
        face+=beam[:,:,None]*np.array([94,94,34])
    return np.clip(face,0,255).astype(np.uint8),mask

def _erase_names(frame):
    # Inpaint glyph pixels only; retain the actual bar shading, border and animation.
    roi=np.zeros((H,W),np.uint8)
    for x0,x1 in [(205,552),(795,1110)]:roi[559:638,x0:x1]=255
    b,g,r=cv2.split(frame)
    bright=((b>120)&(g>100)&(r>87)).astype(np.uint8)*255
    mask=cv2.bitwise_and(bright,roi)
    mask=cv2.dilate(mask,np.ones((11,11),np.uint8),iterations=1)
    return cv2.inpaint(frame,mask,4,cv2.INPAINT_TELEA)

def _names(frame,characters,offset):
    if offset<.16:return frame
    p=np.clip((offset-.16)/.28,0,1)
    scale=.12+.88*p
    for key,cx in zip(characters,[347,944]):
        im=Image.new('RGBA',(430,45));d=ImageDraw.Draw(im)
        text=META[key];box=d.textbbox((0,0),text,font=FONT)
        d.text(((430-(box[2]-box[0]))/2,0),text,font=FONT,fill=(224,238,254,255),stroke_width=0,anchor='lt')
        arr=np.array(im.resize((430,max(2,round(45*scale))),Image.Resampling.LANCZOS))
        y=round(572+29*p);x=cx-215
        rgb=cv2.cvtColor(arr[:,:,:3],cv2.COLOR_RGB2BGR);alpha=arr[:,:,3:4].astype(float)/255
        patch=frame[y:y+arr.shape[0],x:x+430]
        frame[y:y+arr.shape[0],x:x+430]=(patch*(1-alpha)+rgb*alpha).astype(np.uint8)
    return frame

@lru_cache(maxsize=1)
def _crest():
    return np.array(Image.open(A/'hagun_crest_gold.png').convert('RGBA'))

def _badge(frame,offset):
    # Preserve the original ornamental supports, replacing the old school crest only.
    mask=np.zeros((H,W),np.uint8)
    poly=np.int32([[640,540],[686,568],[686,613],[640,641],[594,613],[594,568]])
    cv2.fillConvexPoly(mask,poly,255)
    frame=cv2.inpaint(frame,mask,5,cv2.INPAINT_TELEA)
    if offset<.16:return frame
    p=np.clip((offset-.16)/.33,0,1);sx=.10+.90*p
    crest=_crest();height=88;width=max(4,round(height*crest.shape[1]/crest.shape[0]*sx))
    port=np.array(Image.fromarray(crest).resize((width,height),Image.Resampling.LANCZOS))
    x=640-width//2;y=546
    rgb=cv2.cvtColor(port[:,:,:3],cv2.COLOR_RGB2BGR).astype(float)
    # Actual gold ink stays gold; the small outer halo matches the source projection.
    alpha=port[:,:,3:4].astype(float)/255
    old=frame[y:y+height,x:x+width].astype(float)
    frame[y:y+height,x:x+width]=np.clip(old*(1-alpha)+rgb*alpha,0,255).astype(np.uint8)
    return frame

@lru_cache(maxsize=1)
def _transition_crest():
    # Original verified printed ink, inset into the source's transparent glass seal.
    canvas=np.zeros((256,256,4),np.uint8)
    crest=_crest();height=196;width=round(height*crest.shape[1]/crest.shape[0])
    port=cv2.resize(crest,(width,height),interpolation=cv2.INTER_LANCZOS4)
    x=(256-width)//2;y=(256-height)//2
    canvas[y:y+height,x:x+width]=port
    return canvas

def _transition_frame(background,n):
    frame=background.copy();norm=np.float32([[128,0],[256,64],[256,192],[128,256],[0,192],[0,64]])
    b,g,r=cv2.split(background)
    cyan=((g.astype(int)-r.astype(int)>72)&(b.astype(int)-r.astype(int)>66)&(g>150))
    gray=cv2.cvtColor(background,cv2.COLOR_BGR2GRAY)
    ridges=cv2.morphologyEx(gray,cv2.MORPH_TOPHAT,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(19,19)))
    for vertices in TRANSITIONS[n]:
        points=np.float32(vertices);region=np.zeros((H,W),np.uint8)
        cv2.fillConvexPoly(region,points.round().astype(np.int32),255,cv2.LINE_AA)
        old=((ridges>3)&(gray>55)).astype(np.uint8)*255
        old=cv2.bitwise_and(old,region)
        old=cv2.dilate(old,np.ones((7,7),np.uint8))
        old=cv2.bitwise_and(old,region)
        # Fit the original empty blue glass from pixels between the old emblem's
        # thin strokes. Filling the full inner seal also removes its broad glow;
        # a stroke-only inpaint would leave a recognisable ghost of the old logo.
        valid=(region>0)&(old==0)
        ys,xs=np.where(valid)
        if len(xs)>40:
            step=max(1,len(xs)//12000);xs=xs[::step];ys=ys[::step]
            cx,cy=points.mean(axis=0);span=max(np.ptp(points[:,0]),np.ptp(points[:,1]),1)
            x=(xs-cx)/span;y=(ys-cy)/span
            design=np.stack([np.ones_like(x),x,y,x*x,x*y,y*y],axis=1)
            colors=background[ys,xs].astype(float)
            # Robust two-pass fit excludes remaining bright engraving/glow pixels.
            coef=np.linalg.lstsq(design,colors,rcond=None)[0]
            residual=np.mean(np.abs(design@coef-colors),axis=1)
            good=residual<np.percentile(residual,70)
            coef=np.linalg.lstsq(design[good],colors[good],rcond=None)[0]
            py,px=np.where(region>0);xx=(px-cx)/span;yy=(py-cy)/span
            target=np.stack([np.ones_like(xx),xx,yy,xx*xx,xx*yy,yy*yy],axis=1)
            glass=np.clip(target@coef,0,255)
            aa=region[py,px,None].astype(float)/255
            frame[py,px]=np.clip(frame[py,px]*(1-aa)+glass*aa,0,255).astype(np.uint8)
        mat,_=cv2.findHomography(norm,points,0)
        warped=cv2.warpPerspective(_transition_crest(),mat,(W,H),flags=cv2.INTER_LINEAR)
        alpha=warped[:,:,3:4].astype(float)/255
        rgb=cv2.cvtColor(warped[:,:,:3],cv2.COLOR_RGB2BGR).astype(float)
        alpha*=(region>0)[:,:,None]
        halo=cv2.GaussianBlur(alpha[:,:,0],(0,0),2.1)[:,:,None]
        frame=np.clip(frame.astype(float)+halo*np.array([14,34,30]),0,255)
        frame=np.clip(frame*(1-alpha)+rgb*alpha,0,255).astype(np.uint8)
    return frame

def roster_frame(background_bgr,characters,target_time_seconds):
    """Composite two anime characters into the original screen shot at absolute time."""
    t=float(target_time_seconds)
    n=round(t*25)
    if n in TRANSITIONS:return _transition_frame(background_bgr,n)
    group_id='doroteo_elliott' if 11.16-1e-6<=t<11.8-1e-6 else 'ard_rmc' if 12.08-1e-6<=t<12.8-1e-6 else None
    if group_id is None:return background_bgr.copy()
    frame=background_bgr.copy()
    for side,key in zip(['left','right'],characters):
        face,mask=_screen(group_id,side,key,t,background_bgr)
        a=mask[:,:,None].astype(float)/255
        frame=(frame*(1-a)+face*a).astype(np.uint8)
    offset=t-GROUPS[group_id]['interval'][0]
    frame=_erase_names(frame);frame=_badge(frame,offset);frame=_names(frame,characters,offset)
    return frame

def make_preview():
    import subprocess
    check=P/'检查/v3_roster';check.mkdir(parents=True,exist_ok=True)
    clean=P/'学战都市_去水印母版.mp4';cap=cv2.VideoCapture(str(clean))
    ff=r'E:\devtools\Anconda\Lib\site-packages\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v7.1.exe'
    output=check/'roster_v3_draft.mp4'
    proc=subprocess.Popen([ff,'-hide_banner','-loglevel','error','-y','-f','rawvideo','-pix_fmt','bgr24','-s','1280x720','-r','25','-i','pipe:0','-an','-c:v','libx264','-crf','18','-preset','fast','-pix_fmt','yuv420p',str(output)],stdin=subprocess.PIPE)
    snapshots=[]
    for n in range(279,326):
        t=n/25;cap.set(cv2.CAP_PROP_POS_FRAMES,n);ok,f=cap.read()
        if not ok:raise RuntimeError(n)
        keys=['ikki','stella'] if t<12.08 else ['toka','shizuku']
        out=roster_frame(f,keys,t)
        if n in [279,284,289,294,302,307,313,319] or n in TRANSITIONS:
            path=check/f'roster_{n:04}.png';cv2.imencode('.png',out)[1].tofile(path);snapshots.append((n,out))
        proc.stdin.write(out.tobytes())
    proc.stdin.close();code=proc.wait();cap.release()
    if code:raise RuntimeError(code)
    roster_snaps=[(n,f) for n,f in snapshots if n not in TRANSITIONS]
    sheet=Image.new('RGB',(1280,4*384));d=ImageDraw.Draw(sheet)
    for i,(n,f) in enumerate(roster_snaps):
        x=i%2*640;y=i//2*384;sheet.paste(Image.fromarray(cv2.cvtColor(f,cv2.COLOR_BGR2RGB)).resize((640,360)),(x,y+24));d.text((x+6,y+5),f'{n/25:.2f}s frame {n}',fill='white')
    sheet.save(check/'roster_contact.jpg',quality=95)
    import math
    transition_snaps=[(n,f) for n,f in snapshots if n in TRANSITIONS]
    sheet=Image.new('RGB',(1280,math.ceil(len(transition_snaps)/2)*384));d=ImageDraw.Draw(sheet)
    for i,(n,f) in enumerate(transition_snaps):
        x=i%2*640;y=i//2*384;sheet.paste(Image.fromarray(cv2.cvtColor(f,cv2.COLOR_BGR2RGB)).resize((640,360)),(x,y+24));d.text((x+6,y+5),f'{n/25:.2f}s frame {n}',fill='white')
    sheet.save(check/'crest_transitions_contact.jpg',quality=95)
    print(output)
if __name__=='__main__':make_preview()
