import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyWorksheet, exportWorksheet } from "./worksheetState.ts";
import { createWorksheetStore, type WorksheetStorage } from "./worksheetStore.ts";

const capstone = {
  id: "capstone-drawing-fixture",
  startOrder: ["claim-a"],
  claims: [
    {
      id: "claim-a",
      text: "Begin with the same body.",
      anchor: "s0-p1",
      logicalRole: "assumption" as const,
      buildsOn: [],
      assumptionIds: [],
    },
  ],
  assumptions: [],
};

test("opening a v1 worksheet migrates in memory without writing before an intentional edit", () => {
  const { sketch: _sketch, ...oldFields } = emptyWorksheet(capstone);
  const original = { ...oldFields, schemaVersion: 1, explanation: "My earlier notes." };
  let raw = JSON.stringify(original),
    writes = 0;
  const storage: WorksheetStorage = {
    read: () => ({ status: "ok", raw }),
    write: (next) => {
      writes++;
      raw = next;
      return "saved";
    },
    remove: () => "unavailable",
  };
  const store = createWorksheetStore(capstone, storage);
  store.open();
  assert.equal(writes, 0);
  assert.equal(raw, JSON.stringify(original));
  assert.equal(store.getSnapshot().worksheet.schemaVersion, 2);
  assert.equal(store.getSnapshot().worksheet.explanation, original.explanation);
  assert.deepEqual(store.getSnapshot().worksheet.sketch, { description: "", strokes: [] });
  assert.ok(
    store.edit({
      ...store.getSnapshot().worksheet,
      sketch: { description: "Same body, two accounts.", strokes: [[{ x: 10, y: 20 }]] },
    }),
  );
  assert.equal(writes, 1);
  assert.equal(JSON.parse(raw).schemaVersion, 2);
  const reload = createWorksheetStore(capstone, storage);
  reload.open();
  assert.deepEqual(reload.getSnapshot().worksheet, store.getSnapshot().worksheet);
});

test("storage failure retains every drawing point in the session and in the explicit export", () => {
  const storage: WorksheetStorage = {
    read: () => ({ status: "missing" }),
    write: () => "quota",
    remove: () => "unavailable",
  };
  const store = createWorksheetStore(capstone, storage);
  const worksheet = {
    ...emptyWorksheet(capstone),
    sketch: {
      description: "",
      strokes: [
        [
          { x: 0, y: 600 },
          { x: 1000, y: 0 },
        ],
      ],
    },
  };
  assert.ok(store.edit(worksheet));
  assert.equal(store.getSnapshot().persistence, "session-only");
  assert.deepEqual(store.getSnapshot().worksheet.sketch, worksheet.sketch);
  assert.deepEqual(JSON.parse(exportWorksheet(store.getSnapshot().worksheet)), worksheet);
  assert.equal(
    store.edit({ ...worksheet, sketch: { ...worksheet.sketch, strokes: [[{ x: -1, y: 0 }]] } }),
    false,
  );
  assert.deepEqual(store.getSnapshot().worksheet, worksheet);
});
