import assert from "node:assert/strict";
import test from "node:test";
import { readSchedulerMark } from "./performanceMarkReader.ts";

test("performance-mark reader rejects a mark whose detail lacks snapshotVersion", () => {
  assert.throws(
    () =>
      readSchedulerMark({
        name: "am:accepted",
        detail: { instanceId: "runtime-analytic-a", actionIndex: 1 },
      }),
    /lacks snapshotVersion/,
  );
});

test("performance-mark reader returns matching identities when snapshotVersion is present", () => {
  const mark = readSchedulerMark({
    name: "am:accepted",
    detail: { instanceId: "runtime-analytic-a", actionIndex: 1, snapshotVersion: 4 },
  });
  assert.equal(mark.snapshotVersion, 4);
});
