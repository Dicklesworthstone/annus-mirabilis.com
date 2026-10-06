import assert from "node:assert/strict";
import test from "node:test";
import { TRACER_WEAVE_CONTEXT, weaveContext } from "./context.ts";
import { BM06_READER_WEAVE, BM06_WEAVE_CONTEXT, BM06_WEAVE_PASSAGES } from "./spreadingPassages.ts";

test("the existing tracer context continues to read the actual sample and full-width seed", () => {
  const fields = weaveContext(
    { parameters: { M: 731, seed: "18446744073709551615" } },
    TRACER_WEAVE_CONTEXT,
  );
  assert.deepEqual(
    fields.map((f) => f.value),
    ["731", "18446744073709551615"],
  );
});

test("a deterministic grid shows elapsed time and mode, not an invented sample or seed", () => {
  const fields = weaveContext({ parameters: { t: 60, gridEnabled: true } }, BM06_WEAVE_CONTEXT);
  assert.deepEqual(
    fields.map((f) => [f.label, f.value]),
    [
      ["Elapsed time", "60 s"],
      ["Numerical grid", "enabled"],
    ],
  );
  assert.ok(!fields.some((f) => /seed|sample/i.test(f.label)));
});

test("zero elapsed time and a disabled grid are recorded settings, not missing values", () => {
  assert.deepEqual(
    weaveContext({ parameters: { t: 0, gridEnabled: false } }, BM06_WEAVE_CONTEXT).map(
      (f) => f.value,
    ),
    ["0 s", "off"],
  );
});

test("missing and nonfinite metadata are not supplied from defaults", () => {
  assert.ok(
    weaveContext({ parameters: { t: Number.NaN } }, BM06_WEAVE_CONTEXT).every(
      (f) => f.value === "not recorded",
    ),
  );
});

test("prototype names are not enum labels or accepted parameter values", () => {
  const enumFields = [{ parameterId: "mode", label: "Mode", values: {} }];
  assert.equal(
    weaveContext({ parameters: { mode: "toString" } }, enumFields)[0]?.value,
    "toString",
  );
  const inherited = Object.create({ mode: "borrowed" });
  assert.equal(weaveContext({ parameters: inherited }, enumFields)[0]?.value, "not recorded");
});

test("both compiled spreading predicates resolve to their own canonical source passage", () => {
  assert.equal(BM06_READER_WEAVE.predicates.length, 2);
  for (const p of BM06_READER_WEAVE.predicates) {
    const passage = BM06_WEAVE_PASSAGES[p.id];
    assert.ok(passage);
    assert.deepEqual(p.targets, [passage.sentenceId]);
    assert.equal(p.pointerText, passage.pointerText);
    assert.match(passage.sentenceId, /^s4-p\d+-s\d+$/);
  }
});
