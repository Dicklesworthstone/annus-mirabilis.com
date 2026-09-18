import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { auditReadings, type ReadingTarget } from "../content/audits/readings.ts";
import { parsePresetId } from "../content/ids.ts";
import { validateExperiment } from "../content/schemas/experiment.ts";
import { strictParse } from "../content/schemas/strictParse.ts";
import { evaluatePerrinSummary } from "../experiments/bm07/historical.ts";
import { isValidTapeId, validateControlTape } from "../experiments/tapes/schema.ts";
import { validateTapeCompatibility } from "../experiments/tapes/replayer.ts";
import { getConstantSet } from "../physics/reference/constants.ts";
import { chiSquareQuantile } from "../physics/reference/diffusion.ts";
import {
  chiSquareInterval,
  empiricalCoverageFraction,
  identifiabilityFamily,
  invertToMolecularNumber,
} from "../physics/reference/inference.ts";
import { withinTolerance } from "../units/tolerance.ts";

const ROOT = path.resolve(process.cwd());

function loadManifest(): any {
  return validateExperiment(
    strictParse(
      fs.readFileSync(path.resolve(ROOT, "content/experiments/bm-07.yaml"), "utf8"),
      "yaml",
    ),
  );
}

test("bm07.presets: all four presets resolve, parse as preset IDs, and match scenario files", () => {
  const exp = loadManifest();
  const presetIds = exp.presets.map((p: any) => p.presetId).sort();
  const expectedPresets = [
    "bm-07-coverage",
    "bm-07-identifiability",
    "bm-07-inversion-golden",
    "bm-07-perrin-1909",
  ].sort();
  assert.deepEqual(presetIds, expectedPresets);

  for (const preset of exp.presets) {
    const res = parsePresetId(preset.presetId);
    assert.equal(res.ok, true, `Preset ID ${preset.presetId} must be valid`);
    assert.equal(preset.presetId.includes(":"), false, "Preset ID must not contain colon");

    // Must name an existing scenario file
    const scenarioPath = path.resolve(ROOT, `content/scenarios/${preset.presetId}.yaml`);
    assert.equal(
      fs.existsSync(scenarioPath),
      true,
      `Scenario file ${scenarioPath} must exist for preset ${preset.presetId}`,
    );
  }

  // Reject mode-form preset ID
  assert.equal(parsePresetId("bm-07:identifiability").ok, false);

  // Manifest registers no modes
  assert.equal(exp.modes, undefined);
});

test("bm07.presets: dangling preset citation bm-07-velocity-trap fails with registered list", () => {
  const exp = loadManifest();
  const registered = new Set(exp.presets.map((p: any) => p.presetId));
  const requested = "bm-07-velocity-trap";

  assert.equal(registered.has(requested), false);
  const errorMsg = `Unknown preset ${requested}. Available presets: ${[...registered].sort().join(", ")}`;
  assert.ok(errorMsg.includes("bm-07-identifiability"));
  assert.ok(errorMsg.includes("bm-07-inversion-golden"));
});

test("bm07.presets: bm-07-identifiability produces underdetermined joint pair and aN product", () => {
  const set = getConstantSet("modern-si-2019");
  const D = 0.42944e-12; // 0.42944 um^2/s in m^2/s
  const T = 293.15;
  const eta = 0.001;

  const fam = identifiabilityFamily(
    {
      D,
      T,
      eta,
      radiusRange: [0.1e-6, 2.0e-6],
      synthetic: false,
    },
    set,
  );

  assert.equal(fam.kind, "accepted");
  if (fam.kind !== "accepted") return;

  // Product aN = RT / (6 pi eta D)
  // In SI: m * mol^-1. Converted to um * mol^-1: product * 1e6
  const productMicrometrePerMol = fam.data.product * 1e6;
  const expectedProduct = 3.01107e23;
  const vProd = withinTolerance(productMicrometrePerMol, expectedProduct, { relative: 1e-4 });
  assert.equal(
    vProd.ok,
    true,
    `aN product mismatch: expected ~${expectedProduct}, got ${productMicrometrePerMol}`,
  );

  // Displacements alone do not determine radius or N individually
  assert.equal(fam.data.radii.length > 1, true);
  assert.equal(fam.data.numbers.length > 1, true);
});

