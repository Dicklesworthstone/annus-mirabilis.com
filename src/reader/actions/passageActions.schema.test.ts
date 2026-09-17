import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { OBSTACLE_KIND_IDS } from "../../content/schemas/meanings.ts";
import { PassageActionsSchemaError, validatePassageActions } from "./passageActions.schema.ts";

describe("validatePassageActions: valid records", () => {
  test("the minimal record (hard only) is accepted", () => {
    const result = validatePassageActions({ hard: false });
    expect(result.hard).toBe(false);
  });

  test("a full record with every field is accepted", () => {
    const result = validatePassageActions({
      hard: true,
      why: "arg-bm-observable",
      missingStep: "step-3",
      example: "example-zero-mean",
      original: ["s4-p2-s1"],
      tryIt: { instrumentId: "bm-06", presetOrModeId: "bm-06-default" },
      obstacleResponses: { tooMuchAtOnce: { explanation: "Break it into three smaller claims." } },
    });
    expect(result.tryIt).toEqual({
      kind: "instrument",
      instrumentId: "bm-06",
      presetOrModeId: "bm-06-default",
    });
    expect(result.obstacleResponses?.tooMuchAtOnce?.explanation).toBe(
      "Break it into three smaller claims.",
    );
  });

  test("tryIt as a static example id is accepted without an instrument", () => {
    const result = validatePassageActions({
      hard: false,
      tryIt: { staticExampleId: "static-worked-example-1" },
    });
    expect(result.tryIt).toEqual({ kind: "static", staticExampleId: "static-worked-example-1" });
  });

  test("a mode id (colon form) is accepted for tryIt.presetOrModeId", () => {
    const result = validatePassageActions({
      hard: false,
      tryIt: { instrumentId: "bm-04", presetOrModeId: "bm-04:kicks-off" },
    });
    expect(result.tryIt).toEqual({
      kind: "instrument",
      instrumentId: "bm-04",
      presetOrModeId: "bm-04:kicks-off",
    });
  });
});

describe("validatePassageActions: rejections", () => {
  test("a non-object is rejected", () => {
    expect(() => validatePassageActions("nope")).toThrow(PassageActionsSchemaError);
  });

  test("a missing hard flag is rejected", () => {
    expect(() => validatePassageActions({})).toThrow(/hard/);
  });

  test("an unknown instrument id in tryIt is rejected", () => {
    expect(() => validatePassageActions({ hard: false, tryIt: { instrumentId: "xx-99" } })).toThrow(
      /not a declared instrument/,
    );
  });

  test("an undeclared preset id (bad slug grammar) is rejected", () => {
    expect(() =>
      validatePassageActions({
        hard: false,
        tryIt: { instrumentId: "bm-06", presetOrModeId: "bm-06-Not Valid!" },
      }),
    ).toThrow(/not a declared preset/);
  });

  test("an undeclared mode id (missing slug) is rejected", () => {
    expect(() =>
      validatePassageActions({
        hard: false,
        tryIt: { instrumentId: "bm-04", presetOrModeId: "bm-04:" },
      }),
    ).toThrow(/not a declared mode/);
  });

  test("a tryIt with neither instrumentId nor staticExampleId is rejected", () => {
    expect(() => validatePassageActions({ hard: false, tryIt: {} })).toThrow(
      /needs either instrumentId or staticExampleId/,
    );
  });
});

describe("obstacleResponses: restricted to the six imported kind ids", () => {
  test("every real obstacle kind id is accepted", () => {
    for (const kind of OBSTACLE_KIND_IDS) {
      const result = validatePassageActions({
        hard: true,
        obstacleResponses: { [kind]: { explanation: "test" } },
      });
      expect(result.obstacleResponses?.[kind]?.explanation).toBe("test");
    }
  });

  test("a seventh (unrecognized) obstacle id is rejected", () => {
    expect(() =>
      validatePassageActions({
        hard: true,
        obstacleResponses: { notARealKind: { explanation: "test" } },
      }),
    ).toThrow(/Unknown obstacle response key/);
  });

  test("a kebab-case obstacle id is rejected, naming the camelCase spelling", () => {
    expect(() =>
      validatePassageActions({
        hard: true,
        obstacleResponses: { "unfamiliar-word-or-symbol": { explanation: "test" } },
      }),
    ).toThrow(/camelCase/);
  });

  test("exampleFirst is accepted although it is not one of the six obstacle kinds", () => {
    const result = validatePassageActions({
      hard: false,
      obstacleResponses: { exampleFirst: { workedExampleRef: "example-1" } },
    });
    expect(result.obstacleResponses?.exampleFirst?.workedExampleRef).toBe("example-1");
  });
});

describe("passageActionsOwnership: this schema is the only definition of PassageActions in the corpus", () => {
  function findTsFiles(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (["node_modules", ".next", ".git", ".beads", "artifacts"].includes(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        findTsFiles(full, out);
      } else if (/\.(ts|tsx)$/.test(entry.name) && full !== fileURLToPath(import.meta.url)) {
        out.push(full);
      }
    }
    return out;
  }

  test("no content schema exports its own PassageActions type or interface", () => {
    const contentSchemaFiles = findTsFiles(join(process.cwd(), "src/content/schemas"));
    for (const file of contentSchemaFiles) {
      const source = readFileSync(file, "utf8");
      expect(source).not.toMatch(/export\s+(?:type|interface)\s+PassageActions\b/);
    }
  });

  test("this file is the only one declaring PassageActions outside itself", () => {
    const allFiles = findTsFiles(join(process.cwd(), "src"));
    const declarers = allFiles.filter((file) => {
      if (statSync(file).isDirectory()) return false;
      const source = readFileSync(file, "utf8");
      return /export\s+(?:type|interface)\s+PassageActions\b/.test(source);
    });
    expect(declarers).toEqual([join(process.cwd(), "src/reader/actions/passageActions.schema.ts")]);
  });
});
