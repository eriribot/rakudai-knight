import json

with open('落第骑士英雄谭v0.02.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

entries = data['entries']

output_lines = []
output_lines.append(f"Total entries: {len(entries)}\n")

# Find all entries with UID 67 to 72, and 47, 51, 52, 53
target_uids = ['47', '51', '52', '53', '67', '68', '69', '70', '71', '72']

for uid in target_uids:
    if uid in entries:
        e = entries[uid]
        output_lines.append("="*80)
        output_lines.append(f"UID: {uid} | Comment: {e.get('comment')} | Enabled: {e.get('enabled')}")
        output_lines.append(f"Keys: {e.get('keys')}")
        output_lines.append(f"Secondary Keys: {e.get('secondary_keys', [])}")
        output_lines.append("Content:\n")
        output_lines.append(e.get('content', ''))
        output_lines.append("\n\n")

# Also let's check what entries are between 60 and 80 to see how volumes are organized
output_lines.append("="*80)
output_lines.append("Entries overview from 60 to 85:\n")
for uid_int in range(60, 86):
    uid = str(uid_int)
    if uid in entries:
        e = entries[uid]
        output_lines.append(f"UID: {uid} | Comment: {e.get('comment')}\n")

with open('scratch/vol2_audit_clean.txt', 'w', encoding='utf-8') as f:
    f.writelines(output_lines)

print("Done! Written to scratch/vol2_audit_clean.txt")
