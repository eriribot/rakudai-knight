import re, os, zipfile, html, glob

SRC = r"E:\web\落第\DLC"
OUT = r"E:\web\落第\scratch\vol_all"
os.makedirs(OUT, exist_ok=True)

def strip_html(data):
    data = re.sub(r'(?is)<(script|style).*?</\1>', '', data)
    data = re.sub(r'(?i)<br\s*/?>', '\n', data)
    data = re.sub(r'(?i)</(p|div|h[1-6]|li|tr)>', '\n', data)
    data = re.sub(r'(?s)<[^>]+>', '', data)
    data = html.unescape(data)
    data = data.replace('\u3000', ' ')
    lines = [l.strip() for l in data.split('\n')]
    lines = [l for l in lines if l]
    return '\n'.join(lines)

for path in sorted(glob.glob(os.path.join(SRC, "学战都市Asterisk *.epub"))):
    base = os.path.basename(path)
    m = re.search(r"Asterisk\s*(\d+)", base)
    if not m:
        continue
    vol = int(m.group(1))
    outdir = os.path.join(OUT, f"vol{vol:02d}")
    os.makedirs(outdir, exist_ok=True)
    with zipfile.ZipFile(path) as z:
        names = [n for n in z.namelist() if n.lower().endswith(('.html', '.xhtml', '.htm'))]
        texts = []
        for n in names:
            try:
                raw = z.read(n).decode('utf-8', errors='ignore')
            except Exception:
                continue
            t = strip_html(raw)
            if t.strip():
                texts.append(t)
            with open(os.path.join(outdir, os.path.basename(n) + ".txt"), "w", encoding="utf-8") as f:
                f.write(t)
    full = "\n".join(texts)
    with open(os.path.join(OUT, f"vol{vol:02d}.txt"), "w", encoding="utf-8") as f:
        f.write(full)
    print(f"vol{vol:02d}: {len(full)} chars, {len(names)} files")
