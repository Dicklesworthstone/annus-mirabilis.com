import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { checkCandidateMap, solveCandidateFamily } from "../../physics/reference/kinematics.ts";

const constraintsSrc = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    "../../physics/reference/kinematics/constraints.ts",
  ),
  "utf8",
);

describe("constraint engine", () => {
  test("does not import gamma", () => {
    expect(constraintsSrc.includes("gamma(")).toBe(false);
    expect(/from\s+["'][^"']*kinematics["']/.test(constraintsSrc)).toBe(false);
  });

  test("candidate type uses transverseScale", () => {
    expect(constraintsSrc.includes("transverseScale")).toBe(true);
    expect(/\btransverseScale\b/.test(constraintsSrc)).toBe(true);
  });

  test("none: Galilean residual report, light fails", () => {
    const r = solveCandidateFamily({ v: 0.6 * 299792458, enabledConstraints: [] });
    expect(r.status).toBe("residual-report");
    if (r.status === "residual-report") {
      expect(Math.abs(r.residuals["right-moving-light"] ?? 0)).toBeGreaterThan(1);
      expect(r.notes.includes("light")).toBe(true);
    }
  });

  test("both light rays: underdetermined free a(v)", () => {
    const r = solveCandidateFamily({
      v: 0.6 * 299792458,
      enabledConstraints: ["right-moving-light", "left-moving-light"],
    });
    expect(r.status).toBe("underdetermined");
    if (r.status === "underdetermined")
      expect(r.compatibleFamily.includes("a(v) still free")).toBe(true);
  });

  test("light + reciprocity: a(v)a(-v) relation", () => {
    const r = solveCandidateFamily({
      v: 0.6 * 299792458,
      enabledConstraints: ["right-moving-light", "left-moving-light", "reciprocity"],
    });
    expect(r.status).toBe("underdetermined");
    if (r.status === "underdetermined") expect(r.compatibleFamily.includes("a(v)a(−v)")).toBe(true);
  });

  test("light + reciprocity + isotropy: two branches", () => {
    const r = solveCandidateFamily({
      v: 0.6 * 299792458,
      enabledConstraints: ["right-moving-light", "left-moving-light", "reciprocity", "isotropy"],
    });
    expect(r.status).toBe("underdetermined");
    if (r.status === "underdetermined") expect(r.neededInformation).toContain("identity-branch");
  });

  test("full longitudinal set yields positive root without importing gamma", () => {
    const v = 0.6 * 299792458;
    const r = solveCandidateFamily({
      v,
      enabledConstraints: [
        "right-moving-light",
        "left-moving-light",
        "reciprocity",
        "isotropy",
        "identity-branch",
      ],
    });
    expect(r.status).toBe("value");
    if (r.status === "value") {
      expect(r.value.a).toBeCloseTo(1.25, 12);
      expect(r.value.transverseScale).toBe(1);
    }
  });

  test("transverse step fixes transverseScale = 1", () => {
    const r = solveCandidateFamily({
      v: 0.6 * 299792458,
      enabledConstraints: [
        "right-moving-light",
        "left-moving-light",
        "reciprocity",
        "isotropy",
        "identity-branch",
        "transverse-light",
      ],
    });
    expect(r.status).toBe("value");
    if (r.status === "value") expect(r.value.transverseScale).toBe(1);
  });

  test("isotropy without reciprocity leaves a even and free", () => {
    const r = solveCandidateFamily({
      v: 0.4 * 299792458,
      enabledConstraints: ["isotropy"],
    });
    expect(r.status).toBe("underdetermined");
    if (r.status === "underdetermined")
      expect(r.compatibleFamily.includes("a(v) = a(−v)")).toBe(true);
  });

  test("wrong candidate residuals show which constraint fails", () => {
    const checked = checkCandidateMap({ a: 1, b: 1, d: 0, transverseScale: 1 }, 0.6 * 299792458);
    expect(checked.allHold).toBe(false);
    expect(Math.abs(checked.residuals["right-moving-light"] ?? 0)).toBeGreaterThan(0);
  });
});
