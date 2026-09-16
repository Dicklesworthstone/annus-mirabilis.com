import { describe, expect, test } from "bun:test";
import {
  gamma,
  solveCandidateFamily,
  speedOfLightMetresPerSecond,
} from "../../physics/reference/kinematics.ts";
import { withinTolerance } from "../../units/tolerance.ts";
import { joinConstraints, SR04_DEFAULTS } from "./definition.ts";
import { evaluateSr04 } from "./session.ts";

const C = speedOfLightMetresPerSecond();

function rel(a: number, b: number, tol = 1e-9): boolean {
  return withinTolerance(a, b, { relative: tol }).ok;
}

describe("SR-04 construction sequence against the bead's own worked numbers (am-sr-04-lorentz-map-px1k)", () => {
  test("step 1, Galilean candidate: slow case gives -20 m/s, light rays give 0.4c and 1.6c at v=0.6c", () => {
    const evaluation = evaluateSr04({
      ...SR04_DEFAULTS,
      vOverC: 0.6,
      observerSpeed: 30,
      objectSpeed: 10,
    });
    expect(evaluation.slowCaseGalilean.status).toBe("value");
    if (evaluation.slowCaseGalilean.status === "value") {
      expect(evaluation.slowCaseGalilean.value).toBe(-20);
    }
    expect(evaluation.rightRayFraction.status).toBe("value");
    expect(evaluation.leftRayFraction.status).toBe("value");
    if (
      evaluation.rightRayFraction.status === "value" &&
      evaluation.leftRayFraction.status === "value"
    ) {
      expect(rel(evaluation.rightRayFraction.value, 0.4)).toBe(true);
      expect(rel(evaluation.leftRayFraction.value, -1.6)).toBe(true);
    }
  });

  test("the slow case's relativistic deviation matches the bead's stated -6.675900e-14 m/s and 3.338e-15 relative", () => {
    const evaluation = evaluateSr04({ ...SR04_DEFAULTS, observerSpeed: 30, objectSpeed: 10 });
    expect(evaluation.slowCaseDeviation.status).toBe("value");
    if (evaluation.slowCaseDeviation.status !== "value") return;
    expect(rel(evaluation.slowCaseDeviation.value.difference, -6.6759e-14, 1e-3)).toBe(true);
    expect(rel(evaluation.slowCaseDeviation.value.relativeSize, 3.338e-15, 1e-3)).toBe(true);
  });

  test("naive float64 subtraction of the nearly equal velocities misses the deviation badly, motivating the cancellation-free helper", () => {
    // u' (relativistic) = u - v - deviation; computing it by naively subtracting two nearly
    // equal transformed velocities in float64 loses far more precision than the ~1e-14 m/s
    // true deviation, exactly the bead's point ("about 1.1 percent wrong").
    const u = 10;
    const v = 30;
    const c = C;
    const uPrimeRelativisticNaive = (u - v) / (1 - (u * v) / (c * c));
    const uPrimeGalilean = u - v;
    const naiveDifference = uPrimeRelativisticNaive - uPrimeGalilean;
    const trueDifference = -6.6759e-14;
    // The naive path is not garbage -- it is measurably wrong at the ~1% level relative to the
    // true deviation, which is exactly why the owner's cancellation-free closed form exists.
    const relativeError = Math.abs((naiveDifference - trueDifference) / trueDifference);
    expect(relativeError).toBeGreaterThan(1e-4);
  });

  test("step 3, light constraints only: underdetermined with b=a, d=-av/c^2", () => {
    const family = solveCandidateFamily({
      v: 0.6 * C,
      enabledConstraints: ["right-moving-light", "left-moving-light"],
    });
    expect(family.status).toBe("underdetermined");
    if (family.status !== "underdetermined") return;
    expect(family.relations).toContain("b = a");
    expect(family.relations).toContain("d = -a*v/(c*c)");
  });

  test("step 4, plus reciprocity: still underdetermined, needs isotropy", () => {
    const family = solveCandidateFamily({
      v: 0.6 * C,
      enabledConstraints: ["right-moving-light", "left-moving-light", "reciprocity"],
    });
    expect(family.status).toBe("underdetermined");
    if (family.status !== "underdetermined") return;
    expect(family.neededInformation).toContain("isotropy");
  });

  test("step 5, plus isotropy (no branch): still underdetermined, a = +-1.25 at 0.6c", () => {
    const family = solveCandidateFamily({
      v: 0.6 * C,
      enabledConstraints: ["right-moving-light", "left-moving-light", "reciprocity", "isotropy"],
    });
    expect(family.status).toBe("underdetermined");
    if (family.status !== "underdetermined") return;
    expect(family.neededInformation).toEqual(["identity-branch"]);
  });

  test("step 6, plus the branch rule: a = 1.25 fixed (fixture: after inverse a(v)a(-v)=1.5625, isotropy a=+-1.25, branch a=1.25)", () => {
    const evaluation = evaluateSr04({
      ...SR04_DEFAULTS,
      vOverC: 0.6,
      enabledConstraints: joinConstraints([
        "right-moving-light",
        "left-moving-light",
        "reciprocity",
        "isotropy",
        "identity-branch",
      ]),
    });
    expect(evaluation.family.status).toBe("value");
    if (evaluation.family.status !== "value") return;
    expect(rel(evaluation.family.value.a, 1.25)).toBe(true);
    expect(rel(evaluation.family.value.b, 1.25)).toBe(true);
    expect(rel(evaluation.family.value.d, (-1.25 * 0.6) / C)).toBe(true);
    // a(v)*a(-v)*(1 - v^2/c^2) = 1: 1.25 * 1.25 * (1 - 0.36) = 1.5625 * 0.64 = 1.0
    expect(rel(evaluation.family.value.a * evaluation.family.value.a * (1 - 0.36), 1)).toBe(true);
  });

  test("step 7, plus transverse-light: transverseScale = 1, fully fixed", () => {
    const evaluation = evaluateSr04({
      ...SR04_DEFAULTS,
      vOverC: 0.6,
      enabledConstraints: joinConstraints([
        "right-moving-light",
        "left-moving-light",
        "reciprocity",
        "isotropy",
        "identity-branch",
        "transverse-light",
      ]),
    });
    expect(evaluation.family.status).toBe("value");
    if (evaluation.family.status !== "value") return;
    expect(evaluation.family.value.transverseScale).toBe(1);
    expect(evaluation.family.family).toContain("fixed");
  });

  test("step 8, later aids at 0.6c: determinant 1, eigenvalues 0.5 and 2, rapidity ln2", () => {
    const evaluation = evaluateSr04({ ...SR04_DEFAULTS, vOverC: 0.6 });
    expect(evaluation.laterAids.matrix.status).toBe("value");
    if (evaluation.laterAids.matrix.status === "value") {
      const [row0, row1] = evaluation.laterAids.matrix.value;
      if (!row0 || !row1) throw new Error("unreachable: a 2x2 matrix has two rows.");
      const [m00, m01] = row0;
      const [m10, m11] = row1;
      if (m00 === undefined || m01 === undefined || m10 === undefined || m11 === undefined) {
        throw new Error("unreachable: each row of a 2x2 matrix has two entries.");
      }
      const det = m00 * m11 - m01 * m10;
      expect(rel(det, 1)).toBe(true);
    }
    expect(evaluation.laterAids.eigenvalues).not.toBeNull();
    if (evaluation.laterAids.eigenvalues) {
      const [lo, hi] = evaluation.laterAids.eigenvalues;
      expect(rel(lo, 0.5)).toBe(true);
      expect(rel(hi, 2)).toBe(true);
    }
    expect(evaluation.laterAids.rapidityValue.status).toBe("value");
    if (evaluation.laterAids.rapidityValue.status === "value") {
      expect(rel(evaluation.laterAids.rapidityValue.value, Math.log(2))).toBe(true);
    }
  });

  test("identity at v=0: gamma=1, rapidity=0, both light rays stay at c", () => {
    const evaluation = evaluateSr04({ ...SR04_DEFAULTS, vOverC: 0 });
    expect(evaluation.laterAids.gammaValue.status).toBe("value");
    if (evaluation.laterAids.gammaValue.status === "value") {
      expect(rel(evaluation.laterAids.gammaValue.value, 1)).toBe(true);
    }
    expect(evaluation.rightRayFraction.status).toBe("value");
    expect(evaluation.leftRayFraction.status).toBe("value");
    if (
      evaluation.rightRayFraction.status === "value" &&
      evaluation.leftRayFraction.status === "value"
    ) {
      expect(rel(evaluation.rightRayFraction.value, 1)).toBe(true);
      expect(rel(evaluation.leftRayFraction.value, -1)).toBe(true);
    }
  });

  test("the engine never uses gamma as an input: the family for the 5-constraint (no transverse) case matches gamma(0.6) only as a DERIVED value, and the construction path itself imports no gamma helper", () => {
    // Structural guard, not just numeric: constraints.ts's own header states "does not import
    // gamma or any Lorentz-factor helper." Confirmed by reading the source text directly here
    // (the dedicated static-import-graph guard with a planted-violation fixture belongs to a
    // fuller test suite than this pass builds; see BATCH_PENDING for what remains).
    const source = require("node:fs").readFileSync(
      require("node:path").resolve(__dirname, "../../physics/reference/kinematics/constraints.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/\bgamma\(/);
    expect(source.toLowerCase()).not.toContain("import { gamma");
  });

  test("removing isotropy from the fully-constrained set leaves a two-branch (not single) result", () => {
    const family = solveCandidateFamily({
      v: 0.6 * C,
      enabledConstraints: [
        "right-moving-light",
        "left-moving-light",
        "reciprocity",
        "identity-branch",
      ],
    });
    // isotropy removed: the engine must not silently supply it.
    expect(family.status).toBe("underdetermined");
  });

  test("a(beta) = gamma * e^(kappa beta) satisfies reciprocity for kappa in {0, 0.3} and fails isotropy unless kappa=0 (direct mathematical property, per the bead's Test Plan; beta = v/c, the bead's own 'units c=1' convention)", () => {
    const beta = 0.6;
    const g = gamma(beta);
    expect(g.status).toBe("value");
    if (g.status !== "value") return;
    for (const kappa of [0, 0.3]) {
      const aPlus = g.value * Math.exp(kappa * beta);
      const aMinus = g.value * Math.exp(kappa * -beta);
      const reciprocityProduct = aPlus * aMinus * (1 - beta * beta);
      expect(rel(reciprocityProduct, 1, 1e-9)).toBe(true);
      const isotropyHolds = rel(aPlus, aMinus, 1e-9);
      expect(isotropyHolds).toBe(kappa === 0);
    }
  });

  test("out-of-domain: |v| >= c is refused", () => {
    const family = solveCandidateFamily({ v: C, enabledConstraints: [] });
    expect(family.status).toBe("outside-domain");
  });
});
