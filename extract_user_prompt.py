import json

transcript_path = r'C:\Users\eriri\.gemini\antigravity\brain\397e6031-ea8d-47f5-85fb-155d35ace217\.system_generated\logs\transcript_full.jsonl'

with open(transcript_path, 'r', encoding='utf-8') as f:
    for line in f:
        if not line.strip():
            continue
        try:
            entry = json.loads(line)
            if entry.get('type') == 'USER_INPUT':
                last_user = entry
        except Exception as e:
            pass

if last_user:
    print("Found user step:", last_user.get('step_index'))
    with open('last_user_full.txt', 'w', encoding='utf-8') as out:
        out.write(last_user.get('content', ''))
    print("Length of content:", len(last_user.get('content', '')))