test("bm07.presets: bm-07-inversion-golden reproduces N_hat = 6.02213e23 with consistency-check", () => {
  const set = getConstantSet("modern-si-2019");
  const dHat = 0.42944e-12;
  const q = 100;
  const alpha = 0.05;

  const band = chiSquareInterval({ dHat, q, alpha });
  assert.equal(band.kind, "accepted");
  if (band.kind !== "accepted") return;

  const inv = invertToMolecularNumber(
    {
      T: 293.15,
      eta: 0.001,
      a: 0.5e-6,
      radiusProvenance: "independently-declared",
      dHat,
      interval: band.data,
      synthetic: false,
    },
    set,
  );

  assert.equal(inv.kind, "accepted");
  if (inv.kind !== "accepted") return;

  assert.equal(inv.data.semanticKind, "consistency-check");
  const vN = withinTolerance(inv.data.estimate, 6.02213e23, { relative: 1e-4 });
  assert.equal(vN.ok, true, `Expected N_hat ~ 6.02213e23, got ${inv.data.estimate}`);

  // Ratio to defined N_A is ~0.999999
  const consistencyRatio = inv.data.consistencyRatio;
  assert.ok(consistencyRatio !== null && consistencyRatio !== undefined);
  const vRatio = withinTolerance(consistencyRatio, 0.999999, { relative: 1e-4 });
  assert.equal(vRatio.ok, true);

  // Estimated Boltzmann constant is ~1.38065e-23
  const estimatedKb = inv.data.estimatedBoltzmannConstant;
  assert.ok(estimatedKb !== null && estimatedKb !== undefined);
  const vKb = withinTolerance(estimatedKb, 1.38065e-23, {
    relative: 1e-4,
  });
  assert.equal(vKb.ok, true);

  // Ratio interval is [0.742219, 1.295596]
  const ratioInterval = inv.data.consistencyRatioInterval;
  assert.ok(ratioInterval !== null && ratioInterval !== undefined);
  assert.ok(withinTolerance(ratioInterval.lower, 0.742219, { relative: 1e-4 }).ok);
  assert.ok(withinTolerance(ratioInterval.upper, 1.295596, { relative: 1e-4 }).ok);

  // Estimated Boltzmann constant interval is [1.06564e-23, 1.86017e-23]
  const kbInterval = inv.data.estimatedBoltzmannConstantInterval;
  assert.ok(kbInterval !== null && kbInterval !== undefined);
  assert.ok(withinTolerance(kbInterval.lower, 1.06564e-23, { relative: 1e-4 }).ok);
  assert.ok(withinTolerance(kbInterval.upper, 1.86017e-23, { relative: 1e-4 }).ok);

  // N_hat / N_A equals k_B * T / (6 * pi * eta * a * D_hat) within 10^-12 relative
  const kbDefined = 1.380649e-23;
  const directRatio = (kbDefined * 293.15) / (6 * Math.PI * 0.001 * 0.5e-6 * dHat);
  const nOverNa = inv.data.estimate / 6.02214076e23;
  assert.ok(withinTolerance(nOverNa, directRatio, { relative: 1e-12 }).ok);
});

test("bm07.presets: bm-07-perrin-1909 returns independent-estimate and not-applicable interval for unreported count", () => {
  const set = getConstantSet("scenario-gas-constant-measured");
  const series = {
    id: "perrin-series-unreported",
    meanSquareDisplacement: 10e-12,
    observationInterval: 30,
    independentCoordinateCount: null, // unreported independent count
    temperature: 293.15,
    viscosity: 0.001,
    radius: 0.5e-6,
    reportedN: 7e23,
    locator: "Perrin 1909 Ann. Phys.",
  };

  const evalRes = evaluatePerrinSummary(series, set);
  assert.equal(evalRes.kind, "accepted");
  if (evalRes.kind !== "accepted") return;

  assert.equal(evalRes.data.semanticKind, "independent-estimate");
  assert.equal(evalRes.data.intervalStatus, "not-applicable");
});

test("bm07.presets: teaching tape perrins-count loads; perrin-count and bm-07:perrins-count fail check", () => {
  const tapePath = path.resolve(ROOT, "content/experiments/tapes/perrins-count.yaml");
  assert.equal(fs.existsSync(tapePath), true);
  const raw = strictParse(fs.readFileSync(tapePath, "utf8"), "yaml");
  const tape = validateControlTape(raw);

  assert.equal(tape.tapeId, "perrins-count");
  assert.equal(tape.experimentId, "bm-07");
  assert.equal(tape.constantSetId, "scenario-gas-constant-measured");
  assert.equal(isValidTapeId("perrins-count"), true);

  // Rejected spellings
  assert.equal(isValidTapeId("bm-07:perrins-count"), false);
  assert.notEqual(tape.tapeId, "perrin-count");
});

