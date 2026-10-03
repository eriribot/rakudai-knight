"""Inventory local EPUB art and extract unchanged late-volume illustrations.

Uses Python stdlib + Pillow. Does not execute EPUB scripts or copy novel chapters.
Research output is separate from the terminal's curated avatar manifest.
"""
import argparse
import hashlib
import io
import json
import posixpath
import re
import zipfile
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote
import xml.etree.ElementTree as ET

from PIL import Image, ImageDraw, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[2]


class Document(HTMLParser):
    def __init__(self, text):
        super().__init__(convert_charrefs=True)
        self.events = []
        self.skip = 0
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag in ("script", "style"):
            self.skip += 1
        if tag in ("img", "image"):
            source = attrs.get("src") or attrs.get("xlink:href") or attrs.get("href")
            if source:
                self.events.append(("image", source, attrs.get("alt", "")))

    def handle_endtag(self, tag):
        if tag in ("script", "style") and self.skip:
            self.skip -= 1

    def handle_data(self, text):
        text = re.sub(r"\s+", " ", text).strip()
        if text and not self.skip:
            self.events.append(("text", text, ""))


def member(base, href):
    target = posixpath.normpath(posixpath.join(posixpath.dirname(base), unquote(href.split("#")[0])))
    if target.startswith(("/", "../")) or ":" in target:
        raise ValueError("Unsafe or external EPUB member: " + target)
    return target


def localname(tag):
    return tag.rsplit("}", 1)[-1]


def sheet(book, pictures, output):
    if not pictures:
        return None
    fonts = [Path("C:/Windows/Fonts/msyh.ttc"), Path("C:/Windows/Fonts/msjh.ttc")]
    font = next((ImageFont.truetype(str(p), 15) for p in fonts if p.is_file()), ImageFont.load_default())
    width, cell_width, cell_height = 1000, 250, 310
    canvas = Image.new("RGB", (width, 45 + ((len(pictures) + 3) // 4) * cell_height), "#fff6e5")
    draw = ImageDraw.Draw(canvas)
    draw.text((12, 12), book["book"], fill="#233654", font=font)
    for i, record in enumerate(pictures):
        x, y = (i % 4) * cell_width, 45 + (i // 4) * cell_height
        with Image.open(ROOT / record["file"]) as original:
            thumb = ImageOps.contain(original.convert("RGB"), (238, 268))
        canvas.paste(thumb, (x + (cell_width - thumb.width) // 2, y))
        draw.text((x + 7, y + 274), record["member"].rsplit("/", 1)[-1], fill="#233654", font=font)
        draw.text((x + 7, y + 293), f'{record["width"]}x{record["height"]}', fill="#233654", font=font)
    target = output / (book["id"] + "-color-sheet.jpg")
    canvas.save(target, quality=91)
    return target.relative_to(ROOT).as_posix()


def scan(source, output, extract_from):
    output.mkdir(parents=True, exist_ok=True)
    images_dir = output / "images"
    images_dir.mkdir(exist_ok=True)
    result = {"schemaVersion": 1, "sourceDirectory": source.relative_to(ROOT).as_posix(),
              "note": "Source image bytes unchanged; sheet thumbnails are research only. Names require text/illustration verification.",
              "books": [], "errors": []}
    for epub in sorted(source.glob("*.epub")):
        volume_match = re.search(r"(?:\s|-)(\d+)\.epub$", epub.name)
        volume = int(volume_match.group(1)) if volume_match else None
        edition = "short" if "短篇" in epub.name else "tw" if "台版" in epub.name else "cn"
        book = {"id": f"{edition}-{volume:02d}" if volume is not None else epub.stem,
                "book": epub.name, "epub": epub.relative_to(ROOT).as_posix(), "volume": volume, "images": []}
        try:
            with zipfile.ZipFile(epub) as archive:
                container = ET.fromstring(archive.read("META-INF/container.xml"))
                opf = next(e.attrib["full-path"] for e in container.iter() if localname(e.tag) == "rootfile")
                package = ET.fromstring(archive.read(opf))
                items = {e.attrib["id"]: e.attrib for e in package.iter() if localname(e.tag) == "item"}
                book["title"] = next((e.text for e in package.iter() if localname(e.tag) == "title"), None)
                spine = [items[e.attrib["idref"]] for e in package.iter() if localname(e.tag) == "itemref" and e.attrib.get("idref") in items]
                references = {}
                for item in spine:
                    chapter = member(opf, item["href"])
                    document = Document(archive.read(chapter).decode("utf-8-sig"))
                    for index, (kind, href, alt) in enumerate(document.events):
                        if kind != "image":
                            continue
                        before = " ".join(e[1] for e in document.events[max(0, index - 4):index] if e[0] == "text")[-120:]
                        after = " ".join(e[1] for e in document.events[index + 1:index + 5] if e[0] == "text")[:120]
                        references.setdefault(member(chapter, href), []).append({"xhtml": chapter, "alt": alt,
                                                                               "before": before, "after": after})
                for item in items.values():
                    if not item.get("media-type", "").startswith("image/"):
                        continue
                    image_member = member(opf, item["href"])
                    data = archive.read(image_member)
                    try:
                        with Image.open(io.BytesIO(data)) as image:
                            width, height = image.size
                            if min(width, height) < 180:
                                continue
                            sample = image.convert("RGB").resize((48, 48))
                            pixels = sample.get_flattened_data() if hasattr(sample, "get_flattened_data") else sample.getdata()
                            color_fraction = sum(max(rgb) - min(rgb) > 25 for rgb in pixels) / (48 * 48)
                    except (OSError, ValueError):
                        continue
                    digest = hashlib.sha256(data).hexdigest()
                    record = {"member": image_member, "width": width, "height": height, "sha256": digest,
                              "colorFraction": round(color_fraction, 4), "references": references.get(image_member, [])}
                    if volume is not None and volume >= extract_from and color_fraction >= 0.015:
                        extension = Path(image_member).suffix.lower()
                        target = images_dir / (digest[:20] + extension)
                        if not target.exists():
                            target.write_bytes(data)
                        record["file"] = target.relative_to(ROOT).as_posix()
                    book["images"].append(record)
                extracted = [r for r in book["images"] if r.get("file")]
                book["colorSheet"] = sheet(book, extracted, output)
                result["books"].append(book)
        except (zipfile.BadZipFile, KeyError, ET.ParseError, ValueError, UnicodeError) as error:
            result["errors"].append({"epub": book["epub"], "error": str(error)})
    target = output / "index.json"
    target.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"books": len(result["books"]), "images": sum(len(b["images"]) for b in result["books"]),
                      "extractedColorReferences": sum(sum(bool(i.get("file")) for i in b["images"]) for b in result["books"]),
                      "uniqueColorFiles": len(list(images_dir.iterdir())), "errors": result["errors"],
                      "index": target.relative_to(ROOT).as_posix()}, ensure_ascii=False))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=ROOT / "39688")
    parser.add_argument("--output", type=Path, default=ROOT / "resource/knightavatars/research/epub")
    parser.add_argument("--extract-from", type=int, default=5)
    args = parser.parse_args()
    scan(args.source.resolve(), args.output.resolve(), args.extract_from)
