import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import {
  type AlignmentComponent,
  validateAlignmentSplits,
  validateDerivedStatus,
  validateDisplayByteIdentity,
  validateGloss,
  validateInlineMathematics,
  validateManyToManyAlignment,
  validateReviewStates,
  validateTerms,
} from "../../content/editions/alignment.ts";
import {
  registerReviewStateCheck,
  resetReviewStateCheck,
} from "../../content/editions/reviewState.ts";
import { spanTextDigest } from "../../content/schemas/spans.ts";
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

/**
 * The digest the gloss rule compares with is the project's, not one of its own.
 *
 * Both tests above supply `digest` explicitly and use "Die Brownsche Bewegung", which
 * has no umlaut, so neither reaches the fallback that computes the digest nor notices
 * how it computes it. The fallback used to be
 * createHash("sha256").update(alignable.text) - spanTextDigest without its NFC
 * normalization - and German is where that bites: an umlaut written as one code point
 * and the same umlaut written as letter-plus-combining-mark are the same text and hash
 * differently under the inline form. A gloss whose sourceTextDigest was stored with
 * spanTextDigest was then reported stale the moment its German arrived decomposed,
 * with nothing changed and no way for the editor to tell.
 */
describe("gloss staleness uses spanTextDigest, not a second digest of its own", () => {
  const SENTENCE_NFC = "Die Bewegung der Teilchen ist unregelmäßig und regellos.".normalize("NFC");
  const SENTENCE_NFD = SENTENCE_NFC.normalize("NFD");

  test("PLANTED: the same German sentence decomposed is not stale", () => {
    // The two strings are different sequences of code points and the same text.
    expect(SENTENCE_NFD).not.toBe(SENTENCE_NFC);
    expect(SENTENCE_NFD.normalize("NFC")).toBe(SENTENCE_NFC);

    const issues = validateGloss({
      glossUnits: [
        {
          sentenceId: "s1-p1-s1",
          // Stored the way every other digest in this tree is stored.
          sourceTextDigest: spanTextDigest(SENTENCE_NFC),
          attribution: { id: "alice", kind: "human" },
          editor: { id: "bob", kind: "human" },
        },
      ],
      // No `digest` supplied, so the rule computes one: the path the fixtures above
      // never take.
      alignableUnits: [{ id: "s1-p1-s1", text: SENTENCE_NFD }],
    });
    expect(issues.filter((i) => i.code === "gloss-stale")).toHaveLength(0);
  });

  test("a sentence whose words actually changed is still stale", () => {
    const edited = SENTENCE_NFC.replace("unregelmäßig", "regelmäßig");
    const issues = validateGloss({
      glossUnits: [
        {
          sentenceId: "s1-p1-s1",
          sourceTextDigest: spanTextDigest(SENTENCE_NFC),
          attribution: { id: "alice", kind: "human" },
          editor: { id: "bob", kind: "human" },
        },
      ],
      alignableUnits: [{ id: "s1-p1-s1", text: edited }],
    });
    // The fix must not turn the rule off: a real edit, one word negated, still refuses.
    expect(issues.filter((i) => i.code === "gloss-stale")).toHaveLength(1);
  });

  test("the rule's fallback digest is spanTextDigest's, byte for byte", () => {
    // Asserted through the rule's own verdict rather than by reimplementing it here:
    // a stored spanTextDigest of the exact text must not be stale when the rule
    // computes the comparison digest itself.
    const issues = validateGloss({
      glossUnits: [
        {
          sentenceId: "s1-p1-s1",
          sourceTextDigest: spanTextDigest(SENTENCE_NFC),
          attribution: { id: "alice", kind: "human" },
          editor: { id: "bob", kind: "human" },
        },
      ],
      alignableUnits: [{ id: "s1-p1-s1", text: SENTENCE_NFC }],
    });
    expect(issues.filter((i) => i.code === "gloss-stale")).toHaveLength(0);
  });
});

