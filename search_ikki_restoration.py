# Let's inspect where Ikki's body changes or is discussed in Chapter 5, Chapter 6, and Epilogue
import re

for ch_file in [
    r'e:\web\落第\第十九卷-世界书整理\第十九卷_第五章_大教授.txt',
    r'e:\web\落第\第十九卷-世界书整理\第十九卷_第六章_最爱，也是最强的劲敌.txt',
    r'e:\web\落第\第十九卷-世界书整理\第十九卷_终章_背负憧憬的意义.txt'
]:
    with open(ch_file, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    print(f"=== {ch_file} ===")
    for idx, l in enumerate(lines, 1):
        if any(k in l for k in ['合体', '解除', '身体', '小孩', '正太', '长大', '复原', '自噬', '身材', '体型']):
            if len(l.strip()) < 80:
                print(f"  L{idx}: {l.strip()}")
