"""Render the V3 plan while preserving V1 and V2 artifacts."""
import sys
from pathlib import Path
import render_crossover_v2 as engine
from roster_video_v3 import roster_frame
previous_render_item=engine.render_item
def render_item(clips,item,offset):
    if item.get('kind')=='roster':
        bg=clips.frame(dict(file='clean',clip_start=item['start'],crop=[0,0,1280,720]),offset)
        return roster_frame(bg,item['characters'],item['start']+offset)
    return previous_render_item(clips,item,offset)
engine.render_item=render_item
if __name__=='__main__':
    if '--plan' not in sys.argv:sys.argv.extend(['--plan',str(Path(__file__).with_name('edit_plan_v3.json'))])
    engine.main()
