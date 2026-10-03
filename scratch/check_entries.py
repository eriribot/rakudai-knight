import json

with open('落第骑士英雄谭 (1).json', 'r', encoding='utf-8') as f:
    data = json.load(f)

entries = data.get('entries', {})
targets = {
    '11': '史黛菈',
    '12': '新宫寺黑乃',
    '17': '西京宁音',
    '49': '黑铁珠雫',
    '50': '折木有里',
    '53': '绫辻绚濑',
    '57': '日下部加加美',
    '62': '东堂刀华',
    '64': '贵德原彼方',
    '66': '兔丸恋恋'
}

with open('scratch/current_female_entries.txt', 'w', encoding='utf-8') as out:
    for eid, name in targets.items():
        if eid in entries:
            entry = entries[eid]
            out.write('====================================\n')
            out.write(f'ENTRY {eid}: {name} (comment: {entry.get("comment")})\n')
            out.write(f'Keys: {entry.get("key")}\n')
            out.write(f'Secondary Keys: {entry.get("secondary_keys")}\n')
            out.write(f'Order: {entry.get("order")}\n')
            out.write('Content:\n' + entry.get('content', '') + '\n\n')

print('Successfully dumped to scratch/current_female_entries.txt')
