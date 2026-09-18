import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import {
  validateDerivedStatus,
  validateGloss,
  validateInlineMathematics,
  validateReviewStates,
} from "../../content/editions/alignment.ts";
import { getLogger } from "../log/logger.ts";

const logger = getLogger("editions");
const BEAD = "am-edn-alignment-tooling-do1";

describe("review independence guards: editor-same-as-author and gloss-editor-same-as-author", () => {
  test("PLANTED: translation unit in corrected state where editor equals translator refuses with editor-same-as-author", () => {
    const issues = validateReviewStates([
      {
        id: "s1-p1-s1",
        reviewState: "corrected",
        translator: { id: "alice", kind: "human" },
        editor: { id: "alice", kind: "human" },
      },
    ]);
    const issue = issues.find((i) => i.code === "editor-same-as-author");
    expect(issue).toBeDefined();
    expect(issue?.targetId).toBe("s1-p1-s1");
    expect(issue?.message).toContain('editor "alice" cannot equal translator id');
  });

  test("translation unit in corrected state with independent editor passes review validation", () => {
    const issues = validateReviewStates([
      {
        id: "s1-p1-s1",
        reviewState: "corrected",
        translator: { id: "alice", kind: "human" },
        editor: { id: "bob", kind: "human" },
      },
    ]);
    expect(issues.filter((i) => i.code === "editor-same-as-author")).toHaveLength(0);
  });

  test("PLANTED: gloss unit where editor equals attribution author refuses with gloss-editor-same-as-author", () => {
    const text = "Die Brownsche Bewegung";
    const digest = createHash("sha256").update(text, "utf8").digest("hex");
    const issues = validateGloss({
      glossUnits: [
        {
          sentenceId: "s1-p1-s1",
          sourceTextDigest: digest,
          attribution: { id: "alice", kind: "human" },
          editor: { id: "alice", kind: "human" },
          glosses: [
            { tokenIndex: 0, text: "The" },
            { tokenIndex: 1, text: "Brownian" },
            { tokenIndex: 2, text: "motion" },
          ],
        },
      ],
      alignableUnits: [{ id: "s1-p1-s1", text, digest }],
    });
    const issue = issues.find((i) => i.code === "gloss-editor-same-as-author");
    expect(issue).toBeDefined();
    expect(issue?.sourceId).toBe("s1-p1-s1");
    expect(issue?.message).toContain('editor "alice" must differ from author "alice"');
  });

  test("gloss unit with independent editor passes authorship validation", () => {
    const text = "Die Brownsche Bewegung";
    const digest = createHash("sha256").update(text, "utf8").digest("hex");
    const issues = validateGloss({
      glossUnits: [
        {
          sentenceId: "s1-p1-s1",
          sourceTextDigest: digest,
          attribution: { id: "alice", kind: "human" },
          editor: { id: "bob", kind: "human" },
          glosses: [
            { tokenIndex: 0, text: "The" },
            { tokenIndex: 1, text: "Brownian" },
            { tokenIndex: 2, text: "motion" },
          ],
        },
      ],
      alignableUnits: [{ id: "s1-p1-s1", text, digest }],
    });
    expect(issues.filter((i) => i.code === "gloss-editor-same-as-author")).toHaveLength(0);
  });
});

describe("publication confidence guards: unit-not-reviewed and status-disagrees-with-records", () => {
  test("PLANTED: --require-reviewed refuses unreviewed unit with unit-not-reviewed", () => {
    const issues = validateReviewStates(
      [
        {
          id: "s1-p1-s1",
          reviewState: "machine-draft",
          translator: { id: "claude", kind: "model", modelId: "claude-3-5-sonnet" },
        },
      ],
      { requireReviewed: true },
    );
    const issue = issues.find((i) => i.code === "unit-not-reviewed");
    expect(issue).toBeDefined();
    expect(issue?.targetId).toBe("s1-p1-s1");
    expect(issue?.message).toContain(
      'Unit "s1-p1-s1" is in state "machine-draft", but --require-reviewed requires reviewed',
    );
  });

  test("unit without --require-reviewed flag passes with draft reviewState", () => {
    const issues = validateReviewStates(
      [
        {
          id: "s1-p1-s1",
          reviewState: "machine-draft",
          translator: { id: "claude", kind: "model", modelId: "claude-3-5-sonnet" },
        },
      ],
      { requireReviewed: false },
    );
    expect(issues.filter((i) => i.code === "unit-not-reviewed")).toHaveLength(0);
  });

  test("PLANTED: declared status disagreeing with derived status refuses with status-disagrees-with-records", () => {
    const declared = { transcription: "reviewed", translation: "draft" };
    const derived = { transcription: "draft", translation: "draft" };
    const issues = validateDerivedStatus(declared, derived);
    const issue = issues.find((i) => i.code === "status-disagrees-with-records");
    expect(issue).toBeDefined();
    expect(issue?.message).toContain(
      'Declared status for "transcription" ("reviewed") disagrees with derived status ("draft")',
    );
  });

  test("declared status matching derived status passes validation", () => {
    const declared = { transcription: "draft", translation: "draft" };
    const derived = { transcription: "draft", translation: "draft" };
    const issues = validateDerivedStatus(declared, derived);
    expect(issues).toHaveLength(0);
  });
});

