import { expect, test } from "bun:test";
import {
  alignedBoost,
  type Boost,
  composeBoosts,
  generalBoost,
  type KinematicResult,
  Mode1904GuardError,
  withMode1904Guard,
} from "../../physics/reference/kinematics.ts";
import { withinTolerance } from "../../units/tolerance.ts";

function accepted<T>(result: KinematicResult<T>): T {
  expect(result.status).toBe("value");
  if (result.status !== "value") throw new Error(result.reason);
  return result.value;
}

function close(actual: number, expected: number) {
  expect(withinTolerance(actual, expected, { absolute: 1e-10, relative: 1e-10 }).ok).toBe(true);
}

function product(a: readonly (readonly number[])[], b: readonly (readonly number[])[]) {
  return Array.from({ length: 4 }, (_, i) =>
    Array.from({ length: 4 }, (_, j) =>
      [0, 1, 2, 3].reduce((sum, k) => sum + (a[i]?.[k] ?? 0) * (b[k]?.[j] ?? 0), 0),
    ),
  );
}

function checkDecomposition(first: Boost, second: Boost) {
  const result = accepted(composeBoosts(first, second));
  const reconstructed = product(result.boost.matrix, result.rotation);
  const transposed = result.rotation.map((_, i) => result.rotation.map((row) => row[i] ?? 0));
  const orthogonal = product(transposed, result.rotation);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      close(reconstructed[i]?.[j] ?? Number.NaN, result.product[i]?.[j] ?? Number.NaN);
      close(orthogonal[i]?.[j] ?? Number.NaN, i === j ? 1 : 0);
    }
  }
  expect(result.boost.gamma).toBeGreaterThanOrEqual(1);
  expect(result.resultantSpeed).toBeLessThan(first.c);
  return result;
}

test("equal and opposite boosts return the identity across the teaching range", () => {
  for (const beta of [0.3, 0.4, 0.8, 0.9, 0.99, 0.99999]) {
    for (const direction of [-1, 1]) {
      const result = checkDecomposition(
        accepted(alignedBoost(direction * beta, 1)),
        accepted(alignedBoost(-direction * beta, 1)),
      );
      close(result.boost.gamma, 1);
      close(result.resultantSpeed, 0);
      close(result.wignerAngle, 0);
    }
  }
});

test("a rounded raw product is preserved while its physical boost remains valid", () => {
  const first = accepted(alignedBoost(0.99, 1));
  const second = accepted(alignedBoost(-0.99, 1));
  const raw = product(second.matrix, first.matrix);
  expect(raw[0]?.[0]).toBeLessThan(1);
  const result = accepted(composeBoosts(first, second));
  expect(result.product).toEqual(raw);
  expect(result.boost.gamma).toBe(1);
});

test("non-collinear products decompose into a boost and an orthogonal spatial rotation", () => {
  for (const beta of [0, 1e-12, 0.1, 0.3, 0.4, 0.6, 0.8, 0.9, 0.95, 0.99, 0.99999]) {
    for (const degrees of [0, 1, 30, 45, 90, 135, 179, 180, 181, 225, 270, 359, 360]) {
      const angle = (degrees * Math.PI) / 180;
      checkDecomposition(
        accepted(alignedBoost(beta, 1)),
        accepted(
          generalBoost({ bx: beta * Math.cos(angle), by: beta * Math.sin(angle), bz: 0 }, 1),
        ),
      );
    }
  }
});

test("the decomposition holds for three-dimensional and small boosts", () => {
  const pairs = [
    [
      { bx: 0.3, by: -0.2, bz: 0.1 },
      { bx: -0.2, by: 0.5, bz: -0.3 },
    ],
    [
      { bx: 0, by: 0.3, bz: 0.4 },
      { bx: 0.5, by: 0, bz: -0.2 },
    ],
    [
      { bx: 0.2, by: 0.3, bz: -0.4 },
      { bx: -0.2, by: -0.3, bz: 0.4 },
    ],
    [
      { bx: 1e-10, by: 2e-10, bz: 3e-10 },
      { bx: 3e-10, by: -1e-10, bz: 2e-10 },
    ],
  ] as const;
  for (const [first, second] of pairs)
    checkDecomposition(accepted(generalBoost(first, 1)), accepted(generalBoost(second, 1)));
});

