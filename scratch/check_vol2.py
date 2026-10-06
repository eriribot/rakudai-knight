import json
import sys

def main():
    with open('落第骑士英雄谭v0.02.json', 'r', encoding='utf-8') as f:
        data = json.load(f)

    entries = data['entries']
    
    # Check all volume entries
    vol_entries = []
    for k, v in entries.items():
        comment = v.get('comment', '')
        if '第二卷' in comment or '卷' in comment:
            vol_entries.append((k, comment))
    
    print("All volume entries found:")
    for k, c in vol_entries:
        if '第二卷' in c or any(x in c for x in ['绫辻', '仓敷']):
            print(f"UID: {k} | Comment: {c}")

    target_uids = ['47', '51', '52', '53', '67', '68', '69', '70', '71', '72']
    for uid in target_uids:
        if uid in entries:
            e = entries[uid]
            print("="*60)
            print(f"UID: {uid} | Comment: {e.get('comment')} | Enabled: {e.get('enabled')}")
            print(f"Keys: {e.get('keys')}")
            print(f"Secondary Keys: {e.get('secondary_keys', [])}")
            print("Content:")
            print(e.get('content', ''))

if __name__ == '__main__':
    main()
