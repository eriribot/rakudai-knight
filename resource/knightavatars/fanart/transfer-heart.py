"""Extract the existing painted heart and fit it to the unchanged original art."""
from collections import deque
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter


def largest_component(binary):
    seen = np.zeros(binary.shape, dtype=bool)
    largest = []
    height, width = binary.shape
    for y, x in zip(*np.where(binary)):
        if seen[y, x]:
            continue
        points = []
        queue = deque([(int(y), int(x))])
        seen[y, x] = True
        while queue:
            cy, cx = queue.popleft()
            points.append((cy, cx))
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    ny, nx = cy + dy, cx + dx
                    if 0 <= ny < height and 0 <= nx < width and \
                            binary[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        queue.append((ny, nx))
        if len(points) > len(largest):
            largest = points
    result = np.zeros(binary.shape, dtype=np.uint8)
    for y, x in largest:
        result[y, x] = 255
    return result


def fill_interior(mask):
    height, width = mask.shape
    outside = np.zeros(mask.shape, dtype=bool)
    queue = deque()
    for y in range(height):
        queue.extend(((y, 0), (y, width - 1)))
    for x in range(width):
        queue.extend(((0, x), (height - 1, x)))
    while queue:
        y, x = queue.popleft()
        if outside[y, x] or mask[y, x]:
            continue
        outside[y, x] = True
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < height and 0 <= nx < width:
                queue.append((ny, nx))
    return np.where(outside, 0, 255).astype(np.uint8)


def main():
    directory = Path(__file__).resolve().parent
    source_path = directory / 'ein-vol13-heart-v2.png'
    base_path = directory / 'ein-vol13-heart.png'
    output_path = directory / 'ein-vol13-heart-transferred.png'
    cutout_path = directory / 'ein-heart-extracted.png'
    source = Image.open(source_path).convert('RGB')
    base = Image.open(base_path).convert('RGB')
    # Bounded source area contains the painted pink heart and its white highlights.
    source_bounds = (406, 710, 543, 816)
    crop = source.crop(source_bounds)
    rgb = np.asarray(crop).astype(np.int16)
    color_mask = (rgb[:, :, 0] > 230) & (rgb[:, :, 1] > 108) & \
        (rgb[:, :, 2] > 155) & (rgb[:, :, 0] - rgb[:, :, 1] > 15)
    mask = Image.fromarray(fill_interior(largest_component(color_mask)))
    mask = mask.filter(ImageFilter.GaussianBlur(.45))
    # The RGB pixels are taken directly from the source, not a redrawn heart.
    cutout = crop.convert('RGBA')
    cutout.putalpha(mask)
    cutout.save(cutout_path)
    fitted = cutout.resize((121, 94), Image.Resampling.LANCZOS)
    center = (471, 776)
    left, top = center[0] - fitted.width // 2, center[1] - fitted.height // 2
    overlay = Image.new('RGBA', base.size, (0, 0, 0, 0))
    overlay.paste(fitted, (left, top))
    result = Image.alpha_composite(base.convert('RGBA'), overlay).convert('RGB')
    bounds = (left, top, left + fitted.width, top + fitted.height)
    difference = ImageChops.difference(base, result)
    outside = difference.copy()
    ImageDraw.Draw(outside).rectangle(
        (left, top, bounds[2] - 1, bounds[3] - 1), fill=(0, 0, 0))
    if outside.getbbox() is not None:
        raise RuntimeError('Pixels outside the transferred heart changed.')
    result.save(output_path)
    report = {
        'schemaVersion': 1,
        'method': 'color matte of actual source heart, scale, alpha composite',
        'base': base_path.name,
        'heartSource': source_path.name,
        'heartCutout': cutout_path.name,
        'sourceBounds': list(source_bounds),
        'targetCenter': list(center),
        'targetBounds': list(bounds),
        'output': output_path.name,
        'originalOutfitPreserved': True,
        'pixelsOutsideHeartUnchanged': True,
        'heartRgbIsFromSource': True,
        'baseSha256': hashlib.sha256(base_path.read_bytes()).hexdigest(),
        'heartSourceSha256': hashlib.sha256(source_path.read_bytes()).hexdigest(),
        'outputSha256': hashlib.sha256(output_path.read_bytes()).hexdigest(),
    }
    output_path.with_suffix('.json').write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
