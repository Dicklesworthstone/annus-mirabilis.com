/**
 * Count distributions shared by LQ-05 and the independence countermodel.
 * The binomial and locked-probability owners were moved here from configurations.ts;
 * that public module re-exports them. No sampling or ambient RNG is needed to count.
 */
export type CountTerm = Readonly<{
  k: number;
  exactProbability: Readonly<{ numerator: bigint; denominator: bigint }>;
  probability: number;
}>;
export type CountDistribution = Readonly<{
  n: number;
  f: number;
  terms: readonly CountTerm[];
}>;

function bigIntPow(base: bigint, exp: number): bigint {
  let res = 1n;
  let b = base;
  let e = exp;
  while (e > 0) {
    if (e % 2 === 1) res *= b;
    b *= b;
    e = Math.floor(e / 2);
  }
  return res;
}

function bigIntComb(n: number, k: number): bigint {
  if (k < 0 || k > n) return 0n;
  if (k === 0 || k === n) return 1n;
  const kEff = k > n - k ? n - k : k;
  let num = 1n;
  let den = 1n;
  for (let i = 1; i <= kEff; i++) {
    num *= BigInt(n - i + 1);
    den *= BigInt(i);
  }
  return num / den;
}

/** Preserve the admitted decimal fraction instead of rounding it to six places. */
export function configurationFraction(f: number): Readonly<{ p: bigint; q: bigint }> {
  const cells = Math.round(1 / f);
  if (Number.isSafeInteger(cells) && cells > 0 && 1 / cells === f) {
    return { p: 1n, q: BigInt(cells) };
  }
  const [mantissa = "0", exponent = "0"] = String(f).split("e");
  const [whole = "0", fractional = ""] = mantissa.split(".");
  const places = fractional.length - Number(exponent);
  let p = BigInt(whole + fractional) * 10n ** BigInt(Math.max(0, -places));
  let q = 10n ** BigInt(Math.max(0, places));
  let a = p;
  let b = q;
  while (b !== 0n) [a, b] = [b, a % b];
  if (a !== 0n) {
    p /= a;
    q /= a;
  }
  return { p, q };
}

/** Divide bounded leading digits before applying scale; huge exact counts need not fit a double. */
function probabilityRatio(numerator: bigint, denominator: bigint): number {
  if (numerator === 0n) return 0;
  const n = numerator.toString();
  const d = denominator.toString();
  const headN = n.slice(0, 16);
  const headD = d.slice(0, 16);
  return (
    (Number(headN) / Number(headD)) *
    10 ** (n.length - headN.length - (d.length - headD.length))
  );
}

/** Exact binomial distribution of points inside volume fraction f. */
export function binomialInside(n: number, f: number | { p: bigint; q: bigint }): CountDistribution {
  const { p: pBig, q: qBig } = typeof f === "object" ? f : configurationFraction(f);
  const fNum = typeof f === "object" ? probabilityRatio(f.p, f.q) : f;

  const denomTotal = bigIntPow(qBig, n);
  const qMinusP = qBig - pBig;
  const terms: CountTerm[] = [];
  for (let k = 0; k <= n; k++) {
    const comb = bigIntComb(n, k);
    const num = comb * bigIntPow(pBig, k) * bigIntPow(qMinusP, n - k);
    terms.push({
      k,
      exactProbability: { numerator: num, denominator: denomTotal },
      probability: probabilityRatio(num, denomTotal),
    });
  }
  return { n, f: fNum, terms };
}

/** Perfectly locked, coincident positions: one placement, not n independent ones. */
export function lockedPositionsProbability(
  _n: number,
  f: number,
): Readonly<{
  status: "value";
  quantityId: "configurationProbability";
  unit: "";
  value: number;
  linearRepresentable: true;
  modelNote: string;
  lnW: number;
  log10W: number;
  deltaSOverKb: number;
}> {
  return {
    status: "value",
    quantityId: "configurationProbability",
    unit: "",
    value: f,
    linearRepresentable: true,
    modelNote: "perfectly locked positions have probability f that all lie in fraction f",
    lnW: Math.log(f),
    log10W: Math.log10(f),
    deltaSOverKb: Math.log(f),
  };
}

/** A coincident locked group has only two outcomes: every point outside, or every point inside. */
export function lockedPointsInside(n: number, f: number): CountDistribution {
  const { p, q } = configurationFraction(f);
  return {
    n,
    f,
    terms: Array.from({ length: n + 1 }, (_, k) => {
      const numerator = k === n ? p : k === 0 ? q - p : 0n;
      return {
        k,
        exactProbability: { numerator, denominator: q },
        probability: probabilityRatio(numerator, q),
      };
    }),
  };
}