describe("display math byte identity guard: display-math-bytes-differ", () => {
  test("PLANTED: non-byte-identical display math refuses with display-math-bytes-differ", () => {
    const issue = validateDisplayByteIdentity("$$ E = mc^2 $$", "$$ E = mc^2  $$");
    expect(issue).not.toBeNull();
    expect(issue?.code).toBe("display-math-bytes-differ");
    expect(issue?.message).toContain("English display is not byte-identical to the German display");
  });

  test("byte-identical display math passes validateDisplayByteIdentity without display-math-bytes-differ", () => {
    const issue = validateDisplayByteIdentity("$$ E = mc^2 $$", "$$ E = mc^2 $$");
    expect(issue).toBeNull();
  });
});

describe("component fidelity guards: math-order-differs, reference-atoms-differ, footnote-marks-differ", () => {
  test("PLANTED: inline math atoms differing between German and English emit math-atoms-differ at component check", () => {
    const components: readonly AlignmentComponent[] = [
      {
        germanUnits: [{ id: "s1-p1-s1", mathAtoms: ["V"] }],
        englishUnits: [{ id: "s1-p1-s1", mathAtoms: ["c"] }],
      },
    ];
    const issues = validateInlineMathematics(components);
    const issue = issues.find((i) => i.code === "math-atoms-differ");
    expect(issue).toBeDefined();
    expect(issue?.message).toContain(
      "Inline math atoms differ: missing in English: [V]; extra in English: [c]",
    );
  });

  test("matching inline math atoms pass component check without math-atoms-differ", () => {
    const components: readonly AlignmentComponent[] = [
      {
        germanUnits: [{ id: "s1-p1-s1", mathAtoms: ["V"] }],
        englishUnits: [{ id: "s1-p1-s1", mathAtoms: ["V"] }],
      },
    ];
    const issues = validateInlineMathematics(components);
    expect(issues.filter((i) => i.code === "math-atoms-differ")).toHaveLength(0);
  });

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

describe("alignment coverage and edge structure guards: empty-alignment, missing-target-id, unknown-source, unknown-target", () => {
  test("PLANTED: empty alignment edges list refuses with empty-alignment", () => {
    const issues = validateManyToManyAlignment({
      edges: [],
      germanIds: ["s1-p1-s1"],
      englishIds: ["s1-p1-s1"],
    });
    const issue = issues.find((i) => i.code === "empty-alignment");
    expect(issue).toBeDefined();
    expect(issue?.message).toContain("Alignment has no edges");
  });

  test("non-empty alignment edges list passes empty-alignment check", () => {
    const issues = validateManyToManyAlignment({
      edges: [{ sourceId: "s1-p1-s1", targetId: "s1-p1-s1" }],
      germanIds: ["s1-p1-s1"],
      englishIds: ["s1-p1-s1"],
    });
    expect(issues.filter((i) => i.code === "empty-alignment")).toHaveLength(0);
  });

  test("PLANTED: edge targeting an invalid English translation unit ID refuses with missing-target-id", () => {
    const issues = validateManyToManyAlignment({
      edges: [{ sourceId: "s1-p1-s1", targetId: "not-a-valid-id!!!" }],
      germanIds: ["s1-p1-s1"],
      englishIds: ["s1-p1-s1"],
    });
    const issue = issues.find((i) => i.code === "missing-target-id");
    expect(issue).toBeDefined();
    expect(issue?.targetId).toBe("not-a-valid-id!!!");
  });

  test("edge targeting a valid permanent English translation unit ID passes target id check", () => {
    const issues = validateManyToManyAlignment({
      edges: [{ sourceId: "s1-p1-s1", targetId: "s1-p1-s1" }],
      germanIds: ["s1-p1-s1"],
      englishIds: ["s1-p1-s1"],
    });
    expect(issues.filter((i) => i.code === "missing-target-id")).toHaveLength(0);
  });

  test("PLANTED: edge whose source is not a permanent German alignable ID refuses with missing-source-id", () => {
    const issues = validateManyToManyAlignment({
      edges: [{ sourceId: "not-a-valid-german-id!!!", targetId: "s1-p1-s1" }],
      germanIds: ["s1-p1-s1"],
      englishIds: ["s1-p1-s1"],
    });
    const issue = issues.find((i) => i.code === "missing-source-id");
    expect(issue).toBeDefined();
    expect(issue?.sourceId).toBe("not-a-valid-german-id!!!");
  });

  test("edge with a valid permanent German source ID passes source id check", () => {
    const issues = validateManyToManyAlignment({
      edges: [{ sourceId: "s1-p1-s1", targetId: "s1-p1-s1" }],
      germanIds: ["s1-p1-s1"],
      englishIds: ["s1-p1-s1"],
    });
    expect(issues.filter((i) => i.code === "missing-source-id")).toHaveLength(0);
  });

  test("PLANTED: edge whose source is not in the German id set refuses with unknown-source", () => {
    const issues = validateManyToManyAlignment({
      edges: [{ sourceId: "s2-p1-s1", targetId: "s1-p1-s1" }],
      germanIds: ["s1-p1-s1"],
      englishIds: ["s1-p1-s1"],
    });
    const issue = issues.find((i) => i.code === "unknown-source");
    expect(issue).toBeDefined();
    expect(issue?.sourceId).toBe("s2-p1-s1");
    expect(issue?.message).toContain('Alignment source "s2-p1-s1" is not in the German id set');
  });

  test("edge whose source is in the German id set passes unknown-source check", () => {
    const issues = validateManyToManyAlignment({
      edges: [{ sourceId: "s1-p1-s1", targetId: "s1-p1-s1" }],
      germanIds: ["s1-p1-s1"],
      englishIds: ["s1-p1-s1"],
    });
    expect(issues.filter((i) => i.code === "unknown-source")).toHaveLength(0);
  });

  test("PLANTED: edge whose target is not in the English id set refuses with unknown-target", () => {
    const issues = validateManyToManyAlignment({
      edges: [{ sourceId: "s1-p1-s1", targetId: "s2-p1-s1" }],
      germanIds: ["s1-p1-s1"],
      englishIds: ["s1-p1-s1"],
    });
    const issue = issues.find((i) => i.code === "unknown-target");
    expect(issue).toBeDefined();
    expect(issue?.targetId).toBe("s2-p1-s1");
    expect(issue?.message).toContain('Alignment target "s2-p1-s1" is not in the English id set');
  });

  test("edge whose target is in the English id set passes unknown-target check", () => {
    const issues = validateManyToManyAlignment({
      edges: [{ sourceId: "s1-p1-s1", targetId: "s1-p1-s1" }],
      germanIds: ["s1-p1-s1"],
      englishIds: ["s1-p1-s1"],
    });
    expect(issues.filter((i) => i.code === "unknown-target")).toHaveLength(0);
  });
});

describe("alignment split guards: missing-split-sibling and invalid-split-suffix", () => {
  test("PLANTED: lone suffixed translation unit without sibling refuses with missing-split-sibling", () => {
    const issues = validateAlignmentSplits(["s3-p2-s1a"]);
    const issue = issues.find((i) => i.code === "missing-split-sibling");
    expect(issue).toBeDefined();
    expect(issue?.targetId).toBe("s3-p2-s1a");
    expect(issue?.message).toContain("has no sibling split unit");
  });

  test("split translation units with siblings (a and b) pass sibling check", () => {
    const issues = validateAlignmentSplits(["s3-p2-s1a", "s3-p2-s1b"]);
    expect(issues.filter((i) => i.code === "missing-split-sibling")).toHaveLength(0);
  });

  test("PLANTED: split suffixes not starting with 'a' refuse with invalid-split-suffix", () => {
    const issues = validateAlignmentSplits(["s3-p2-s1b", "s3-p2-s1c"]);
    const issue = issues.find((i) => i.code === "invalid-split-suffix");
    expect(issue).toBeDefined();
    expect(issue?.message).toContain('must start with suffix "a"');
  });

  test("PLANTED: unsuffixed base unit colliding with suffixed splits refuses with invalid-split-suffix", () => {
    const issues = validateAlignmentSplits(["s3-p2-s1", "s3-p2-s1a", "s3-p2-s1b"]);
    const issue = issues.find(
      (i) => i.code === "invalid-split-suffix" && i.targetId === "s3-p2-s1",
    );
    expect(issue).toBeDefined();
    expect(issue?.message).toContain("exists beside suffixed splits");
  });

  test("split suffixes starting with 'a' and consecutive pass suffix check", () => {
    const issues = validateAlignmentSplits(["s3-p2-s1a", "s3-p2-s1b"]);
    expect(issues.filter((i) => i.code === "invalid-split-suffix")).toHaveLength(0);
  });
});

describe("terminology guards: term-definition-too-short, term-missing-german-lang, term-missing-english-lang, term-not-occurrence-specific", () => {
  test("PLANTED: term definition of 80 characters or fewer refuses with term-definition-too-short", () => {
    const issues = validateTerms([
      {
        id: "s1-p1-s1",
        termId: "diffusion",
        termText: "Diffusion",
        definition: "A concise definition that is too short.",
        termLang: "de",
        definitionLang: "en",
        isOccurrenceSpecific: true,
      },
    ]);
    const issue = issues.find((i) => i.code === "term-definition-too-short");
    expect(issue).toBeDefined();
    expect(issue?.sourceId).toBe("s1-p1-s1");
    expect(issue?.message).toContain("is <= 80 characters");
  });

  test("term definition longer than 80 characters passes definition length check", () => {
    const longDef =
      "Diffusion is the net movement of particles from a region of higher concentration to a region of lower concentration as a result of their random motion.";
    const issues = validateTerms([
      {
        id: "s1-p1-s1",
        termId: "diffusion",
        termText: "Diffusion",
        definition: longDef,
        termLang: "de",
        definitionLang: "en",
        isOccurrenceSpecific: true,
      },
    ]);
    expect(issues.filter((i) => i.code === "term-definition-too-short")).toHaveLength(0);
  });

  test("PLANTED: term German text missing lang 'de' refuses with term-missing-german-lang", () => {
    const longDef =
      "Diffusion is the net movement of particles from a region of higher concentration to a region of lower concentration as a result of their random motion.";
    const issues = validateTerms([
      {
        id: "s1-p1-s1",
        termId: "diffusion",
        termText: "Diffusion",
        definition: longDef,
        termLang: "en",
        definitionLang: "en",
        isOccurrenceSpecific: true,
      },
    ]);
    const issue = issues.find((i) => i.code === "term-missing-german-lang");
    expect(issue).toBeDefined();
    expect(issue?.message).toContain('German text must carry lang: "de"');
  });

  test("term German text with lang 'de' passes German lang check", () => {
    const longDef =
      "Diffusion is the net movement of particles from a region of higher concentration to a region of lower concentration as a result of their random motion.";
    const issues = validateTerms([
      {
        id: "s1-p1-s1",
        termId: "diffusion",
        termText: "Diffusion",
        definition: longDef,
        termLang: "de",
        definitionLang: "en",
        isOccurrenceSpecific: true,
      },
    ]);
    expect(issues.filter((i) => i.code === "term-missing-german-lang")).toHaveLength(0);
  });

  test("PLANTED: term definition missing lang 'en' refuses with term-missing-english-lang", () => {
    const longDef =
      "Diffusion ist die thermisch getriebene zufällige Bewegung von Molekülen von Bereichen höherer zu Bereichen niedrigerer Konzentration.";
    const issues = validateTerms([
      {
        id: "s1-p1-s1",
        termId: "diffusion",
        termText: "Diffusion",
        definition: longDef,
        termLang: "de",
        definitionLang: "de",
        isOccurrenceSpecific: true,
      },
    ]);
    const issue = issues.find((i) => i.code === "term-missing-english-lang");
    expect(issue).toBeDefined();
    expect(issue?.message).toContain('definition must carry lang: "en"');
  });

  test("term definition with lang 'en' passes English lang check", () => {
    const longDef =
      "Diffusion is the net movement of particles from a region of higher concentration to a region of lower concentration as a result of their random motion.";
    const issues = validateTerms([
      {
        id: "s1-p1-s1",
        termId: "diffusion",
        termText: "Diffusion",
        definition: longDef,
        termLang: "de",
        definitionLang: "en",
        isOccurrenceSpecific: true,
      },
    ]);
    expect(issues.filter((i) => i.code === "term-missing-english-lang")).toHaveLength(0);
  });

  test("PLANTED: term definition marked not occurrence-specific refuses with term-not-occurrence-specific", () => {
    const longDef =
      "Diffusion is the net movement of particles from a region of higher concentration to a region of lower concentration as a result of their random motion.";
    const issues = validateTerms([
      {
        id: "s1-p1-s1",
        termId: "diffusion",
        termText: "Diffusion",
        definition: longDef,
        termLang: "de",
        definitionLang: "en",
        isOccurrenceSpecific: false,
      },
    ]);
    const issue = issues.find((i) => i.code === "term-not-occurrence-specific");
    expect(issue).toBeDefined();
    expect(issue?.message).toContain("shared across occurrences without an occurrence record");
  });

  test("term definition marked occurrence-specific passes validation", () => {
    const longDef =
      "Diffusion is the net movement of particles from a region of higher concentration to a region of lower concentration as a result of their random motion.";
    const issues = validateTerms([
      {
        id: "s1-p1-s1",
        termId: "diffusion",
        termText: "Diffusion",
        definition: longDef,
        termLang: "de",
        definitionLang: "en",
        isOccurrenceSpecific: true,
      },
    ]);
    expect(issues.filter((i) => i.code === "term-not-occurrence-specific")).toHaveLength(0);
  });
});

describe("gloss validation guards: gloss-target-not-alignable, gloss-unit-unknown, gloss-missing-token, gloss-token-collision", () => {
  test("PLANTED: gloss addressing a paragraph block id refuses with gloss-target-not-alignable at block-syntax check", () => {
    const text = "Die Brownsche Bewegung";
    const digest = createHash("sha256").update(text, "utf8").digest("hex");
    const issues = validateGloss({
      glossUnits: [
        {
          sentenceId: "s0-p1", // paragraph block id, not alignable unit
          sourceTextDigest: digest,
          attribution: { id: "alice", kind: "human" },
          editor: { id: "bob", kind: "human" },
        },
      ],
      alignableUnits: [{ id: "s0-p1-s1", text, digest }],
    });
    const issue = issues.find((i) => i.code === "gloss-target-not-alignable");
    expect(issue).toBeDefined();
    expect(issue?.sourceId).toBe("s0-p1");
    expect(issue?.message).toContain("not an alignable unit");
  });

  test("PLANTED: gloss addressing an unknown alignable unit id refuses with gloss-unit-unknown at lookup check", () => {
    const text = "Die Brownsche Bewegung";
    const digest = createHash("sha256").update(text, "utf8").digest("hex");
    const issues = validateGloss({
      glossUnits: [
        {
          sentenceId: "s1-p1-s99", // valid sentence ID syntax, but not in alignableUnits
          sourceTextDigest: digest,
          attribution: { id: "alice", kind: "human" },
          editor: { id: "bob", kind: "human" },
        },
      ],
      alignableUnits: [{ id: "s1-p1-s1", text, digest }],
    });
    const issue = issues.find((i) => i.code === "gloss-unit-unknown");
    expect(issue).toBeDefined();
    expect(issue?.sourceId).toBe("s1-p1-s99");
    expect(issue?.message).toContain('Gloss unit references unknown alignable unit "s1-p1-s99"');
  });

  test("gloss addressing a valid sentence id passes gloss unit address check", () => {
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
    expect(issues.filter((i) => i.code === "gloss-target-not-alignable")).toHaveLength(0);
    expect(issues.filter((i) => i.code === "gloss-unit-unknown")).toHaveLength(0);
  });

  test("PLANTED: gloss unit missing coverage for a word token refuses with gloss-missing-token", () => {
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
            // token 2 ("Bewegung") missing
          ],
        },
      ],
      alignableUnits: [{ id: "s1-p1-s1", text, digest }],
    });
    const issue = issues.find((i) => i.code === "gloss-missing-token");
    expect(issue).toBeDefined();
    expect(issue?.sourceId).toBe("s1-p1-s1");
    expect(issue?.message).toContain('missing gloss for token at index 2 ("Bewegung")');
  });

  test("gloss unit covering all word tokens passes token coverage check", () => {
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
    expect(issues.filter((i) => i.code === "gloss-missing-token")).toHaveLength(0);
  });

  test("PLANTED: gloss token index belonging to multiple multiwords or glosses refuses with gloss-token-collision", () => {
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
          ],
          multiwords: [{ tokenIndices: [1, 2], text: "Brownian motion" }], // token index 1 collides!
        },
      ],
      alignableUnits: [{ id: "s1-p1-s1", text, digest }],
    });
    const issue = issues.find((i) => i.code === "gloss-token-collision");
    expect(issue).toBeDefined();
    expect(issue?.sourceId).toBe("s1-p1-s1");
    expect(issue?.message).toContain(
      'Gloss token index 1 in unit "s1-p1-s1" belongs to multiple gloss entries',
    );
  });

  test("disjoint token indices across glosses and multiwords pass collision check", () => {
    const text = "Die Brownsche Bewegung";
    const digest = createHash("sha256").update(text, "utf8").digest("hex");
    const issues = validateGloss({
      glossUnits: [
        {
          sentenceId: "s1-p1-s1",
          sourceTextDigest: digest,
          attribution: { id: "alice", kind: "human" },
          editor: { id: "bob", kind: "human" },
          glosses: [{ tokenIndex: 0, text: "The" }],
          multiwords: [{ tokenIndices: [1, 2], text: "Brownian motion" }],
        },
      ],
      alignableUnits: [{ id: "s1-p1-s1", text, digest }],
    });
    expect(issues.filter((i) => i.code === "gloss-token-collision")).toHaveLength(0);
  });
});

