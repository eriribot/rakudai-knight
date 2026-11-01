with open(r'e:\web\落第\第十九卷-世界书整理\第十九卷_第四章_划破黑暗.txt', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, l in enumerate(lines):
    if any(k in l for k in ['恢复', '长大', '身体', '肌肉', '少年', '小孩', '珠雫', '王马']) and any(k in l for k in ['原状', '骨骼', '成长', '细胞', '自噬', '原来', '复原']):
        print(f"L{i+1}: {l.strip()[:100]}")
