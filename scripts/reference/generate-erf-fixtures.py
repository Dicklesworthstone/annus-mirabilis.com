"""Regenerate independent fixtures; requires mpmath==1.3.0 (not a runtime dependency)."""
import hashlib
import json
from pathlib import Path
import mpmath as mp

if mp.__version__ != "1.3.0":
    raise RuntimeError("Use mpmath==1.3.0 for this fixture edition")
mp.mp.dps = 80
points = ["0", "1e-300", "1e-12", "0.001", "0.1", "0.5", "1", "1.49999999", "1.5", "2", "3", "4", "5", "6", "7", "8", "10", "15", "20", "26"]
rows = [{"x": x, "erf": str(mp.erf(mp.mpf(x))), "erfc": str(mp.erfc(mp.mpf(x)))} for x in points]
encoded = json.dumps(rows, ensure_ascii=True, separators=(",", ":")).encode("utf-8")
fixture = {"generator": "python3 scripts/reference/generate-erf-fixtures.py", "library": "mpmath 1.3.0", "decimalPrecision": 80, "rowsSha256": hashlib.sha256(encoded).hexdigest(), "rows": rows}
root = Path(__file__).resolve().parents[2]
(root / "src/physics/reference/special/erf.table.json").write_text(json.dumps(fixture, indent=2) + "\n")