describe("staleness guard: gloss-stale evaluated by digest comparison", () => {
  test("PLANTED: gloss unit whose sourceTextDigest differs from alignable text digest refuses with gloss-stale without calling tokenizer", () => {
    const text = "Die Brownsche Bewegung";
    const currentDigest = createHash("sha256").update(text, "utf8").digest("hex");
    const staleDigest = "deadbeef12345678deadbeef12345678deadbeef12345678deadbeef12345678";
    let tokenizerCalled = false;
    const throwingTokenizer = () => {
      tokenizerCalled = true;
      throw new Error(
        "Tokenizer was invoked on stale unit! Staleness must be evaluated by digest comparison only.",
      );
    };

    const issues = validateGloss({
      glossUnits: [
        {
          sentenceId: "s1-p1-s1",
          sourceTextDigest: staleDigest,
          attribution: { id: "alice", kind: "human" },
          editor: { id: "bob", kind: "human" },
        },
      ],
      alignableUnits: [{ id: "s1-p1-s1", text, digest: currentDigest }],
      tokenizer: throwingTokenizer,
    });

    expect(tokenizerCalled).toBe(false);
    const issue = issues.find((i) => i.code === "gloss-stale");
    expect(issue).toBeDefined();
    expect(issue?.sourceId).toBe("s1-p1-s1");
    expect(issue?.message).toContain('Gloss unit for "s1-p1-s1" is stale');
  });

  test("gloss unit with current sourceTextDigest passes staleness check", () => {
    const text = "Die Brownsche Bewegung";
    const currentDigest = createHash("sha256").update(text, "utf8").digest("hex");
    const issues = validateGloss({
      glossUnits: [
        {
          sentenceId: "s1-p1-s1",
          sourceTextDigest: currentDigest,
          attribution: { id: "alice", kind: "human" },
          editor: { id: "bob", kind: "human" },
          glosses: [
            { tokenIndex: 0, text: "The" },
            { tokenIndex: 1, text: "Brownian" },
            { tokenIndex: 2, text: "motion" },
          ],
        },
      ],
      alignableUnits: [{ id: "s1-p1-s1", text, digest: currentDigest }],
    });
    expect(issues.filter((i) => i.code === "gloss-stale")).toHaveLength(0);
  });
});

describe("component fidelity guards: math-order-differs, reference-atoms-differ, footnote-marks-differ", () => {
  test("PLANTED: reordered math atoms in alignment component emit warning math-order-differs", () => {
    const components = [
      {
        germanUnits: [{ id: "s1-p1-s1", mathAtoms: ["A", "B"] }],
        englishUnits: [
          { id: "s1-p1-s1a", mathAtoms: ["B"] },
          { id: "s1-p1-s1b", mathAtoms: ["A"] },
        ],
      },
    ];
    const issues = validateInlineMathematics(components);
    const warning = issues.find((i) => i.code === "math-order-differs");
    expect(warning).toBeDefined();
    expect(issues.some((i) => i.code === "math-atoms-differ")).toBe(false);
  });

  test("math atoms with identical order and counts pass without order warning", () => {
    const components = [
      {
        germanUnits: [{ id: "s1-p1-s1", mathAtoms: ["A", "B"] }],
        englishUnits: [
          { id: "s1-p1-s1a", mathAtoms: ["A"] },
          { id: "s1-p1-s1b", mathAtoms: ["B"] },
        ],
      },
    ];
    const issues = validateInlineMathematics(components);
    expect(issues.filter((i) => i.code === "math-order-differs")).toHaveLength(0);
  });

  test("PLANTED: English unit missing German referenceId refuses with reference-atoms-differ", () => {
    const components = [
      {
        germanUnits: [{ id: "s1-p1-s1", referenceIds: ["ref-pais-1982"] }],
        englishUnits: [{ id: "s1-p1-s1", referenceIds: [] }],
      },
    ];
    const issues = validateInlineMathematics(components);
    const issue = issues.find((i) => i.code === "reference-atoms-differ");
    expect(issue).toBeDefined();
    expect(issue?.message).toContain("Reference inline targets differ");
    expect(issue?.message).toContain("ref-pais-1982");
  });

  test("matching referenceIds in alignment component pass validation", () => {
    const components = [
      {
        germanUnits: [{ id: "s1-p1-s1", referenceIds: ["ref-pais-1982"] }],
        englishUnits: [{ id: "s1-p1-s1", referenceIds: ["ref-pais-1982"] }],
      },
    ];
    const issues = validateInlineMathematics(components);
    expect(issues.filter((i) => i.code === "reference-atoms-differ")).toHaveLength(0);
  });

  test("PLANTED: English unit missing German footnote mark refuses with footnote-marks-differ", () => {
    const components = [
      {
        germanUnits: [{ id: "s1-p1-s1", footnoteMarks: ["1"] }],
        englishUnits: [{ id: "s1-p1-s1", footnoteMarks: [] }],
      },
    ];
    const issues = validateInlineMathematics(components);
    const issue = issues.find((i) => i.code === "footnote-marks-differ");
    expect(issue).toBeDefined();
    expect(issue?.message).toContain("Footnote mark atoms differ between German and English");
  });

  test("matching footnoteMarks in alignment component pass validation", () => {
    const components = [
      {
        germanUnits: [{ id: "s1-p1-s1", footnoteMarks: ["1"] }],
        englishUnits: [{ id: "s1-p1-s1", footnoteMarks: ["1"] }],
      },
    ];
    const issues = validateInlineMathematics(components);
    expect(issues.filter((i) => i.code === "footnote-marks-differ")).toHaveLength(0);
  });
});
