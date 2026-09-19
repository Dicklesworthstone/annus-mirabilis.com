import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { loadReadingFiles } from "../../scripts/build-content.ts";
import { compileReadingContent } from "../content/compiler/compile.ts";
import { loadRegistry } from "../content/foundations/registry.ts";
import { ArgumentSchemaError, validateFoundationOrBridge } from "../content/schemas/argument.ts";
import { validateReadingRecord } from "../content/schemas/reading.ts";
import { writeCalculusLog } from "./foundCalculus.logger.ts";

const FOUNDATIONS_DIR = path.resolve("content/foundations");
const CALCULUS_FOUNDATION_IDS = [
  "functions-graphs",
  "derivatives",
  "partial-derivatives",
  "exponentials",
  "logarithms",
] as const;

test("foundCalculus.records: all 5 calculus foundations exist, load, and validate", () => {
  for (const id of CALCULUS_FOUNDATION_IDS) {
    const filePath = path.join(FOUNDATIONS_DIR, `${id}.json`);
    assert.equal(fs.existsSync(filePath), true, `File ${filePath} must exist`);

    const content = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(content);

    const record = validateReadingRecord(parsed, filePath);
    assert.equal(record.kind, "foundation");
    if (record.kind !== "foundation") {
      throw new Error(`Record ${id} is not a foundation record`);
    }
    assert.equal(record.id, id);
    assert.ok(record.title.length > 0);
    assert.ok(record.question.length > 0);
    assert.ok(record.summary.length > 0);
    assert.ok(record.stoppingPoint.length > 0);
    assert.ok(record.explanation.length >= 3);
    assert.ok(record.example.length >= 2);

    writeCalculusLog({
      testId: `foundation-record-validate-${id}`,
      foundationId: id,
      expected: "valid foundation record with title, question, summary, stoppingPoint",
      actual: "valid",
      outcome: "passed",
      message: `Foundation record ${id} validated against schema`,
    });
  }
});

test("foundCalculus.records: registry entries, status authored, owner bead, and planned callers verified", () => {
  const registry = loadRegistry();
  const entryMap = new Map(registry.entries.map((e) => [e.id, e]));

  const expectedPlannedCallers: Record<string, string[]> = {
    "foundation:functions-graphs": [
      "light-quanta:s1",
      "light-quanta:s2",
      "light-quanta:s3",
      "light-quanta:s4",
      "light-quanta:s8",
      "brownian-motion:s5",
    ],
    "foundation:derivatives": [
      "light-quanta:s8",
      "brownian-motion:s4",
      "special-relativity:s5",
      "mass-energy",
    ],
    "foundation:partial-derivatives": [
      "light-quanta:s3",
      "brownian-motion:s3",
      "brownian-motion:s4",
      "special-relativity:s6",
    ],
    "foundation:exponentials": ["light-quanta:s4", "brownian-motion:s4"],
    "foundation:logarithms": ["light-quanta:s4", "light-quanta:s5", "brownian-motion:s2"],
  };

  for (const slug of CALCULUS_FOUNDATION_IDS) {
    const canonicalId = `foundation:${slug}`;
    const entry = entryMap.get(canonicalId);
    assert.ok(entry, `Registry must contain entry for ${canonicalId}`);
    assert.equal(
      entry.ownerBead,
      "am-found-calculus-6agg",
      `Owner bead for ${canonicalId} must be am-found-calculus-6agg`,
    );
    assert.equal(entry.status, "authored", `Status for ${canonicalId} must be authored`);
    assert.equal(entry.kind, "node", `Kind for ${canonicalId} must be node`);
    assert.equal(entry.cluster, "calculus", `Cluster for ${canonicalId} must be calculus`);

    const expectedCallers = expectedPlannedCallers[canonicalId];
    assert.deepEqual(
      entry.plannedCallers,
      expectedCallers,
      `Planned callers mismatch for ${canonicalId}`,
    );

    writeCalculusLog({
      testId: `registry-entry-verified-${slug}`,
      foundationId: slug,
      expected: {
        ownerBead: "am-found-calculus-6agg",
        status: "authored",
        plannedCallers: expectedCallers,
      },
      actual: {
        ownerBead: entry.ownerBead,
        status: entry.status,
        plannedCallers: entry.plannedCallers,
      },
      outcome: "passed",
      message: `Verified registry entry ${canonicalId} status, owner, and planned callers`,
    });
  }
});

