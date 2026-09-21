import assert from "node:assert/strict";
import { test } from "node:test";
import { bm04DataCsv } from "../experiments/bm04/dataExport.ts";

function fixture(cells = 25) {
  return {
    instanceId: "instance-1",
    runId: "accepted-run",
    snapshotVersion: 7,
    revisions: { input: 3 },
    parameters: {
      cells,
      W: 1e-5,
      F: 4e-15,
      m: 1,
      T: 293.15,
      eta: 0.001,
      a: 0.5e-6,
      dt: 0.001,
      steps: 50,
      profile: "uniform",
    },
    outputs: [
      {
        quantityId: "densityProfile",
        status: "value",
        value: new Float64Array(cells).fill(100000),
      },
      {
        quantityId: "osmoticProfile",
        status: "value",
        value: new Float64Array(cells).fill(100000),
      },
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

/**
 * The four dataExport refusals by code and by line (am-p465).
 *
 * The owner ruled "Positional code argument", so these sites lost their builtin TypeError and now
 * throw ExperimentRuntimeError with a kebab code first. The cases above already drove three of
 * these paths by MESSAGE; what was missing was the code and the line citation the scanner reads,
 * so a converted site did not count as tested.
 *
 * A CORRECTION TO WHAT THIS FILE SAID IN fce8f69c. It recorded dataExport.ts:8 as unreachable on
 * the evidence that all seven metadata PARAMETERS set to Infinity are accepted. That measurement
 * was real but its denominator was wrong: cell() also formats `snapshot.snapshotVersion` and
 * `snapshot.revisions.input`, which no guard covers, and either one nonfinite reaches the site.
 * The claim was under-measured, not mistaken about what it checked, and it is driven below.
 */
const refusal = (fn) => {
  try {
    fn();
  } catch (err) {
    return err;
  }
  throw new Error("The export was accepted when it should have been refused.");
};

test("BM-04 export refusals carry their codes (dataExport.ts:8, 24, 42, 82)", () => {
  // dataExport.ts:82 - a nonfinite accepted density
  const density = fixture();
  density.outputs[0].value[2] = NaN;
  const densityErr = refusal(() => bm04DataCsv(density, "sha"));
  assert.equal(densityErr.code, "density-not-exportable");
  assert.match(densityErr.message, /finite, nonnegative/);

  // dataExport.ts:24 - a grid the accepted parameters cannot describe
  const grid = fixture();
  grid.parameters.cells = 3.5;
  const gridErr = refusal(() => bm04DataCsv(grid, "sha"));
  assert.equal(gridErr.code, "accepted-grid-invalid");
  assert.match(gridErr.message, /accepted grid is invalid/);

  // dataExport.ts:42 - two profiles that do not share one grid
  const profile = fixture();
  profile.outputs[1].value = new Float64Array(3);
  const profileErr = refusal(() => bm04DataCsv(profile, "sha"));
  assert.equal(profileErr.code, "profile-grid-mismatch");
  assert.match(profileErr.message, /match the accepted spatial grid/);

  // dataExport.ts:8 - a nonfinite snapshot identity field, which cell() formats and no guard covers
  const version = fixture();
  version.snapshotVersion = Number.POSITIVE_INFINITY;
  const versionErr = refusal(() => bm04DataCsv(version, "sha"));
  assert.equal(versionErr.code, "nonfinite-export-value");
  assert.match(versionErr.message, /Nonfinite data cannot be exported/);

  const revision = fixture();
  revision.revisions.input = Number.NaN;
  const revisionErr = refusal(() => bm04DataCsv(revision, "sha"));
  assert.equal(revisionErr.code, "nonfinite-export-value");
});
