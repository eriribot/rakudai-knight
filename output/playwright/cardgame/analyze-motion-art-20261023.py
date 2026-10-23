"""Read a motion PNG without modifying pixels; report measured alpha geometry.

First pass:
  python analyze-motion-art-20261023.py INPUT.png --output geometry.json

After visually identifying each pose and its supporting shoes, provide --spec:
  {"poses": {"guard": {"component_ids": [6],
                      "feet_rects": [[1120, 930, 1220, 1010],
                                     [1280, 940, 1410, 1010]]}}}

All rectangles are source-pixel [left, top, right, bottom], right/bottom exclusive.
The example coordinates are illustrative, NEVER measurements of a new asset.
No pose, shoe rectangle, or foot anchor is guessed. A missing foot spec produces
null anchors. Only JSON is written; the source image is opened read-only.
"""

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage


def rect(value, width, height):
    if len(value) != 4 or any(not isinstance(n, int) for n in value):
        raise ValueError("Rectangles must contain four integer coordinates")
    left, top, right, bottom = value
    if not (0 <= left < right <= width and 0 <= top < bottom <= height):
        raise ValueError(f"Rectangle lies outside the source: {value}")
    return left, top, right, bottom


def bounds(mask):
    ys, xs = np.nonzero(mask)
    if not len(xs):
        raise ValueError("Selected region contains no alpha pixels")
    return [int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1]


def crop_report(labels, component_ids, margin):
    height, width = labels.shape
    mask = np.isin(labels, component_ids)
    left, top, right, bottom = bounds(mask)
    crop = [max(0, left - margin), max(0, top - margin),
            min(width, right + margin), min(height, bottom + margin)]
    x0, y0, x1, y1 = crop
    present, counts = np.unique(labels[y0:y1, x0:x1], return_counts=True)
    foreign = [{"component_id": int(i), "pixels_in_crop": int(n)}
               for i, n in zip(present, counts)
               if i != 0 and i not in component_ids]
    return {
        "component_ids": component_ids,
        "alpha_bbox": [left, top, right, bottom],
        "crop_xywh": [x0, y0, x1 - x0, y1 - y0],
        "alpha_pixels": int(mask.sum()),
        "foreign_components_in_crop": foreign,
        "requires_isolation_review": bool(foreign),
    }


