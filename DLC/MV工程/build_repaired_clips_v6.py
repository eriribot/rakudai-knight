"""Build the explicitly planned V6 replacement clips, without titles or impacts."""
from pathlib import Path
import json
import subprocess
import time
import cv2
import numpy as np
from PIL import Image

import render_crossover_v2 as engine
from propagate_frame_repair import propagate

P=Path(__file__).resolve().parent
OUT=P/'素材/v6/repaired_clips'
INPUTS=P/'素材/v6/imagegen_inputs/selected_inputs.json'
RESTORED=P/'素材/v6/imagegen_restored'
W,H,FPS=1280,720,25


def map_anchor(path,source_frame,old,new):
    """Map old edited-image pixels into the new native crop, with valid fill."""
    image=np.array(Image.open(path).convert('RGB'))
    image=cv2.cvtColor(image,cv2.COLOR_RGB2BGR)
    original_size=[image.shape[1],image.shape[0]]
    if image.shape[:2]!=(H,W):
        image=cv2.resize(image,(W,H),interpolation=cv2.INTER_LANCZOS4)
    if old.get('flip'):
        image=cv2.flip(image,1)
    canvas=cv2.flip(source_frame,1) if new.get('flip') else source_frame.copy()
    ox,oy,ow,oh=old.get('crop',[32,0,576,324])
    nx,ny,nw,nh=new.get('crop',[32,0,576,324])
    native_w,native_h=new.get('native_size',[640,360])
    sx_native=native_w/640;sy_native=native_h/360
    sx=sx_native*ow/nw;sy=sy_native*oh/nh
    tx=(sx_native*ox-nx)*W/nw+(sx-1)*.5
    ty=(sy_native*oy-ny)*H/nh+(sy-1)*.5
    matrix=np.float32([[sx,0,tx],[0,sy,ty]])
    projected=cv2.warpAffine(image,matrix,(W,H),flags=cv2.INTER_LINEAR)
    valid=cv2.warpAffine(np.ones((H,W),np.float32),matrix,(W,H),flags=cv2.INTER_LINEAR)
    # Discard fractional outside samples; keep new-source content in newly
    # exposed crop regions. A one-pixel inner transition avoids a hard seam.
    valid=(valid>.999).astype(np.float32)
    valid=cv2.erode(valid,np.ones((3,3),np.uint8))
    valid=cv2.GaussianBlur(valid,(3,3),.5)
    result=np.clip(projected.astype(np.float32)*valid[...,None]
                   +canvas.astype(np.float32)*(1-valid[...,None]),0,255).astype(np.uint8)
    if new.get('flip'):
        result=cv2.flip(result,1)
    return result,{'restored_file':str(path),'restored_native_size':original_size,
                   'old_native_size':[640,360],'new_native_size':[native_w,native_h],
                   'old_crop':[ox,oy,ow,oh],'new_crop':[nx,ny,nw,nh],
                   'old_flip':bool(old.get('flip')),'new_flip':bool(new.get('flip')),
                   'unflipped_old_to_new_affine':matrix.tolist(),
                   'valid_coverage':float(np.mean(valid>.99))}


def encode(frames,path):
    tmp=path.with_name(path.stem+'.part.mp4')
    command=[engine.FFMPEG,'-hide_banner','-loglevel','error','-y',
             '-f','rawvideo','-pix_fmt','bgr24','-s','1280x720','-r','25',
             '-i','pipe:0','-an','-c:v','libx264','-preset','fast','-crf','16',
             '-pix_fmt','yuv420p','-movflags','+faststart',str(tmp)]
    process=subprocess.Popen(command,stdin=subprocess.PIPE,stderr=subprocess.PIPE)
    try:
        for frame in frames:
            process.stdin.write(np.ascontiguousarray(frame).tobytes())
        process.stdin.close()
        error=process.stderr.read().decode('utf-8',errors='replace')
        code=process.wait()
        if code:
            raise RuntimeError(f'Clip encoding failed ({code}): {error}')
        tmp.replace(path)
    finally:
        if process.poll() is None:
            process.kill();process.wait()


