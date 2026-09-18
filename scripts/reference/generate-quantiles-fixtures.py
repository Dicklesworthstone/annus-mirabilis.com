"""Generate independent arbitrary-precision quantile fixtures; requires mpmath==1.3.0.
Used by AC 12 and AC 13 of am-ref-diffusion-lr3.
"""
import hashlib
import json
from pathlib import Path
import mpmath as mp

if mp.__version__ != "1.3.0":
    raise RuntimeError("Use mpmath==1.3.0 for this fixture edition")

mp.mp.dps = 80

# Standard normal quantile points from AC 12 & spec
normal_probs = ["0.975", "0.9995", "0.99995"]
normal_rows = []
for p_str in normal_probs:
    p = mp.mpf(p_str)
    # z_p = sqrt(2) * erfinv(2*p - 1)
    z = mp.sqrt(2) * mp.erfinv(2 * p - 1)
    normal_rows.append({"p": p_str, "z": str(z), "value": float(z)})

# Chi-square quantiles grid: 11 degrees of freedom x 13 probability levels
q_list = [1, 2, 4, 10, 20, 38, 40, 60, 100, 400, 1000]
p_list = [
    "0.00005",  # 5e-5
    "0.0005",   # 5e-4
    "0.001",
    "0.0125",
    "0.025",
    "0.05",
    "0.5",
    "0.95",
    "0.975",
    "0.9875",
    "0.999",
    "0.9995",   # 1 - 5e-4
    "0.99995",  # 1 - 5e-5
]

def compute_chi2_quantile(q, p_str):
    a = mp.mpf(q) / 2
    p = mp.mpf(p_str)
    if q == 1:
        z = mp.sqrt(2) * mp.erfinv(2 * ((1 + p) / 2) - 1)
        return z**2
    z = mp.sqrt(2) * mp.erfinv(2 * p - 1)
    term = 1 - mp.mpf(2) / (9 * q) + z * mp.sqrt(mp.mpf(2) / (9 * q))
    x = a * (term ** 3) if term > 0 else mp.mpf("0.1")
    for _ in range(35):
        fx = mp.gammainc(a, 0, x, regularized=True) - p
        dfx = mp.exp(-x + (a - 1) * mp.log(x) - mp.loggamma(a))
        step = fx / dfx
        x_next = x - step
        if x_next <= 0:
            x_next = x / 2
        x = x_next
        if abs(step) < mp.mpf("1e-75"):
            break
    return 2 * x

chi2_rows = []
for q in q_list:
    for p_str in p_list:
        chi2_val = compute_chi2_quantile(q, p_str)
        chi2_rows.append({
            "q": q,
            "p": p_str,
            "chi2": str(chi2_val),
            "value": float(chi2_val)
        })

encoded = json.dumps({"normal": normal_rows, "chi2": chi2_rows}, ensure_ascii=True, separators=(",", ":")).encode("utf-8")
fixture = {
    "generator": "python3 scripts/reference/generate-quantiles-fixtures.py",
    "library": "mpmath 1.3.0",
    "decimalPrecision": 80,
    "rowsSha256": hashlib.sha256(encoded).hexdigest(),
    "normal": normal_rows,
    "chi2": chi2_rows,
}

root = Path(__file__).resolve().parents[2]
target = root / "src/physics/reference/special/quantiles.table.json"
target.write_text(json.dumps(fixture, indent=2) + "\n")
print(f"Wrote {len(normal_rows)} normal and {len(chi2_rows)} chi2 entries to {target}")
