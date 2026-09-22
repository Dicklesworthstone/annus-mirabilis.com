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

/** Exact binomial distribution of points inside volume fraction f. */
export function binomialInside(
  n: number,
  f: number | { p: bigint; q: bigint },
): CountDistribution {
  let pBig: bigint;
  let qBig: bigint;
  let fNum: number;

  if (typeof f === "object") {
    pBig = f.p;
    qBig = f.q;
    fNum = Number(f.p) / Number(f.q);
  } else {
    fNum = f;
    // Retain the existing LQ-05 numeric-input conversion contract.
    if (f === 0.5) {
      pBig = 1n;
      qBig = 2n;
    } else if (f === 0.25) {
      pBig = 1n;
      qBig = 4n;
    } else {
      pBig = BigInt(Math.round(f * 1e6));
      qBig = 1000000n;
    }
  }

  const denomTotal = bigIntPow(qBig, n);
  const qMinusP = qBig - pBig;
  const terms: CountTerm[] = [];
  for (let k = 0; k <= n; k++) {
    const comb = bigIntComb(n, k);
    const num = comb * bigIntPow(pBig, k) * bigIntPow(qMinusP, n - k);
    terms.push({
      k,
      exactProbability: { numerator: num, denominator: denomTotal },
      probability: Number(num) / Number(denomTotal),
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
}> {
  return {
    status: "value",
    quantityId: "configurationProbability",
    unit: "",
    value: f,
    linearRepresentable: true,
    modelNote: "perfectly locked positions have probability f that all lie in fraction f",
  };
}