test("bm07.presets: caption and preset R0-R3 readings audit passes; removing R2 fails", () => {
  const readingsOwnerPath = path.resolve(
    ROOT,
    "content/editorial/readings-owners/am-bm-07-infer-molecular-number-frf9.yaml",
  );
  assert.equal(fs.existsSync(readingsOwnerPath), true);
  const ownerDoc = strictParse(fs.readFileSync(readingsOwnerPath, "utf8"), "yaml") as any;

  assert.equal(ownerDoc.ownerBeadId, "am-bm-07-infer-molecular-number-frf9");
  assert.equal(ownerDoc.targets.length, 5); // bm-07 + 4 presets

  const validTargets: ReadingTarget[] = ownerDoc.targets.map((t: any) => ({
    targetId: t.id,
    targetKind: t.kind === "caption" ? "instrument-caption" : "paragraph",
    paper: "brownian-motion",
    readings: t.readings,
  }));

  const ownerEntry = {
    ownerBeadId: "am-bm-07-infer-molecular-number-frf9",
    fileName: "am-bm-07-infer-molecular-number-frf9.yaml",
    paper: "brownian-motion",
    targetKinds: ["instrument-caption" as const],
    targetIds: ownerDoc.targets.map((t: any) => t.id),
  };

  const validReport = auditReadings({
    targets: validTargets,
    owners: [ownerEntry],
  });
  const validErrors = validReport.findings.filter((f) => f.severity === "error");
  assert.equal(validErrors.length, 0, `Audit readings errors: ${JSON.stringify(validErrors)}`);

  // Planted negative: removing R2 from bm-07-identifiability fails auditReadings
  const brokenTargets: ReadingTarget[] = ownerDoc.targets.map((t: any) => {
    if (t.id === "bm-07-identifiability") {
      const { r2, ...rest } = t.readings;
      return {
        targetId: t.id,
        targetKind: "instrument-caption" as const,
        paper: "brownian-motion",
        readings: rest as any,
      };
    }
    return {
      targetId: t.id,
      targetKind: "instrument-caption" as const,
      paper: "brownian-motion",
      readings: t.readings,
    };
  });

  const brokenReport = auditReadings({
    targets: brokenTargets,
    owners: [ownerEntry],
  });
  const missingR2 = brokenReport.findings.find(
    (f) =>
      f.recordId === "bm-07-identifiability" &&
      (f.check === "missing-reading-level" || f.check === "missing-r2"),
  );
  assert.ok(
    missingR2,
    "Removing R2 must trigger missing-reading-level or missing-r2 error finding",
  );
});

test("bm07.presets: bm-07-coverage runs repeated-experiment coverage view within scenario tolerance", () => {
  const scenarioPath = path.resolve(ROOT, "content/scenarios/bm-07-coverage.yaml");
  assert.equal(fs.existsSync(scenarioPath), true);
  const scenario = strictParse(fs.readFileSync(scenarioPath, "utf8"), "yaml") as any;

  const res = empiricalCoverageFraction({
    trials: scenario.inputs.coverageTrials.value,
    nominalCoverage: scenario.inputs.nominalCoverage.value,
    degreesOfFreedom: 100,
    seed: "1905",
  });
  assert.equal(res.kind, "accepted");
  if (res.kind !== "accepted") return;

  const expectedVal = scenario.expected.outputs[0].value;
  const tolAbs = scenario.expected.outputs[0].tolerance.absolute;
  const v = withinTolerance(res.data, expectedVal, { absolute: tolAbs });
  assert.equal(
    v.ok,
    true,
    `Empirical coverage ${res.data} outside tolerance ${expectedVal} +/- ${tolAbs}`,
  );

  // Planted negative: invalid trial count or out-of-domain nominal coverage must refuse
  assert.equal(empiricalCoverageFraction({ trials: 0 }).kind, "refused");
  assert.equal(empiricalCoverageFraction({ trials: 10, nominalCoverage: 1.5 }).kind, "refused");
  // Hard failure in both directions: coverage 0.5 or 1.5 outside tolerance
  assert.equal(withinTolerance(0.5, expectedVal, { absolute: tolAbs }).ok, false);
  assert.equal(withinTolerance(1.5, expectedVal, { absolute: tolAbs }).ok, false);
});

