"""Place a movable heart layer over the original image without redrawing it."""
import argparse
import hashlib
import json
import math
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw


def render_heart(width, height):
    scale = 4
    w, h = width * scale, height * scale
    raw = []
    for step in range(721):
        t = 2 * math.pi * step / 720
        raw.append((16 * math.sin(t) ** 3,
                    -(13 * math.cos(t) - 5 * math.cos(2 * t)
                      - 2 * math.cos(3 * t) - math.cos(4 * t))))
    min_x = min(x for x, _ in raw)
    max_x = max(x for x, _ in raw)
    min_y = min(y for _, y in raw)
    max_y = max(y for _, y in raw)
    inset = 2 * scale
    points = [((x - min_x) / (max_x - min_x) * (w - 2 * inset) + inset,
               (y - min_y) / (max_y - min_y) * (h - 2 * inset) + inset)
              for x, y in raw]
    mask = Image.new('L', (w, h), 0)
    ImageDraw.Draw(mask).polygon(points, fill=255)
    heart = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(heart)
    for y in range(h):
        ratio = y / max(1, h - 1)
        color = tuple(round(a + (b - a) * ratio)
                      for a, b in zip((255, 130, 183), (238, 53, 124)))
        draw.line((0, y, w, y), fill=(*color, 255))
    draw.line(points + [points[0]], fill=(255, 207, 226, 255),
              width=round(1.4 * scale), joint='curve')
    draw.ellipse((w * .19, h * .13, w * .29, h * .26),
                 fill=(255, 234, 243, 255))
    heart.putalpha(mask)
    return heart.resize((width, height), Image.Resampling.LANCZOS)


def main():
    directory = Path(__file__).resolve().parent
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path, default=directory / 'ein-vol13-heart.png')
    parser.add_argument('--output', type=Path, default=directory / 'ein-vol13-heart-overlay.png')
    parser.add_argument('--center-x', type=float, default=471)
    parser.add_argument('--center-y', type=float, default=782)
    parser.add_argument('--width', type=int, default=124)
    parser.add_argument('--height', type=int, default=86)
    args = parser.parse_args()
    if args.input.resolve() == args.output.resolve():
        raise ValueError('Output must be a separate file; preserve the original.')
    source = Image.open(args.input).convert('RGB')
    left = round(args.center_x - args.width / 2)
    top = round(args.center_y - args.height / 2)
    bounds = (left, top, left + args.width, top + args.height)
    if args.width <= 0 or args.height <= 0 or left < 0 or top < 0 or \
            bounds[2] > source.width or bounds[3] > source.height:
        raise ValueError('Heart placement must fit inside the source image.')
    overlay = Image.new('RGBA', source.size, (0, 0, 0, 0))
    overlay.paste(render_heart(args.width, args.height), (left, top))
    result = Image.alpha_composite(source.convert('RGBA'), overlay).convert('RGB')
    difference = ImageChops.difference(source, result)
    outside = difference.copy()
    ImageDraw.Draw(outside).rectangle((left, top, bounds[2] - 1, bounds[3] - 1), fill=(0, 0, 0))
    if outside.getbbox() is not None:
        raise RuntimeError('Pixels outside the heart overlay changed.')
    args.output.parent.mkdir(parents=True, exist_ok=True)
    result.save(args.output)
    report = {
        'schemaVersion': 1,
        'type': 'deterministic-heart-overlay-on-existing-fanart',
        'source': args.input.name,
        'output': args.output.name,
        'method': 'Pillow alpha composite; original image is not redrawn',
        'heartCenter': [args.center_x, args.center_y],
        'heartBounds': list(bounds),
        'changedPixelsBounds': list(difference.getbbox()),
        'pixelsOutsideOverlayUnchanged': True,
        'originalOutfitPreserved': True,
        'sourceSha256': hashlib.sha256(args.input.read_bytes()).hexdigest(),
        'outputSha256': hashlib.sha256(args.output.read_bytes()).hexdigest(),
    }
    args.output.with_suffix('.json').write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