test("foundCalculus.records: prerequisites and dependency graph are properly connected", () => {
  const records = new Map<string, { prerequisites?: unknown[]; returnCaptions?: unknown[] }>();
  for (const id of CALCULUS_FOUNDATION_IDS) {
    const filePath = path.join(FOUNDATIONS_DIR, `${id}.json`);
    const content = JSON.parse(fs.readFileSync(filePath, "utf8"));
    records.set(id, content);
  }

  // functions-graphs requires bridge-a-graph as proof-edge
  assert.deepEqual(records.get("functions-graphs")?.prerequisites, [
    { foundationId: "foundation:bridge-a-graph", kind: "proof-edge" },
  ]);

  // derivatives requires functions-graphs as proof-edge
  assert.deepEqual(records.get("derivatives")?.prerequisites, [
    { foundationId: "foundation:functions-graphs", kind: "proof-edge" },
  ]);

  // partial-derivatives requires derivatives as proof-edge
  assert.deepEqual(records.get("partial-derivatives")?.prerequisites, [
    { foundationId: "foundation:derivatives", kind: "proof-edge" },
  ]);

  // exponentials requires derivatives (proof-edge) and logarithms (cross-link)
  assert.deepEqual(records.get("exponentials")?.prerequisites, [
    { foundationId: "foundation:derivatives", kind: "proof-edge" },
    { foundationId: "foundation:logarithms", kind: "cross-link" },
  ]);

  // logarithms requires exponentials (cross-link)
  assert.deepEqual(records.get("logarithms")?.prerequisites, [
    { foundationId: "foundation:exponentials", kind: "cross-link" },
  ]);

  // Verify returnCaptions on all 5 authored records
  for (const id of CALCULUS_FOUNDATION_IDS) {
    const rec = records.get(id);
    assert.ok(
      Array.isArray(rec?.returnCaptions) && rec.returnCaptions.length > 0,
      `Foundation ${id} must carry returnCaptions[] for existing callers`,
    );
    for (const rc of rec.returnCaptions as { callingAnchor: string; caption: string }[]) {
      assert.ok(typeof rc.callingAnchor === "string" && rc.callingAnchor.length > 0);
      assert.ok(typeof rc.caption === "string" && rc.caption.length > 0);
    }
  }

  writeCalculusLog({
    testId: "calculus-prerequisites-graph",
    expected: "typed proof-edge and cross-link prerequisites and returnCaptions on all 5 files",
    actual: "connected with typed prerequisites and returnCaptions",
    outcome: "passed",
    message: "Verified calculus typed prerequisite connections and returnCaptions",
  });
});

test("foundCalculus.records: prerequisite typing (cross-link vs proof-edge, missing kind rejected)", () => {
  const validAuthorship = {
    draftedBy: [{ id: "jemanuel", name: "Jeffrey Emanuel", kind: "human" as const }],
  };
  const baseFoundation = {
    id: "found-calculus-test",
    kind: "foundation",
    title: "Calculus Foundation Test",
    learningObjective: "Test prerequisite typing",
    compactExplanation: "Compact",
    fullExplanation: "Full",
    workedExample: {
      question: "Q",
      given: "G",
      plausibleFirstThought: "P",
      decisiveStep: "D",
      limitation: "L",
    },
    textualEquivalent: "T",
    stoppingPoint: "S",
    returnCaptions: [],
    authorship: validAuthorship,
    reviewState: "reviewed",
  };

  // 1. Valid proof-edge prerequisite ref passes
  const parsedProof = validateFoundationOrBridge({
    ...baseFoundation,
    prerequisites: [{ foundationId: "foundation:derivatives", kind: "proof-edge" }],
  });
  // The validator returns Foundation | Bridge; only Foundation carries prerequisites.
  // Assert the discriminant so a wrong return kind fails loudly instead of being cast away.
  assert.equal(parsedProof.kind, "foundation");
  assert.ok(parsedProof.kind === "foundation");
  assert.equal(parsedProof.prerequisites.length, 1);
  assert.equal(parsedProof.prerequisites[0]?.kind, "proof-edge");

  // 2. Valid cross-link prerequisite ref passes
  const parsedCross = validateFoundationOrBridge({
    ...baseFoundation,
    prerequisites: [{ foundationId: "foundation:functions-graphs", kind: "cross-link" }],
  });
  assert.equal(parsedCross.kind, "foundation");
  assert.ok(parsedCross.kind === "foundation");
  assert.equal(parsedCross.prerequisites[0]?.kind, "cross-link");

  // 3. Prerequisite missing kind is rejected with invalid-prerequisite-shape or invalid-prerequisite-kind
  assert.throws(
    () =>
      validateFoundationOrBridge({
        ...baseFoundation,
        prerequisites: [{ foundationId: "foundation:derivatives" }] as unknown as [],
      }),
    (err: unknown) => {
      assert.ok(err instanceof ArgumentSchemaError);
      assert.ok(
        err.code === "invalid-prerequisite-shape" || err.code === "invalid-prerequisite-kind",
        `Expected invalid prerequisite error code, got ${err.code}`,
      );
      return true;
    },
  );

  // 4. Bare string prerequisite is rejected with invalid-prerequisite-shape
  assert.throws(
    () =>
      validateFoundationOrBridge({
        ...baseFoundation,
        prerequisites: ["foundation:derivatives"] as unknown as [],
      }),
    (err: unknown) => {
      assert.ok(err instanceof ArgumentSchemaError);
      assert.equal(err.code, "invalid-prerequisite-shape");
      return true;
    },
  );

  writeCalculusLog({
    testId: "prerequisite-typing-kind-checks",
    expected: "proof-edge and cross-link pass; missing kind rejected with schema error",
    actual: "rejected as expected",
    outcome: "passed",
    message:
      "Verified prerequisite typing enforces proof-edge vs cross-link and rejects untyped prerequisites",
  });
});

