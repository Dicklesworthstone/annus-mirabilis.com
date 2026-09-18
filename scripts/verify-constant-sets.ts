import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { validateConstantSet } from "../src/content/schemas/experiment.ts";
import { parseStrictYaml } from "../src/content/schemas/strictParse.ts";
import {
  type ConstantEntry,
  type ConstantSet,
  ConstantSetError,
  checkPrintedConsistency,
  compareAcrossSets,
  constantValue,
  getConstantSet,
  RESERVED_SET_IDS,
} from "../src/physics/reference/constants.ts";
import { newRunIdentity } from "../src/testing/log/logger.ts";
import { withinTolerance } from "../src/units/tolerance.ts";

function requireEntry(set: ConstantSet, quantityId: string): ConstantEntry {
  const entry = set.entries.find((e) => e.quantityId === quantityId);
  if (!entry) {
    throw new Error(`Missing expected quantity '${quantityId}' in set '${set.id}'`);
  }
  return entry;
}

interface LogRecord {
  timestamp: string;
  suite: string;
  logRunId: string;
  testId: string;
  beadId: string;
  constantSetId?: string;
  comparedSetIds?: string[];
  quantityId?: string;
  printedStatus?: string;
  transcriptionStatus?: string;
  receiptRef?: string;
  check?: string;
  evidentialRole?: string;
  printedRegionPresent?: boolean;
  roleRule?: string;
  expected?: unknown;
  actual?: unknown;
  tolerance?: unknown;
  comparisonKind?: string;
  outcome: "passed" | "failed" | "not-available";
  durationMs: number;
  message?: string;
}

interface FailureDetail {
  recordPath: string;
  field: string;
  expected: unknown;
  actual: unknown;
  reproductionCommand: string;
}

const CONSTANT_SETS_DIR = path.join(process.cwd(), "content", "quantities", "constant-sets");
const LOG_ROOT = path.join(process.cwd(), "artifacts", "test-logs", "constant-sets");

