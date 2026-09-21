import assert from "node:assert/strict";
import { test } from "node:test";
import { bm04DataCsv } from "../experiments/bm04/dataExport.ts";

function fixture(cells = 25) {
  return {
    instanceId: "instance-1", runId: "accepted-run", snapshotVersion: 7, revisions: { input: 3 },
    parameters: { cells, W: 1e-5, F: 4e-15, m: 1, T: 293.15, eta: 0.001, a: 0.5e-6, dt: 0.001, steps: 50, profile: "uniform" },
    outputs: [
      { quantityId: "densityProfile", status: "value", value: new Float64Array(cells).fill(100000) },
      { quantityId: "osmoticProfile", status: "value", value: new Float64Array(cells).fill(100000) },
    ],
  };
}

test("BM-04 CSV contains every accepted cell, not the former ten-row preview", () => {
  const snapshot = fixture(25);
  const rows = bm04DataCsv(snapshot, "source-sha").trim().split("\r\n");
  assert.equal(rows.length, 26);
  assert.match(rows[0], /parameters_json,cell,x_m,density_per_m,osmotic_density_per_m$/);
  assert.match(rows[1], /"host-reference"/);
  assert.match(rows[1], /"accepted-run",7,3,/);
  const last = rows[25].split(",").slice(-4).map(Number);
  assert.equal(last[0], 25);
  assert.ok(Math.abs(last[1] - 9.8e-6) < 1e-20);
  assert.deepEqual(last.slice(2), [100000, 100000]);
  assert.equal(snapshot.parameters.cells, 25);
  assert.equal(snapshot.outputs[0].value[24], 100000);
});

test("BM-04 CSV quotes provenance and neutralizes textual spreadsheet formulas", () => {
  const snapshot = fixture(3);
  snapshot.instanceId = '=HYPERLINK("unsafe")';
  const text = bm04DataCsv(snapshot, 'sha,"quoted"');
  assert.ok(text.includes('"sha,""quoted"""'));
  assert.ok(text.includes('"\'=HYPERLINK(""unsafe"")"'));
  assert.ok(text.includes('""cells"":3'));
});

test("BM-04 CSV refuses mismatched or nonnumerical profiles instead of mixing runs", () => {
  const snapshot = fixture();
  snapshot.outputs[1].value = new Float64Array(3);
  assert.throws(() => bm04DataCsv(snapshot, "sha"), /match the accepted spatial grid/);
  snapshot.outputs[1] = { quantityId: "osmoticProfile", status: "outside-domain", reason: "test" };
  assert.throws(() => bm04DataCsv(snapshot, "sha"), /match the accepted spatial grid/);
});

test("BM-04 CSV rejects nonfinite, negative, and invalid-grid data", () => {
  for (const invalid of [NaN, Infinity, -1]) {
    const snapshot = fixture();
    snapshot.outputs[0].value[2] = invalid;
    assert.throws(() => bm04DataCsv(snapshot, "sha"), /finite, nonnegative/);
  }
  for (const cells of [0, 2, 3.5]) {
    const snapshot = fixture();
    snapshot.parameters.cells = cells;
    assert.throws(() => bm04DataCsv(snapshot, "sha"), /grid is invalid/);
  }
});