test("foundCalculus.records: voice lint rejects 'obviously', 'clearly', 'simply', and em dashes", () => {
  const forbiddenWords = [/\bobviously\b/i, /\bclearly\b/i, /\bsimply\b/i];
  const emDash = /\u2014/;

  for (const id of CALCULUS_FOUNDATION_IDS) {
    const filePath = path.join(FOUNDATIONS_DIR, `${id}.json`);
    const rawText = fs.readFileSync(filePath, "utf8");

    for (const pattern of forbiddenWords) {
      assert.equal(
        pattern.test(rawText),
        false,
        `Foundation ${id} contains forbidden condescending voice pattern ${pattern}`,
      );
    }

    assert.equal(
      emDash.test(rawText),
      false,
      `Foundation ${id} contains em dash (\\u2014), violating editorial voice rules`,
    );
  }

  writeCalculusLog({
    testId: "voice-lint-calculus-foundations",
    expected: "0 forbidden words and 0 em dashes",
    actual: "0 forbidden words, 0 em dashes across all 5 files",
    outcome: "passed",
    message: "Voice lint confirmed: 0 condescending words and 0 em dashes in calculus foundations",
  });
});

test("foundCalculus.records: partial-derivatives explicitly names held-fixed quantities in each example", () => {
  const filePath = path.join(FOUNDATIONS_DIR, "partial-derivatives.json");
  const content = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(content);

  // Check general explanation
  const fullText = JSON.stringify(parsed);
  assert.ok(
    fullText.includes("holding time t strictly fixed"),
    "Must explicitly state holding time t fixed in explanation",
  );
  assert.ok(
    fullText.includes("fixed position x"),
    "Must explicitly state fixed position x in explanation",
  );

  // Check EACH example explicitly names its own fixed quantities
  const examples = parsed.example as Array<{ kind: string; text?: string; latex?: string }>;
  const exampleText = examples
    .filter((e) => e.kind === "paragraph")
    .map((e) => e.text ?? "")
    .join("\n");

  // Example 1: Time fixed when moving through space
  assert.ok(
    exampleText.includes("Example 1 (Time fixed when moving through space)"),
    "Example 1 must name time fixed when moving through space",
  );
  assert.ok(
    exampleText.includes("time t is strictly fixed") || exampleText.includes("t is strictly fixed"),
    "Example 1 must explicitly name time t as held-fixed parameter",
  );

  // Example 2: Position fixed when tracking time
  assert.ok(
    exampleText.includes("Example 2 (Position fixed when tracking time)"),
    "Example 2 must name position fixed when tracking time",
  );
  assert.ok(
    exampleText.includes("position x is strictly fixed"),
    "Example 2 must explicitly name position x as held-fixed parameter",
  );

  // Example 3: Thermodynamic derivatives (isothermal vs adiabatic)
  assert.ok(
    exampleText.includes("Example 3 (Thermodynamic derivatives: isothermal versus adiabatic)"),
    "Example 3 must distinguish isothermal versus adiabatic derivatives",
  );
  assert.ok(
    exampleText.includes("names temperature T as the held-fixed quantity"),
    "Example 3 must name temperature T held fixed for isothermal derivative",
  );
  assert.ok(
    exampleText.includes("names entropy S as the held-fixed quantity"),
    "Example 3 must name entropy S held fixed for adiabatic derivative",
  );

  // Example 4: Light Quanta §3 radiation entropy
  assert.ok(
    exampleText.includes("Example 4 (Radiation entropy derivative in Light Quanta §3)"),
    "Example 4 must name radiation entropy derivative in Light Quanta §3",
  );
  assert.ok(
    exampleText.includes("volume V and radiation frequency nu are strictly held fixed"),
    "Example 4 must explicitly name volume V and frequency nu as held-fixed parameters",
  );

  // Example 5: Special Relativity §6 transformed derivatives
  assert.ok(
    exampleText.includes("Example 5 (Transformed derivatives in Relativity §6)"),
    "Example 5 must name transformed derivatives in Relativity §6",
  );
  assert.ok(
    exampleText.includes("holds resting coordinates y, z, and time t fixed"),
    "Example 5 must explicitly name resting coordinates y, z, and time t held fixed",
  );

  writeCalculusLog({
    testId: "partial-derivatives-held-fixed-explicit",
    foundationId: "partial-derivatives",
    callingAnchor: "brownian-motion:s4",
    expected:
      "each example explicitly names its own held-fixed quantities (t, x, T, S, V, nu, y, z)",
    actual:
      "Example 1 names t, Example 2 names x, Example 3 names T and S, Example 4 names V and nu, Example 5 names y, z, t",
    outcome: "passed",
    message:
      "Verified each held-fixed example in partial-derivatives explicitly identifies its fixed quantities",
  });
});

