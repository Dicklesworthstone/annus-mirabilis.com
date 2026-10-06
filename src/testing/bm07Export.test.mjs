import assert from "node:assert/strict";
import test from "node:test";
import { BM07_DEFAULTS } from "../experiments/bm07/definition.ts";
import { inferenceObservationCsv } from "../experiments/bm07/export.ts";
import { createBm07Session } from "../experiments/bm07/session.ts";
import { encodeResult } from "../experiments/results/codec.ts";
import { createBm07Recording, measureBm07 } from "../workers/operations/bm07.ts";

test("SI observation exports preserve every accepted position and exclude hidden answers and inference assumptions", async () => {
  const parameters = { ...BM07_DEFAULTS, seed: "9007199254740993" },
    sourceDigest = `source:sha256:${"a".repeat(64)}`;
  const recording = (await createBm07Recording(parameters, { yieldControl: async () => {} })).data,
    e = (await measureBm07(recording, parameters, false)).data;
  const session = createBm07Session(
    "export",
    {
      parameters,
      sourceDigest,
      stepIndex: e.stepIndex,
      simulationTime: e.simulationTime,
      results: e.outputs.map(encodeResult),
    },
    () => {
      throw new Error("no worker");
    },
  );
  const csv = inferenceObservationCsv(session.getSnapshot().accepted, sourceDigest),
    rows = csv.trim().split("\n");
  assert.equal(rows.length, parameters.M + 3);
  assert.match(rows[0], /synthetic-observations/);
  assert.match(rows[0], /9007199254740993/);
  assert.ok(!csv.includes(String(recording.hiddenNumber)));
  assert.ok(!csv.includes("estimator"));
  const positions = e.outputs.find((o) => o.quantityId === "observationPositions").value;
  for (let i = 0; i <= parameters.M; i++) {
    const r = rows[i + 2].split(",");
    assert.equal(Number(r[0]), i * parameters.dt);
    for (let c = 0; c < parameters.d; c++)
      assert.equal(Number(r[c + 1]), positions[i * parameters.d + c]);
  }
  assert.throws(() => inferenceObservationCsv(session.getSnapshot().accepted, "bogus"));
});

/*
 * A LEDGER ENTRY FOR THIS MODULE THAT IS NOT A REFUSAL (am-r3qt).
 *
 * The refusal scanner records a site at bm07/export.ts line 12 carrying the code
 * `synthetic-observations`. Both halves of that are wrong, and neither is this module's fault:
 *
 *   line 12 is `throw new TypeError("Observation data is unavailable.")` - a bare throw with no
 *   code argument at all;
 *   the string it was given as a code is seven lines below, in `const meta = { kind:
 *   "synthetic-observations", units: "SI", ... }`, where it is a METADATA LABEL on the exported
 *   CSV. AGENTS.md requires exactly that label: "Demonstration data is conspicuously labeled
 *   synthetic".
 *
 * The scanner counts `kind:` fields carrying a kebab string, and `kind:` is this codebase's
 * ordinary discriminated-union tag. So this module carries no refusal code whatsoever, and no test
 * can pay the entry because there is nothing there to drive. Recorded here and on am-r3qt rather
 * than silenced, because silencing it means editing the instrument or the baseline.
 */
