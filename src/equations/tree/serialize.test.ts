/**
 * Unit tests for deterministic serialization and hash stability.
 * Specified in am-eq-expression-tree-8kl (Test Plan: serialize.test.ts).
 */

import { describe, expect, test } from "bun:test";
import { FIXTURE_1_PRINTED_DIFFUSION } from "./fixtures.ts";
import { canonicalJsonStringify, computeTreeHash } from "./serialize.ts";
import type { EquationTree } from "./types.ts";

describe("Deterministic Serialization and Hashing (serialize.test.ts)", () => {
  test("deterministic output and hash stability across repeated calls", () => {
    const json1 = canonicalJsonStringify(FIXTURE_1_PRINTED_DIFFUSION);
    const json2 = canonicalJsonStringify(FIXTURE_1_PRINTED_DIFFUSION);
    expect(json1).toBe(json2);

    const hash1 = computeTreeHash(FIXTURE_1_PRINTED_DIFFUSION);
    const hash2 = computeTreeHash(FIXTURE_1_PRINTED_DIFFUSION);
    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(64); // SHA-256 hex string
  });

  test("reordering object keys in the source does not change the serialized output or hash", () => {
    const treeA: EquationTree = {
      treeSchemaVersion: 1,
      root: {
        kind: "symbol",
        termId: "eq-1.t.x",
        quantityId: "temperature",
        scale: { num: 1, den: 2 },
      },
    };

    // Construct an object with keys inserted in different order
    const treeB = {
      root: {
        scale: { den: 2, num: 1 },
        quantityId: "temperature",
        termId: "eq-1.t.x",
        kind: "symbol",
      },
      treeSchemaVersion: 1,
    } as unknown as EquationTree;

    const jsonA = canonicalJsonStringify(treeA);
    const jsonB = canonicalJsonStringify(treeB);
    expect(jsonA).toBe(jsonB);

    const hashA = computeTreeHash(treeA);
    const hashB = computeTreeHash(treeB);
    expect(hashA).toBe(hashB);
  });

  test("changing a rendering hint changes the hash", () => {
    const treeWithoutHint: EquationTree = {
      treeSchemaVersion: 1,
      root: {
        kind: "product",
        args: [
          { kind: "number", value: "2" },
          { kind: "symbol", termId: "eq-1.t.d", quantityId: "diffusionCoefficient" },
        ],
        style: "explicit",
      },
    };

    const treeWithHint: EquationTree = {
      treeSchemaVersion: 1,
      root: {
        kind: "product",
        args: [
          { kind: "number", value: "2" },
          { kind: "symbol", termId: "eq-1.t.d", quantityId: "diffusionCoefficient" },
        ],
        style: "juxtaposed", // Changed rendering hint
      },
    };

    const hashWithout = computeTreeHash(treeWithoutHint);
    const hashWith = computeTreeHash(treeWithHint);
    expect(hashWithout).not.toBe(hashWith);
  });

  test("adding layout breaks changes the hash", () => {
    const treeA: EquationTree = {
      treeSchemaVersion: 1,
      root: {
        kind: "symbol",
        termId: "eq-1.t.x",
        quantityId: "temperature",
      },
      layout: undefined,
    };

    const treeB: EquationTree = {
      treeSchemaVersion: 1,
      root: {
        kind: "symbol",
        termId: "eq-1.t.x",
        quantityId: "temperature",
      },
      layout: {
        breaks: ["eq-1.t.x"],
      },
    };

    expect(computeTreeHash(treeA)).not.toBe(computeTreeHash(treeB));
  });
});
