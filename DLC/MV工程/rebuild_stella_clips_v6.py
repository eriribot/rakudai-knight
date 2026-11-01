"""Rebuild only the two confirmed continuous Stella shots in the V6 delivery."""
import json
import time
from pathlib import Path
import numpy as np
import build_repaired_clips_v6 as build
from propagate_frame_repair import propagate


def main():
    manifest_path=build.OUT/'manifest.json'
    manifest=json.loads(manifest_path.read_text('utf-8'))
    plan=json.loads((build.P/'repair_plan_v6.json').read_text('utf-8'))
    selected=json.loads(build.INPUTS.read_text('utf-8'))['items']
    clips=build.engine.Clips()
    try:
        for index in (33,34):
            item=next(x for x in plan['edits'] if x['item_index']==index)
            row=next(x for x in manifest['clips'] if x['item_index']==index)
            count=round((item['end']-item['start'])*build.FPS)
            frames=[clips.frame(item,j/build.FPS) for j in range(count)]
            anchors={};mapped=[]
            for chosen in selected:
                if chosen['plan_item_index_0based']!=index:
                    continue
                key=chosen['target_frame_index_0based']-round(item['start']*build.FPS)
                path=build.RESTORED/Path(chosen['input_png']).name
                anchors[key],record=build.map_anchor(path,frames[key],item['original_descriptor'],item)
                record.update({'id':chosen['id'],'key_idx':key,'target_seconds':chosen['target_seconds']})
                mapped.append(record)
            diagnostic={}
            repaired=propagate(frames,anchors,max_distance=16,cut_indices=[],
                               detect_cuts=False,diagnostics=diagnostic)
            diagnostic['automatic_cut_detection']=False
            diagnostic['shot_boundary_source']='Parent-confirmed single continuous cut for this whole item'
            # If severe occlusion still leaves a <=2-frame repair island, reduce
            # that island with a smooth temporal envelope instead of a bright pop.
            energy=np.array([np.mean(np.abs(a.astype(np.float32)-b.astype(np.float32)))
                             for a,b in zip(repaired,frames)])
            active=np.flatnonzero(energy>.12)
            sparse_taper=False
            if 0<len(active)<=2 and float(energy.max())>1.0:
                center=float(np.mean(active))
                envelope=.35*np.exp(-.5*((np.arange(count)-center)/2.0)**2)
                repaired=[np.clip(b.astype(np.float32)+(a.astype(np.float32)-b)*strength,0,255).astype(np.uint8)
                          for a,b,strength in zip(repaired,frames,envelope)]
                sparse_taper=True
            changed=[];changed_pixels=0
            for j,(before,after) in enumerate(zip(frames,repaired)):
                delta=np.max(np.abs(after.astype(np.int16)-before.astype(np.int16)),axis=2)
                pixels=int(np.count_nonzero(delta>=2));changed_pixels+=pixels
                if pixels>=256:
                    changed.append(j)
            path=build.OUT/f'item_{index:02}.mp4'
            build.encode(repaired,path)
            previous=row['actual_repaired_frames']
            row.update({'anchor_mapping':mapped,'diagnostics':diagnostic,
                'actual_repaired_frames':len(changed),'repaired_local_frame_indices':changed,
                'changed_pixels_at_least_2_levels_total':changed_pixels,'file_bytes':path.stat().st_size,
                'continuous_shot_rebuild':{'previous_repaired_frames':previous,'max_distance':16,
                    'automatic_cut_detection':False,'sparse_repair_taper_applied':sparse_taper,
                    'all_original_occlusion_and_registration_gates_retained':True}})
            manifest['actual_repaired_frames']=sum(x['actual_repaired_frames'] for x in manifest['clips'])
            manifest['last_rebuild']={'items':[33,34],'reason':'confirmed continuous shots; disable false automatic cuts',
                                      'unix_time':time.time()}
            manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
            print(json.dumps({'item':index,'before':previous,'after':len(changed),
                'total_frames':count,'taper':sparse_taper,'cuts':diagnostic['cuts']}),flush=True)
    finally:
        clips.close()


if __name__=='__main__':
    main()
