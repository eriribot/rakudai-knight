import os
import re

# Search for chapters in volume folders
vol_folders = [f for f in os.listdir('.') if '卷-世界书整理' in f]
vol_folders.sort()

print(f"Found {len(vol_folders)} volume folders:")
for vf in vol_folders:
    txts = [f for f in os.listdir(vf) if f.endswith('.txt')]
    print(f"  {vf}: {len(txts)} txt files")
