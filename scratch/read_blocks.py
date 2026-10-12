import os, sys

sys.stdout.reconfigure(encoding='utf-8')

with open('scratch/sarah_all_output.txt', 'r', encoding='utf-8') as f:
    text = f.read()

# Let's inspect volumes one by one
print("Reading sarah_all_output.txt...")
