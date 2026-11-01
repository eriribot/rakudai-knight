from pathlib import Path
import json
P=Path(__file__).resolve().parents[2];OUT=Path(__file__).resolve().parent
import sys
plan_name=sys.argv[1] if len(sys.argv)>1 else 'edit_plan_v2.json'
out_name='v3_plan_source_usage.json' if plan_name=='edit_plan_v3.json' else 'v3_global_source_usage.json'
v1=json.loads((P/'edit_plan.json').read_text(encoding='utf-8'));v2=json.loads((P/plan_name).read_text(encoding='utf-8'))
rows=[]
def rec(desc,a,b,tag):
    file=desc['file'];key=file;start=desc.get('clip_start',0);speed=desc.get('speed',1)
    prov=(P/file).with_suffix('.json')
    if file=='clean':key='asterisk_original'
    elif prov.exists():
        d=json.loads(prov.read_text(encoding='utf-8'))
        if 'source_start' in d:
            key=d.get('source_url',str(prov.parent))
            embedded_speed=d.get('source_duration',0)/d['output_duration'] if d.get('source_duration') and d.get('output_duration') else 1
            start=d['source_start']+start*embedded_speed;speed*=embedded_speed
        elif 'source_segment_url' in d and 'selection_after_pts_reset_seconds' in d:
            segment=d['source_segment_url'].rsplit('/',1)[1]
            elapsed=0;duration=0
            for line in (prov.parent/'playlist_360p.m3u8').read_text().splitlines():
                if line.startswith('#EXTINF:'):duration=float(line.split(':')[1].split(',')[0])
                elif line and not line.startswith('#'):
                    if line.rsplit('/',1)[-1]==segment:break
                    elapsed+=duration
            key=d['source_segment_url'].rsplit('/',1)[0]+'/video.m3u8'
            start+=elapsed+d['selection_after_pts_reset_seconds'][0]
        elif 'nominal_source_range_seconds' in d:
            vid=d['source_page'].split('vid=')[1]
            key=f'https://xgct-video.bzcdn.net/{vid}/640x360/video.m3u8'
            start+=d['nominal_source_range_seconds'][0]
    rows.append({'tag':tag,'file':file,'target':[a,b],'source':[round(start,5),round(start+(b-a)*speed,5)],'speed':speed,'key':key})
boundaries=sorted(set([0,5267/25]+[x[k] for x in v1['inserts'] for k in ['start','end']]+[x[k] for x in v2['edits'] for k in ['start','end']]))
for a,b in zip(boundaries,boundaries[1:]):
    m=(a+b)/2
    match=next(((i,x) for i,x in enumerate(v2['edits']) if x['start']<=m<x['end']),None)
    if match:
        i,x=match
        if x.get('kind')=='roster':continue
        if x.get('kind')=='pair':
            for side in ['left','right']:
                d=dict(x[side]);d['clip_start']=d.get('clip_start',0)+(a-x['start'])*d.get('speed',1);rec(d,a,b,f'V2#{i}:{side}')
        else:
            d=dict(x);d['clip_start']=d.get('clip_start',0)+(a-x['start'])*d.get('speed',1);rec(d,a,b,f'V2#{i}')
    else:
        match=next(((i,x) for i,x in enumerate(v1['inserts']) if x['start']<=m<x['end']),None)
        if match:
            i,x=match;d=dict(x);d['clip_start']=d.get('clip_start',0)+(a-x['start'])*d.get('speed',1);rec(d,a,b,f'V1#{i}')
        else:rec({'file':'clean','clip_start':a},a,b,'V1_original_base')
dups=[]
for i,a in enumerate(rows):
    for b in rows[i+1:]:
        if a['key']!=b['key']:continue
        lo=max(a['source'][0],b['source'][0]);hi=min(a['source'][1],b['source'][1])
        if hi-lo<.08:continue
        at=[a['target'][0]+(t-a['source'][0])/a['speed'] for t in [lo,hi]]
        bt=[b['target'][0]+(t-b['source'][0])/b['speed'] for t in [lo,hi]]
        dups.append({'a':a['tag'],'b':b['tag'],'a_target_overlap':[round(t,3) for t in at],'b_target_overlap':[round(t,3) for t in bt],'common_source':[lo,hi],'source_file':a['file']})
(OUT/out_name).write_text(json.dumps({'rows':rows,'overlaps':dups},ensure_ascii=False,indent=2),encoding='utf-8')
for d in dups:print(json.dumps(d,ensure_ascii=False))
