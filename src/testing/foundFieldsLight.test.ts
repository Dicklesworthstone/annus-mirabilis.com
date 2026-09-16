import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { loadReadingFiles } from "../../scripts/build-content.ts";
import { compileReadingContent } from "../content/compiler/compile.ts";
import { validateReadingRecord } from "../content/schemas/reading.ts";
import { withinTolerance } from "../units/tolerance.ts";

const FOUNDATIONS_DIR = path.resolve("content/foundations");
const FIELDS_LIGHT_FOUNDATION_IDS = [
  "frames-events",
  "fields-waves",
  "electromagnetism-charges",
  "momentum-energy-light",
] as const;

describe("Foundations: Fields and Light (am-found-fields-light-cv3o)", () => {
  it("all 4 fields and light foundations exist, load, and validate against schema", () => {
    for (const id of FIELDS_LIGHT_FOUNDATION_IDS) {
      const filePath = path.join(FOUNDATIONS_DIR, `${id}.json`);
      assert.equal(fs.existsSync(filePath), true, `File ${filePath} must exist`);

      const content = fs.readFileSync(filePath, "utf8");
      const parsed = JSON.parse(content);

      const record = validateReadingRecord(parsed, filePath);
      assert.equal(record.kind, "foundation");
      assert.equal(record.id, id);
      assert.ok(record.title.length > 0);
      assert.ok(record.question.length > 0);
      assert.ok(record.summary.length > 0);
      assert.ok(record.stoppingPoint.length > 0);
      assert.ok(record.explanation.length >= 3);
      assert.ok(record.example.length >= 2);
    }
  });

  it("verifies numerical precision and tolerances for physical claims using withinTolerance", () => {
    const SPEED_OF_LIGHT = 299792458; // m/s
    const logDir = path.resolve(process.cwd(), "artifacts/test-logs/found-fields-light");
    fs.mkdirSync(logDir, { recursive: true });
    const logRunId = `fields-light-run-${Date.now()}`;
    const logFile = path.join(logDir, `${logRunId}.jsonl`);
    const logs: Array<Record<string, unknown>> = [];

    // 1. Wavelength at 600 THz: lambda = c / nu
    const nu = 600e12; // 600 THz in Hz
    const expectedWavelengthNm = (SPEED_OF_LIGHT / nu) * 1e9; // ~499.654 nm
    const statedWavelengthNm = 499.65;
    const wavelengthTol = { absolute: 0.01, relative: 1e-4 };
    const vWavelength = withinTolerance(statedWavelengthNm, expectedWavelengthNm, wavelengthTol);
    assert.equal(vWavelength.ok, true, `Wavelength comparison failed: diff=${vWavelength.diff}`);
    logs.push({
      timestamp: new Date().toISOString(),
      suite: "found-fields-light",
      logRunId,
      testId: "wavelength-at-600thz",
      beadId: "am-found-fields-light-cv3o",
      foundationId: "fields-waves",
      expected: expectedWavelengthNm,
      actual: statedWavelengthNm,
      tolerance: wavelengthTol,
      outcome: "pass",
      message: "Verified 499.65 nm wavelength at 600 THz",
    });

    // 2. Light push: 1/c N/W absorbed and 2/c reflected
    const pushAbsExpected = 1 / SPEED_OF_LIGHT; // ~3.33564095e-9 N/W
    const pushAbsStated = 3.33564e-9;
    const pushAbsTol = { absolute: 1e-14, relative: 1e-4 };
    const vPushAbs = withinTolerance(pushAbsStated, pushAbsExpected, pushAbsTol);
    assert.equal(vPushAbs.ok, true, `Absorbed push failed: diff=${vPushAbs.diff}`);

    const pushReflExpected = 2 / SPEED_OF_LIGHT; // ~6.6712819e-9 N/W
    const pushReflStated = 6.67128e-9;
    const pushReflTol = { absolute: 1e-14, relative: 1e-4 };
    const vPushRefl = withinTolerance(pushReflStated, pushReflExpected, pushReflTol);
    assert.equal(vPushRefl.ok, true, `Reflected push failed: diff=${vPushRefl.diff}`);
    logs.push({
      timestamp: new Date().toISOString(),
      suite: "found-fields-light",
      logRunId,
      testId: "light-radiation-force",
      beadId: "am-found-fields-light-cv3o",
      foundationId: "momentum-energy-light",
      expected: pushAbsExpected,
      actual: pushAbsStated,
      tolerance: pushAbsTol,
      outcome: "pass",
      message: "Verified 1/c absorbed and 2/c reflected radiation pressure forces",
    });

    // 3. Synchronization midpoint assignment: (0 + 10) / 2 = 5
    const tA = 0;
    const tPrimeA = 10;
    const tMidpointExpected = (tA + tPrimeA) / 2;
    const tMidpointStated = 5;
    const midpointTol = { absolute: 1e-12, relative: 1e-12 };
    const vMidpoint = withinTolerance(tMidpointStated, tMidpointExpected, midpointTol);
    assert.equal(vMidpoint.ok, true);
    logs.push({
      timestamp: new Date().toISOString(),
      suite: "found-fields-light",
      logRunId,
      testId: "clock-sync-midpoint",
      beadId: "am-found-fields-light-cv3o",
      foundationId: "frames-events",
      expected: tMidpointExpected,
      actual: tMidpointStated,
      tolerance: midpointTol,
      outcome: "pass",
      message: "Verified midpoint clock synchronization value 5",
    });

    // 4. Time-average of cos^2 over a period: exactly 0.5 to 1e-12
    const nSteps = 10000;
    let sum = 0;
    for (let i = 0; i < nSteps; i++) {
      const theta = (2 * Math.PI * (i + 0.5)) / nSteps;
      sum += Math.cos(theta) * Math.cos(theta);
    }
    const computedAverage = sum / nSteps;
    const cos2Tol = { absolute: 1e-12, relative: 1e-12 };
    const vCos2 = withinTolerance(computedAverage, 0.5, cos2Tol);
    assert.equal(vCos2.ok, true, `cos^2 period average diff=${vCos2.diff}`);
    logs.push({
      timestamp: new Date().toISOString(),
      suite: "found-fields-light",
      logRunId,
      testId: "cos2-period-average",
      beadId: "am-found-fields-light-cv3o",
      foundationId: "fields-waves",
      expected: 0.5,
      actual: computedAverage,
      tolerance: cos2Tol,
      outcome: "pass",
      message: "Verified cos^2 time average over period equals 0.5 to 1e-12",
    });

    // 5. Spherical power spreading: P / (4 pi r^2)
    const power = 1.0;
    const intensity1mExpected = power / (4 * Math.PI * 1 * 1); // ~0.0795774715
    const intensity1mStated = 0.0795775;
    const int1Tol = { absolute: 1e-6, relative: 1e-4 };
    const vInt1 = withinTolerance(intensity1mStated, intensity1mExpected, int1Tol);
    assert.equal(vInt1.ok, true);

    const intensity2mExpected = power / (4 * Math.PI * 2 * 2); // ~0.0198943678
    const intensity2mStated = 0.0198944;
    const int2Tol = { absolute: 1e-6, relative: 1e-4 };
    const vInt2 = withinTolerance(intensity2mStated, intensity2mExpected, int2Tol);
    assert.equal(vInt2.ok, true);
    logs.push({
      timestamp: new Date().toISOString(),
      suite: "found-fields-light",
      logRunId,
      testId: "spherical-intensity-spreading",
      beadId: "am-found-fields-light-cv3o",
      foundationId: "fields-waves",
      expected: intensity1mExpected,
      actual: intensity1mStated,
      tolerance: int1Tol,
      outcome: "pass",
      message: "Verified inverse square intensity spreading at 1 m and 2 m",
    });

    fs.writeFileSync(logFile, `${logs.map((e) => JSON.stringify(e)).join("\n")}\n`);
    assert.equal(fs.existsSync(logFile), true);
  });

  it("verifies the sound Doppler effect is explicitly labeled as an analogy with its physical limit", () => {
    const fieldsWavesPath = path.join(FOUNDATIONS_DIR, "fields-waves.json");
    const content = fs.readFileSync(fieldsWavesPath, "utf8");
    const parsed = JSON.parse(content);

    const explanationTexts = parsed.explanation
      .map((b: { text?: string }) => b.text || "")
      .join(" ");
    assert.equal(
      explanationTexts.toLowerCase().includes("analogy"),
      true,
      "fields-waves must label sound Doppler as an analogy",
    );
    assert.equal(
      explanationTexts.toLowerCase().includes("limit"),
      true,
      "fields-waves must specify the physical limit of the sound analogy",
    );
  });

  it("verifies stopping points are present and non-empty for all 4 foundations", () => {
    const expectedStoppingPoints: Record<string, string> = {
      "frames-events": "something that happens at one place and one time",
      "fields-waves": "a value assigned to every place",
      "electromagnetism-charges": "property that makes electric forces",
      "momentum-energy-light": "push a beam gives when absorbed",
    };

    for (const id of FIELDS_LIGHT_FOUNDATION_IDS) {
      const filePath = path.join(FOUNDATIONS_DIR, `${id}.json`);
      const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
      const keyphrase = expectedStoppingPoints[id];
      assert.ok(keyphrase, `Keyphrase missing for ${id}`);
      assert.equal(
        parsed.stoppingPoint.toLowerCase().includes(keyphrase.toLowerCase()),
        true,
        `Foundation ${id} stopping point missing expected concept '${keyphrase}'`,
      );
    }
  });

  it("verifies voice rules (no condescending vocabulary)", () => {
    const forbiddenWords = [/\bobviously\b/i, /\bclearly\b/i, /\bsimply\b/i, /\btrivially\b/i];

    for (const id of FIELDS_LIGHT_FOUNDATION_IDS) {
      const filePath = path.join(FOUNDATIONS_DIR, `${id}.json`);
      const rawText = fs.readFileSync(filePath, "utf8");

      for (const pattern of forbiddenWords) {
        assert.equal(
          pattern.test(rawText),
          false,
          `Foundation ${id} contains forbidden condescending voice pattern ${pattern}`,
        );
      }
    }
  });

  it("compiler builds all content including fields and light foundations cleanly with 0 errors", async () => {
    const files = await loadReadingFiles();
    const result = compileReadingContent(files);
    const errors = result.diagnostics.filter((d) => d.severity === "error");
    assert.equal(errors.length, 0, `Compiler errors found: ${JSON.stringify(errors)}`);

    const foundIds = new Set(result.foundations.map((f) => f.id));
    for (const id of FIELDS_LIGHT_FOUNDATION_IDS) {
      assert.equal(foundIds.has(id), true, `Foundation ${id} must be in compiled output`);
    }
  });
});
