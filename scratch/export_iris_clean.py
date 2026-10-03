with open('第十四卷-世界书整理/设定条目/艾莉丝倒戈与法国秘密案件浴血十字架.md', 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

with open('scratch/iris_case.txt', 'w', encoding='utf-8') as out:
    out.write(text)

print("Exported scratch/iris_case.txt, length:", len(text))
