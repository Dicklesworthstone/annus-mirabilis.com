import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyWorksheet } from "./worksheetState.ts";
import { createWorksheetStore, type WorksheetStorage } from "./worksheetStore.ts";

const definition = (id = "capstone-test") => ({
  id,
  startOrder: ["b", "a"],
  claims: ["a", "b"].map((claim) => ({
    id: claim,
    text: claim,
    anchor: claim,
    logicalRole: "assumption" as const,
    buildsOn: [],
    assumptionIds: [],
  })),
  assumptions: [],
});
function memory(initial: string | null = null) {
  let raw = initial;
  let writes = 0;
  let unavailable = false;
  let quota = false;
  const port: WorksheetStorage = {
    read: () =>
      unavailable
        ? { status: "unavailable" }
        : raw === null
          ? { status: "missing" }
          : { status: "ok", raw },
    write(value) {
      if (unavailable) return "unavailable";
      if (quota) return "quota";
      raw = value;
      writes++;
      return "saved";
    },
    remove() {
      if (unavailable) return "unavailable";
      raw = null;
      return "removed";
    },
  };
  return {
    port,
    raw: () => raw,
    writes: () => writes,
    replace: (value: string | null) => {
      raw = value;
    },
    unavailable: (value: boolean) => {
      unavailable = value;
    },
    quota: (value: boolean) => {
      quota = value;
    },
  };
}