def main():
    started=time.time();OUT.mkdir(parents=True,exist_ok=True)
    plan=json.loads((P/'repair_plan_v6.json').read_text('utf-8'))
    selected=json.loads(INPUTS.read_text('utf-8'))['items']
    by_item={}
    for anchor in selected:
        by_item.setdefault(anchor['plan_item_index_0based'],[]).append(anchor)
    clips=engine.Clips()
    manifest={'status':'building','fps':FPS,'size':[W,H],
              'plan':str(P/'repair_plan_v6.json'),'clips':[],
              'processing':'Unmodified engine.Clips source crops, flips and color matching; '
              'registered ImageGen anchor residuals propagated by bidirectional original-video optical flow; '
              'no lyrics, impact, extra sharpening or super-resolution.',
              'anchors_total':len(selected),'anchors_accepted':0,'anchors_rejected':0,
              'actual_repaired_frames':0,'total_frames':0}
    def save():
        manifest['elapsed_seconds']=round(time.time()-started,2)
        (OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
    try:
        # Export source-only items first so they are immediately available to
        # the final compositor, then complete the anchored cuts.
        edits=sorted(plan['edits'],key=lambda x:(bool(by_item.get(x['item_index'])),x['start']))
        for item in edits:
            index=item['item_index'];count=round((item['end']-item['start'])*FPS)
            frames=[clips.frame(item,j/FPS) for j in range(count)]
            anchors={};mapped=[]
            for chosen in by_item.get(index,[]):
                key=chosen['target_frame_index_0based']-round(item['start']*FPS)
                if not 0<=key<len(frames):
                    raise RuntimeError(f'Anchor outside item {index}: {key}')
                path=RESTORED/Path(chosen['input_png']).name
                if not path.is_file():
                    raise FileNotFoundError(path)
                anchors[key],record=map_anchor(path,frames[key],item['original_descriptor'],item)
                record.update({'id':chosen['id'],'key_idx':key,
                               'target_seconds':chosen['target_seconds']})
                mapped.append(record)
            diagnostic={}
            repaired=propagate(frames,anchors,max_distance=12,diagnostics=diagnostic) if anchors else frames
            changed=[];changed_pixels=0
            for j,(before,after) in enumerate(zip(frames,repaired)):
                delta=np.max(np.abs(after.astype(np.int16)-before.astype(np.int16)),axis=2)
                pixels=int(np.count_nonzero(delta>=2));changed_pixels+=pixels
                if pixels>=256:
                    changed.append(j)
            accepted=sum(bool(x['accepted']) for x in diagnostic.get('anchors',{}).values())
            rejected=len(anchors)-accepted
            path=OUT/f'item_{index:02}.mp4'
            encode(repaired,path)
            row={'item_index':index,'target_start':item['start'],'target_end':item['end'],
                 'file':str(path),'frames':count,'duration_seconds':count/FPS,
                 'descriptor':item,'anchor_mapping':mapped,'diagnostics':diagnostic,
                 'anchors_accepted':accepted,'anchors_rejected':rejected,
                 'actual_repaired_frames':len(changed),'repaired_local_frame_indices':changed,
                 'changed_pixels_at_least_2_levels_total':changed_pixels,
                 'file_bytes':path.stat().st_size}
            manifest['clips'].append(row)
            manifest['anchors_accepted']+=accepted;manifest['anchors_rejected']+=rejected
            manifest['actual_repaired_frames']+=len(changed);manifest['total_frames']+=count
            save()
            print(json.dumps({'item':index,'frames':count,'accepted':accepted,'rejected':rejected,
                              'repaired_frames':len(changed),'status':'saved'}),flush=True)
        manifest['clips'].sort(key=lambda x:x['target_start'])
        manifest['status']='complete';manifest['total_seconds']=manifest['total_frames']/FPS
        save()
        print(json.dumps({'status':'complete','clips':len(manifest['clips']),
            'accepted':manifest['anchors_accepted'],'repaired_frames':manifest['actual_repaired_frames'],
            'seconds':manifest['total_seconds']}),flush=True)
        if manifest['anchors_accepted']==0:
            raise RuntimeError('ZERO_IMAGEGEN_ANCHORS_ACCEPTED: all clips retain native dynamic sources')
    except Exception as exc:
        manifest['status']='failed';manifest['error']=str(exc);save();raise
    finally:
        clips.close()


if __name__=='__main__':
    main()
