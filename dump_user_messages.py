# -*- coding: utf-8 -*-
import json

log_path = r'C:\Users\eriri\.gemini\antigravity\brain\146a3405-b527-4b1d-8518-d8b914223500\.system_generated\logs\transcript.jsonl'
lines_out = []
with open(log_path, 'r', encoding='utf-8') as f:
    for line in f:
        data = json.loads(line)
        if data.get('type') == 'USER_INPUT':
            content = data.get('content', '')
            lines_out.append(f"=== STEP {data.get('step_index')} ({data.get('created_at')}) ===")
            lines_out.append(content)
            lines_out.append("\n" + "="*50 + "\n")

with open(r'e:\web\落第\all_user_messages.txt', 'w', encoding='utf-8') as out:
    out.write("\n".join(lines_out))

print("Wrote all_user_messages.txt successfully.")
