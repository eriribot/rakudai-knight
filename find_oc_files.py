import os

for root, dirs, files in os.walk(r'e:\web\落第'):
    for f in files:
        if 'OC' in f or 'oc' in f or '朝阳' in f:
            print(os.path.join(root, f))
