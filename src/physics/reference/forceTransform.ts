/**
 * Independent modern verification oracle for SR-08, not a historical premise.
 * Boost along +x; c is explicitly supplied by the caller's constant set.
 * This transforms dp/dt, not an ordinary spatial vector. It does not recompute
 * q(E + u cross B), so comparing the two calculations can expose a wrong sign,
 * an untransformed particle velocity, or a frame-time mismatch.
 */
export type ForceVector = Readonly<{ x: number; y: number; z: number }>;
export type ForceTransformResult =
  | Readonly<{
      status: "value";
      force: ForceVector;
      dtPrimeOverDt: number;
      gamma: number;
      ownerId: "host:three-force-transform-v1";
    }>
  | Readonly<{
      status: "outside-domain";
      domainKind: "input" | "physical" | "numerical";
      reason: string;
    }>;

const outside = (domainKind: "input" | "physical" | "numerical", reason: string): ForceTransformResult =>
  Object.freeze({ status: "outside-domain", domainKind, reason });

export function transformThreeForce(input: Readonly<{
  force: ForceVector;
  velocity: ForceVector;
  beta: number;
  c: number;
}>): ForceTransformResult {
  const { force: F, velocity: u, beta, c } = input;
  if (![F.x, F.y, F.z, u.x, u.y, u.z, beta, c].every(Number.isFinite) || c <= 0)
    return outside("input", "Force and velocity components must be finite, and c must be positive.");
  if (Math.abs(beta) >= 1)
    return outside("physical", "The inertial observer must satisfy |v| < c.");
  const ux = u.x / c;
  const uy = u.y / c;
  const uz = u.z / c;
  if (Math.hypot(ux, uy, uz) >= 1)
    return outside("physical", "This oracle describes a massive test particle with |u| < c.");
  const inverseGamma = Math.sqrt((1 - beta) * (1 + beta));
  const denominator = 1 - beta * ux;
  if (!(inverseGamma > 0) || !(denominator > 0))
    return outside("numerical", "The boost or particle time transformation is numerically unresolved.");
  const dtPrimeOverDt = denominator / inverseGamma;
  // Algebraically cancel Fx*(1-beta*ux) before division. Collinear force
  // is unchanged even when those two factors are both close to zero.
  const transformed = Object.freeze({
    x: F.x - (beta * (uy * F.y + uz * F.z)) / denominator,
    y: (F.y * inverseGamma) / denominator,
    z: (F.z * inverseGamma) / denominator,
  });
  const gamma = 1 / inverseGamma;
  if (![transformed.x, transformed.y, transformed.z, dtPrimeOverDt, gamma].every(Number.isFinite))
    return outside("numerical", "The transformed force exceeds the finite numerical range.");
  return Object.freeze({
    status: "value", force: transformed, dtPrimeOverDt, gamma,
    ownerId: "host:three-force-transform-v1",
  });
}
