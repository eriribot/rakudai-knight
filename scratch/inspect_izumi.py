import json

path = r'C:\Users\eriri\Downloads\Izumi 1002.json'
with open(path, 'r', encoding='utf-8') as f:
    data = json.load(f)

prompts = data.get('prompts', [])
prompt_order = data.get('prompt_order', [])

with open('scratch/izumi_inspect.txt', 'w', encoding='utf-8') as out:
    out.write(f"Total prompts: {len(prompts)}\n")
    out.write(f"Prompt order length: {len(prompt_order)}\n\n")
    
    # check enabled prompts
    enabled_prompts = []
    for p in prompts:
        # Check enabled
        # In ST, some prompts have 'enabled' boolean, or they are in prompt_order
        name = p.get('name', '') or p.get('identifier', '')
        content = p.get('content', '')
        role = p.get('role', '')
        enabled = p.get('enabled', False)
        system_prompt = p.get('system_prompt', False)
        marker = p.get('marker', False)
        if enabled and content:
            enabled_prompts.append((name, role, len(content), content[:300]))
            
    out.write(f"Enabled prompts with content ({len(enabled_prompts)}):\n")
    for name, role, length, preview in enabled_prompts:
        out.write(f"=== [{name}] (role={role}, len={length}) ===\n{preview}\n\n")

print("Exported scratch/izumi_inspect.txt")
