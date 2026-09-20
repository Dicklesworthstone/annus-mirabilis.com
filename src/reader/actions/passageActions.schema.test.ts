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

describe("validatePassageActions refusal throw sites (am-muyh)", () => {
  function assertPassageActionsRefusal(
    fn: () => unknown,
    expectedCode: string,
    expectedPath?: string,
  ): void {
    let thrown: unknown;
    try {
      fn();
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(PassageActionsSchemaError);
    const schemaErr = thrown as PassageActionsSchemaError;
    expect(schemaErr.code).toBe(expectedCode);
    if (expectedPath !== undefined) {
      expect(schemaErr.path).toBe(expectedPath);
    }
  }

  test("refusal (passageActions.schema.ts:60): invalid-string rejects non-string or empty strings", () => {
    // Accept: non-empty string for why, missingStep, example
    const accepted = validatePassageActions({
      hard: false,
      why: "arg-bm-diffusion",
      missingStep: "step-1",
      example: "ex-diffusion",
    });
    expect(accepted.why).toBe("arg-bm-diffusion");
    expect(accepted.missingStep).toBe("step-1");
    expect(accepted.example).toBe("ex-diffusion");

    // Reject: whitespace-only string
    assertPassageActionsRefusal(
      () => validatePassageActions({ hard: false, why: "   " }),
      "invalid-string",
      "PassageActions.why",
    );
  });

  test("refusal (passageActions.schema.ts:72): invalid-string-array rejects non-array or empty strings in array", () => {
    // Accept: array of non-empty strings
    const accepted = validatePassageActions({
      hard: false,
      original: ["s1-p1-s1", "s1-p1-s2"],
    });
    expect(accepted.original).toEqual(["s1-p1-s1", "s1-p1-s2"]);

    // Reject: array with whitespace-only string
    assertPassageActionsRefusal(
      () => validatePassageActions({ hard: false, original: ["s1-p1-s1", "  "] }),
      "invalid-string-array",
      "PassageActions.original",
    );
  });

  test("refusal (passageActions.schema.ts:83): invalid-try-it rejects non-object tryIt", () => {
    // Accept: valid tryIt object
    const accepted = validatePassageActions({
      hard: false,
      tryIt: { staticExampleId: "ex-1" },
    });
    expect(accepted.tryIt?.kind).toBe("static");

    // Reject: primitive string instead of object
    assertPassageActionsRefusal(
      () => validatePassageActions({ hard: false, tryIt: "invalid-try-it-payload" }),
      "invalid-try-it",
      "PassageActions.tryIt",
    );
  });

  test("refusal (passageActions.schema.ts:90): invalid-try-it rejects invalid tryIt.label", () => {
    // Accept: valid non-empty label
    const accepted = validatePassageActions({
      hard: false,
      tryIt: { staticExampleId: "ex-1", label: "Inspect Step" },
    });
    expect(accepted.tryIt?.label).toBe("Inspect Step");

    // Reject: whitespace-only label
    assertPassageActionsRefusal(
      () =>
        validatePassageActions({ hard: false, tryIt: { staticExampleId: "ex-1", label: "   " } }),
      "invalid-try-it",
      "PassageActions.tryIt.label",
    );
  });

  test("refusal (passageActions.schema.ts:101): invalid-try-it rejects empty staticExampleId", () => {
    // Accept: valid staticExampleId
    const accepted = validatePassageActions({
      hard: false,
      tryIt: { staticExampleId: "static-worked-example-1" },
    });
    expect(accepted.tryIt).toEqual({
      kind: "static",
      staticExampleId: "static-worked-example-1",
    });

    // Reject: empty string staticExampleId
    assertPassageActionsRefusal(
      () => validatePassageActions({ hard: false, tryIt: { staticExampleId: "   " } }),
      "invalid-try-it",
      "PassageActions.tryIt.staticExampleId",
    );
  });

  test("refusal (passageActions.schema.ts:115): invalid-try-it rejects tryIt missing both instrumentId and staticExampleId", () => {
    // Accept: instrumentId provided
    const accepted = validatePassageActions({
      hard: false,
      tryIt: { instrumentId: "bm-01" },
    });
    expect(accepted.tryIt).toEqual({
      kind: "instrument",
      instrumentId: "bm-01",
    });

    // Reject: neither instrumentId nor staticExampleId provided
    assertPassageActionsRefusal(
      () => validatePassageActions({ hard: false, tryIt: {} }),
      "invalid-try-it",
      "PassageActions.tryIt",
    );
  });

  test("refusal (passageActions.schema.ts:123): undeclared-instrument rejects unrecognized instrumentId", () => {
    // Accept: declared core instrument bm-06
    const accepted = validatePassageActions({
      hard: false,
      tryIt: { instrumentId: "bm-06" },
    });
    expect(accepted.tryIt?.kind).toBe("instrument");

    // Reject: undeclared instrument xx-99
    assertPassageActionsRefusal(
      () => validatePassageActions({ hard: false, tryIt: { instrumentId: "xx-99" } }),
      "undeclared-instrument",
      "PassageActions.tryIt.instrumentId",
    );
  });

  test("refusal (passageActions.schema.ts:133): invalid-try-it rejects non-string presetOrModeId", () => {
    // Accept: string presetOrModeId
    const accepted = validatePassageActions({
      hard: false,
      tryIt: { instrumentId: "bm-06", presetOrModeId: "bm-06-default" },
    });
    expect(accepted.tryIt?.kind).toBe("instrument");
    if (accepted.tryIt?.kind === "instrument") {
      expect(accepted.tryIt.presetOrModeId).toBe("bm-06-default");
    }

    // Reject: numeric presetOrModeId
    assertPassageActionsRefusal(
      () =>
        validatePassageActions({
          hard: false,
          tryIt: { instrumentId: "bm-06", presetOrModeId: 12345 as unknown as string },
        }),
      "invalid-try-it",
      "PassageActions.tryIt.presetOrModeId",
    );
  });

  test("refusal (passageActions.schema.ts:142): undeclared-preset-or-mode rejects invalid preset or mode grammar", () => {
    // Accept: valid preset id and valid mode id
    const acceptedPreset = validatePassageActions({
      hard: false,
      tryIt: { instrumentId: "bm-06", presetOrModeId: "bm-06-default" },
    });
    expect(acceptedPreset.tryIt?.kind).toBe("instrument");
    if (acceptedPreset.tryIt?.kind === "instrument") {
      expect(acceptedPreset.tryIt.presetOrModeId).toBe("bm-06-default");
    }

    const acceptedMode = validatePassageActions({
      hard: false,
      tryIt: { instrumentId: "bm-04", presetOrModeId: "bm-04:kicks-off" },
    });
    expect(acceptedMode.tryIt?.kind).toBe("instrument");
    if (acceptedMode.tryIt?.kind === "instrument") {
      expect(acceptedMode.tryIt.presetOrModeId).toBe("bm-04:kicks-off");
    }

    // Reject: malformed preset slug grammar
    assertPassageActionsRefusal(
      () =>
        validatePassageActions({
          hard: false,
          tryIt: { instrumentId: "bm-06", presetOrModeId: "bm-06-Invalid Slug!" },
        }),
      "undeclared-preset-or-mode",
      "PassageActions.tryIt.presetOrModeId",
    );
  });

  test("refusal (passageActions.schema.ts:166): invalid-obstacle-responses rejects non-object obstacleResponses", () => {
    // Accept: valid object obstacleResponses
    const accepted = validatePassageActions({
      hard: false,
      obstacleResponses: { tooMuchAtOnce: { explanation: "Take it step by step" } },
    });
    expect(accepted.obstacleResponses?.tooMuchAtOnce?.explanation).toBe("Take it step by step");

    // Reject: primitive non-object obstacleResponses
    assertPassageActionsRefusal(
      () => validatePassageActions({ hard: false, obstacleResponses: "not-an-object" }),
      "invalid-obstacle-responses",
      "PassageActions.obstacleResponses",
    );
  });

  test("refusal (passageActions.schema.ts:180): invalid-obstacle-responses rethrows delegated schema error", () => {
    // Accept: valid camelCase obstacle response
    const accepted = validatePassageActions({
      hard: false,
      obstacleResponses: { algebraicMove: { explanation: "Subtract term from both sides" } },
    });
    expect(accepted.obstacleResponses?.algebraicMove?.explanation).toBe(
      "Subtract term from both sides",
    );

    // Reject: delegated rejection (kebab-case key triggering validateObstacleResponses error)
    assertPassageActionsRefusal(
      () =>
        validatePassageActions({
          hard: false,
          obstacleResponses: { "algebraic-move": { explanation: "Use camelCase" } },
        }),
      "invalid-obstacle-responses",
      "PassageActions.obstacleResponses",
    );
  });

  test("refusal (passageActions.schema.ts:189): invalid-obstacle-key rejects unrecognized obstacle key", () => {
    // Accept: allowed non-kind key exampleFirst
    const accepted = validatePassageActions({
      hard: false,
      obstacleResponses: { exampleFirst: { workedExampleRef: "ex-1" } },
    });
    expect(accepted.obstacleResponses?.exampleFirst?.workedExampleRef).toBe("ex-1");

    // Reject: unrecognized key
    assertPassageActionsRefusal(
      () =>
        validatePassageActions({
          hard: false,
          obstacleResponses: { nonExistentObstacleKind: { explanation: "invalid" } },
        }),
      "invalid-obstacle-key",
      "PassageActions.obstacleResponses.nonExistentObstacleKind",
    );
  });

  test("refusal (passageActions.schema.ts:201): invalid-record rejects non-object raw input", () => {
    // Accept: valid object
    const accepted = validatePassageActions({ hard: false });
    expect(accepted.hard).toBe(false);

    // Reject: null input
    assertPassageActionsRefusal(
      () => validatePassageActions(null),
      "invalid-record",
      "PassageActions",
    );
  });

  test("refusal (passageActions.schema.ts:206): invalid-hard rejects missing or non-boolean hard field", () => {
    // Accept: boolean true and false
    expect(validatePassageActions({ hard: true }).hard).toBe(true);
    expect(validatePassageActions({ hard: false }).hard).toBe(false);

    // Reject: missing hard field
    assertPassageActionsRefusal(
      () => validatePassageActions({}),
      "invalid-hard",
      "PassageActions.hard",
    );
  });
});
