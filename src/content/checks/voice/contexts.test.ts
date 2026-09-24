import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveVoiceContext } from "./contexts.ts";
import { checkVoice } from "./index.ts";

/**
 * The first tests this function has had (am-9yw6). resolveVoiceContext decides which severity
 * every rule applies to every scanned string, and it had no test of any kind, so both defects
 * below sat in it unobserved: one live, one latent.
 */
describe("resolveVoiceContext: record kind and field path decide the severity", () => {
  // The recap of content/arguments/light-quanta/arg-lq-independent-configurations.json, verbatim.
  // This exact string was a verify-content ERROR: the field path contains "recap", which mapped
  // it to reader-progress, the one context besides task-feedback and ui-label where the theater
  // rule is an error rather than a flag. It is the argument's one-sentence summary, and
  // "uniformly distributed points" is the mathematical noun, not gamification vocabulary.
  const SCHOLARLY_RECAP =
    "For n independent uniformly distributed points, the chance that all lie in a fraction f " +
    "of a volume is fⁿ. Perfectly locked positions instead give f; the exponent is a " +
    "statement about independence.";

  it("am-9yw6: an argument's scholarly recap is not judged as progress copy", () => {
    assert.equal(resolveVoiceContext("argument", "recap"), "prose");

    // WHAT CHANGED HERE AND WHAT DID NOT. The invariant this bead paid for is that the CONTEXT
    // decides how a string is judged, and it is intact. What broke was the scaffolding: the old
    // body asserted `theater.length === 1` in order to reach into that finding and check its
    // severity, and so it pinned an incidental fact - that "points" is theater vocabulary in
    // prose at all. Its own comment deferred that question: "the theater rule still reports the
    // word - that question belongs to am-xsue and is untouched here". am-xsue was then answered,
    // in f7a0a849 under am-gzxs: "points" is now gated on a scoring construction, so in prose the
    // mathematical noun reports nothing, which is exactly what the comment above SCHOLARLY_RECAP
    // says it deserves.
    //
    // So the assertion is rewritten to state the invariant directly, by contrasting the two
    // contexts on ONE string rather than inspecting one finding in one context. That is stronger
    // than what it replaces, and it no longer depends on which words another rule treats as
    // vocabulary.
    //
    // Dispatch 148 moved the contrast off this string. It used to assert that the same recap on
    // a progress readout WAS gamification, because a scoring context fired on every bare
    // "points". That was the misfire: the points are Einstein's, and the theater rule now asks
    // whether an occurrence is a score, so this sentence is quiet in every context. The contrast
    // between contexts is kept, on mark vocabulary, which prose exempts and progress copy does
    // not.
    const recapTheater = (context: Parameters<typeof checkVoice>[1]["context"]) =>
      checkVoice(SCHOLARLY_RECAP, { context }).filter((f) => f.rule === "theater");
    assert.deepEqual(
      recapTheater(resolveVoiceContext("argument", "recap")),
      [],
      "an argument's recap is prose, and 'uniformly distributed points' is the mathematical noun",
    );
    assert.deepEqual(
      recapTheater("reader-progress"),
      [],
      "the mathematical noun is not a score on any surface",
    );

    const MARKED = "Correct: 3 of 5 predictions.";
    const markedTheater = (context: Parameters<typeof checkVoice>[1]["context"]) =>
      checkVoice(MARKED, { context }).filter((f) => f.rule === "theater");
    assert.deepEqual(markedTheater(resolveVoiceContext("argument", "recap")), []);
    assert.ok(
      markedTheater(resolveVoiceContext("notebook", "recap")).some((f) => f.severity === "error"),
      "the same words on a progress readout are a mark, or the contrast proves nothing",
    );
  });

  it("am-9yw6 planted negative: a recap that IS progress copy still errors", () => {
    // Without this the fix would be indistinguishable from deleting the reader-progress branch.
    // Every recap in the corpus today belongs to an argument record, so the branch protects the
    // interrupted-reader card of am-read-notebook-tde, which does not exist yet.
    for (const kind of [undefined, "tour", "notebook"]) {
      assert.equal(
        resolveVoiceContext(kind, "recap"),
        "reader-progress",
        `a recap on ${String(kind)} is still progress copy`,
      );
    }
    const context = resolveVoiceContext("notebook", "recap");
    const findings = checkVoice("You earned 30 points and a 5 day streak.", { context });
    assert.equal(
      findings.filter((f) => f.rule === "theater" && f.severity === "error").length > 0,
      true,
    );
  });

  it("am-9yw6: a branch matches a WORD of the path, so 'variant' is not an aria label", () => {
    // v-ARIA-nt. Substring matching classified every one of these as an accessible name, and in
    // a critical edition of the relativity paper they are ordinary vocabulary. Experiment already
    // declares invariants[].description, which holds prose.
    for (const field of [
      "entries[0].glyph.variant",
      "modernOnlySymbols[3].glyph.variant",
      "invariants[0].description",
      "expectedInvariants[2]",
      "variance",
      "covariantForm",
    ]) {
      assert.equal(resolveVoiceContext(undefined, field), "prose", `${field} is not a ui-label`);
    }
  });

  it("am-9yw6 planted negative: the aria branch itself still fires", () => {
    // Without this, the word-matching change would be indistinguishable from deleting "aria".
    for (const field of ["aria-label", "ariaLabel", "aria", "controls[0].aria-description"]) {
      assert.equal(resolveVoiceContext(undefined, field), "ui-label", `${field} is a ui-label`);
    }
  });

  it("am-9yw6: every other branch still resolves", () => {
    const cases: readonly [string | undefined, string, string][] = [
      [undefined, "predictMode.prompts[0].feedback", "task-feedback"],
      [undefined, "separatingAssumption", "task-feedback"],
      [undefined, "selfCheck", "task-feedback"],
      [undefined, "steps[1].hint", "task-feedback"],
      ["tour", "description", "reader-progress"],
      [undefined, "worksheet.intro", "reader-progress"],
      // Reader progress is tested before ui-label, so a progress label is progress copy.
      [undefined, "progress.label", "reader-progress"],
      ["journey-branch", "copy", "journey-branch"],
      [undefined, "forkBranch", "journey-branch"],
      ["countermodel", "cells[0]", "countermodel-cell"],
      [undefined, "countermodelCell", "countermodel-cell"],
      ["independence-claim", "text", "independence-claim"],
      [undefined, "independenceReadout", "independence-claim"],
      [undefined, "title", "ui-label"],
      [undefined, "buttons[1].label", "ui-label"],
      [undefined, "heading", "ui-label"],
      [undefined, "caption.header", "ui-label"],
      [undefined, "readings.overview[0].text", "prose"],
    ];
    for (const [kind, field, want] of cases) {
      assert.equal(resolveVoiceContext(kind, field), want, `${String(kind)} / ${field}`);
    }
  });
});