test("foundCalculus.records: logarithms node carries 'lg' note and product-to-sum derivation", () => {
  const filePath = path.join(FOUNDATIONS_DIR, "logarithms.json");
  const content = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(content);

  const fullText = JSON.stringify(parsed);
  // 'lg' historical note check
  assert.ok(
    fullText.includes("In 1905 German scientific literature") &&
      fullText.includes("'lg' denoted the natural logarithm"),
    "Logarithms node must explain 1905 German 'lg' convention",
  );
  assert.ok(
    fullText.includes("0.693147") && fullText.includes("0.301030"),
    "Logarithms node must contrast ln(2) approx 0.693147 with log10(2) approx 0.301030",
  );

  // Product-to-sum relation check
  assert.ok(
    fullText.includes("ln(A * B) = ln(A) + ln(B)") || fullText.includes("W_1 \\cdot W_2"),
    "Logarithms node must include product-to-sum rule",
  );

  writeCalculusLog({
    testId: "logarithms-lg-note-and-product-to-sum",
    foundationId: "logarithms",
    callingAnchor: "light-quanta:s5",
    expected: "1905 'lg' note and product-to-sum entropy derivation",
    actual: "present and detailed",
    outcome: "passed",
    message: "Verified logarithms node carries 1905 'lg' note and product-to-sum derivation",
  });
});

test("foundCalculus.records: compiler builds all content including calculus foundations cleanly with 0 errors", async () => {
  const files = await loadReadingFiles();
  const result = compileReadingContent(files);
  const errors = result.diagnostics.filter((d) => d.severity === "error");
  assert.equal(errors.length, 0, `Compiler errors found: ${JSON.stringify(errors)}`);

  const foundIds = new Set(result.foundations.map((f) => f.id));
  for (const id of CALCULUS_FOUNDATION_IDS) {
    assert.equal(foundIds.has(id), true, `Foundation ${id} must be in compiled output`);
  }

  writeCalculusLog({
    testId: "compiler-calculus-clean-build",
    expected: "0 compiler errors, 5 calculus foundations in output",
    actual: `0 errors, all 5 found: ${CALCULUS_FOUNDATION_IDS.join(", ")}`,
    outcome: "passed",
    message: "Compiled all reading content cleanly with 0 diagnostics errors",
  });
});
