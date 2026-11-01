from pathlib import Path
import subprocess,json
ROOT=Path(__file__).resolve().parent
EP=ROOT/'ep01'
FFMPEG=r'E:\devtools\Anconda\Lib\site-packages\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v7.1.exe'
shots=[('itto_shura_call_raw.mp4',0,32),('itto_shura_release_raw.mp4',11,79),('ikki_dodge_raw.mp4',66,86)]
cmd=[FFMPEG,'-hide_banner','-loglevel','error']
for name,a,b in shots:cmd+=['-i',str(EP/name)]
vf=';'.join(f'[{i}:v]trim=start_frame={a}:end_frame={b},setpts=N/(25*TB)[v{i}]' for i,(n,a,b) in enumerate(shots))
vf+=';[v0][v1][v2]concat=n=3:v=1:a=0,fps=25,tpad=stop_mode=clone:stop_duration=0.04,setpts=N/(25*TB)[v]'
out=EP/'itto_shura_confirmed_combo.mp4'
cmd+=['-filter_complex',vf,'-map','[v]','-an','-c:v','libx264','-crf','17','-preset','fast','-r','25','-fps_mode','cfr','-frames:v','120','-movflags','+faststart','-y',str(out)]
subprocess.run(cmd,check=True)
out.with_suffix('.json').write_text(json.dumps({'file':str(out),'duration':4.8,'fps':25,'frames':120,'grading':'none; original public 360p colors','technique_evidence':'First shot has visible source subtitle 一刀修羅. Assembly is declaration, raised eyes, then rush from the same ep1 sequence. No claim of a giant blue-flame explosion.','shots':[{'file':str(EP/n),'start_frame':a,'end_frame_exclusive':b} for n,a,b in shots]},ensure_ascii=False,indent=2),encoding='utf-8')
print(out)
