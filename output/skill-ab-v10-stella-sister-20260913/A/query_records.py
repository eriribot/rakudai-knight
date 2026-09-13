from pathlib import Path
import json
import subprocess
import sys

base = Path(__file__).resolve().parent
script = base.parent / 'skills/build-work-library/scripts/work_library.py'
queries = [('露娜艾丝', 10), ('约翰', 10), ('战争', 10), ('露娜艾丝', 9)]
receipts = []
for query, stage in queries:
    args = [sys.executable, '-X', 'utf8', str(script), 'query', '--project', str(base / 'library'),
            '--query', query, '--realm', 'canon', '--continuity', 'novel-main', '--as-of', str(stage), '--limit', '10']
    completed = subprocess.run(args, capture_output=True, text=True, encoding='utf-8', check=True)
    result = json.loads(completed.stdout)
    receipts.append({'command': args, 'exit_code': completed.returncode, 'result': result})
    if len(receipts) == 1:
        for row in result['records']:
            print(row['id'], row['status'], row['known_from'], row['markdown_sha256'])
            print(row['body'])
    else:
        print(json.dumps({'query': query, 'as_of': stage, 'matches': result['matches'], 'ids': [r['id'] for r in result['records']]}, ensure_ascii=False))
assert receipts[0]['result']['matches'] == 4
assert receipts[-1]['result']['matches'] == 0
(base / 'query-receipts.json').write_text(json.dumps(receipts, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')
