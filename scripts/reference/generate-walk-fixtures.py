"""Independent Irwin–Hall fixtures. Run with SciPy 1.17.0; not an app dependency."""
import json
from pathlib import Path
import scipy
from scipy.stats import irwinhall

if scipy.__version__ != "1.17.0":
    raise RuntimeError("Use SciPy 1.17.0 to reproduce the committed fixture bytes.")
rows = []
for n in [1, 2, 4, 16, 64, 400]:
    xs = sorted(set([0., float(n), n / 2] + [
        max(0, min(n, n / 2 + z * (n / 12) ** .5))
        for z in [-4, -2, -.75, .75, 2, 4]
    ]))
    for x in xs:
        rows.append(dict(n=n, x=x, cdf=float(irwinhall.cdf(x, n)),
                         pdf=0. if n == 1 and x == 1 else float(irwinhall.pdf(x, n))))
fixture = {"generator": "scipy.stats.irwinhall.cdf/pdf", "version": scipy.__version__,
           "convention": "U(0,1) density represented on [0,1).", "rows": rows}
path = Path(__file__).resolve().parents[2] / "src/testing/walk-law-fixtures.json"
path.write_text(json.dumps(fixture, indent=2) + "\n", encoding="utf-8")
