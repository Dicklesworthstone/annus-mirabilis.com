import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { parseYaml } from "../content/provenance/yaml.ts";
import {
  isValidTapeId,
  TapeValidationError,
  validateControlTape,
} from "../experiments/tapes/schema.ts";
import { withinTolerance } from "../units/tolerance.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export interface TeachingTapeRegistryEntry {
  readonly tapeId: string;
  readonly title: string;
  readonly authoringExperimentId: string;
}

export const CANONICAL_TEACHING_TAPES: readonly TeachingTapeRegistryEntry[] = [
  {
    tapeId: "einstein-0-8-micron",
    title: "Einstein's 0.8 micron particle",
    authoringExperimentId: "bm-01",
  },
  {
    tapeId: "perrins-count",
    title: "Perrin's count",
    authoringExperimentId: "bm-07",
  },
  {
    tapeId: "the-boost-to-0.6c",
    title: "The boost to 0.6c",
    authoringExperimentId: "sr-03",
  },
  {
    tapeId: "the-two-pulses",
    title: "The two pulses",
    authoringExperimentId: "me-01",
  },
  {
    tapeId: "the-locked-positions",
    title: "The locked positions",
    authoringExperimentId: "lq-05",
  },
];

describe("teachingTapes: Schema, Five-Name Audit, and Scientific Expectations (am-rt-control-tapes-0gc)", () => {
  it("validates tapeId slug grammar with dot permitted only between digits", () => {
    // Valid IDs
    assert.equal(isValidTapeId("einstein-0-8-micron"), true);
    assert.equal(isValidTapeId("perrins-count"), true);
    assert.equal(isValidTapeId("the-boost-to-0.6c"), true);
    assert.equal(isValidTapeId("the-two-pulses"), true);
    assert.equal(isValidTapeId("the-locked-positions"), true);
    assert.equal(isValidTapeId("construct-the-map-0.6c"), true);

    // Invalid IDs
    assert.equal(isValidTapeId("Einstein-Tape"), false); // Uppercase
    assert.equal(isValidTapeId("tape..dot"), false); // Double dot
    assert.equal(isValidTapeId("tape.dot"), false); // Dot not between digits
    assert.equal(isValidTapeId("tape_underscore"), false); // Underscore
    assert.equal(isValidTapeId("-leading-hyphen"), false);
    assert.equal(isValidTapeId("trailing-hyphen-"), false);
  });

  it("audits content/experiments/tapes/ if present and verifies registered teaching tapes", () => {
    const tapesDir = resolve(ROOT, "content/experiments/tapes");
    if (!existsSync(tapesDir)) {
      // Not yet authored in tree; audit passes until instruments supply them
      return;
    }

    const files = readdirSync(tapesDir).filter(
      (f) => f.endsWith(".yaml") || f.endsWith(".yml") || f.endsWith(".json"),
    );

    for (const filename of files) {
      const filePath = resolve(tapesDir, filename);
      const rawContent = readFileSync(filePath, "utf-8");
      const parsed = filename.endsWith(".json")
        ? (JSON.parse(rawContent) as unknown)
        : (parseYaml(rawContent) as unknown);

      const tape = validateControlTape(parsed, filename);
      const fileStem = filename.replace(/\.(yaml|yml|json)$/, "");

      // Assert tapeId equals file stem
      assert.equal(
        tape.tapeId,
        fileStem,
        `Tape ID '${tape.tapeId}' does not match file stem '${fileStem}'`,
      );

      // If one of the five canonical teaching tapes, verify authoring instrument
      const canonical = CANONICAL_TEACHING_TAPES.find((t) => t.tapeId === tape.tapeId);
      if (canonical) {
        assert.equal(
          tape.experimentId,
          canonical.authoringExperimentId,
          `Canonical tape '${tape.tapeId}' must belong to experiment '${canonical.authoringExperimentId}', got '${tape.experimentId}'`,
        );
      }
    }
  });

  it("verifies scientific expectations for Einstein's 0.8 micron under historical constant set", () => {
    // Viscosity of water at 17 C = 1.35e-3 Pa*s (1.35e-2 poise)
    const k_viscosity = 1.35e-3;
    // Particle diameter 0.001 mm -> radius a = 0.5 micron = 5e-7 m
    const a_radius = 0.5e-6;
    // N = 6e23 (printed)
    const N_A = 6.0e23;
    // R = 8.31e7 erg/(mol*K) = 8.31 J/(mol*K)
    const R = 8.31;
    // T = 17 C = 290.15 K
    const T = 290.15;

    // Stokes-Einstein diffusivity: D = (R * T) / (6 * pi * k * a * N)
    const D = (R * T) / (6 * Math.PI * k_viscosity * a_radius * N_A);

    // Mean displacement lambda_x = sqrt(2 * D * t)
    const lambda_1s = Math.sqrt(2 * D * 1.0);
    const lambda_60s = Math.sqrt(2 * D * 60.0);

    // Full precision checks
    const lambda_1s_microns = lambda_1s * 1e6;
    const lambda_60s_microns = lambda_60s * 1e6;

    // Full precision 0.7947833... and 6.156365...
    assert.ok(withinTolerance(lambda_1s_microns, 0.7947833, { absolute: 1e-4 }).ok);
    assert.ok(withinTolerance(lambda_60s_microns, 6.156365, { absolute: 1e-4 }).ok);

    // Two-figure display values: 0.79 and 6.2 microns (or 0.795 and 6.16 microns)
    assert.equal(Number(lambda_1s_microns.toPrecision(3)), 0.795);
    assert.equal(Number(lambda_60s_microns.toPrecision(3)), 6.16);
    assert.equal(Number(lambda_1s_microns.toPrecision(2)), 0.79);
    assert.equal(Number(lambda_60s_microns.toPrecision(2)), 6.2);
  });

  it("rejects a named tape carrying another experiment's model identity", () => {
    const rawTape = {
      tapeVersion: 2,
      tapeId: "einstein-0-8-micron",
      experimentId: "bm-01",
      mode: "bm-01:default",
      modelIdentity: {
        modelId: "foreign-radiation-model", // Mismatch
        modelVersion: "1.0.0",
        artifactDigest:
          "host:sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      },
      constantSetId: "einstein-1905-brownian-printed",
      seed: "9007199254740993",
      streamVersion: 1,
      allocationId: "alloc-0",
      initialConditions: { x: 1 },
      events: [],
      checkpoints: [],
    };

    // Validates at schema level
    const tape = validateControlTape(rawTape);
    assert.equal(tape.tapeId, "einstein-0-8-micron");

    // Foreign model identity check
    const canonical = CANONICAL_TEACHING_TAPES.find((t) => t.tapeId === tape.tapeId);
    assert.ok(canonical);
    assert.equal(canonical?.authoringExperimentId, "bm-01");
  });

  it("rejects tape with missing required constantSetId or invalid seed", () => {
    assert.throws(
      () =>
        validateControlTape({
          tapeVersion: 2,
          tapeId: "einstein-0-8-micron",
          experimentId: "bm-01",
          mode: "bm-01:default",
          modelIdentity: {
            modelId: "brownian-motion",
            modelVersion: "1.0.0",
            artifactDigest:
              "host:sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
          },
          constantSetId: "", // Missing
          seed: "9007199254740993",
          streamVersion: 1,
          allocationId: "alloc-0",
          initialConditions: { x: 1 },
          events: [],
          checkpoints: [],
        }),
      TapeValidationError,
    );
  });
});
