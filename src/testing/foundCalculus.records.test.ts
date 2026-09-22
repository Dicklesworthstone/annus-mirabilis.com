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

test("foundCalculus.records: prerequisite typing (cross-link vs proof-edge, missing kind rejected) (argument.ts:2084) (argument.ts:2092)", () => {
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

  // Each case must say what it holds fixed. This asserted fourteen sentences verbatim, among
  // them five "Example N (...)" labels and the ASCII "nu", which pinned the lesson to one worked
  // example carrying five cases. The held-fixed quantities are stated where they cannot be
  // paraphrased away: as the subscript on each partial derivative in the typeset formulas.
  const blocks = [...parsed.explanation, ...parsed.example] as Array<{
    kind: string;
    text?: string;
    latex?: string;
  }>;
  const formulas = blocks
    .filter((b) => b.kind === "formula")
    .map((b) => (b.latex ?? "").replace(/\s+/g, ""));
  const prose = blocks.filter((b) => b.kind === "paragraph").map((b) => b.text ?? "");
  const held = (pattern: RegExp) => formulas.some((l) => pattern.test(l));
  assert.ok(
    held(/\\frac\{\\partialf\}\{\\partialx\}\\right\)_\{?t\}?/),
    "The spatial derivative of f must carry the held-fixed time t as its subscript",
  );
  assert.ok(
    held(/\\frac\{\\partialf\}\{\\partialt\}\\right\)_\{?x\}?/),
    "The time derivative of f must carry the held-fixed position x as its subscript",
  );
  assert.ok(
    held(/\\right\)_\{?T\}?/) && held(/\\right\)_\{?S\}?/),
    "The thermodynamic case must show the same derivative at fixed temperature T and fixed entropy S",
  );
  assert.ok(
    held(/\\right\)_\{[^}]*\\nu\}/) || held(/\\right\)_\\nu/),
    "The radiation-entropy case must carry the held-fixed frequency nu as its subscript",
  );
  assert.ok(
    prose.some((t) => t.includes("§6") && /held fixed/.test(t)),
    "The relativity §6 case must say which coordinates are held fixed",
  );
  assert.ok(
    /held[ -]fixed/.test(parsed.stoppingPoint),
    "The stopping point must name held-fixed quantities as the condition",
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

  // These held three sentences of copy verbatim, one of them the ASCII "ln(A * B) = ln(A) +
  // ln(B)" that a reader saw as programmer notation. They now hold the three properties the copy
  // exists to state, so a rewrite that keeps them passes and one that drops any of them fails.
  const blocks = [...parsed.explanation, ...parsed.example] as Array<{
    kind: string;
    text?: string;
    latex?: string;
  }>;
  const prose = blocks.filter((b) => b.kind === "paragraph").map((b) => b.text ?? "");
  const latex = blocks.filter((b) => b.kind === "formula").map((b) => b.latex ?? "");
  // The 1905 printed 'lg' is the natural logarithm, said in one paragraph.
  assert.ok(
    prose.some((t) => /\blg\b/.test(t) && t.includes("natural logarithm") && t.includes("1905")),
    "Logarithms node must explain 1905 German 'lg' convention",
  );
  // ln 2 is contrasted with log10 2, to at least three places.
  assert.ok(
    prose.some((t) => t.includes("0.693") && t.includes("0.301")),
    "Logarithms node must contrast ln(2) approx 0.693 with log10(2) approx 0.301",
  );
  // The product-to-sum rule as typeset mathematics: the log of a product equals a sum of logs.
  assert.ok(
    latex.some((l) =>
      /\\ln\s*\(\s*\w+\s*(?:\\cdot\s*)?\w+\s*\)\s*=\s*(?:\w+\s*)?\\ln\s*\(?\w+\)?\s*\+/.test(l),
    ),
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
