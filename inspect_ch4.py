def inspect_file(path, start_line, end_line):
    with open(path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    print(f"=== {path} (Lines {start_line} to {end_line}) ===")
    for i in range(start_line - 1, min(end_line, len(lines))):
        print(f"L{i+1}: {lines[i].strip()}")

print("--- 第四章 ---")
inspect_file(r'e:\web\落第\第十九卷-世界书整理\第十九卷_第四章_划破黑暗.txt', 1, 60)
inspect_file(r'e:\web\落第\第十九卷-世界书整理\第十九卷_第四章_划破黑暗.txt', 150, 220)
inspect_file(r'e:\web\落第\第十九卷-世界书整理\第十九卷_第四章_划破黑暗.txt', 500, 560)
inspect_file(r'e:\web\落第\第十九卷-世界书整理\第十九卷_第四章_划破黑暗.txt', 1800, 1883)
