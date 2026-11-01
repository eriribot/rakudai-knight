import sys
from pathlib import Path
import time
import requests

s = requests.Session()
s.trust_env = False
s.headers.update({'Referer': 'https://pframe.xgcartoon.com/', 'Origin': 'https://pframe.xgcartoon.com'})
url, destination = sys.argv[1:]
r = s.get(url, timeout=25)
if r.status_code == 429:
    delay = max(45, int(r.headers.get('Retry-After', '30')) + 5)
    print(f'HTTP 429; honoring cooldown {delay}s', flush=True)
    time.sleep(delay)
    r = s.get(url, timeout=25)
r.raise_for_status()
p = Path(destination)
p.parent.mkdir(parents=True, exist_ok=True)
p.write_bytes(r.content)
print(f'{r.status_code} {r.headers.get("Content-Type")} {len(r.content)} bytes -> {p}', flush=True)
