import { expect, test } from "bun:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { load } from "js-yaml";
import { LQ05_DEFAULTS, LQ05_OUTPUTS } from "../../experiments/lq05/definition.ts";
import { createLq05Session } from "../../experiments/lq05/session.ts";
import type { AcceptedSnapshot } from "../../experiments/store/instanceStore.ts";
import { createWeaveEvaluator } from "../../experiments/weave/evaluate.ts";
import { checkPointerVoice } from "../../experiments/weave/pointerVoice.ts";
import { createSessionWeave, weaveOutputs } from "../../experiments/weave/sessionSource.ts";
import { validateWeavePredicate } from "../../experiments/weave/validate.ts";
import {
  LQ05_INDEPENDENT_READER_WEAVE,
  LQ05_LOCKED_READER_WEAVE,
  lq05ReaderWeave,
} from "./configurationPassages.ts";
import type { ReaderWeaveBinding } from "./SessionResultWeave.tsx";

const parameters = { ...LQ05_DEFAULTS, trials: 32 };

function flags(snapshot: AcceptedSnapshot, binding: ReaderWeaveBinding) {
  return createWeaveEvaluator(binding.predicates).evaluate({
    runId: snapshot.runId,
    snapshotVersion: snapshot.snapshotVersion,
    outputs: weaveOutputs(snapshot),
    refused: false,
  }).flags;
}

test("both dependence models use declared readings and actual §5 source sentences", () => {
  const manifest = load(
    readFileSync(new URL("../../../content/experiments/lq-05.yaml", import.meta.url), "utf8"),
  ) as { weavePredicates: string[] };
  for (const binding of [LQ05_INDEPENDENT_READER_WEAVE, LQ05_LOCKED_READER_WEAVE]) {
    const ids = new Set<string>();
    for (const passage of Object.values(binding.passages)) {
      const block = passage.sentenceId.replace(/-s\d+$/, "");
      const source = load(
        readFileSync(
          new URL(
            "../../../content/source-blocks/light-quanta/" + block + ".yaml",
            import.meta.url,
          ),
          "utf8",
        ),
      ) as { sentenceSpans: { id: string }[] };
      expect(source.sentenceSpans.some((span) => span.id === passage.sentenceId)).toBe(true);
      for (const span of source.sentenceSpans) ids.add(span.id);
    }
    for (const predicate of binding.predicates) {
      expect(manifest.weavePredicates).toContain(predicate.id);
      expect(
        validateWeavePredicate(predicate, {
          instrumentOutputIds: new Set(Object.keys(LQ05_OUTPUTS)),
          resolvableTargetIds: ids,
        }),
      ).toEqual(predicate);
      expect(checkPointerVoice(predicate)).toEqual([]);
      expect(predicate.meaning).toBe("quantity-compared");
    }
  }
});

test("removing independence switches the source comparison instead of certifying f to the n", () => {
  const session = createLq05Session("configuration-source-model", parameters);
  const independent = session.getSnapshot().accepted;
  expect(lq05ReaderWeave(independent)).toBe(LQ05_INDEPENDENT_READER_WEAVE);
  expect(weaveOutputs(independent).configurationProbability?.value).toBeCloseTo(1 / 16, 14);
  expect(
    Object.values(flags(independent, LQ05_INDEPENDENT_READER_WEAVE)).every((p) => p.lit),
  ).toBe(true);
  expect(session.apply({ ...parameters, locked: true }).kind).toBe("accepted");
  const locked = session.getSnapshot().accepted;
  expect(lq05ReaderWeave(locked)).toBe(LQ05_LOCKED_READER_WEAVE);
  expect(weaveOutputs(locked).configurationProbability?.value).toBe(0.5);
  const derived = flags(locked, LQ05_LOCKED_READER_WEAVE);
  expect(derived["lq05-s5-independent-probability"]).toBeUndefined();
  expect(derived["lq05-s5-locked-counterexample"]?.lit).toBe(true);
  expect(derived["lq05-s5-locked-counterexample"]?.pointerText).toContain("removes that premise");
  expect(lq05ReaderWeave(null)).toBeNull();
  expect(lq05ReaderWeave({ parameters: { locked: "true" } })).toBeNull();
});

test("rare-event zero samples and full-volume zero entropy remain distinct accepted comparisons", () => {
  const session = createLq05Session("configuration-source-limits", { ...parameters, n: 60 });
  const rare = session.getSnapshot().accepted;
  const outputs = weaveOutputs(rare);
  expect(outputs.configurationProbability?.value).toBeGreaterThan(0);
  expect(outputs.log10W?.value).toBeCloseTo(-18.06179973983887, 10);
  expect(outputs.successCount?.value).toBe(0);
  expect(Object.values(flags(rare, LQ05_INDEPENDENT_READER_WEAVE)).every((p) => p.lit)).toBe(true);
  expect(session.apply({ ...parameters, f: 1 }).kind).toBe("accepted");
  const full = session.getSnapshot().accepted;
  expect(weaveOutputs(full).deltaSOverKb?.value).toBe(0);
  expect(weaveOutputs(full).configurationProbability?.value).toBe(1);
  expect(
    flags(full, LQ05_INDEPENDENT_READER_WEAVE)["lq05-s5-entropy-volume-relation"]?.lit,
  ).toBe(true);
});

test("missing, duplicate and nonfinite outputs cannot light a source comparison", () => {
  const snapshot = createLq05Session("configuration-source-damage", parameters).getSnapshot().accepted;
  const target = snapshot.outputs.find((output) => output.quantityId === "lnW");
  assert.ok(target);
  for (const outputs of [
    snapshot.outputs.filter((output) => output !== target),
    [...snapshot.outputs, target],
    snapshot.outputs.map((output) =>
      output === target && output.status === "value" ? { ...output, value: Number.NaN } : output,
    ),
  ]) {
    const derived = flags({ ...snapshot, outputs }, LQ05_INDEPENDENT_READER_WEAVE);
    expect(derived["lq05-s5-independent-probability"]?.lit).toBe(false);
    expect(derived["lq05-s5-entropy-volume-relation"]?.lit).toBe(false);
    expect(derived["lq05-s5-motion-assumption-independence"]?.lit).toBe(true);
  }
});

test("refusal suppresses the previous source pointers and preserves its accepted sample", () => {
  const session = createLq05Session("configuration-source-refusal", parameters);
  const source = createSessionWeave(session, LQ05_INDEPENDENT_READER_WEAVE);
  const original = session.getSnapshot();
  expect(source.getSnapshot().kind).toBe("ready");
  expect(session.apply({ ...parameters, n: 0 }).kind).toBe("refused");
  expect(source.getSnapshot()).toEqual({ kind: "inactive", reason: "refused" });
  expect(session.getSnapshot().accepted).toBe(original.accepted);
  expect(session.getSnapshot().evaluation).toBe(original.evaluation);
});
