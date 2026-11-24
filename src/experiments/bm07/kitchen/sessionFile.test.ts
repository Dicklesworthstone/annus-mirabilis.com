import { afterEach, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { kitchenFixture } from "../../../testing/kitchen/fixture.mjs";
import { createWorkerAdmission } from "../../../workers/scheduler/admission.ts";
import { exportKitchenCsv, parseKitchenCsv } from "./csv.ts";
import { KITCHEN_OPTIONS, type KitchenOptions } from "./definition.ts";
import { kitchenAnalysisJson } from "./export.ts";
import { createKitchenHost } from "./host.ts";
import { KITCHEN_PROTOCOL } from "./protocol.ts";
import { createKitchenSession } from "./session.ts";
import {
  captureKitchenSession,
  KITCHEN_SESSION_FILE_BYTES,
  kitchenSessionJson,
  parseKitchenSession,
  prepareKitchenSession,
  readKitchenSessionFile,
} from "./sessionFile.ts";

const sourceDigest = `source:sha256:${"a".repeat(64)}`;
const sessions: ReturnType<typeof createKitchenSession>[] = [];
afterEach(() => {
  for (const session of sessions.splice(0)) session.disconnect();
});

function laboratory(id: string) {
  let listener: ((message: unknown) => void) | null = null;
  let requests = 0;
  const host = createKitchenHost((message) => listener?.(structuredClone(message)), sourceDigest);
  const session = createKitchenSession(
    id,
    () => ({
      listen(onMessage) {
        listener = onMessage;
        return () => { listener = null; };
      },
      send(message) {
        requests++;
        void host.receive(structuredClone(message));
      },
      dispose() { host.dispose(); },
    }),
    sourceDigest,
    createWorkerAdmission(1),
  );
  sessions.push(session);
  return { session, get requests() { return requests; } };
}

async function accepted(lab: ReturnType<typeof laboratory>, csv: string, options: KitchenOptions) {
  expect(await lab.session.submit(csv, options)).toBe(true);
  for (let i = 0; i < 200 && !lab.session.getSnapshot().accepted; i++)
    await new Promise<void>((resolve) => setTimeout(resolve, 5));
  const result = lab.session.getSnapshot().accepted;
  assert.ok(result, "The real kitchen owner must accept the observation fixture.");
  return result;
}

function twoTracks() {
  const document = parseKitchenCsv(kitchenFixture());
  return exportKitchenCsv({
    ...document,
    points: [
      ...document.points,
      ...document.points.filter((point) => point.kind === "particle").map((point) => ({
        ...point,
        objectId: "second-particle",
      })),
    ],
  });
}

test("a real accepted session exports its chosen track, coordinate, coverage and gas-constant basis and reanalyzes only explicitly", async () => {
  const first = laboratory("session-capture");
  const options: KitchenOptions = {
    track: JSON.stringify(["second-particle", 0]),
    axis: "y",
    coverage: 0.9,
    constantSet: "modern-si-2019",
  };
  const original = await accepted(first, twoTracks(), options);
  const saved = await captureKitchenSession(original, sourceDigest);
  expect(saved.options).toEqual(options);
  expect(saved.csv).toBe(original.csv);
  expect(saved.origin).toEqual({
    modelVersion: KITCHEN_PROTOCOL,
    sourceDigest,
    sourceId: original.sourceId,
    documentDigest: original.documentDigest,
  });
  const text = kitchenSessionJson(saved);
  expect(Object.keys(JSON.parse(text))).toEqual([
    "schemaVersion", "format", "csv", "rows", "options", "origin",
  ]);
  const preview = await readKitchenSessionFile(text, sourceDigest);
  expect(preview.compatibility).toBe("same-evaluator");
  expect(Object.isFrozen(preview.session.options)).toBe(true);
  expect(first.requests).toBe(1);
  expect(first.session.getSnapshot().accepted).toBe(original);
  const second = laboratory("session-reopened");
  expect(second.requests).toBe(0);
  const restored = await accepted(second, preview.session.csv, preview.session.options);
  expect(restored.report.options).toEqual(options);
  expect(restored.report.selectedTrack).toBe(original.report.selectedTrack);
  expect(restored.report.constantSetId).toBe("modern-si-2019");
  expect(restored.document).toEqual(original.document);
  expect(restored.documentDigest).toBe(original.documentDigest);
  expect(restored.snapshot.instanceId).not.toBe(original.snapshot.instanceId);
  for (const output of original.snapshot.outputs) {
    const actual = restored.snapshot.outputs.find((item) => item.quantityId === output.quantityId);
    assert.ok(actual);
    expect(actual.status).toBe(output.status);
    if (output.status === "value" && actual.status === "value") {
      expect(typeof actual.value === "number" ? actual.value : Array.from(actual.value.copy())).toEqual(
        typeof output.value === "number" ? output.value : Array.from(output.value.copy()),
      );
    }
  }
});

test("an older observation-only document stays explicit about default choices and unknown evaluator", async () => {
  const csv = kitchenFixture();
  const legacy = { schemaVersion: 1, csv, rows: parseKitchenCsv(csv).points.length };
  const untouched = JSON.stringify(legacy);
  const preview = await prepareKitchenSession(legacy, sourceDigest);
  expect(preview.session.schemaVersion).toBe(2);
  expect(preview.session.origin).toBeNull();
  expect(preview.session.options).toEqual(KITCHEN_OPTIONS);
  expect(preview.compatibility).toBe("legacy-observations");
  expect(preview.notice).toContain("first particle track, x coordinate, 95% coverage");
  expect(JSON.stringify(legacy)).toBe(untouched);
});

test("changed evaluator identity is visible and forged observation identities refuse without calculating", async () => {
  const lab = laboratory("session-identity");
  const original = await accepted(lab, kitchenFixture(), KITCHEN_OPTIONS);
  const saved = await captureKitchenSession(original, sourceDigest);
  expect(saved.options.track).toBe(original.report.selectedTrack);
  const changed = await prepareKitchenSession(saved, `source:sha256:${"b".repeat(64)}`);
  expect(changed.compatibility).toBe("changed-evaluator");
  expect(changed.notice).toContain("new calculation");
  await assert.rejects(
    prepareKitchenSession({
      ...saved,
      origin: { ...saved.origin, documentDigest: `sha256:${"0".repeat(64)}` },
    }, sourceDigest),
    { code: "kitchen-session-invalid" },
  );
  await assert.rejects(
    captureKitchenSession({
      ...original, sourceId: `sha256:${"b".repeat(64)}`,
    }, sourceDigest),
    { code: "kitchen-session-invalid" },
  );
  await assert.rejects(
    readKitchenSessionFile(kitchenAnalysisJson(original, sourceDigest), sourceDigest),
    { code: "kitchen-session-invalid" },
  );
  expect(lab.requests).toBe(1);
  expect(lab.session.getSnapshot().accepted).toBe(original);
});

test("admission rejects malformed, oversized and executable-shaped input instead of repairing saved choices", async () => {
  const csv = kitchenFixture();
  const legacy = { schemaVersion: 1, csv, rows: parseKitchenCsv(csv).points.length };
  const parsed = parseKitchenSession(legacy);
  for (const value of [
    null,
    { ...legacy, schemaVersion: 100 },
    { ...legacy, rows: legacy.rows - 1 },
    { ...legacy, csv: "not an observation file" },
    { ...parsed, options: { ...KITCHEN_OPTIONS, axis: "z" } },
    { ...parsed, options: { ...KITCHEN_OPTIONS, coverage: 0.4 } },
    { ...parsed, options: { ...KITCHEN_OPTIONS, constantSet: "modern-si-2019" } },
    { ...parsed, origin: {
      modelVersion: KITCHEN_PROTOCOL,
      sourceDigest: "invented",
      sourceId: "unknown",
      documentDigest: "unknown",
    } },
    { ...parsed, results: [{ value: 42 }] },
  ]) assert.throws(() => parseKitchenSession(value), { code: "kitchen-session-invalid" });
  let invoked = false;
  const getter = { ...legacy };
  Object.defineProperty(getter, "csv", { get() { invoked = true; return csv; } });
  assert.throws(() => parseKitchenSession(getter), { code: "kitchen-session-invalid" });
  expect(invoked).toBe(false);
  await assert.rejects(
    readKitchenSessionFile(" ".repeat(KITCHEN_SESSION_FILE_BYTES + 1), sourceDigest),
    { code: "kitchen-session-invalid" },
  );
  await assert.rejects(readKitchenSessionFile("{broken json", sourceDigest), {
    code: "kitchen-session-invalid",
  });
});
