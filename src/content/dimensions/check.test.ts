import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { newRunIdentity, TestLogger } from "../../testing/log/logger.ts";
import {
  conversion,
  fn,
  glyphOnly,
  num,
  pow,
  prod,
  quot,
  rel,
  root,
  sum,
  sym,
} from "./__fixtures__/tree.ts";
import { checkDimensions, type QuantityRegistryMap } from "./check.ts";
import { dimension, dimensionText, formatRational } from "./rational.ts";
import { mapToRuntimeDimension } from "./runtimeMapping.ts";

describe("Exact Rational Dimension Validator and Semantic Kind Checker", () => {
  const logger = new TestLogger("dimension-validator-tests", newRunIdentity());

  // 1. Core SI Quantities Registry Fixture
  const REGISTRY: QuantityRegistryMap = {
    // Kinematic / Mechanical
    length: { id: "length", dimension: ["1", "0", "0", "0", "0", "0"] },
    area: { id: "area", dimension: ["2", "0", "0", "0", "0", "0"] },
    time: { id: "time", dimension: ["0", "0", "1", "0", "0", "0"] },
    volume: { id: "volume", dimension: ["3", "0", "0", "0", "0", "0"] },
    volume0: { id: "volume0", dimension: ["3", "0", "0", "0", "0", "0"] },
    velocity: { id: "velocity", dimension: ["1", "0", "-1", "0", "0", "0"] },
    lightSpeed: { id: "lightSpeed", dimension: ["1", "0", "-1", "0", "0", "0"] },
    energy: { id: "energy", dimension: ["2", "1", "-2", "0", "0", "0"] },
    entropy: { id: "entropy", dimension: ["2", "1", "-2", "-1", "0", "0"] },
    temperature: { id: "temperature", dimension: ["0", "0", "0", "1", "0", "0"] },
    gasConstant: { id: "gasConstant", dimension: ["2", "1", "-2", "-1", "0", "-1"] },
    avogadroConstant: { id: "avogadroConstant", dimension: ["0", "0", "0", "0", "0", "-1"] },
    boltzmannConstant: { id: "boltzmannConstant", dimension: ["2", "1", "-2", "-1", "0", "0"] },
    viscosity: { id: "viscosity", dimension: ["-1", "1", "-1", "0", "0", "0"] },
    particleRadius: { id: "particleRadius", dimension: ["1", "0", "0", "0", "0", "0"] },
    diffusionCoefficient: {
      id: "diffusionCoefficient",
      dimension: ["2", "0", "-1", "0", "0", "0"],
    },
    rmsDisplacement: { id: "rmsDisplacement", dimension: ["1", "0", "0", "0", "0", "0"] },

    // Light Quanta
    frequency: {
      id: "frequency",
      dimension: ["0", "0", "-1", "0", "0", "0"],
      semanticKind: "cyclic-frequency",
    },
    angularFrequency: {
      id: "angularFrequency",
      dimension: ["0", "0", "-1", "0", "0", "0"],
      semanticKind: "angular-frequency",
    },
    wienAlpha: { id: "wienAlpha", dimension: ["-1", "1", "2", "0", "0", "0"] }, // J s^4 m^-3
    wienBeta: { id: "wienBeta", dimension: ["0", "0", "1", "1", "0", "0"] }, // K s
    spectralEnergyDensityFreq: {
      id: "spectralEnergyDensityFreq",
      dimension: ["-1", "1", "-1", "0", "0", "0"],
      semanticKind: "spectral-density-frequency",
    }, // J s m^-3
    spectralEnergyDensityWave: {
      id: "spectralEnergyDensityWave",
      dimension: ["-2", "1", "-2", "0", "0", "0"],
      semanticKind: "spectral-density-wavelength",
    }, // J m^-4
    spectralEnergyDensityWaveMismatched: {
      id: "spectralEnergyDensityWaveMismatched",
      dimension: ["-1", "1", "-1", "0", "0", "0"],
      semanticKind: "spectral-density-wavelength",
    },
    totalEnergyDensity: {
      id: "totalEnergyDensity",
      dimension: ["-1", "1", "-2", "0", "0", "0"],
      semanticKind: "total-density",
    }, // J m^-3
    wavelength: { id: "wavelength", dimension: ["1", "0", "0", "0", "0", "0"] },

    // Electrodynamics (Dual SI / Gaussian / EMU)
    chargeSI: {
      id: "chargeSI",
      dimension: ["0", "0", "1", "0", "1", "0"], // A s
      gaussianDimension: ["3/2", "1/2", "-1", "0", "0", "0"], // M^1/2 L^3/2 T^-1 (statcoulomb)
      emuDimension: ["1/2", "1/2", "0", "0", "0", "0"], // M^1/2 L^1/2 (abcoulomb)
    },
    electricFieldSI: {
      id: "electricFieldSI",
      dimension: ["1", "1", "-3", "0", "-1", "0"], // V/m = kg m s^-3 A^-1
      gaussianDimension: ["-1/2", "1/2", "-1", "0", "0", "0"], // statvolt/cm = M^1/2 L^-1/2 T^-1
      emuDimension: ["1/2", "1/2", "-2", "0", "0", "0"],
    },
    magneticFieldSI: {
      id: "magneticFieldSI",
      dimension: ["0", "1", "-2", "0", "-1", "0"], // Tesla = kg s^-2 A^-1
      gaussianDimension: ["-1/2", "1/2", "-1", "0", "0", "0"], // Gauss = M^1/2 L^-1/2 T^-1
      emuDimension: ["-1/2", "1/2", "-1", "0", "0", "0"],
    },
    fieldWithoutGaussian: {
      id: "fieldWithoutGaussian",
      dimension: ["1", "1", "-3", "0", "-1", "0"],
    },
    stoppingPotentialSI: {
      id: "stoppingPotentialSI",
      dimension: ["2", "1", "-3", "0", "-1", "0"], // Volt
      gaussianDimension: ["1/2", "1/2", "-1", "0", "0", "0"], // statvolt
      emuDimension: ["3/2", "1/2", "-2", "0", "0", "0"], // abvolt
    },
    stoppingPotentialWithoutEMU: {
      id: "stoppingPotentialWithoutEMU",
      dimension: ["2", "1", "-3", "0", "-1", "0"],
    },
    faradayChargePerMole: {
      id: "faradayChargePerMole",
      dimension: ["0", "0", "1", "0", "1", "-1"], // C/mol
      emuDimension: ["1/2", "1/2", "0", "0", "0", "-1"], // abcoulomb/mol
    },
    workFunctionPerMole: {
      id: "workFunctionPerMole",
      dimension: ["2", "1", "-2", "0", "0", "-1"], // J/mol
    },
    singleElectronCharge: {
      id: "singleElectronCharge",
      dimension: ["0", "0", "1", "0", "1", "0"],
      gaussianDimension: ["3/2", "1/2", "-1", "0", "0", "0"],
      emuDimension: ["1/2", "1/2", "0", "0", "0", "0"],
    },
    singleElectronWork: {
      id: "singleElectronWork",
      dimension: ["2", "1", "-2", "0", "0", "0"], // J
    },

    // Semantic Kinds
    coordinateTime: {
      id: "coordinateTime",
      dimension: ["0", "0", "1", "0", "0", "0"],
      semanticKind: "coordinate-time",
    },
    properTime: {
      id: "properTime",
      dimension: ["0", "0", "1", "0", "0", "0"],
      semanticKind: "proper-time",
    },
    labForce: {
      id: "labForce",
      dimension: ["1", "1", "-2", "0", "0", "0"],
      semanticKind: "laboratory-force",
    },
    comovingForce: {
      id: "comovingForce",
      dimension: ["1", "1", "-2", "0", "0", "0"],
      semanticKind: "comoving-force",
    },
    meanSquareVal: {
      id: "meanSquareVal",
      dimension: ["2", "0", "0", "0", "0", "0"],
      semanticKind: "mean-square",
    },
    varianceVal: {
      id: "varianceVal",
      dimension: ["2", "0", "0", "0", "0", "0"],
      semanticKind: "variance",
    },
    measuredPos: {
      id: "measuredPos",
      dimension: ["1", "0", "0", "0", "0", "0"],
      semanticKind: "measured-position",
    },
    latentPos: {
      id: "latentPos",
      dimension: ["1", "0", "0", "0", "0", "0"],
      semanticKind: "latent-position",
    },
    angleVal: { id: "angleVal", dimension: ["0", "0", "0", "0", "0", "0"], semanticKind: "angle" },
    countVal: { id: "countVal", dimension: ["0", "0", "0", "0", "0", "0"], semanticKind: "count" },
    // Cancelled-units vs intrinsically dimensionless: same all-zero vector,
    // distinguished by dimensionlessKind (schema vocabulary: ratio vs pure-number).
    volumeRatio: {
      id: "volumeRatio",
      dimension: ["0", "0", "0", "0", "0", "0"],
      dimensionlessKind: "ratio",
      semanticKind: "cancelled-units",
    },
    pureNumber: {
      id: "pureNumber",
      dimension: ["0", "0", "0", "0", "0", "0"],
      dimensionlessKind: "pure-number",
      semanticKind: "dimensionless",
    },
    probabilityVal: {
      id: "probabilityVal",
      dimension: ["0", "0", "0", "0", "0", "0"],
      dimensionlessKind: "probability",
      semanticKind: "probability",
    },

    // State Dependent (Paper 2 §2)
    stateVariable: {
      id: "stateVariable",
      dimension: ["0", "0", "0", "0", "0", "0"],
      dimensionStatus: "state-dependent",
    },
    configurationIntegralFactor: {
      id: "configurationIntegralFactor",
      dimension: ["0", "0", "0", "0", "0", "0"],
      dimensionStatus: "state-dependent",
    },
  };

  it("PLANTED: a one-slot exponent mismatch is refused by typed code naming the base and both sides", () => {
    // Energy is M L^2 T^-2; force is M L T^-2. They differ only in the length exponent.
    const forceLike = {
      ...REGISTRY,
      force: { id: "force", dimension: ["1", "1", "-2", "0", "0", "0"] },
    };
    const res = checkDimensions(rel(sym("energy"), sym("force")), forceLike);
    expect(res.status).toBe("inconsistent");
    expect(res).not.toBe(false);
    expect(res).not.toBe(true);
    if (res.status !== "inconsistent") throw new Error("expected inconsistent");
    expect(res.offendingBases).toHaveLength(1);
    const [slot] = res.offendingBases;
    if (!slot) throw new Error("expected offending base slot");
    expect(slot.base).toBe("length");
    expect(slot.lhs).toEqual({ num: 2n, den: 1n });
    expect(slot.rhs).toEqual({ num: 1n, den: 1n });
    expect(res.reason).toContain("length");
    expect(res.reason).toContain("left 2");
    expect(res.reason).toContain("right 1");
    expect(dimensionText(res.lhsDimension)).toBe("2,1,-2,0,0,0");
    expect(dimensionText(res.rhsDimension)).toBe("1,1,-2,0,0,0");
    logger.log({
      testId: "planted-one-slot-mismatch-names-length",
      beadId: "am-cm-dimension-validator-aoz",
      expected: "inconsistent length 2 vs 1",
      actual: res.reason,
      comparisonKind: "bitwise",
      outcome: "passed",
    });
  });

  it("PLANTED: three one-third exponents compose to exactly 1 (the float-error case)", () => {
    const cubeRootOfLength = root(sym("length"), 3);
    const composed = prod(cubeRootOfLength, cubeRootOfLength, cubeRootOfLength);
    const res = checkDimensions(composed, REGISTRY);
    expect(res.status).toBe("consistent");
    if (res.status !== "consistent") throw new Error("expected consistent");
    const [lengthExp] = res.dimension;
    if (!lengthExp) throw new Error("expected length dimension exponent");
    expect(lengthExp.num).toBe(1n);
    expect(lengthExp.den).toBe(1n);
    expect(typeof lengthExp.num).toBe("bigint");
    expect(typeof lengthExp.den).toBe("bigint");
    expect(dimensionText(res.dimension)).toBe("1,0,0,0,0,0");
    // Cube root of volume is length for the same reason: 3 * (1/3) = 1 exactly.
    const cubeRootVolume = checkDimensions(root(sym("volume"), 3), REGISTRY);
    expect(cubeRootVolume.status).toBe("consistent");
    if (cubeRootVolume.status === "consistent") {
      expect(cubeRootVolume.dimension[0]).toEqual({ num: 1n, den: 1n });
    }
    logger.log({
      testId: "planted-three-one-thirds-compose-to-one",
      beadId: "am-cm-dimension-validator-aoz",
      expected: "1/1",
      actual: formatRational(lengthExp),
      comparisonKind: "bitwise",
      outcome: "passed",
    });
  });

  it("PLANTED: cancelled-units (ratio) and intrinsically dimensionless (pure-number) are distinguishable", () => {
    // Choice: distinguish them. Both have the all-zero exponent vector. The
    // Quantity schema already names cancelled units `dimensionlessKind: "ratio"`
    // (V/V0, strain) and an authored number `pure-number`. Equating them without
    // a conversion is a teaching error this corpus actually makes (the Wien
    // exponent base is a volume ratio, not a count). We do not invent a seventh
    // basis slot: AGENTS.md keeps angles a kind, not a dimension.
    const res = checkDimensions(rel(sym("volumeRatio"), sym("pureNumber")), REGISTRY);
    expect(res.status).toBe("semantic-mismatch");
    if (res.status !== "semantic-mismatch") throw new Error("expected semantic-mismatch");
    expect(res.kinds).toEqual(["ratio", "pure-number"]);
    expect(res.reason).toContain("ratio");
    expect(res.reason).toContain("pure-number");
    const vsProbability = checkDimensions(rel(sym("volumeRatio"), sym("probabilityVal")), REGISTRY);
    expect(vsProbability.status).toBe("semantic-mismatch");
  });

  it("GOOD CASE: Stokes-Einstein D = k_B T / (6 pi eta a) is accepted as L^2 T^-1", () => {
    const stokesD = quot(
      prod(sym("boltzmannConstant"), sym("temperature")),
      prod(num(6), num("3.14159"), sym("viscosity"), sym("particleRadius")),
    );
    const checkD = checkDimensions(stokesD, REGISTRY);
    expect(checkD.status).toBe("consistent");
    if (checkD.status === "consistent") {
      expect(dimensionText(checkD.dimension)).toBe("2,0,-1,0,0,0");
    }
  });

  it("PLANTED: a printed glyph is never a binding key", () => {
    const byGlyph = checkDimensions(glyphOnly("k"), REGISTRY);
    expect(byGlyph.status).toBe("unsupported-check");
    if (byGlyph.status === "unsupported-check") {
      expect(byGlyph.reason).toContain("quantity id");
      expect(byGlyph.reason).toContain("glyph");
    }
    const visc = { kind: "symbol" as const, quantityId: "viscosity", glyph: "k" };
    const bolt = { kind: "symbol" as const, quantityId: "boltzmannConstant", glyph: "k" };
    const sameGlyphDifferentIds = checkDimensions(sum(visc, bolt), REGISTRY);
    expect(sameGlyphDifferentIds.status).toBe("inconsistent");
    if (sameGlyphDifferentIds.status === "inconsistent") {
      expect(sameGlyphDifferentIds.offendingBases.map((s) => s.base)).toEqual([
        "length",
        "time",
        "temperature",
      ]);
    }
  });

  it("an explicit conversion node lets cyclic frequency become angular frequency", () => {
    const without = checkDimensions(rel(sym("angularFrequency"), sym("frequency")), REGISTRY);
    expect(without.status).toBe("semantic-mismatch");
    const converted = rel(
      sym("angularFrequency"),
      conversion(sym("frequency"), "cyclic-frequency", "angular-frequency"),
    );
    expect(checkDimensions(converted, REGISTRY).status).toBe("consistent");
  });

  it("a scaled term keeps its quantity's dimension; the numeric factor does not change it", () => {
    // 2 κ N = R with κ bound to boltzmannConstant at scale 1/2.
    const kappa = {
      kind: "symbol" as const,
      quantityId: "boltzmannConstant",
      scale: { num: 1, den: 2 },
    };
    const lhs = prod(num(2), kappa, sym("avogadroConstant"));
    const eq = rel(lhs, sym("gasConstant"));
    const res = checkDimensions(eq, REGISTRY);
    expect(res.status).toBe("consistent");
  });

  it("a bare matrix without target dimensions is unsupported-check, not a pass", () => {
    const res = checkDimensions({ kind: "matrix" }, REGISTRY);
    expect(res.status).toBe("unsupported-check");
    if (res.status === "unsupported-check") {
      expect(res.reason).toContain("target vector");
    }
  });

  it("never uses a float or an epsilon for exponent comparison", () => {
    const dir = dirname(fileURLToPath(import.meta.url));
    for (const file of ["rational.ts", "check.ts"]) {
      const src = readFileSync(join(dir, file), "utf8");
      expect(src).not.toContain("Number.EPSILON");
      expect(src).not.toContain("parseFloat");
      expect(src).not.toMatch(/Math\.abs\([^)]*\)\s*[<>=]/);
    }
  });

  it("validates Brownian motion: lambda_x = sqrt(2*D*t) and sqrt(D*t) has length dimension", () => {
    const sqrtDt = root(prod(sym("diffusionCoefficient"), sym("time")), 2);
    const checkSqrt = checkDimensions(sqrtDt, REGISTRY);
    expect(checkSqrt.status).toBe("consistent");
    if (checkSqrt.status === "consistent") {
      expect(dimensionText(checkSqrt.dimension)).toBe("1,0,0,0,0,0"); // Length
    }

    const eq = rel(
      sym("rmsDisplacement"),
      root(prod(num(2), sym("diffusionCoefficient"), sym("time")), 2),
    );
    expect(checkDimensions(eq, REGISTRY).status).toBe("consistent");
  });

  it("validates Stokes-Einstein D = k_B*T / (6*pi*eta*a)", () => {
    const stokesD = quot(
      prod(sym("boltzmannConstant"), sym("temperature")),
      prod(num(6), num("3.14159"), sym("viscosity"), sym("particleRadius")),
    );
    const checkD = checkDimensions(stokesD, REGISTRY);
    expect(checkD.status).toBe("consistent");
    if (checkD.status === "consistent") {
      expect(dimensionText(checkD.dimension)).toBe("2,0,-1,0,0,0");
    }
  });

  it("validates Avogadro determination N = (t / lambda_x^2) * (R*T / (3*pi*k*P)) yields amount^-1", () => {
    const N_expr = prod(
      quot(sym("time"), pow(sym("rmsDisplacement"), { num: 2, den: 1 })),
      quot(
        prod(sym("gasConstant"), sym("temperature")),
        prod(num(3), num("3.14159"), sym("viscosity"), sym("particleRadius")),
      ),
    );
    const checkN = checkDimensions(N_expr, REGISTRY);
    expect(checkN.status).toBe("consistent");
    if (checkN.status === "consistent") {
      expect(dimensionText(checkN.dimension)).toBe("0,0,0,0,0,-1"); // amount^-1
    }
  });

  it("validates exp(-x^2 / (4Dt)) passes and exp(-x^2 / (4D)) fails", () => {
    const goodExp = fn(
      "exp",
      quot(
        prod(num(-1), pow(sym("rmsDisplacement"), { num: 2, den: 1 })),
        prod(num(4), sym("diffusionCoefficient"), sym("time")),
      ),
    );
    expect(checkDimensions(goodExp, REGISTRY).status).toBe("consistent");

    const badExp = fn(
      "exp",
      quot(
        prod(num(-1), pow(sym("rmsDisplacement"), { num: 2, den: 1 })),
        prod(num(4), sym("diffusionCoefficient")),
      ),
    );
    const badRes = checkDimensions(badExp, REGISTRY);
    expect(badRes.status).toBe("inconsistent");
    if (badRes.status === "inconsistent") {
      expect(badRes.offendingBases.some((s) => s.base === "time")).toBe(true);
      expect(badRes.reason).toContain("time");
      expect(badRes.subexpression).toContain("exp");
    }
  });

  it("validates Light Quanta: S - S0 = (E / (beta*nu)) * ln(V / V0) yields J/K", () => {
    const entropyExpr = prod(
      quot(sym("energy"), prod(sym("wienBeta"), sym("frequency"))),
      fn("ln", quot(sym("volume"), sym("volume0"))),
    );
    const res = checkDimensions(entropyExpr, REGISTRY);
    expect(res.status).toBe("consistent");
    if (res.status === "consistent") {
      expect(dimensionText(res.dimension)).toBe("2,1,-2,-1,0,0"); // J/K
    }
  });

  it("validates non-constant exponent rule: W = (V/V0)^exp passes, while V^n fails", () => {
    // (V/V0)^(NE / (R*beta*nu))
    const dimensionlessExponent = quot(
      prod(sym("avogadroConstant"), sym("energy")),
      prod(sym("gasConstant"), sym("wienBeta"), sym("frequency")),
    );
    const dimensionlessBase = quot(sym("volume"), sym("volume0"));

    const goodPower = pow(dimensionlessBase, dimensionlessExponent);
    expect(checkDimensions(goodPower, REGISTRY).status).toBe("consistent");

    // V^n (dimensional base with non-constant exponent)
    const badPower = pow(sym("volume"), dimensionlessExponent);
    const badRes = checkDimensions(badPower, REGISTRY);
    expect(badRes.status).toBe("inconsistent");
    if (badRes.status === "inconsistent") {
      expect(badRes.offendingBases.some((s) => s.base === "length")).toBe(true);
      expect(badRes.subexpression).toContain("non-constant power base");
      expect(dimensionText(badRes.lhsDimension)).toBe("3,0,0,0,0,0");
    }
  });

  it("validates spectral density Jacobian u_lambda = u_nu * c / lambda^2 and rejects mismatch", () => {
    const convertedDensity = quot(
      prod(sym("spectralEnergyDensityFreq"), sym("lightSpeed")),
      pow(sym("wavelength"), { num: 2, den: 1 }),
    );
    const res = checkDimensions(convertedDensity, REGISTRY);
    expect(res.status).toBe("consistent");
    if (res.status === "consistent") {
      expect(dimensionText(res.dimension)).toBe("-2,1,-2,0,0,0"); // J m^-4
    }

    // Direct equating u_nu with u_lambda without Jacobian is a semantic mismatch
    const badRel = rel(sym("spectralEnergyDensityFreq"), sym("spectralEnergyDensityWave"));
    const mismatchRes = checkDimensions(badRel, REGISTRY);
    expect(mismatchRes.status).toBe("inconsistent"); // Different dimensions in addition to semantic kinds
  });

  it("validates frequency vs angular frequency semantic mismatch (nu + omega)", () => {
    const sumFreq = sum(sym("frequency"), sym("angularFrequency"));
    const res = checkDimensions(sumFreq, REGISTRY);
    expect(res.status).toBe("semantic-mismatch");
    if (res.status === "semantic-mismatch") {
      expect(res.kinds).toEqual(["cyclic-frequency", "angular-frequency"]);
    }
  });

  it("validates Gaussian electrodynamics: Y' = beta*(Y - (v/V)*N) in Gaussian vs SI context", () => {
    // E-field Y, magnetic field N, velocity v, lightSpeed V
    const transformExpr = rel(
      sym("electricFieldSI"),
      prod(
        num("1.0"),
        sum(
          sym("electricFieldSI"),
          prod(quot(sym("velocity"), sym("lightSpeed")), sym("magneticFieldSI")),
        ),
      ),
    );

    // Passes in Gaussian-CGS context
    const gaussianCheck = checkDimensions(transformExpr, REGISTRY, { context: "gaussian-cgs" });
    expect(gaussianCheck.status).toBe("consistent");
    if (gaussianCheck.status === "consistent") {
      expect(dimensionText(gaussianCheck.dimension)).toBe("-1/2,1/2,-1,0,0,0");
    }

    // Fails in SI context because E and B have different dimensions in SI
    const siCheck = checkDimensions(transformExpr, REGISTRY, { context: "si" });
    expect(siCheck.status).toBe("inconsistent");

    // A field component lacking gaussianDimension in gaussian-cgs context yields unsupported-check
    const missingGaussianExpr = sym("fieldWithoutGaussian");
    const checkMissingGaussian = checkDimensions(missingGaussianExpr, REGISTRY, {
      context: "gaussian-cgs",
    });
    expect(checkMissingGaussian.status).toBe("unsupported-check");
    if (checkMissingGaussian.status === "unsupported-check") {
      expect(checkMissingGaussian.reason).toContain("fieldWithoutGaussian");
      expect(checkMissingGaussian.reason).toContain("Gaussian");
    }
  });

  it("validates paper 1 §8 in EMU-CGS context: Pi * E = R*beta*nu - P' is energy per mole", () => {
    // Pi (stopping potential in abvolt), E (charge in abcoulomb/mol), R (gas constant), beta (Wien beta), nu (frequency), P' (work function per mole)
    const lhs = prod(sym("stoppingPotentialSI"), sym("faradayChargePerMole"));
    const rhs = sum(
      prod(sym("gasConstant"), sym("wienBeta"), sym("frequency")),
      prod(num(-1), sym("workFunctionPerMole")),
    );
    const eq = rel(lhs, rhs);

    const emuCheck = checkDimensions(eq, REGISTRY, { context: "emu-cgs" });
    expect(emuCheck.status).toBe("consistent");
    if (emuCheck.status === "consistent") {
      expect(dimensionText(emuCheck.dimension)).toBe("2,1,-2,0,0,-1"); // J / mol
    }

    // A field component lacking emuDimension in emu-cgs context yields unsupported-check
    const missingEMUExpr = sym("stoppingPotentialWithoutEMU");
    const checkMissing = checkDimensions(missingEMUExpr, REGISTRY, { context: "emu-cgs" });
    expect(checkMissing.status).toBe("unsupported-check");
  });

  it("validates paper 2 §2 state-dependent quantities return unsupported-check", () => {
    const sExpr = sum(sym("entropy"), sym("stateVariable"));
    const res = checkDimensions(sExpr, REGISTRY);
    expect(res.status).toBe("unsupported-check");
    if (res.status === "unsupported-check") {
      expect(res.reason).toContain("state-dependent");
    }

    const cfgExpr = sym("configurationIntegralFactor");
    const cfgRes = checkDimensions(cfgExpr, REGISTRY);
    expect(cfgRes.status).toBe("unsupported-check");
  });

  it("validates proper time vs coordinate time semantic mismatch", () => {
    const timeRel = rel(sym("properTime"), sym("coordinateTime"));
    const res = checkDimensions(timeRel, REGISTRY);
    expect(res.status).toBe("semantic-mismatch");
  });

  it("validates paper 4 mass-energy: K0 - K1 = (L / V^2) * (v^2 / 2) is energy", () => {
    const deltaK = prod(
      quot(sym("energy"), pow(sym("lightSpeed"), { num: 2, den: 1 })),
      quot(pow(sym("velocity"), { num: 2, den: 1 }), num(2)),
    );
    const res = checkDimensions(deltaK, REGISTRY);
    expect(res.status).toBe("consistent");
    if (res.status === "consistent") {
      expect(dimensionText(res.dimension)).toBe("2,1,-2,0,0,0"); // J (Energy)
    }
  });

  it("validates angle added to count is a semantic mismatch", () => {
    const anglePlusCount = sum(sym("angleVal"), sym("countVal"));
    const res = checkDimensions(anglePlusCount, REGISTRY);
    expect(res.status).toBe("semantic-mismatch");
  });

  it("validates laboratory vs comoving force semantic mismatch (labForce == comovingForce)", () => {
    const forceRel = rel(sym("labForce"), sym("comovingForce"));
    const res = checkDimensions(forceRel, REGISTRY);
    expect(res.status).toBe("semantic-mismatch");
    if (res.status === "semantic-mismatch") {
      expect(res.kinds).toEqual(["laboratory-force", "comoving-force"]);
    }
  });

  it("validates mean-square vs variance semantic mismatch (meanSquareVal == varianceVal)", () => {
    const varRel = rel(sym("meanSquareVal"), sym("varianceVal"));
    const res = checkDimensions(varRel, REGISTRY);
    expect(res.status).toBe("semantic-mismatch");
    if (res.status === "semantic-mismatch") {
      expect(res.kinds).toEqual(["mean-square", "variance"]);
    }
  });

  it("validates measured vs latent position semantic mismatch (measuredPos == latentPos)", () => {
    const posRel = rel(sym("measuredPos"), sym("latentPos"));
    const res = checkDimensions(posRel, REGISTRY);
    expect(res.status).toBe("semantic-mismatch");
    if (res.status === "semantic-mismatch") {
      expect(res.kinds).toEqual(["measured-position", "latent-position"]);
    }
  });

  it("validates angle added to probability is a semantic mismatch", () => {
    const anglePlusProb = sum(sym("angleVal"), sym("probabilityVal"));
    const res = checkDimensions(anglePlusProb, REGISTRY);
    expect(res.status).toBe("semantic-mismatch");
    if (res.status === "semantic-mismatch") {
      expect(res.kinds).toEqual(["angle", "probability"]);
    }
  });

  it("validates spectral density frequency vs wavelength semantic mismatch when dimensions match", () => {
    const densityRel = rel(
      sym("spectralEnergyDensityFreq"),
      sym("spectralEnergyDensityWaveMismatched"),
    );
    const res = checkDimensions(densityRel, REGISTRY);
    expect(res.status).toBe("semantic-mismatch");
    if (res.status === "semantic-mismatch") {
      expect(res.kinds).toEqual(["spectral-density-frequency", "spectral-density-wavelength"]);
    }
  });

  it("validates Lorentz boost component equations and matrix target dimensions", () => {
    const gamma = num("1.0");
    const dxComponent = rel(
      sym("length"),
      sum(prod(gamma, sym("length")), prod(num("-1.0"), gamma, sym("velocity"), sym("time"))),
    );
    const dxCheck = checkDimensions(dxComponent, REGISTRY);
    expect(dxCheck.status).toBe("consistent");
    if (dxCheck.status === "consistent") {
      expect(dimensionText(dxCheck.dimension)).toBe("1,0,0,0,0,0");
    }

    const dtComponent = rel(
      sym("time"),
      sum(
        prod(
          num("-1.0"),
          gamma,
          quot(sym("velocity"), pow(sym("lightSpeed"), { num: 2, den: 1 })),
          sym("length"),
        ),
        prod(gamma, sym("time")),
      ),
    );
    const dtCheck = checkDimensions(dtComponent, REGISTRY);
    expect(dtCheck.status).toBe("consistent");
    if (dtCheck.status === "consistent") {
      expect(dimensionText(dtCheck.dimension)).toBe("0,0,1,0,0,0");
    }

    const matrixWithTarget = {
      kind: "matrix" as const,
      targetDimensions: ["1", "0", "0", "0", "0", "0"],
    };
    const targetCheck = checkDimensions(matrixWithTarget, REGISTRY);
    expect(targetCheck.status).toBe("consistent");
    if (targetCheck.status === "consistent") {
      expect(dimensionText(targetCheck.dimension)).toBe("1,0,0,0,0,0");
    }
  });

  it("validates runtime mapping refuses fractional exponents, non-SI contexts, and state-dependent quantities", () => {
    // Integer SI dimension passes
    const intDim = dimension(["2", "0", "-1", "0", "0", "0"]);
    const res1 = mapToRuntimeDimension(intDim, "si");
    expect(res1.ok).toBe(true);
    if (res1.ok) {
      expect(res1.runtimeExponents).toEqual([2, 0, -1, 0, 0, 0]);
    }

    // Fractional exponent fails
    const fracDim = dimension(["1/2", "0", "0", "0", "0", "0"]);
    const res2 = mapToRuntimeDimension(fracDim, "si");
    expect(res2.ok).toBe(false);
    if (!res2.ok) {
      expect(res2.code).toBe("fractional-exponent");
    }

    // Gaussian context fails
    const res3 = mapToRuntimeDimension(intDim, "gaussian-cgs");
    expect(res3.ok).toBe(false);
    if (!res3.ok) {
      expect(res3.code).toBe("non-si-context");
    }

    // State dependent fails
    const res4 = mapToRuntimeDimension(intDim, "si", true);
    expect(res4.ok).toBe(false);
    if (!res4.ok) {
      expect(res4.code).toBe("state-dependent");
    }
  });
});