describe("capstone device persistence", () => {
  it("construction and opening never write; complete work survives a fresh store", () => {
    const backend = memory();
    const store = createWorksheetStore(definition(), backend.port);
    assert.equal(store.getSnapshot().persistence, "unopened");
    store.open();
    assert.equal(backend.writes(), 0);
    const work = {
      ...emptyWorksheet(definition()),
      order: ["a", "b"],
      explanation: "My explanation",
      annotations: { equation: "A term" },
      table: [["One", "Two"]],
    };
    assert.equal(store.edit(work), true);
    const reopened = createWorksheetStore(definition(), backend.port);
    reopened.open();
    assert.deepEqual(reopened.getSnapshot().worksheet, work);
    assert.equal(reopened.getSnapshot().persistence, "saved");
  });
  it("quota failures retain the complete draft and retry without overwriting a changed base", () => {
    const backend = memory();
    backend.quota(true);
    const store = createWorksheetStore(definition(), backend.port);
    store.edit({ ...emptyWorksheet(definition()), explanation: "Unsaved text" });
    assert.equal(store.getSnapshot().persistence, "session-only");
    assert.equal(store.getSnapshot().worksheet.explanation, "Unsaved text");
    assert.equal(backend.raw(), null);
    backend.quota(false);
    store.retry();
    assert.equal(store.getSnapshot().persistence, "saved");
    assert.equal(JSON.parse(backend.raw() ?? "{}").explanation, "Unsaved text");
  });
  it("throwing storage accessors cannot interrupt editing", () => {
    const port: WorksheetStorage = {
      read() {
        throw new Error("blocked");
      },
      write() {
        throw new Error("blocked");
      },
      remove() {
        throw new Error("blocked");
      },
    };
    const store = createWorksheetStore(definition(), port);
    assert.equal(store.edit({ ...emptyWorksheet(definition()), explanation: "Still here" }), true);
    assert.equal(store.getSnapshot().persistence, "session-only");
    assert.equal(store.getSnapshot().worksheet.explanation, "Still here");
  });
  it("an initially unavailable store does not overwrite a saved copy discovered later", () => {
    const saved = JSON.stringify({ ...emptyWorksheet(definition()), explanation: "Elsewhere" });
    const backend = memory(saved);
    backend.unavailable(true);
    const store = createWorksheetStore(definition(), backend.port);
    store.edit({ ...emptyWorksheet(definition()), explanation: "This tab" });
    backend.unavailable(false);
    store.retry();
    assert.equal(store.getSnapshot().persistence, "conflict");
    assert.equal(store.getSnapshot().worksheet.explanation, "This tab");
    assert.equal(backend.raw(), saved);
  });
  it("invalid, future and wrong-capstone originals are protected without silent replacement", () => {
    for (const raw of [
      "{broken",
      JSON.stringify({ ...emptyWorksheet(definition()), schemaVersion: 9 }),
      JSON.stringify(emptyWorksheet(definition("other"))),
    ]) {
      const backend = memory(raw);
      const store = createWorksheetStore(definition(), backend.port);
      store.open();
      assert.equal(store.getSnapshot().persistence, "protected");
      assert.equal(store.getSnapshot().recoveryRaw, raw);
      store.edit({ ...emptyWorksheet(definition()), explanation: "New draft" });
      assert.equal(backend.raw(), raw);
      assert.equal(store.getSnapshot().worksheet.explanation, "New draft");
      store.clearConfirmed();
      assert.equal(backend.raw(), null);
      assert.equal(store.getSnapshot().recoveryRaw, null);
    }
  });
  it("two tabs retain both versions and require explicit loading after a conflict", () => {
    const backend = memory();
    const first = createWorksheetStore(definition(), backend.port);
    const second = createWorksheetStore(definition(), backend.port);
    first.open();
    second.open();
    first.edit({ ...emptyWorksheet(definition()), explanation: "First" });
    second.edit({ ...emptyWorksheet(definition()), explanation: "Second" });
    assert.equal(second.getSnapshot().persistence, "conflict");
    assert.equal(JSON.parse(backend.raw() ?? "{}").explanation, "First");
    assert.equal(second.getSnapshot().worksheet.explanation, "Second");
    assert.equal(second.clearConfirmed(), false);
    second.reloadConfirmed();
    assert.equal(second.getSnapshot().worksheet.explanation, "First");
    assert.equal(second.getSnapshot().persistence, "saved");
  });
  it("external deletion is a conflict, not a reason to resurrect work automatically", () => {
    const backend = memory();
    const store = createWorksheetStore(definition(), backend.port);
    store.edit({ ...emptyWorksheet(definition()), explanation: "Keep privately" });
    backend.replace(null);
    store.checkForExternalChange();
    assert.equal(store.getSnapshot().persistence, "conflict");
    store.retry();
    assert.equal(backend.raw(), null);
    assert.equal(store.getSnapshot().worksheet.explanation, "Keep privately");
  });
  it("clearing one worksheet leaves another capstone untouched", () => {
    const a = memory(),
      b = memory();
    const first = createWorksheetStore(definition("one"), a.port);
    const second = createWorksheetStore(definition("two"), b.port);
    first.edit({ ...emptyWorksheet(definition("one")), explanation: "First" });
    second.edit({ ...emptyWorksheet(definition("two")), explanation: "Second" });
    first.clearConfirmed();
    assert.equal(a.raw(), null);
    assert.equal(JSON.parse(b.raw() ?? "{}").explanation, "Second");
  });
  it("failed clear names the surviving saved copy, while a failed reload preserves the draft", () => {
    const backend = memory();
    const store = createWorksheetStore(definition(), backend.port);
    store.edit({ ...emptyWorksheet(definition()), explanation: "Saved" });
    backend.unavailable(true);
    store.clearConfirmed();
    assert.match(store.getSnapshot().message, /saved copy could not be cleared/);
    assert.equal(JSON.parse(backend.raw() ?? "{}").explanation, "Saved");
    store.edit({ ...emptyWorksheet(definition()), explanation: "New draft" });
    assert.equal(store.reloadConfirmed(), false);
    assert.equal(store.getSnapshot().worksheet.explanation, "New draft");
  });
  it("invalid changes do not discard good work and subscribers cannot break saving", () => {
    const backend = memory();
    const store = createWorksheetStore(definition(), backend.port);
    store.subscribe(() => {
      throw new Error("detached view");
    });
    store.edit({ ...emptyWorksheet(definition()), explanation: "Keep" });
    assert.equal(store.edit({ ...emptyWorksheet(definition()), order: ["missing"] }), false);
    assert.equal(store.getSnapshot().worksheet.explanation, "Keep");
    assert.equal(JSON.parse(backend.raw() ?? "{}").explanation, "Keep");
  });
});