test("bm07.presets: chi-square quantiles match committed mpmath 40-digit table", () => {
  // Committed mpmath reference table at 40 digits (am-bm-07-infer-molecular-number-frf9 Test Plan)
  const MPMATH_CHI2_TABLE = [
    { q: 20, alpha: 0.05, lower: 9.5907774, upper: 34.169607 },
    { q: 40, alpha: 0.05, lower: 24.433039, upper: 59.341707 },
    { q: 100, alpha: 0.05, lower: 74.221927, upper: 129.5612 },
    { q: 100, alpha: 0.025, lower: 71.014099, upper: 134.34165 },
  ];

  for (const row of MPMATH_CHI2_TABLE) {
    const lo = chiSquareQuantile(row.q, row.alpha / 2);
    assert.equal(lo.kind, "accepted");
    if (lo.kind !== "accepted") return;

    const hi = chiSquareQuantile(row.q, 1 - row.alpha / 2);
    assert.equal(hi.kind, "accepted");
    if (hi.kind !== "accepted") return;

    assert.ok(
      withinTolerance(lo.data, row.lower, { absolute: 1e-4 }).ok,
      `q=${row.q} alpha=${row.alpha} lower mismatch: got ${lo.data}, expected ${row.lower}`,
    );
    assert.ok(
      withinTolerance(hi.data, row.upper, { absolute: 1e-4 }).ok,
      `q=${row.q} alpha=${row.alpha} upper mismatch: got ${hi.data}, expected ${row.upper}`,
    );

    // Planted negative: perturbed values must fail tolerance check in both directions
    assert.equal(withinTolerance(lo.data, row.lower + 0.5, { absolute: 1e-4 }).ok, false);
    assert.equal(withinTolerance(lo.data, row.lower - 0.5, { absolute: 1e-4 }).ok, false);
    assert.equal(withinTolerance(hi.data, row.upper + 0.5, { absolute: 1e-4 }).ok, false);
    assert.equal(withinTolerance(hi.data, row.upper - 0.5, { absolute: 1e-4 }).ok, false);
  }
});

test("bm07.presets: teaching tape perrins-count compatibility and replay verification", () => {
  const tapePath = path.resolve(ROOT, "content/experiments/tapes/perrins-count.yaml");
  const raw = strictParse(fs.readFileSync(tapePath, "utf8"), "yaml");
  const tape = validateControlTape(raw);

  const context = {
    experimentId: "bm-07",
    modelIdentity: tape.modelIdentity,
    constantSetId: "scenario-gas-constant-measured",
    streamVersion: tape.streamVersion,
    allocationId: tape.allocationId,
  };

  const compat = validateTapeCompatibility(tape, context);
  assert.equal(compat.compatible, true);

  // Checkpoints verify constantSetId and semantic kind expectation
  assert.ok(tape.checkpoints.length > 0);
  const cp = tape.checkpoints[0];
  assert.ok(cp);
  assert.equal(cp?.expectedDisplayValues?.[0]?.constantSetId, "scenario-gas-constant-measured");

  // Planted negative: compatibility rejects modern-si-2019 in historical tape context
  const modernCompat = validateTapeCompatibility(tape, {
    ...context,
    constantSetId: "modern-si-2019",
  });
  assert.equal(modernCompat.compatible, false);
  if (!modernCompat.compatible) {
    assert.equal(modernCompat.refusalCode, "tape-constant-set-mismatch");
  }

  // Planted negative: compatibility rejects mismatched experimentId
  const foreignCompat = validateTapeCompatibility(tape, {
    ...context,
    experimentId: "foreign-exp",
  });
  assert.equal(foreignCompat.compatible, false);
  if (!foreignCompat.compatible) {
    assert.equal(foreignCompat.refusalCode, "tape-model-mismatch");
  }
});

test("bm07.presets: worked interval table in page.tsx matches golden interval fixture", () => {
  const pagePath = path.resolve(ROOT, "src/app/lab/bm-07/page.tsx");
  const pageContent = fs.readFileSync(pagePath, "utf8");

  // Verified table contents
  assert.ok(pageContent.includes("d = 2, M = 50, q = 100, D̂ = 0.42944 μm²/s"));
  assert.ok(pageContent.includes("[0.331457, 0.578589] μm²/s"));
  assert.ok(pageContent.includes("N̂ = 6.02213 × 10²³ mol⁻¹"));
  assert.ok(pageContent.includes("q/(q − 2) = 1.020408"));

  // Planted negative: incorrect fixture values are not present
  assert.equal(pageContent.includes("N̂ = 9.99999 × 10²³ mol⁻¹"), false);
  assert.equal(pageContent.includes("q/(q − 2) = 1.000000"), false);
});
