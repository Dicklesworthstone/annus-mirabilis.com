"""
Shared cleanup for the facsimile plates: find a microfilm frame's printed block and flatten its paper.

Used by first_page_plates.py (the four first pages) and page_plates.py (the German face's following
plates). Reads pixels rendered by pdftoppm only: no text layer, no OCR. "Finding the printed block"
is geometry: where the ink edges are, with the film border and binding gutter excluded.
"""
from PIL import Image, ImageFilter
import numpy as np
import os, subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TYPE_W, TYPE_H = 1377, 2500  # the printed type area at 400 dpi; see detect()

def render_page(key, pdf_page, dpi, stem):
    """Rasterize one page of a pinned PDF to <stem>.png (grey) with pdftoppm."""
    subprocess.run(["pdftoppm", "-f", str(pdf_page), "-l", str(pdf_page), "-r", str(dpi), "-gray",
                    "-singlefile", "-png", os.path.join(ROOT, "public/papers/pdfs", key + ".pdf"), stem],
                   check=True)
    return stem + ".png"

def load(path):
    return np.asarray(Image.open(path).convert("L"), dtype=np.float32)

def place(a, box, canvas_w, canvas_h, text_w, top):
    """The flattened block on a white page: centred on a common text width, at a common top."""
    x0, x1, y0, y1 = box
    m = 6  # antialiased stroke edges only; any wider reaches the gutter shadow
    cx0, cx1, cy0, cy1 = max(0, x0 - m), min(a.shape[1], x1 + m), max(0, y0 - m), min(a.shape[0], y1 + m)
    crop = flatten(a)[cy0:cy1, cx0:cx1]
    canvas = Image.new("L", (canvas_w, canvas_h), 255)
    side = (canvas_w - text_w) // 2
    canvas.paste(Image.fromarray(crop), (side + (text_w - (x1 - x0)) // 2 - (x0 - cx0), top - (y0 - cy0)))
    return canvas

def runs(mask):
    o=[];s=None
    for i,b in enumerate(list(mask)+[False]):
        if b and s is None: s=i
        if not b and s is not None: o.append([s,i]); s=None
    return o
def merge(rs,gap):
    o=[]
    for r in rs:
        if o and r[0]-o[-1][1]<=gap: o[-1][1]=r[1]
        else: o.append(list(r))
    return o
def runmed(v,k):
    p=k//2; vp=np.pad(v,p,mode="edge"); return np.array([np.median(vp[i:i+k]) for i in range(len(v))])
def detect(a):
    """The printed block of one frame, as (x0, x1, y0, y1) in frame pixels.

    Ink edges on a 12px grid, with film border and deep gutter masked out, are joined along a line
    (60px) and across line spacing (36px) into text components. The largest is the body. Every
    component whose centre lies inside the body's width belongs to the page: the running head, a lone
    page number, footnotes, the printer's signature. One outside it is the facing page, seen across
    the gutter. Works on a page that is mostly blank, where a column profile does not.
    """
    from collections import deque
    H, W = a.shape
    e = np.zeros_like(a, bool)
    e[:, 1:] |= np.abs(np.diff(a, axis=1)) > 50
    e[1:, :] |= np.abs(np.diff(a, axis=0)) > 50
    B = 12
    h, w = H // B, W // B
    blk = a[:h * B, :w * B].reshape(h, B, w, B).mean((1, 3))
    dark = blk < 120
    dd = dark.copy()
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            dd |= np.roll(np.roll(dark, dy, 0), dx, 1)
    cnt = e[:h * B, :w * B].reshape(h, B, w, B).sum((1, 3))
    ink = (cnt >= 6) & ~dd
    grown = ink.copy()
    for dx in range(-5, 6):
        grown |= np.roll(ink, dx, 1)
    g2 = grown.copy()
    for dy in range(-3, 4):
        g2 |= np.roll(grown, dy, 0)
    g2 &= ~dd
    lab = np.zeros((h, w), int)
    comps = []
    for y in range(h):
        for x in range(w):
            if g2[y, x] and not lab[y, x]:
                n = len(comps) + 1
                q = deque([(y, x)])
                lab[y, x] = n
                pts = []
                while q:
                    cy, cx = q.popleft()
                    pts.append((cy, cx))
                    for ny, nx in ((cy + 1, cx), (cy - 1, cx), (cy, cx + 1), (cy, cx - 1)):
                        if 0 <= ny < h and 0 <= nx < w and g2[ny, nx] and not lab[ny, nx]:
                            lab[ny, nx] = n
                            q.append((ny, nx))
                ys = [p[0] for p in pts if ink[p]]
                xs = [p[1] for p in pts if ink[p]]
                if ys:
                    comps.append(dict(n=len(ys), x0=min(xs), x1=max(xs) + 1, y0=min(ys), y1=max(ys) + 1))
    body = max(comps, key=lambda c: c["n"])
    bx0, bx1 = body["x0"], body["x1"]
    bw = bx1 - bx0
    inside = [c for c in comps if bx0 <= (c["x0"] + c["x1"]) / 2 <= bx1
              and c["x0"] >= bx0 - 3 and c["x1"] <= bx1 + 3
              and not (c["y1"] - c["y0"] <= 2 and c["x1"] - c["x0"] > 0.6 * bw)]  # the film's edge
    keep = [c for c in inside if c["n"] > 3]
    # A mark of a few blocks is print only beside other print: the signature "42*" sits under the
    # footnotes. The same size alone in a margin is dust.
    ky0, ky1 = min(c["y0"] for c in keep), max(c["y1"] for c in keep)
    keep += [c for c in inside if c["n"] <= 3 and (ky0 - 10 <= c["y1"] and c["y0"] <= ky1 + 10)]
    x0 = min(c["x0"] for c in keep) * B
    x1 = max(c["x1"] for c in keep) * B
    y0 = min(c["y0"] for c in keep) * B
    y1 = max(c["y1"] for c in keep) * B
    # Refine each edge to the pixel. First the gutter: a stripe darker than paper down the block's
    # whole height, which print never is. Then the outermost columns holding at least 16 ink edges
    # (a dust speck has about 10; the last column of justified text has dozens even on a nearly blank
    # page), and the outermost rows holding any (the printer's signature has 4-9 per row).
    cmean = a[y0:y1].mean(0)
    while x0 < x1 and cmean[x0] < 185:
        x0 += 1
    while x1 > x0 and cmean[x1 - 1] < 185:
        x1 -= 1
    # A gutter's edge can be a thin black rule, dark on most rows, which no column of type is. If one
    # stands in the outer 15% of either side, the block starts past it.
    dk = np.maximum((a[y0:y1, x0:x1] < 128).mean(0), e[y0:y1, x0:x1].mean(0))  # dark, or an edge, on most rows
    edge = max(1, int((x1 - x0) * 0.15))
    left = np.where(dk[:edge] > 0.6)[0]
    right = np.where(dk[-edge:] > 0.6)[0]
    nx0 = x0 + int(left.max()) + 4 if len(left) else x0
    nx1 = x1 - edge + int(right.min()) - 4 if len(right) else x1
    x0, x1 = nx0, nx1
    sub = e[y0:y1, x0:x1]
    # Type is a run of inked columns; a shadow's edge is one or two with blank paper beside them.
    inked = sub.sum(0) >= 16
    dense = np.convolve(inked.astype(int), np.ones(31, int), "full")
    idx = np.where(inked)[0]
    def gap_within(seg):  # a run of 4 blank columns: paper between a shadow's edge and the type
        run = 0
        for v in seg:
            run = 0 if v else run + 1
            if run >= 4:
                return True
        return False
    lefts = [c for c in idx if dense[c + 30] >= 10 and not gap_within(inked[c:c + 12])]
    rights = [c for c in idx if dense[c] >= 10 and not gap_within(inked[max(0, c - 11):c + 1][::-1])]
    cols = np.array([lefts[0], rights[-1]]) if lefts and rights else idx
    x0, x1 = x0 + int(cols.min()), x0 + int(cols.max()) + 1
    # rows: one grid block of slack, since a stroke's tail can fall in a block too faint to count
    ya, yb = max(0, y0 - B), min(H, y1 + B)
    rows = np.where(e[ya:yb, x0:x1].sum(1) >= 2)[0]
    y0, y1 = ya + int(rows.min()), ya + int(rows.max()) + 1
    # The Annalen's type area is one size on every page. At 400 dpi, measured on the 30 pages whose
    # frames hold nothing else: at most 1377 px wide, and 2480 px from running head to signature.
    # A block larger than that has taken in the paper's edge, a margin, or the facing page, so it is
    # cut to the window of type-area size that holds the most ink.
    if x1 - x0 > TYPE_W + 25:
        col = e[y0:y1, x0:x1].sum(0).astype(np.int64)
        win = np.convolve(col, np.ones(TYPE_W, np.int64), "valid")
        best = int(np.argmax(win))
        x0, x1 = x0 + best, x0 + best + TYPE_W
        inked = e[y0:y1, x0:x1].sum(0) >= 16
        idx = np.where(inked)[0]
        x0, x1 = x0 + int(idx.min()), x0 + int(idx.max()) + 1
    if y1 - y0 > TYPE_H:
        rows = np.where(e[y0:y0 + TYPE_H, x0:x1].sum(1) >= 2)[0]
        y1 = y0 + int(rows.max()) + 1
    return x0, x1, y0, y1

def flatten(a):
    # background: 95th percentile per 48px block, smoothed, then divide it out
    H,W=a.shape; B=48; h,w=-(-H//B),-(-W//B)
    pad=np.pad(a,((0,h*B-H),(0,w*B-W)),mode="edge")
    bg=np.percentile(pad.reshape(h,B,w,B).transpose(0,2,1,3).reshape(h,w,B*B),95,axis=2)
    bgi=Image.fromarray(np.clip(bg,1,255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3)).resize((W,H),Image.BILINEAR).filter(ImageFilter.GaussianBlur(24))
    n=a/np.maximum(np.asarray(bgi,dtype=np.float32),60)*255
    # levels: paper and show-through to white, ink kept dark and crisp
    n=np.clip((n-35)/(215-35),0,1)
    return (n**1.15*255).astype(np.uint8)
