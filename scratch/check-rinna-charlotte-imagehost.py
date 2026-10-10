import concurrent.futures
import hashlib
import io
import json
from pathlib import Path
import sys
import urllib.error
import urllib.request
from PIL import Image

sys.stdout.reconfigure(encoding='utf-8')
root = Path('resource/knightavatars')
manifest = json.loads((root / 'manifest.json').read_text(encoding='utf-8'))
ids = ['rinna', 'charlotte']

def check(character_id):
    character = next(c for c in manifest['characters'] if c['id'] == character_id)
    url = 'https://eriribot.github.io/rakudai-knight/resource/knightavatars/' + character['displayFile']
    result = {'id': character_id, 'name': character['name'], 'url': url, 'localFile': character['displayFile']}
    result['localSha256'] = hashlib.sha256((root / character['displayFile']).read_bytes()).hexdigest()
    try:
        request = urllib.request.Request(url, headers={'User-Agent': 'Codex-avatar-verification', 'Cache-Control': 'no-cache'})
        with urllib.request.urlopen(request, timeout=30) as response:
            payload = response.read()
            result.update(httpStatus=response.status, contentType=response.headers.get('Content-Type'), finalUrl=response.url, etag=response.headers.get('ETag'))
        picture = Image.open(io.BytesIO(payload))
        picture.verify()
        result.update(format=picture.format, width=picture.width, height=picture.height, mode=picture.mode, bytes=len(payload), sha256=hashlib.sha256(payload).hexdigest())
        result['matchesLocalBytes'] = result['sha256'] == result['localSha256']
        result['status'] = 'verified-matching-local' if result['matchesLocalBytes'] else 'verified-image-needs-identity-review'
    except urllib.error.HTTPError as error:
        result.update(status='http-error', httpStatus=error.code)
    except Exception as error:
        result.update(status='verification-error', error=str(error))
    return result

with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
    results = list(executor.map(check, ids))
report = {'scope': 'two-configured-portrait-paths', 'method': 'HTTPS GET, bitmap decode, exact local byte SHA-256 comparison', 'images': results}
directory = root / 'research/github-pages'
directory.mkdir(parents=True, exist_ok=True)
(directory / 'rinna-charlotte-verification.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report, ensure_ascii=False, indent=2))
sys.exit(0 if all(r['status'] == 'verified-matching-local' for r in results) else 1)
