from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from urllib.parse import quote
import hashlib
import json
from datetime import datetime, timezone

root = Path(__file__).resolve().parents[1]
assets = root / 'resource/knightavatars'
manifest = json.loads((assets / 'manifest.json').read_text(encoding='utf-8'))
base = 'https://eriribot.github.io/rakudai-knight/'
records = [dict(id=person['id'], name=person['name'], file=person.get('displayFile') or person['file']) for person in manifest['characters']]
records.append(dict(id='shieldFrame', name='共用盾框', file=manifest['shieldFrame']['file']))

def verify(record):
    address = base + quote('resource/knightavatars/' + record['file'], safe='/')
    expected = hashlib.sha256((assets / record['file']).read_bytes()).hexdigest()
    result = dict(**record, url=address, expectedSha256=expected)
    try:
        with urlopen(Request(address, headers={'User-Agent':'Codex-avatar-host-verification'}), timeout=25) as response:
            content = response.read()
            actual = hashlib.sha256(content).hexdigest()
            result.update(status=response.status, finalUrl=response.url,
                contentType=response.headers.get('Content-Type'), bytes=len(content),
                pngSignature=content.startswith(b'\x89PNG\r\n\x1a\n'), sha256=actual, exactLocalMatch=actual==expected)
            result['passed'] = response.status==200 and result['pngSignature'] and result['exactLocalMatch']
    except HTTPError as error:
        result.update(status=error.code, passed=False, error=str(error))
    except (URLError, TimeoutError, OSError) as error:
        result.update(status=None, passed=False, error=str(error))
    return result

with ThreadPoolExecutor(max_workers=6) as pool:
    verified = list(pool.map(verify, records))
report = dict(baseUrl=base, checkedAtUtc=datetime.now(timezone.utc).isoformat(), total=len(verified),
    accessible=sum(item.get('status')==200 for item in verified),
    exactMatches=sum(item.get('exactLocalMatch', False) for item in verified),
    passed=all(item['passed'] for item in verified), files=verified)
(assets / 'research/review/github-pages-avatar-check.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print(json.dumps({key:value for key,value in report.items() if key!='files'}, ensure_ascii=False))
for item in verified:
    if not item['passed']:
        print(json.dumps(item, ensure_ascii=False))
