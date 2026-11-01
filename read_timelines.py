for vol in ['第十五卷', '第十六卷', '第十七卷', '第十八卷']:
    path = f'e:\\web\\落第\\{vol}-世界书整理\\01_卷内时间线.md'
    try:
        with open(path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        print(f"=== {vol} ===")
        for line in lines[:30]:
            print(line.rstrip())
    except Exception as e:
        print(f"Error {vol}: {e}")
