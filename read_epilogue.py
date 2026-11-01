def inspect_file(path, start_line, end_line):
    with open(path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    print(f"=== {path} (Lines {start_line} to {end_line}) ===")
    for i in range(start_line - 1, min(end_line, len(lines))):
        print(f"L{i+1}: {lines[i].strip()}")

p = r'e:\web\落第\第十九卷-世界书整理\第十九卷_终章_背负憧憬的意义.txt'
inspect_file(p, 1, 80)
inspect_file(p, 250, 320)
inspect_file(p, 500, 657)
