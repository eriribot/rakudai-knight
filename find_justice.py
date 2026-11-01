import os
import glob
import zipfile

def search_text_in_files(pattern):
    for root, dirs, files in os.walk(r'e:\web\落第'):
        for f in files:
            p = os.path.join(root, f)
            if f.endswith('.txt'):
                try:
                    with open(p, 'r', encoding='utf-8', errors='ignore') as fp:
                        for idx, line in enumerate(fp, 1):
                            if pattern in line:
                                print(f"[TXT] {p}:{idx}: {line.strip()}")
                except:
                    pass
            elif f.endswith('.epub'):
                try:
                    with zipfile.ZipFile(p, 'r') as z:
                        for name in z.namelist():
                            if name.endswith(('.html', '.xhtml', '.txt')):
                                text = z.read(name).decode('utf-8', errors='ignore')
                                if pattern in text:
                                    print(f"[EPUB] {p} ({name}): contains {pattern}")
                except:
                    pass

search_text_in_files("正义从天而降")
print("--- Searching '从天而降' in epub ---")
search_text_in_files("从天而降")
