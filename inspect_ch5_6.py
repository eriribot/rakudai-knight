def inspect_file(path, start_line, end_line):
    with open(path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    print(f"=== {path} (Lines {start_line} to {end_line}) ===")
    for i in range(start_line - 1, min(end_line, len(lines))):
        print(f"L{i+1}: {lines[i].strip()}")

print("--- Chapter 5 (L1900-L2000, end of ch5) ---")
inspect_file(r'e:\web\落第\第十九卷-世界书整理\第十九卷_第五章_大教授.txt', 1900, 1995)

print("\n--- Chapter 6 (L1-L100) ---")
inspect_file(r'e:\web\落第\第十九卷-世界书整理\第十九卷_第六章_最爱，也是最强的劲敌.txt', 1, 100)

print("\n--- Chapter 6 (L1650-L1750, Tsuikage & Stella awakening) ---")
inspect_file(r'e:\web\落第\第十九卷-世界书整理\第十九卷_第六章_最爱，也是最强的劲敌.txt', 1650, 1750)

print("\n--- Chapter 6 (L2150-L2313, Fu Xiaoli destroys brain in US) ---")
inspect_file(r'e:\web\落第\第十九卷-世界书整理\第十九卷_第六章_最爱，也是最强的劲敌.txt', 2150, 2260)
