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
from PIL import Image, ImageFilter
import numpy as np, json, os, subprocess, tempfile
ROOT=os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
KEYS=["ap-17-132","ap-17-549","ap-17-891","ap-18-639"]
out=os.path.join(ROOT,"public/figures/plates")
def render():
    work=tempfile.mkdtemp(prefix="first-page-plates-")
    files=[]
    for k in KEYS:
        stem=os.path.join(work,k)
        subprocess.run(["pdftoppm","-f","1","-l","1","-r","400","-gray","-singlefile","-png",
                        os.path.join(ROOT,"public/papers/pdfs",k+".pdf"),stem],check=True)
        files.append(stem+".png")
    return files
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
    H,W=a.shape
    e=np.zeros_like(a,bool); e[:,1:]|=np.abs(np.diff(a,axis=1))>50; e[1:,:]|=np.abs(np.diff(a,axis=0))>50
    h8,w8=H//16,W//16
    blk=a[:h8*16,:w8*16].reshape(h8,16,w8,16).mean((1,3)); db=blk<120
    dd=db.copy()
    for dy in (-1,0,1):
        for dx in (-1,0,1): dd|=np.roll(np.roll(db,dy,0),dx,1)
    dark=np.kron(dd,np.ones((16,16),bool)); dark=np.pad(dark,((0,H-dark.shape[0]),(0,W-dark.shape[1])),constant_values=True)
    e&=~dark
    ylo,yhi=int(H*.12),int(H*.88)
    colm=runmed(e[ylo:yhi].sum(0).astype(float),9)
    cr=merge(runs(colm>(yhi-ylo)*0.01),12)
    x0,x1=max(cr,key=lambda r:r[1]-r[0])
    cmean=a[ylo:yhi].mean(0)
    while cmean[x0]<185 and x0<x1: x0+=1          # gutter stripe at the run's edge
    while cmean[x1-1]<185 and x1>x0: x1-=1
    row=e[:,x0:x1].sum(1).astype(float)
    rr=merge(runs(row>(x1-x0)*0.01),40)
    rmean=a[:,x0:x1].mean(1)
    rr=[r for r in rr if r[1]-r[0]>15 and r[0]>30 and r[1]<H-30 and rmean[r[0]:r[1]].mean()>170]
    y0,y1=rr[0][0],rr[-1][1]
    # a small trailing mark under the last line (the printer's signature, "42*") belongs to the page
    gap=0; y=y1
    while y<min(H-30,y1+120):
        if row[y]>=3: y1=y+1; gap=0
        else:
            gap+=1
            if gap>24: break
        y+=1
    return x0,x1,y0,y1
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
boxes={}
srcs=render()
for f in srcs:
    key=os.path.basename(f)[:9]
    a=np.asarray(Image.open(f).convert("L"),dtype=np.float32)
    boxes[key]=detect(a)
TW=max(b[1]-b[0] for b in boxes.values()); TH=max(b[3]-b[2] for b in boxes.values())
SIDE=int(TW*0.085); TOP=int(TW*0.06)
CW=TW+2*SIDE; CH=round(CW*662/400)
assert CH>=TH+TOP+int(TW*0.05), (CW,CH,TH)
report={}
for f in srcs:
    key=os.path.basename(f)[:9]; x0,x1,y0,y1=boxes[key]
    a=np.asarray(Image.open(f).convert("L"),dtype=np.float32)
    m=6  # antialiased stroke edges only; any wider reaches the gutter shadow
    cx0,cx1,cy0,cy1=max(0,x0-m),min(a.shape[1],x1+m),max(0,y0-m),min(a.shape[0],y1+m)
    crop=flatten(a)[cy0:cy1,cx0:cx1]
    canvas=Image.new("L",(CW,CH),255)
    px=SIDE+(TW-(x1-x0))//2-(x0-cx0); py=TOP-(y0-cy0)
    canvas.paste(Image.fromarray(crop),(px,py))
    for w in (400,800,1200):
        im=canvas.resize((w,round(w*662/400)),Image.LANCZOS)
        im.save(f"{out}/{key}-first-page-{w}.webp","WEBP",quality=72,method=6)
    canvas.resize((660,1092),Image.LANCZOS).convert("RGB").save(f"{out}/share/{key}.jpg","JPEG",quality=84,optimize=True,progressive=True)
    report[key]=dict(textBlock=[x0,y0,x1-x0,y1-y0],canvas=[CW,CH])
print(json.dumps(report))
