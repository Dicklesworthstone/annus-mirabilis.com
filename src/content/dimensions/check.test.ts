import { describe, expect, it } from "bun:test";
import { checkDimensions, type QuantityRegistryMap } from "./check.ts";
import { dimension, dimensionText, rational } from "./rational.ts";
import { mapToRuntimeDimension } from "./runtimeMapping.ts";
import { TestLogger, newRunIdentity } from "../../testing/log/logger.ts";

describe("Exact Rational Dimension Validator and Semantic Kind Checker", () => {
  const logger = new TestLogger("dimension-validator-tests", newRunIdentity());

  // Helper AST node builders for typed fixtures
  const sym = (quantityId: string, id?: string) => ({
    kind: "symbol",
    quantityId,
    id: id ?? `t.${quantityId}`,
  });
  const num = (value: string | number) => ({ kind: "number", value: String(value) });
  const prod = (...args: any[]) => ({ kind: "product", args });
  const quot = (numerator: any, denominator: any) => ({ kind: "quotient", numerator, denominator });
  const sum = (...args: any[]) => ({ kind: "sum", args });
  const root = (radicand: any, degree = 2) => ({ kind: "root", radicand, degree });
  const pow = (base: any, exponent: any) => ({ kind: "power", base, exponent });
  const fn = (name: string, argument: any) => ({ kind: "function", name, argument });
  const rel = (left: any, right: any, op = "=") => ({ kind: "relation", operator: op, left, right });
  const deriv = (expression: any, variable: any, order = 1) => ({
    kind: "derivative",
    expression,
    variable,
    order,
  });
  const integral = (expression: any, variable: any) => ({ kind: "integral", expression, variable });

  // 1. Core SI Quantities Registry Fixture
  const REGISTRY: QuantityRegistryMap = {
    // Kinematic / Mechanical
    length: { id: "length", dimension: ["1", "0", "0", "0", "0", "0"] },
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
    diffusionCoefficient: { id: "diffusionCoefficient", dimension: ["2", "0", "-1", "0", "0", "0"] },
    rmsDisplacement: { id: "rmsDisplacement", dimension: ["1", "0", "0", "0", "0", "0"] },

    // Light Quanta
    frequency: { id: "frequency", dimension: ["0", "0", "-1", "0", "0", "0"], semanticKind: "cyclic-frequency" },
    angularFrequency: { id: "angularFrequency", dimension: ["0", "0", "-1", "0", "0", "0"], semanticKind: "angular-frequency" },
    wienAlpha: { id: "wienAlpha", dimension: ["-1", "1", "2", "0", "0", "0"] }, // J s^4 m^-3
    wienBeta: { id: "wienBeta", dimension: ["0", "0", "1", "1", "0", "0"] }, // K s
    spectralEnergyDensityFreq: { id: "spectralEnergyDensityFreq", dimension: ["-1", "1", "-1", "0", "0", "0"], semanticKind: "spectral-density-frequency" }, // J s m^-3
    spectralEnergyDensityWave: { id: "spectralEnergyDensityWave", dimension: ["-2", "1", "-2", "0", "0", "0"], semanticKind: "spectral-density-wavelength" }, // J m^-4
    totalEnergyDensity: { id: "totalEnergyDensity", dimension: ["-1", "1", "-2", "0", "0", "0"], semanticKind: "total-density" }, // J m^-3
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
    coordinateTime: { id: "coordinateTime", dimension: ["0", "0", "1", "0", "0", "0"], semanticKind: "coordinate-time" },
    properTime: { id: "properTime", dimension: ["0", "0", "1", "0", "0", "0"], semanticKind: "proper-time" },
    labForce: { id: "labForce", dimension: ["1", "1", "-2", "0", "0", "0"], semanticKind: "laboratory-force" },
    comovingForce: { id: "comovingForce", dimension: ["1", "1", "-2", "0", "0", "0"], semanticKind: "comoving-force" },
    meanSquareVal: { id: "meanSquareVal", dimension: ["2", "0", "0", "0", "0", "0"], semanticKind: "mean-square" },
    varianceVal: { id: "varianceVal", dimension: ["2", "0", "0", "0", "0", "0"], semanticKind: "variance" },
    measuredPos: { id: "measuredPos", dimension: ["1", "0", "0", "0", "0", "0"], semanticKind: "measured-position" },
    latentPos: { id: "latentPos", dimension: ["1", "0", "0", "0", "0", "0"], semanticKind: "latent-position" },
    angleVal: { id: "angleVal", dimension: ["0", "0", "0", "0", "0", "0"], semanticKind: "angle" },
    countVal: { id: "countVal", dimension: ["0", "0", "0", "0", "0", "0"], semanticKind: "count" },

    // State Dependent (Paper 2 §2)
    stateVariable: { id: "stateVariable", dimension: ["0", "0", "0", "0", "0", "0"], dimensionStatus: "state-dependent" },
    configurationIntegralFactor: { id: "configurationIntegralFactor", dimension: ["0", "0", "0", "0", "0", "0"], dimensionStatus: "state-dependent" },
  };

  it("validates Brownian motion: lambda_x = sqrt(2*D*t) and sqrt(D*t) has length dimension", () => {
    const sqrtDt = root(prod(sym("diffusionCoefficient"), sym("time")), 2);
    const checkSqrt = checkDimensions(sqrtDt, REGISTRY);
    expect(checkSqrt.status).toBe("consistent");
    if (checkSqrt.status === "consistent") {
      expect(dimensionText(checkSqrt.dimension)).toBe("1,0,0,0,0,0"); // Length
    }

    const eq = rel(sym("rmsDisplacement"), root(prod(num(2), sym("diffusionCoefficient"), sym("time")), 2));
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
    const goodExp = fn("exp", quot(
      prod(num(-1), pow(sym("rmsDisplacement"), { num: 2, den: 1 })),
      prod(num(4), sym("diffusionCoefficient"), sym("time")),
    ));
    expect(checkDimensions(goodExp, REGISTRY).status).toBe("consistent");

    const badExp = fn("exp", quot(
      prod(num(-1), pow(sym("rmsDisplacement"), { num: 2, den: 1 })),
      prod(num(4), sym("diffusionCoefficient")),
    ));
    const badRes = checkDimensions(badExp, REGISTRY);
    expect(badRes.status).toBe("inconsistent");
    if (badRes.status === "inconsistent") {
      expect(badRes.reason).toContain("dimensionless argument");
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
      expect(badRes.reason).toContain("Non-constant power requires a dimensionless base");
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
      prod(num("1.0"), sum(sym("electricFieldSI"), prod(quot(sym("velocity"), sym("lightSpeed")), sym("magneticFieldSI")))),
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
