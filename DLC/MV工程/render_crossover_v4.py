"""Fast V4 render: color holograms, matte cleanup, conservative anime restoration."""
import sys,json
from pathlib import Path
import cv2,numpy as np
import render_crossover_v2 as engine
from roster_video_v4 import roster_frame
P=Path(__file__).resolve().parent
OriginalClips=engine.Clips
previous_render_item=engine.render_item

class EnhancedClips(OriginalClips):
    def prepare_crop(self,frame,desc):
        if desc['file']=='clean':return frame
        # Smooth codec ringing and block noise while retaining ink boundaries.
        clean=cv2.bilateralFilter(frame,5,18,1.65)
        # Retain fine original texture; avoid a waxy all-denoised output.
        return cv2.addWeighted(clean,.78,frame,.22,0)
    def finish_resize(self,frame,desc):
        if desc['file']=='clean':return frame
        # Luma-only, clamped detail enhancement does not create colored halos.
        yuv=cv2.cvtColor(frame,cv2.COLOR_BGR2YCrCb)
        lum=yuv[:,:,0].astype(np.float32)
        soft=cv2.GaussianBlur(lum,(0,0),.9)
        detail=lum-soft
        strength=np.clip((np.abs(detail)-.65)/2,0,1)
        fine=np.clip(detail,-7,7)*strength*.80
        broad=np.clip(lum-cv2.GaussianBlur(lum,(0,0),3.2),-8,8)*.14
        yuv[:,:,0]=np.clip(lum+fine+broad,0,255).astype(np.uint8)
        return cv2.cvtColor(yuv,cv2.COLOR_YCrCb2BGR)

def render_item(clips,item,offset):
    if item.get('kind')=='roster':
        bg=clips.frame(dict(file='clean',clip_start=item['start'],crop=[0,0,1280,720]),offset)
        return roster_frame(bg,item['characters'],item['start']+offset)
    return previous_render_item(clips,item,offset)

engine.Clips=EnhancedClips
engine.render_item=render_item
if __name__=='__main__':
    plan=json.loads((P/'edit_plan_v3.json').read_text(encoding='utf-8'))
    plan.update(output='学战都市×落第骑士英雄谭_联合MV_V4_彩色清晰版.mp4',
        title='The Asterisk War x Rakudai - Color and Detail V4',
        check_directory='检查/v4',preset='fast',crf=17,
        enhancement='Edge-preserving native deblock, Lanczos upscale, clamped luma sharpening; original character colors under pale cyan projection',
        validation='User requested direct edits and faster delivery; no repeated QA suite')
    target=P/'edit_plan_v4.json'
    target.write_text(json.dumps(plan,ensure_ascii=False,indent=2),encoding='utf-8')
    if '--plan' not in sys.argv:sys.argv.extend(['--plan',str(target)])
    engine.main()
