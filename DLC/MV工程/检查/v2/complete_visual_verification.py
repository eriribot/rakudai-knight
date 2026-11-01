from pathlib import Path
import json
P=Path(__file__).resolve().parent
path=P/'verify_final_result.json'
d=json.loads(path.read_text(encoding='utf-8'))
d['visual_review']={
 'status':'pass_for_reviewed_deliverable',
 'actual_encoded_frames_reviewed':115,
 'method':'Inspected first/middle/last actual encoded frames of each edit in both exchanges, entrance roster and school insert samples, 37–41-second exhaustion sequence, power-release intercut, and locked climax samples. Enlarged representative fixed frames inspected separately.',
 'exchange_63_12_to_76':'Ikki/Ayato pairing and opposing actions present. New clean horizontal guard at70.52–71.52 contains no Stella face/hair/crown. Closeup starts at66.24 and67.00 avoid unintended wide shot; Ayato eye retained at68.40. No source dialogue remnants found in sampled frames.',
 'exchange_148_48_to_159_28':'Stella/Julis pairing remains framed through its end. Stella guard remains Stella through152.84; no Ikki reveal. Top and bottom skill captions fully removed from156.44–157.84. Following fire flash and Stella reaction connect to original smoke bridge. No original opponent face found within the replacement window.',
 'roster':'Two additional screens show Ikki/Stella and Toka/Shizuku with readable matching names. Original Saya/Kirin screen still follows at13.04. No original portraits visibly bleed through added screens.',
 'academy':'Rakudai campus present at22.32–24.16; Stella/Toka/Shizuku colored introductions and retained V1 Ikki introduction present.',
 'exhausted_ikki':'37–41 seconds shows black-and-white exhausted/unstable Ikki sequence with target lyric overlays.',
 'power_intercut':'Original Ayato171.96–173.40, Ikki declaration173.40–174.68, remainder of Ayato173.40–174.16 moved to174.68–175.44, then genuine Ikki release/eye sequence175.44–178.16. Added 一刀修羅 caption readable; target lyrics fit.',
 'ending':'Snow scene, Ryoma insert, white-haired emotional climax, Ikki red-light hand, and final white flower verified. All730 decoded frames from181.48 compared with V1; only small recompression differences.',
 'observed_limitations':['Rakudai360p material is softer and more blocky than original720p Asterisk footage.','The clean Ikki guard uses six source frames slowed to1second, so movement is restrained.','Original Asterisk opponents remain in original footage outside the two specified replacement windows, including the brief pre-pair clash at148.44. This is preserved montage context, not leakage inside the reviewed Stella/Julis window.'],
 'contacts':['verify_final_new_sections.jpg','verify_final_exchange1.jpg','verify_final_exchange2.jpg']
}
d['overall_status']='passed'
d['acceptance_signal']='5267 decoded frames without errors; original AAC hash identical; specified edits visually verified and locked ending matches V1 within re-encoding loss.'
assert d['technical_pass'] and d['all_streams_decode']['returncode']==0 and not d['all_streams_decode']['stderr']
path.write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding='utf-8')
print(d['overall_status'])