def foot_measurement(labels, component_ids, rectangles, band):
    height, width = labels.shape
    contacts = []
    for raw in rectangles:
        x0, y0, x1, y1 = rect(raw, width, height)
        shoe = np.isin(labels[y0:y1, x0:x1], component_ids)
        ys, xs = np.nonzero(shoe)
        if not len(xs):
            raise ValueError(f"Verified shoe rectangle has no selected alpha: {raw}")
        sole_y = int(ys.max())
        in_band = ys >= max(0, sole_y - band + 1)
        contact_xs = xs[in_band]
        contact_ys = ys[in_band]
        contacts.append({
            "verified_rect": list(raw),
            "contact_bbox": [int(contact_xs.min()) + x0,
                             int(contact_ys.min()) + y0,
                             int(contact_xs.max()) + x0 + 1,
                             sole_y + y0 + 1],
            "contact_pixels": int(in_band.sum()),
        })
    if not contacts:
        return None, []
    left = min(item["contact_bbox"][0] for item in contacts)
    right = max(item["contact_bbox"][2] for item in contacts)
    bottom = max(item["contact_bbox"][3] for item in contacts)
    return {"x": (left + right) / 2, "y": bottom,
            "basis": "outer edges of alpha soles inside visually verified shoe rectangles",
            "sole_band_px": band}, contacts


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("image", type=Path)
    parser.add_argument("--output", type=Path, help="JSON only; omit to print to stdout")
    parser.add_argument("--spec", type=Path, help="Visually reviewed pose IDs and shoe rectangles")
    parser.add_argument("--threshold", type=int, default=16)
    parser.add_argument("--min-pixels", type=int, default=128)
    parser.add_argument("--margin", type=int, default=4)
    parser.add_argument("--sole-band", type=int, default=3)
    parser.add_argument("--columns", type=int, default=3, help="Nominal sheet layout; not used to assign poses")
    parser.add_argument("--rows", type=int, default=2)
    args = parser.parse_args()
    if not 0 <= args.threshold < 255 or args.min_pixels < 1 or args.margin < 0 or args.sole_band < 1 or args.columns < 1 or args.rows < 1:
        parser.error("Invalid alpha threshold, component size, crop margin, or sole band")
    source = args.image.resolve()
    if args.output and args.output.resolve() == source:
        parser.error("Output must not be the source image")
    with Image.open(source) as image:
        original_mode = image.mode
        has_alpha = "A" in image.getbands() or "transparency" in image.info
        alpha = np.asarray(image.convert("RGBA"))[:, :, 3]
        width, height = image.size
    labels, count = ndimage.label(alpha > args.threshold, structure=np.ones((3, 3), dtype=np.uint8))
    sizes = np.bincount(labels.ravel())
    slices = ndimage.find_objects(labels)
    candidates = []
    for component_id in range(1, count + 1):
        if sizes[component_id] < args.min_pixels:
            continue
        sy, sx = slices[component_id - 1]
        report = crop_report(labels, [component_id], args.margin)
        report["grid_cells_touched"] = [
            [col, row] for row in range(args.rows) for col in range(args.columns)
            if sx.start < (col + 1) * width / args.columns and sx.stop > col * width / args.columns
            and sy.start < (row + 1) * height / args.rows and sy.stop > row * height / args.rows
        ]
        report["foot_anchor"] = None
        candidates.append(report)
    candidates.sort(key=lambda item: item["alpha_pixels"], reverse=True)
    warnings = []
    if not has_alpha or int(alpha.min()) == 255:
        warnings.append("No transparent source pixels: do not import as a transparent actor sheet")
    if len(candidates) != args.columns * args.rows:
        warnings.append("Candidate count differs from nominal grid; inspect connected/fragmented figures before assignment")
    if any(len(c["grid_cells_touched"]) > 1 for c in candidates):
        warnings.append(f"Some bounding boxes cross nominal {args.columns}x{args.rows} cells; fixed-cell cropping is unsafe")
    result = {
        "source": str(source), "sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
        "dimensions": [width, height], "source_mode": original_mode,
        "nominal_grid": {"columns": args.columns, "rows": args.rows},
        "alpha_threshold": args.threshold, "connectivity": 8,
        "alpha_extrema": [int(alpha.min()), int(alpha.max())],
        "transparent_fraction": round(float(np.mean(alpha == 0)), 6),
        "component_count": count, "candidate_min_pixels": args.min_pixels,
        "candidate_count": len(candidates), "candidates": candidates,
        "warnings": warnings, "verified_poses": {},
        "review_required": "Visually assign pose components and supporting shoe rectangles before deriving CSS anchors",
    }
    if args.spec:
        specification = json.loads(args.spec.read_text(encoding="utf-8-sig"))
        for pose, entry in specification.get("poses", {}).items():
            ids = entry.get("component_ids", [])
            if not ids or any(not isinstance(i, int) or not 1 <= i <= count for i in ids):
                raise ValueError(f"Invalid component IDs for {pose}: {ids}")
            report = crop_report(labels, ids, args.margin)
            anchor, contacts = foot_measurement(labels, ids, entry.get("feet_rects", []), args.sole_band)
            report["foot_anchor"] = anchor
            report["foot_contacts"] = contacts
            result["verified_poses"][pose] = report
    output = json.dumps(result, ensure_ascii=False, indent=2)
    if args.output:
        args.output.write_text(output + "\n", encoding="utf-8")
    else:
        print(output)


if __name__ == "__main__":
    main()
