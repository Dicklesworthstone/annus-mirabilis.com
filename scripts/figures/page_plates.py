"""
The German face's following plates: every printed page of a paper, cleaned like the first pages.

Usage, from the repository root:
    uv run --with pillow --with numpy python scripts/figures/page_plates.py [<key>...]

Rewrites public/figures/plates/pages/<key>/<printed page>.webp (640 x 987) and <page>-1280.webp
(1280 x 1974), the sizes src/reader/faces/FollowingPlate.tsx declares. By default it does only the
keys that already have plates (the rights check was made when those were first written). The printed
page number of each PDF page comes from the receipt's pageMap, as in scripts/generate-page-plates.ts,
never from the page image.

Until 2026-09-23 these plates were the whole microfilm frame: black film borders, the binding gutter
and slivers of the facing page. Each page is now its printed block on white, flattened by
plate_cleanup.py. All pages of all papers share one scale and one top margin, so the block does not
jump as the plate turns from one page to the next. A short last page sits at the top of the plate with
white below it, as it is printed.
"""
import sys
sys.dont_write_bytecode = True  # no __pycache__ beside the scripts
import json, os, re, sys, tempfile
from PIL import Image
from plate_cleanup import ROOT, detect, load, place, render_page

W, H = 640, 987
PAGES = os.path.join(ROOT, "public/figures/plates/pages")

def page_map(key):
    text = open(os.path.join(ROOT, "docs/provenance", key + ".md"), encoding="utf8").read()
    seen = {}
    for pdf, printed in re.findall(r"pdfPageIndex:\s*(\d+)\s*\n\s*printedPage:\s*(\d+)", text):
        pdf, printed = int(pdf), int(printed)
        if seen.get(pdf, printed) != printed:
            raise SystemExit(f"{key}: PDF page {pdf} is printed page {seen[pdf]} and {printed}")
        seen[pdf] = printed
    return sorted(seen.items())

def main(keys):
    work = tempfile.mkdtemp(prefix="page-plates-")
    frames = {}
    for key in keys:
        for pdf, printed in page_map(key):
            frames[(key, printed)] = load(render_page(key, pdf, 400, os.path.join(work, f"{key}-{pdf}")))
    boxes = {k: detect(a) for k, a in frames.items()}
    tw = max(b[1] - b[0] for b in boxes.values())
    th = max(b[3] - b[2] for b in boxes.values())
    vm = int(tw * 0.045)
    ch = th + 2 * vm
    cw = round(ch * W / H)
    assert cw >= tw + 2 * vm, (cw, ch, tw)
    report = {}
    for (key, printed), a in frames.items():
        canvas = place(a, boxes[(key, printed)], cw, ch, tw, vm)
        out = os.path.join(PAGES, key)
        canvas.resize((W, H), Image.LANCZOS).save(os.path.join(out, f"{printed}.webp"), "WEBP", quality=72, method=6)
        canvas.resize((2 * W, 2 * H), Image.LANCZOS).save(os.path.join(out, f"{printed}-1280.webp"), "WEBP", quality=72, method=6)
        x0, x1, y0, y1 = boxes[(key, printed)]
        report[f"{key}/{printed}"] = [x0, y0, x1 - x0, y1 - y0]
    print(json.dumps({"canvas": [cw, ch], "blocks": report}))

if __name__ == "__main__":
    keys = sys.argv[1:] or sorted(d for d in os.listdir(PAGES) if os.path.isdir(os.path.join(PAGES, d)))
    main(keys)
