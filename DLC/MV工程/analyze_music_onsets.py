from pathlib import Path
import json,subprocess
import numpy as np
P=Path(__file__).resolve().parent
FF=r'E:\devtools\Anconda\Lib\site-packages\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v7.1.exe'
src=next(P.parent.parent.glob('*Asterisk*.mp4'))
raw=subprocess.check_output([FF,'-v','error','-i',str(src),'-vn','-ar','16000','-ac','1','-f','f32le','-'])
y=np.frombuffer(raw,dtype=np.float32)
n,hop=512,160
win=np.lib.stride_tricks.sliding_window_view(y,n)[::hop]
spec=np.abs(np.fft.rfft(win*np.hanning(n),axis=1)).astype(np.float32)
spec=np.log1p(spec*12)
flux=np.maximum(np.diff(spec,axis=0),0).mean(axis=1)
onsets=[]
for i in range(15,len(flux)-15):
    if flux[i]==flux[i-15:i+16].max() and flux[i]>np.percentile(flux[max(0,i-150):i+151],70):
        onsets.append({'time':round(((i+1)*hop+n/2)/16000,2),'strength':round(float(flux[i]),3)})
(P/'检查/v2').mkdir(exist_ok=True)
(P/'检查/v2/music_onsets.json').write_text(json.dumps(onsets,indent=2),encoding='utf-8')
for lo,hi in [(48,60),(66,77),(109,120),(140,159),(166,181)]:
    print(lo,hi,[(x['time'],x['strength']) for x in onsets if lo<=x['time']<hi])
