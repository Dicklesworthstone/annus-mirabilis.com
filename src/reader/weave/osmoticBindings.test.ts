import { expect, test } from "bun:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { load } from "js-yaml";
import { BM03_DEFAULTS, BM03_OUTPUTS } from "../../experiments/bm03/definition.ts";
import { createBm03Session } from "../../experiments/bm03/session.ts";
import type { AcceptedSnapshot } from "../../experiments/store/instanceStore.ts";
import { createWeaveEvaluator } from "../../experiments/weave/evaluate.ts";
import { checkPointerVoice } from "../../experiments/weave/pointerVoice.ts";
import { createSessionWeave, weaveOutputs } from "../../experiments/weave/sessionSource.ts";
import { validateWeavePredicate } from "../../experiments/weave/validate.ts";
import {
  BM03_INDEPENDENT_READER_WEAVE,
  BM03_LOCKED_READER_WEAVE,
  bm03ReaderWeave,
} from "./osmoticPassages.ts";
import type { ReaderWeaveBinding } from "./SessionResultWeave.tsx";

function flags(snapshot: AcceptedSnapshot, binding: ReaderWeaveBinding) {
  return createWeaveEvaluator(binding.predicates).evaluate({
    runId: snapshot.runId,
    snapshotVersion: snapshot.snapshotVersion,
    outputs: weaveOutputs(snapshot),
    refused: false,
  }).flags;
}

test("BM03 source comparisons use registered outputs and actual §2 sentences", () => {
  const manifest = load(
    readFileSync(new URL("../../../content/experiments/bm-03.yaml", import.meta.url), "utf8"),
  ) as { weavePredicates: string[] };
  for (const binding of [BM03_INDEPENDENT_READER_WEAVE, BM03_LOCKED_READER_WEAVE]) {
    const targets = new Set<string>();
    for (const passage of Object.values(binding.passages)) {
      const block = passage.sentenceId.replace(/-s\d+$/, "");
      const source = load(
        readFileSync(
          new URL(`../../../content/source-blocks/brownian-motion/${block}.yaml`, import.meta.url),
          "utf8",
        ),
      ) as { sentenceSpans: { id: string }[] };
      expect(source.sentenceSpans.some((span) => span.id === passage.sentenceId)).toBe(true);
      for (const span of source.sentenceSpans) targets.add(span.id);
    }
    for (const predicate of binding.predicates) {
      expect(manifest.weavePredicates).toContain(predicate.id);
      expect(
        validateWeavePredicate(predicate, {
          instrumentOutputIds: new Set(Object.keys(BM03_OUTPUTS)),
          resolvableTargetIds: targets,
        }),
      ).toEqual(predicate);
      expect(checkPointerVoice(predicate)).toEqual([]);
    }
  }
});

test("independent and locked settings illuminate their own conditional comparisons", () => {
  const session = createBm03Session("osmotic-source-models");
  const independent = session.getSnapshot().accepted;
  expect(bm03ReaderWeave(independent)).toBe(BM03_INDEPENDENT_READER_WEAVE);
  expect(
    flags(independent, BM03_INDEPENDENT_READER_WEAVE)["bm03-s2-independent-pressure"]?.lit,
  ).toBe(true);
  expect(session.apply({ ...BM03_DEFAULTS, model: "locked-cluster" }).kind).toBe("accepted");
  const locked = session.getSnapshot().accepted;
  expect(bm03ReaderWeave(locked)).toBe(BM03_LOCKED_READER_WEAVE);
  expect(flags(locked, BM03_LOCKED_READER_WEAVE)["bm03-s2-locked-counterexample"]?.lit).toBe(true);
  expect(flags(locked, BM03_INDEPENDENT_READER_WEAVE)["bm03-s2-independent-pressure"]?.lit).toBe(
    false,
  );
  expect(bm03ReaderWeave(null)).toBeNull();
  expect(bm03ReaderWeave({ parameters: { model: "unrecognized" } })).toBeNull();
});

test("ratio one and logarithmic overflow preserve the difference between value and representation", () => {
  const session = createBm03Session("osmotic-source-range");
  session.apply({ ...BM03_DEFAULTS, volumeRatio: 1 });
  const unchanged = session.getSnapshot().accepted;
  expect(weaveOutputs(unchanged).deltaF?.value).toBe(0);
  expect(flags(unchanged, BM03_INDEPENDENT_READER_WEAVE)["bm03-s2-independent-volume"]?.lit).toBe(
    true,
  );
  session.apply({ ...BM03_DEFAULTS, Np: 1_000_000 });
  const overflow = session.getSnapshot().accepted;
  const derived = flags(overflow, BM03_INDEPENDENT_READER_WEAVE);
  expect(derived["bm03-s2-logarithmic-range"]?.lit).toBe(true);
  expect(derived["bm03-s2-independent-volume"]?.lit).toBe(true);
  expect(derived["bm03-s2-independent-pressure"]?.lit).toBe(true);
  expect(weaveOutputs(overflow).factorRatio?.value).toBeUndefined();
});

test("missing, duplicate and nonfinite pressure readings cannot light the pressure passage", () => {
  const snapshot = createBm03Session("osmotic-source-corruption").getSnapshot().accepted;
  const target = snapshot.outputs.find((out) => out.quantityId === "pressure");
  assert.ok(target);
  for (const outputs of [
    snapshot.outputs.filter((out) => out !== target),
    [...snapshot.outputs, target],
    snapshot.outputs.map((out) =>
      out === target && out.status === "value" ? { ...out, value: Number.NaN } : out,
    ),
  ])
    expect(
      flags({ ...snapshot, outputs }, BM03_INDEPENDENT_READER_WEAVE)["bm03-s2-independent-pressure"]
        ?.lit,
    ).toBe(false);
});

test("a rejected request suppresses the old pointers without changing its accepted evidence", () => {
  const session = createBm03Session("osmotic-source-refusal");
  const source = createSessionWeave(session, BM03_INDEPENDENT_READER_WEAVE);
  const before = session.getSnapshot().accepted;
  expect(source.getSnapshot().kind).toBe("ready");
  expect(session.apply({ ...BM03_DEFAULTS, Np: 0 }).kind).toBe("refused");
  expect(source.getSnapshot()).toEqual({ kind: "inactive", reason: "refused" });
  expect(session.getSnapshot().accepted).toBe(before);
  session.apply(BM03_DEFAULTS);
  expect(source.getSnapshot().kind).toBe("ready");
});
