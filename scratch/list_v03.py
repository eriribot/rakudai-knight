import os

p = '世界书规则/v0.3'
with open('scratch/v03_files.txt', 'w', encoding='utf-8') as out:
    for f in os.listdir(p):
        out.write(f"{f}\n")

print("Written scratch/v03_files.txt")
