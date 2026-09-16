import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import type { AcceptedSnapshot } from "../../experiments/store/instanceStore.ts";
import type { RepresentationScale } from "../../visuals/kit/types.ts";
import {
  auditPrintRepresentationScale,
  formatOrdinarySpatialMagnification,
  renderPrintFigure,
} from "./printFigure.ts";

const DIR = path.dirname(fileURLToPath(import.meta.url));

function makeAcceptedSnapshot(): AcceptedSnapshot {
  return {
    experimentId: "bm-01",
    instanceId: "inst-bm01",
    runId: "run-bm01-001",
    parentRunId: null,
    actionIndex: 1,
    revisions: { input: 1, observer: 0, measurement: 0, estimator: 0 },
    parameters: {},
    stepIndex: 10,
    simulationTime: 5.0,
    final: true,
    snapshotVersion: 1,
    outputs: [],
  };
}

describe("printRepresentationScale: 5-Field Ordinary Language Representation", () => {
  const bm01MicroscopeScale: RepresentationScale = {
    spatialMagnification: { appliesTo: "scene", factor: 1000 },
    simulatedElapsedTime: { quantityId: "timeElapsed", value: 10, unit: "s" },
    playbackMultiplier: 1, // true rate
    glyphSize: { drawnPx: 4, represents: "none" },
    quantityNormalization: { kind: "none" },
  };

  it("BM-01 microscope fixture carries all five facts in ordinary language", () => {
    const snapshot = makeAcceptedSnapshot();
    const result = renderPrintFigure({
      instrumentId: "bm-01",
      question: "Microscope particle paths",
      snapshot,
      status: "accepted",
      scale: bm01MicroscopeScale,
    });

    assert.equal(result.isAccepted, true);
    assert.ok(result.html.includes('data-print-scale-facts="true"'));

    // Fact 1: Spatial magnification
    assert.ok(result.html.includes("Scene magnified ×1,000"));
    // Fact 2: Simulated elapsed time
    assert.ok(result.html.includes("10 s (timeElapsed)"));
    // Fact 3: Playback multiplier
    assert.ok(result.html.includes("true rate (1 s/s)"));
    // Fact 4: Glyph size (uncalibrated marker)
    assert.ok(
      result.html.includes("4 px marker (uncalibrated marker, not a physical particle size)"),
    );
    // Fact 5: Quantity normalization (unnormalized)
    assert.ok(result.html.includes("unnormalized counts/values"));
  });

  it("am-me-03-box-extension-kiei box fixture prints appliesTo naming displacement output rather than scene", () => {
    const boxScale: RepresentationScale = {
      spatialMagnification: { appliesTo: "displacement", factor: 1e17 },
      simulatedElapsedTime: { quantityId: "burstTime", value: 1e-9, unit: "s" },
      playbackMultiplier: 1,
      glyphSize: { drawnPx: 2, represents: "none" },
      quantityNormalization: { kind: "none" },
    };

    const snapshot = makeAcceptedSnapshot();
    const result = renderPrintFigure({
      instrumentId: "me-03",
      question: "Box displacement upon radiation emission",
      snapshot,
      status: "accepted",
      scale: boxScale,
      displacementValue: "1.112650e-17 m",
    });

    assert.ok(
      result.html.includes(
        "the displacement is drawn one hundred thousand million million times larger than life",
      ),
    );
    assert.ok(result.html.includes("1.112650e-17 m"));
  });

  it("default cases (factor: 1, represents: none, kind: none) are printed rather than omitted", () => {
    const defaultScale: RepresentationScale = {
      spatialMagnification: { appliesTo: "scene", factor: 1 },
      simulatedElapsedTime: { quantityId: "elapsedTime", value: 0, unit: "s" },
      playbackMultiplier: 1,
      glyphSize: { drawnPx: 1, represents: "none" },
      quantityNormalization: { kind: "none" },
    };

    const rows = auditPrintRepresentationScale("default-view", defaultScale);
    assert.equal(rows.length, 5);
    const keys = rows.map((r) => r.key);
    assert.ok(keys.includes("spatialMagnification"));
    assert.ok(keys.includes("simulatedElapsedTime"));
    assert.ok(keys.includes("playbackMultiplier"));
    assert.ok(keys.includes("glyphSize"));
    assert.ok(keys.includes("quantityNormalization"));

    assert.equal(
      formatOrdinarySpatialMagnification(defaultScale.spatialMagnification),
      "1:1 scene scale (unmagnified)",
    );
  });

  it("removing any one fact fails the audit with the view id and field named", () => {
    const baseScale: RepresentationScale = {
      spatialMagnification: { appliesTo: "scene", factor: 1 },
      simulatedElapsedTime: { quantityId: "t", value: 1, unit: "s" },
      playbackMultiplier: 1,
      glyphSize: { drawnPx: 2, represents: "none" },
      quantityNormalization: { kind: "none" },
    };

    // Missing spatialMagnification
    assert.throws(
      () =>
        auditPrintRepresentationScale("view-missing-mag", {
          ...baseScale,
          spatialMagnification: undefined as unknown as RepresentationScale["spatialMagnification"],
        }),
      (err: Error) =>
        err.message.includes("view-missing-mag") && err.message.includes("spatialMagnification"),
    );

    // Missing simulatedElapsedTime
    assert.throws(
      () =>
        auditPrintRepresentationScale("view-missing-time", {
          ...baseScale,
          simulatedElapsedTime: undefined as unknown as RepresentationScale["simulatedElapsedTime"],
        }),
      (err: Error) =>
        err.message.includes("view-missing-time") && err.message.includes("simulatedElapsedTime"),
    );

    // Missing playbackMultiplier
    assert.throws(
      () =>
        auditPrintRepresentationScale("view-missing-rate", {
          ...baseScale,
          playbackMultiplier: undefined as unknown as RepresentationScale["playbackMultiplier"],
        }),
      (err: Error) =>
        err.message.includes("view-missing-rate") && err.message.includes("playbackMultiplier"),
    );

    // Missing glyphSize
    assert.throws(
      () =>
        auditPrintRepresentationScale("view-missing-glyph", {
          ...baseScale,
          glyphSize: undefined as unknown as RepresentationScale["glyphSize"],
        }),
      (err: Error) =>
        err.message.includes("view-missing-glyph") && err.message.includes("glyphSize"),
    );

    // Missing quantityNormalization
    assert.throws(
      () =>
        auditPrintRepresentationScale("view-missing-norm", {
          ...baseScale,
          quantityNormalization:
            undefined as unknown as RepresentationScale["quantityNormalization"],
        }),
      (err: Error) =>
        err.message.includes("view-missing-norm") && err.message.includes("quantityNormalization"),
    );
  });

  it("box fixture printed at 10^15, 10^17, 10^20 shows 3 different factors while displacement value stays 1.112650e-17 m", () => {
    const factors = [1e15, 1e17, 1e20];
    const trueDisplacementValue = "1.112650e-17 m";
    const printedFactors: string[] = [];

    for (const factor of factors) {
      const scale: RepresentationScale = {
        spatialMagnification: { appliesTo: "displacement", factor },
        simulatedElapsedTime: { quantityId: "burstTime", value: 1e-9, unit: "s" },
        playbackMultiplier: 1,
        glyphSize: { drawnPx: 2, represents: "none" },
        quantityNormalization: { kind: "none" },
      };

      const result = renderPrintFigure({
        instrumentId: "me-03",
        question: "Box displacement",
        snapshot: makeAcceptedSnapshot(),
        status: "accepted",
        scale,
        displacementValue: trueDisplacementValue,
      });

      // Assert true physical displacement number is NOT scaled by factor!
      assert.ok(result.html.includes(`Displacement: <code>${trueDisplacementValue}</code>`));

      const formattedMag = formatOrdinarySpatialMagnification(scale.spatialMagnification);
      printedFactors.push(formattedMag);
    }

    // 3 distinct printed factor descriptions
    assert.equal(new Set(printedFactors).size, 3);

    // Planted failure: if someone scales the printed number by the factor, assert failure
    const wronglyScaledResult = renderPrintFigure({
      instrumentId: "me-03",
      question: "Box displacement",
      snapshot: makeAcceptedSnapshot(),
      status: "accepted",
      scale: {
        spatialMagnification: { appliesTo: "displacement", factor: 1e17 },
        simulatedElapsedTime: { quantityId: "burstTime", value: 1e-9, unit: "s" },
        playbackMultiplier: 1,
        glyphSize: { drawnPx: 2, represents: "none" },
        quantityNormalization: { kind: "none" },
      },
      displacementValue: "1.112650 m", // WRONGLY SCALED (1e-17 * 1e17 = 1.112650 m)
    });

    assert.notEqual(wronglyScaledResult.html.includes(trueDisplacementValue), true);
  });

  it("static scan: no RepresentationScale declaration and no scale computation in src/platform/print", () => {
    const files = readdirSync(DIR).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));

    for (const file of files) {
      const fullPath = path.join(DIR, file);
      const text = readFileSync(fullPath, "utf-8");
      const lines = text.split(/\r?\n/);

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;
        // Ensure no local interface / type declaration of RepresentationScale
        if (
          /interface\s+RepresentationScale\b/i.test(line) ||
          /type\s+RepresentationScale\s*=/i.test(line)
        ) {
          assert.fail(`Found RepresentationScale declaration in ${file}:${i + 1}`);
        }
        // Ensure no local scale calculation / factor derivation
        if (/Math\.pow\s*\(.*10/.test(line) && /factor\s*=/.test(line)) {
          assert.fail(`Found local scale computation in ${file}:${i + 1}`);
        }
      }
    }
  });
});