describe("a quantity the source names without defining it (dispatch 236)", () => {
  // Zero vectors on purpose: without the undefined-in-source branch in unitSystems.ts, A_m/A_e
  // would check as a dimensionless ratio equal to v/V and pass, which is exactly the silent result
  // the status exists to prevent. The control below proves the refusal comes from the status.
  const ZERO = ["0", "0", "0", "0", "0", "0"];
  const SPEED = ["1", "0", "-1", "0", "0", "0"];
  const NAMED: QuantityRegistryMap = {
    magneticDeflectability: {
      id: "magneticDeflectability",
      dimension: ZERO,
      dimensionStatus: "undefined-in-source",
    },
    electricDeflectability: {
      id: "electricDeflectability",
      dimension: ZERO,
      dimensionStatus: "undefined-in-source",
    },
    frameSpeed: { id: "frameSpeed", dimension: SPEED },
    speedOfLight: { id: "speedOfLight", dimension: SPEED },
    stateVariable: { id: "stateVariable", dimension: ZERO, dimensionStatus: "state-dependent" },
  };
  const law = rel(
    quot(sym("magneticDeflectability"), sym("electricDeflectability")),
    quot(sym("frameSpeed"), sym("speedOfLight")),
  );

  it("A_m/A_e = v/V reports an unsupported check naming the reason, never consistent", () => {
    const res = checkDimensions(law, NAMED);
    expect(res.status).toBe("unsupported-check");
    if (res.status !== "unsupported-check") throw new Error("expected unsupported-check");
    expect(res.reason).toContain("magneticDeflectability");
    expect(res.reason).toContain("named in the source without a definition");
  });

  it("control: the same law with the status removed checks consistent", () => {
    const declared: QuantityRegistryMap = {
      ...NAMED,
      magneticDeflectability: { id: "magneticDeflectability", dimension: ZERO },
      electricDeflectability: { id: "electricDeflectability", dimension: ZERO },
    };
    expect(checkDimensions(law, declared).status).toBe("consistent");
  });

  it("state-dependent keeps its own reason", () => {
    const res = checkDimensions(sym("stateVariable"), NAMED);
    expect(res.status).toBe("unsupported-check");
    if (res.status !== "unsupported-check") throw new Error("expected unsupported-check");
    expect(res.reason).toContain("state-dependent");
    expect(res.reason).not.toContain("named in the source");
  });
});