test("reversing perpendicular boosts reverses the Wigner rotation", () => {
  const first = accepted(alignedBoost(0.6, 1));
  const second = accepted(generalBoost({ bx: 0, by: 0.6, bz: 0 }, 1));
  const forward = checkDecomposition(first, second);
  const reverse = checkDecomposition(second, first);
  close(forward.wignerAngle, -2 * Math.atan(1 / 9));
  close(reverse.wignerAngle, 2 * Math.atan(1 / 9));
  close(forward.boost.gamma, 1.5625);
  close(forward.resultantSpeed, Math.sqrt(0.5904));
});

test("near-light inverse boosts cancel before large Lorentz factors are multiplied", () => {
  for (const beta of [0.999999, 0.99999999, 1 - Number.EPSILON]) {
    const scale = beta / Math.sqrt(14);
    for (const velocity of [
      { bx: beta, by: 0, bz: 0 },
      { bx: scale, by: 2 * scale, bz: 3 * scale },
    ]) {
      const first = accepted(generalBoost(velocity, 1));
      const second = accepted(
        generalBoost({ bx: -velocity.bx, by: -velocity.by, bz: -velocity.bz }, 1),
      );
      const result = accepted(composeBoosts(first, second));
      expect(result.boost.gamma).toBe(1);
      expect(result.resultantSpeed).toBe(0);
      expect(result.wignerAngle).toBe(0);
      // At this conditioning, the raw matrix multiplication need not itself round to identity.
      expect(result.product).toEqual(product(second.matrix, first.matrix));
    }
  }
});

test("nearly opposite three-dimensional boosts retain their small physical velocity", () => {
  for (const beta of [0.95, 0.99999999]) {
    const scale = beta / Math.sqrt(14);
    const velocity = { bx: scale, by: 2 * scale, bz: 3 * scale };
    const angle = 1e-6;
    const opposite = {
      bx: -velocity.bx * Math.cos(angle) + velocity.by * Math.sin(angle),
      by: -velocity.by * Math.cos(angle) - velocity.bx * Math.sin(angle),
      bz: -velocity.bz,
    };
    const first = accepted(generalBoost(velocity, 1));
    const second = accepted(generalBoost(opposite, 1));
    const result = accepted(composeBoosts(first, second));
    const sumSquared =
      (velocity.bx + opposite.bx) ** 2 +
      (velocity.by + opposite.by) ** 2 +
      (velocity.bz + opposite.bz) ** 2;
    // gamma1 gamma2 (1 + beta1.beta2), rearranged to avoid cancellation near dot = -1.
    const expectedGamma =
      (first.gamma / second.gamma +
        second.gamma / first.gamma +
        first.gamma * second.gamma * sumSquared) /
      2;
    close(result.boost.gamma, expectedGamma);
    expect(result.resultantSpeed).toBeGreaterThan(0);
    expect(result.resultantSpeed).toBeLessThan(0.01);
  }
});

test("invalid boost matrices and nonphysical parameters remain refused", () => {
  const valid = accepted(alignedBoost(0.6, 1));
  const defective = valid.matrix.map((row) => [...row]);
  if (defective[1]) defective[1][1] = (defective[1][1] ?? 0) + 0.01;
  const nonfinite = valid.matrix.map((row) => [...row]);
  if (nonfinite[0]) nonfinite[0][0] = Number.NaN;
  const sparseRow = valid.matrix.map((row) => [...row]);
  sparseRow[1] = new Array<number>(4);
  const invalid: Boost[] = [
    { ...valid, matrix: defective },
    { ...valid, matrix: new Array<number[]>(4) },
    { ...valid, matrix: sparseRow },
    { ...valid, matrix: nonfinite },
    { ...valid, matrix: valid.matrix.slice(0, 3) },
    { ...valid, gamma: 0.5 },
    { ...valid, beta: { bx: 0.2, by: 0, bz: 0 } },
    { ...valid, beta: { bx: 1, by: 0, bz: 0 } },
  ];
  for (const candidate of invalid) {
    expect(composeBoosts(candidate, valid).status).toBe("outside-domain");
    expect(composeBoosts(valid, candidate).status).toBe("outside-domain");
  }
});

test("composition cannot expose a modern matrix inside the 1904 guard", () => {
  const first = accepted(alignedBoost(0.6, 1));
  const second = accepted(alignedBoost(-0.6, 1));
  expect(() => withMode1904Guard(() => composeBoosts(first, second))).toThrow(Mode1904GuardError);
  expect(composeBoosts(first, second).status).toBe("value");
});
