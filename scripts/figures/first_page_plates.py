"""
The four first-page plates (home, /papers/, /discover/, 404) and their share-card JPEGs.

Usage, from the repository root:
    uv run --with pillow --with numpy python scripts/figures/first_page_plates.py

WHAT IT READS. Page 1 of each pinned PDF, rasterized at 400 dpi with pdftoppm, which draws page pixels
and is not an OCR engine (AGENTS.md, "Cloud OCR only"). No text layer is read, and nothing here
recognizes text: the page's printed area is found from where its ink edges are, which is geometry.

WHY. Until 2026-09-23 the plates were fixed rectangles cut at hand-picked offsets from the microfilm
frames (9a759f3c). The owner found them "cut off and distorted": p. 132 lost its right margin, p. 891
its left, and each frame's own position set the type size. Each frame holds the printed page plus a
binding gutter, black film borders and slivers of the facing page. This script:
  1. finds the page's printed block (running head to last mark, the printer's signature included)
     from ink-edge profiles, excluding film border and gutter;
  2. divides out the paper's own shading (gutter shadow, microfilm vignette) and lifts paper tone and
     show-through to white, keeping the ink;
  3. sets all four blocks at ONE scale on a common 400:662 page with even margins, padding and never
     stretching, so the four pages show the same type size.
The binding still compresses a few letters at the gutter edge of pp. 132 and 891. That is in the
scan, and no crop can restore it.
"""
import sys
sys.dont_write_bytecode = True  # no __pycache__ beside the scripts
import json, os, tempfile
from PIL import Image
from plate_cleanup import ROOT, detect, load, place, render_page

KEYS = ["ap-17-132", "ap-17-549", "ap-17-891", "ap-18-639"]
OUT = os.path.join(ROOT, "public/figures/plates")

def main():
    work = tempfile.mkdtemp(prefix="first-page-plates-")
    frames = {k: load(render_page(k, 1, 400, os.path.join(work, k))) for k in KEYS}
    boxes = {k: detect(a) for k, a in frames.items()}
    tw = max(b[1] - b[0] for b in boxes.values())
    th = max(b[3] - b[2] for b in boxes.values())
    side, top = int(tw * 0.085), int(tw * 0.06)
    cw = tw + 2 * side
    ch = round(cw * 662 / 400)
    assert ch >= th + top + int(tw * 0.05), (cw, ch, th)
    report = {}
    for k, a in frames.items():
        canvas = place(a, boxes[k], cw, ch, tw, top)
        for w in (400, 800, 1200):
            canvas.resize((w, round(w * 662 / 400)), Image.LANCZOS).save(
                os.path.join(OUT, f"{k}-first-page-{w}.webp"), "WEBP", quality=72, method=6)
        canvas.resize((660, 1092), Image.LANCZOS).convert("RGB").save(
            os.path.join(OUT, "share", f"{k}.jpg"), "JPEG", quality=84, optimize=True, progressive=True)
        x0, x1, y0, y1 = boxes[k]
        report[k] = dict(textBlock=[x0, y0, x1 - x0, y1 - y0], canvas=[cw, ch])
    print(json.dumps(report))

if __name__ == "__main__":
    main()