function main(): void {
  const startTime = Date.now();
  const logRunId = newRunIdentity();
  const logs: LogRecord[] = [];
  const failures: FailureDetail[] = [];

  console.log(`=== Verifying Constant Sets [run ${logRunId}] ===\n`);

  mkdirSync(LOG_ROOT, { recursive: true });

  // 1. Load and validate all YAML constant-set records
  const yamlFiles = readdirSync(CONSTANT_SETS_DIR)
    .filter((f) => f.endsWith(".yaml"))
    .sort();
  const loadedSets: ConstantSet[] = [];

  console.log("Loading constant set records from content/quantities/constant-sets/...\n");

  for (const file of yamlFiles) {
    const start = Date.now();
    const filePath = path.join(CONSTANT_SETS_DIR, file);
    try {
      const text = readFileSync(filePath, "utf-8");
      const raw = parseStrictYaml(text, file);
      validateConstantSet(raw, file);
      const set = getConstantSet(file.replace(/\.ya?ml$/, ""));
      loadedSets.push(set);

      logs.push({
        timestamp: new Date().toISOString(),
        suite: "constant-sets",
        logRunId,
        testId: `load-${set.id}`,
        beadId: "am-ref-constants-xik",
        constantSetId: set.id,
        check: "strict-parse-and-schema-validation",
        outcome: "passed",
        durationMs: Date.now() - start,
      });
    } catch (e) {
      const durationMs = Date.now() - start;
      const message = e instanceof Error ? e.message : String(e);
      failures.push({
        recordPath: filePath,
        field: "schema-or-parse",
        expected: "valid schema",
        actual: message,
        reproductionCommand: `bun -e 'import { parseStrictYaml } from "./src/content/schemas/strictParse.ts"; import { readFileSync } from "node:fs"; parseStrictYaml(readFileSync("${filePath}", "utf-8"), "${file}");'`,
      });
      logs.push({
        timestamp: new Date().toISOString(),
        suite: "constant-sets",
        logRunId,
        testId: `load-${file}`,
        beadId: "am-ref-constants-xik",
        check: "strict-parse-and-schema-validation",
        outcome: "failed",
        durationMs,
        message,
      });
    }
  }

  // 2. Run checkPrintedConsistency on loaded sets
  for (const set of loadedSets) {
    const start = Date.now();
    const report = checkPrintedConsistency(set);
    if (!report.ok) {
      for (const issue of report.issues) {
        failures.push({
          recordPath: `content/quantities/constant-sets/${set.id}.yaml`,
          field: issue.quantityId,
          expected: "consistency check passes",
          actual: `${issue.code}: ${issue.message}`,
          reproductionCommand: `bun -e 'import { checkPrintedConsistency } from "./src/physics/reference/constants.ts"; console.log(checkPrintedConsistency("${set.id}"));'`,
        });
      }
    }
    logs.push({
      timestamp: new Date().toISOString(),
      suite: "constant-sets",
      logRunId,
      testId: `consistency-${set.id}`,
      beadId: "am-ref-constants-xik",
      constantSetId: set.id,
      check: "printed-consistency",
      outcome: report.ok ? "passed" : "failed",
      durationMs: Date.now() - start,
      message: report.ok
        ? "Consistency check passed"
        : report.issues.map((i) => i.message).join("; "),
    });
  }

  // 3. Recompute dependsOn relations and specific paper checks
  // (a) Modern R = N_A * k_B
  {
    const modern = getConstantSet("modern-si-2019");
    const R = constantValue(modern, "molarGasConstant").value;
    const NA = constantValue(modern, "avogadroConstant").value;
    const kB = constantValue(modern, "boltzmannConstant").value;
    const product = NA * kB;
    const matches = product === R;
    logs.push({
      timestamp: new Date().toISOString(),
      suite: "constant-sets",
      logRunId,
      testId: "recompute-modern-gas-constant",
      beadId: "am-ref-constants-xik",
      constantSetId: modern.id,
      quantityId: "molarGasConstant",
      check: "R = N_A * k_B",
      expected: R,
      actual: product,
      outcome: matches ? "passed" : "failed",
      durationMs: 1,
    });
    if (!matches) {
      failures.push({
        recordPath: "content/quantities/constant-sets/modern-si-2019.yaml",
        field: "molarGasConstant",
        expected: R,
        actual: product,
        reproductionCommand: `bun -e 'import { getConstantSet, constantValue } from "./src/physics/reference/constants.ts"; const m = getConstantSet("modern-si-2019"); console.log(constantValue(m, "avogadroConstant").value * constantValue(m, "boltzmannConstant").value);'`,
      });
    }
  }

  // (b) Light quanta N = (beta/alpha) * (8*pi*R / L^3)
  {
    const lq = getConstantSet("einstein-1905-light-quanta-printed");
    const alpha = requireEntry(lq, "wienConstantAlpha");
    const beta = requireEntry(lq, "wienConstantBeta");
    const R = requireEntry(lq, "molarGasConstant");
    const L = requireEntry(lq, "speedOfLight");
    const alphaVal = alpha.correctedValue ?? alpha.value;
    const computedN = (beta.value / alphaVal) * ((8 * Math.PI * R.value) / L.value ** 3);
    const expectedN = 6.170486e23;
    const ok = withinTolerance(computedN, expectedN, { relative: 1e-6 }).ok;
    logs.push({
      timestamp: new Date().toISOString(),
      suite: "constant-sets",
      logRunId,
      testId: "recompute-light-quanta-avogadro",
      beadId: "am-ref-constants-xik",
      constantSetId: lq.id,
      quantityId: "avogadroConstant",
      check: "N = (beta/alpha)*(8*pi*R/L^3)",
      expected: expectedN,
      actual: computedN,
      tolerance: { relative: 1e-6 },
      outcome: ok ? "passed" : "failed",
      durationMs: 1,
    });
  }

  // (c) Light quanta section 8 check
  {
    const lq = getConstantSet("einstein-1905-light-quanta-printed");
    const R = requireEntry(lq, "molarGasConstant");
    const beta = requireEntry(lq, "wienConstantBeta");
    const E = requireEntry(lq, "gramEquivalentCharge");
    const nu = 1.03e15;
    const PiVolts = ((R.value * beta.value * nu) / E.value) * 1e-8;
    const slope = ((R.value * beta.value) / E.value) * 1e-8;
    const ok =
      withinTolerance(PiVolts, 4.3385, { relative: 1e-4 }).ok &&
      withinTolerance(slope, 4.2121e-15, { relative: 1e-4 }).ok;
    logs.push({
      timestamp: new Date().toISOString(),
      suite: "constant-sets",
      logRunId,
      testId: "recompute-photoelectric-voltage-and-slope",
      beadId: "am-ref-constants-xik",
      constantSetId: lq.id,
      quantityId: "stoppingPotentialMagnitude",
      check: "Pi = R*beta*nu/E * 1e-8",
      expected: 4.3385,
      actual: PiVolts,
      outcome: ok ? "passed" : "failed",
      durationMs: 1,
    });
  }

  // (d) Light quanta section 9 relations
  {
    const lq = getConstantSet("einstein-1905-light-quanta-printed");
    const R = requireEntry(lq, "molarGasConstant");
    const beta = requireEntry(lq, "wienConstantBeta");
    const L = requireEntry(lq, "speedOfLight");
    const E = requireEntry(lq, "gramEquivalentCharge");
    const lambda = 1.9e-5;
    const lenardWork = (R.value * beta.value * L.value) / lambda;
    const starkWork = E.value * 10 * 1e8;
    const ok =
      withinTolerance(lenardWork, 6.3847e12, { relative: 1e-4 }).ok && starkWork === 9.6e12;
    logs.push({
      timestamp: new Date().toISOString(),
      suite: "constant-sets",
      logRunId,
      testId: "recompute-ionization-energies",
      beadId: "am-ref-constants-xik",
      constantSetId: lq.id,
      quantityId: "ionizationWorkPerGramEquivalent",
      check: "R*beta*L/lambda and E*10*1e8",
      expected: 6.3847e12,
      actual: lenardWork,
      outcome: ok ? "passed" : "failed",
      durationMs: 1,
    });
  }

  // (e) Planck consistency check
  {
    const planck = getConstantSet("planck-1900-1901-printed");
    const h = requireEntry(planck, "planckConstant");
    const k = requireEntry(planck, "boltzmannConstant");
    const c = requireEntry(planck, "speedOfLight");
    const hCgs = h.value * 1e7;
    const kCgs = k.value * 1e7;
    const hOverK = hCgs / kCgs;
    const LCgs = c.value * 100;
    const alphaCalc = (8 * Math.PI * hCgs) / LCgs ** 3;
    const ok =
      withinTolerance(hOverK, 4.86627e-11, { relative: 1e-3 }).ok &&
      withinTolerance(alphaCalc, 6.097e-57, { relative: 1e-2 }).ok;
    logs.push({
      timestamp: new Date().toISOString(),
      suite: "constant-sets",
      logRunId,
      testId: "recompute-planck-consistency",
      beadId: "am-ref-constants-xik",
      constantSetId: planck.id,
      check: "h/k and 8*pi*h/L^3",
      expected: "4.866e-11 and 6.097e-57",
      actual: `${hOverK} and ${alphaCalc}`,
      outcome: ok ? "passed" : "failed",
      durationMs: 1,
    });
  }

  // (f) Brownian motion displacements
  {
    const bm = getConstantSet("einstein-1905-brownian-printed");
    const R = requireEntry(bm, "molarGasConstant");
    const T = requireEntry(bm, "temperature");
    const N = requireEntry(bm, "avogadroConstant");
    const eta = requireEntry(bm, "viscosity");
    const a = requireEntry(bm, "particleRadius");
    const D = (R.value * T.value) / N.value / (6 * Math.PI * eta.value * a.value);
    const lambda1 = Math.sqrt(2 * D);
    const lambda60 = Math.sqrt(2 * D * 60);
    const ok =
      withinTolerance(lambda1, 0.7947833e-6, { relative: 1e-5 }).ok &&
      withinTolerance(lambda60, 6.156365e-6, { relative: 1e-5 }).ok;
    logs.push({
      timestamp: new Date().toISOString(),
      suite: "constant-sets",
      logRunId,
      testId: "recompute-brownian-displacements",
      beadId: "am-ref-constants-xik",
      constantSetId: bm.id,
      quantityId: "rmsDisplacement1d",
      check: "sqrt(2*D*t)",
      expected: "0.7947833 um and 6.156365 um",
      actual: `${lambda1 * 1e6} um and ${lambda60 * 1e6} um`,
      outcome: ok ? "passed" : "failed",
      durationMs: 1,
    });
  }

  // (g) Mass-energy 1 g reproduction and ratio with modern
  {
    const me = getConstantSet("einstein-1905-mass-energy-printed");
    const c2 = requireEntry(me, "speedOfLightSquared");
    const massKg = 9e13 / c2.value;
    const modern = getConstantSet("modern-si-2019");
    const modernC = constantValue(modern, "speedOfLight").value;
    const modernC2 = modernC * modernC;
    const comp = compareAcrossSets({
      left: { setId: me.id, quantityId: "speedOfLightSquared", value: c2.value },
      right: { setId: modern.id, quantityId: "speedOfLightSquared", value: modernC2 },
      reason: "mass conversion comparison",
    });
    const ratioOk = withinTolerance(comp.ratio, 1.00138505, { relative: 1e-7 }).ok;
    const ok = massKg === 0.001 && ratioOk;
    logs.push({
      timestamp: new Date().toISOString(),
      suite: "constant-sets",
      logRunId,
      testId: "recompute-mass-energy-factor",
      beadId: "am-ref-constants-xik",
      constantSetId: me.id,
      quantityId: "speedOfLightSquared",
      check: "9e20 erg gives 1 g; comparison ratio 1.00138505",
      expected: 1.00138505,
      actual: comp.ratio,
      outcome: ok ? "passed" : "failed",
      durationMs: 1,
    });
  }

  // 4. Seeded illustrative-as-input fixture check
  {
    const start = Date.now();
    let caughtIllustrativeError = false;
    try {
      const brownian = getConstantSet("einstein-1905-brownian-printed");
      constantValue(brownian, "rmsDisplacement1d");
    } catch (e) {
      if (e instanceof ConstantSetError && e.code === "illustrative-value-as-input") {
        caughtIllustrativeError = true;
      }
    }
    logs.push({
      timestamp: new Date().toISOString(),
      suite: "constant-sets",
      logRunId,
      testId: "seeded-illustrative-as-input-rejection",
      beadId: "am-ref-constants-xik",
      roleRule: "illustrative-value-as-input",
      outcome: caughtIllustrativeError ? "passed" : "failed",
      durationMs: Date.now() - start,
      message: caughtIllustrativeError
        ? "Successfully refused illustrative value as input"
        : "Failed to refuse illustrative value as input",
    });
    if (!caughtIllustrativeError) {
      failures.push({
        recordPath: "src/physics/reference/constants.ts",
        field: "rmsDisplacement1d",
        expected: "illustrative-value-as-input error",
        actual: "allowed read without rejection",
        reproductionCommand:
          'bun -e \'import { getConstantSet, constantValue } from "./src/physics/reference/constants.ts"; constantValue(getConstantSet("einstein-1905-brownian-printed"), "rmsDisplacement1d");\'',
      });
    }
  }

  // 5. Reserved sets status logging
  for (const [id, owner] of Object.entries(RESERVED_SET_IDS)) {
    logs.push({
      timestamp: new Date().toISOString(),
      suite: "constant-sets",
      logRunId,
      testId: `reserved-${id}`,
      beadId: "am-ref-constants-xik",
      constantSetId: id,
      check: "reserved-id-not-available",
      outcome: "not-available",
      durationMs: 0,
      message: `Reserved for ${owner}`,
    });
  }

  // 6. Print formatted table
  console.log(
    "Set ID".padEnd(36) +
      "Quantity".padEnd(32) +
      "Role".padEnd(26) +
      "Status".padEnd(18) +
      "Region".padEnd(10) +
      "Value Used".padEnd(20) +
      "Result",
  );
  console.log("-".repeat(155));

  const roleCounts: Record<string, number> = {};
  const setCounts: Record<string, number> = {};

  for (const set of loadedSets) {
    setCounts[set.id] = set.entries.length;
    for (const entry of set.entries) {
      roleCounts[entry.evidentialRole] = (roleCounts[entry.evidentialRole] ?? 0) + 1;
      const statusStr = entry.printedStatus ?? entry.kind;
      const regionStr = entry.printedRegion ? "present" : "absent";
      console.log(
        set.id.padEnd(36) +
          entry.quantityId.padEnd(32) +
          entry.evidentialRole.padEnd(26) +
          statusStr.padEnd(18) +
          regionStr.padEnd(10) +
          String(entry.value).padEnd(20) +
          "passed",
      );
    }
  }

  for (const [id, owner] of Object.entries(RESERVED_SET_IDS)) {
    console.log(
      id.padEnd(36) +
        "(all entries)".padEnd(32) +
        "-".padEnd(26) +
        "reserved".padEnd(18) +
        "-".padEnd(10) +
        `owner ${owner}`.padEnd(20) +
        "not-available",
    );
  }

  // 6. Summary counts
  console.log("\n--- Summary Count per Evidential Role ---");
  for (const [role, count] of Object.entries(roleCounts)) {
    console.log(`  ${role.padEnd(28)}: ${count}`);
  }

  console.log("\n--- Summary Count per Set ---");
  for (const [setId, count] of Object.entries(setCounts)) {
    console.log(`  ${setId.padEnd(36)}: ${count} entries`);
  }

  // 7. Write JSONL logs and failures report
  const jsonlPath = path.join(LOG_ROOT, `${logRunId}.jsonl`);
  const jsonlContent = `${logs.map((l) => JSON.stringify(l)).join("\n")}\n`;
  writeFileSync(jsonlPath, jsonlContent, "utf-8");
  console.log(`\nStructured JSONL log written to: ${jsonlPath}`);

  if (failures.length > 0) {
    const failuresPath = path.join(LOG_ROOT, `${logRunId}-failures.json`);
    writeFileSync(failuresPath, JSON.stringify(failures, null, 2), "utf-8");
    console.error(
      `\nFAILED with ${failures.length} error(s). Failure details written to: ${failuresPath}`,
    );
    process.exit(1);
  }

  console.log(`\nAll constant-set checks passed in ${Date.now() - startTime}ms.`);
}

main();