describe("model provenance and review record guards: model-missing-id, model-drafted-not-machine-draft, review-records-not-available", () => {
  test("PLANTED: model translator missing modelId refuses with model-missing-id", () => {
    const issues = validateReviewStates([
      {
        id: "s1-p1-s1",
        reviewState: "machine-draft",
        translator: { id: "gpt-4", kind: "model" }, // missing modelId
      },
    ]);
    const issue = issues.find((i) => i.code === "model-missing-id");
    expect(issue).toBeDefined();
    expect(issue?.targetId).toBe("s1-p1-s1");
    expect(issue?.message).toContain("missing required modelId");
  });

  test("model translator with modelId passes model id check", () => {
    const issues = validateReviewStates([
      {
        id: "s1-p1-s1",
        reviewState: "machine-draft",
        translator: { id: "gpt-4", kind: "model", modelId: "gpt-4-turbo" },
      },
    ]);
    expect(issues.filter((i) => i.code === "model-missing-id")).toHaveLength(0);
  });

  test("PLANTED: model translator in drafted state refuses with model-drafted-not-machine-draft", () => {
    const issues = validateReviewStates([
      {
        id: "s1-p1-s1",
        reviewState: "drafted", // must be machine-draft for model
        translator: { id: "gpt-4", kind: "model", modelId: "gpt-4-turbo" },
      },
    ]);
    const issue = issues.find((i) => i.code === "model-drafted-not-machine-draft");
    expect(issue).toBeDefined();
    expect(issue?.targetId).toBe("s1-p1-s1");
    expect(issue?.message).toContain("must be machine-draft, never drafted");
  });

  test("model translator in machine-draft state passes state check", () => {
    const issues = validateReviewStates([
      {
        id: "s1-p1-s1",
        reviewState: "machine-draft",
        translator: { id: "gpt-4", kind: "model", modelId: "gpt-4-turbo" },
      },
    ]);
    expect(issues.filter((i) => i.code === "model-drafted-not-machine-draft")).toHaveLength(0);
  });

  test("PLANTED: unit in reviewed state under default strict check refuses with review-records-not-available", () => {
    resetReviewStateCheck();
    const issues = validateReviewStates([
      {
        id: "s1-p1-s1",
        reviewState: "reviewed",
        translator: { id: "alice", kind: "human" },
        editor: { id: "bob", kind: "human" },
      },
    ]);
    const issue = issues.find((i) => i.code === "review-records-not-available");
    expect(issue).toBeDefined();
    expect(issue?.targetId).toBe("s1-p1-s1");
    expect(issue?.message).toContain("Review records are not available");
  });

  test("registered review check accepting a unit passes reviewed state", () => {
    registerReviewStateCheck((ctx) => {
      if (ctx.unitId === "s1-p1-s1") return { ok: true };
      return { ok: false, code: "review-records-not-available", message: "unregistered" };
    });
    try {
      const issues = validateReviewStates([
        {
          id: "s1-p1-s1",
          reviewState: "reviewed",
          translator: { id: "alice", kind: "human" },
          editor: { id: "bob", kind: "human" },
        },
      ]);
      expect(issues.filter((i) => i.code === "review-records-not-available")).toHaveLength(0);
    } finally {
      resetReviewStateCheck();
    }
  });
});
