/**
 * The reader's investigation, kept on their own device and read back (am-rc1001-bridge-plan-pcjk.27).
 *
 * Every report here is produced by the real store from a real accepted-view fixture, never typed
 * out as a literal: a hand-written report would let a parser that quietly accepts the wrong shape
 * pass, and the shape under test is exactly the one `exportInvestigationJson` writes.
 */

import { describe, expect, test } from "bun:test";
import {
  createKeyRegistry,
  INVESTIGATION_KEYS,
  type KeyRegistration,
  storageKeyRegistry,
} from "../../platform/storage/keys.ts";
import { listQuarantine, QUARANTINE_KEY } from "../../platform/storage/quarantine.ts";
import { createStorageContext, type StorageContext } from "../../platform/storage/store.ts";
import { InMemoryStorage, quotaExceededError } from "../../platform/storage/testSupport.ts";
import {
  createInvestigationStore,
  exportInvestigationJson,
  type InvestigationReport,
} from "./core.ts";
import {
  clearStoredInvestigation,
  createInvestigationPersistence,
  INVESTIGATION_KEY_OWNER,
  readStoredInvestigation,
  saveStoredInvestigation,
} from "./persistence.ts";
import { INVESTIGATIONS } from "./specs.ts";

const PAPER = "brownian-motion";
const KEY = INVESTIGATION_KEYS[PAPER];
const spec = INVESTIGATIONS[PAPER];
const task = {
  promptId: spec.promptId,
  task: "What happens to the spread?",
  perturbPrompt: "Change only radius.",
  explainPrompt: "Explain the change and the model's limits.",
};

function acceptedView(reason = ""): unknown {
  const identity = {
    experimentId: "bm-01",
    instanceId: "placement-A",
    runId: "run-1",
    actionIndex: 1,
    revisions: { input: 1, observer: 0, measurement: 0, estimator: 0 },
    parameters: { T: 290.15, eta: 0.00135, a: 5e-7, seed: "18446744073709551615" },
  };
  return {
    status: "accepted",
    pending: false,
    requested: { ...identity },
    accepted: {
      ...identity,
      snapshotVersion: 1,
      stepIndex: 20,
      simulationTime: 1,
      final: true,
      outputs: spec.quantities.map(({ id }, i) => ({
        quantityId: id,
        ownerId: "fixture.reference",
        unit: "m",
        semanticKind: "coordinate-rms",
        status: "value",
        value: i ? 6e-6 : 8e-7,
        ...(reason ? { reason } : {}),
      })),
    },
  };
}

/** A real pinned investigation: the store's own `begin`, from an accepted laboratory view. */
function pinned(reason = ""): InvestigationReport {
  const view = acceptedView(reason);
  const store = createInvestigationStore(spec);
  store.connect({ getSnapshot: () => view, subscribe: () => () => {} }, "fixture-source-v1");
  const begun = store.begin("It will be smaller, but not half.", task);
  if (!begun.ok) throw new Error(`fixture could not pin: ${begun.message}`);
  const report = store.getSnapshot().report;
  if (!report) throw new Error("fixture produced no report");
  return report;
}

function explained(report: InvestigationReport, words: string): InvestigationReport {
  const store = createInvestigationStore(spec);
  if (!store.restore(report).ok || !store.explain(words).ok)
    throw new Error("fixture could not explain the restored investigation");
  return store.getSnapshot().report as InvestigationReport;
}

function registryWith(maxBytes: number) {
  const entries: KeyRegistration[] = [
    {
      key: KEY,
      kind: "document",
      ownerBeadId: INVESTIGATION_KEY_OWNER,
      exportable: true,
      clearable: true,
      maxBytes,
      schemaVersion: 1,
      label: "Discovery investigation: Brownian motion",
    },
    {
      key: QUARANTINE_KEY,
      kind: "document",
      ownerBeadId: "am-plat-local-storage-km8f",
      exportable: true,
      clearable: true,
      maxBytes: 2_000_000,
      schemaVersion: 1,
      label: "Saved data this site could not read, kept aside",
    },
  ];
  return createKeyRegistry(entries);
}

function context(storage: Storage, maxBytes = 300_000): StorageContext {
  return createStorageContext({ registry: registryWith(maxBytes), getStorage: () => storage });
}

describe("the investigation key family", () => {
  test("all four papers are registered to this bead, exportable and clearable", () => {
    expect(Object.keys(INVESTIGATION_KEYS).sort()).toEqual([
      "brownian-motion",
      "light-quanta",
      "mass-energy",
      "special-relativity",
    ]);
    for (const key of Object.values(INVESTIGATION_KEYS)) {
      const entry = storageKeyRegistry.get(key);
      expect(entry?.kind).toBe("document");
      expect(entry?.ownerBeadId).toBe(INVESTIGATION_KEY_OWNER);
      expect(entry?.exportable).toBe(true);
      expect(entry?.clearable).toBe(true);
      expect(entry?.maxBytes).toBe(300_000);
    }
  });

  test("am:journeys:v1 is NOT this family, and could not hold one investigation anyway", () => {
    // The reason this key family exists rather than reusing the Discover document: its budget is
    // smaller than one investigation's own ceiling, and it has a different owner.
    const journeys = storageKeyRegistry.get("am:journeys:v1");
    expect(journeys?.maxBytes).toBe(64_000);
    expect(journeys?.ownerBeadId).toBe("am-disc-journey-framework-umbg");
    expect(Object.values(INVESTIGATION_KEYS)).not.toContain("am:journeys:v1");
  });
});

describe("keeping and reading back", () => {
  test("a pinned investigation survives being written and read", () => {
    const storage = new InMemoryStorage();
    const ctx = context(storage);
    expect(readStoredInvestigation(PAPER, ctx).status).toBe("missing");

    const report = pinned();
    expect(saveStoredInvestigation(PAPER, report, ctx)).toBe("saved");

    const read = readStoredInvestigation(PAPER, ctx);
    expect(read.status).toBe("ok");
    // Byte identity through the real export, not a field-by-field comparison that could miss one.
    expect(exportInvestigationJson(read.report as InvestigationReport)).toBe(
      exportInvestigationJson(report),
    );
  });

  test("the stored document is the registered namespace and carries its own schemaVersion", () => {
    const storage = new InMemoryStorage();
    const ctx = context(storage);
    saveStoredInvestigation(PAPER, pinned(), ctx);
    const raw = storage.rawGet(KEY);
    expect(raw).toBeDefined();
    const document = JSON.parse(raw as string);
    expect(document.schemaVersion).toBe(1);
    expect(document.report.format).toBe("annus-discovery-investigation");
  });

  test("clearing forgets it, and reading then reports missing rather than failing", () => {
    const storage = new InMemoryStorage();
    const ctx = context(storage);
    saveStoredInvestigation(PAPER, pinned(), ctx);
    clearStoredInvestigation(PAPER, ctx);
    expect(storage.rawGet(KEY)).toBeUndefined();
    expect(readStoredInvestigation(PAPER, ctx).status).toBe("missing");
  });

  test("a paper with no registered key neither reads nor writes anything", () => {
    const storage = new InMemoryStorage();
    const ctx = context(storage);
    expect(saveStoredInvestigation("molecular-dimensions", pinned(), ctx)).toBe("unregistered");
    expect(readStoredInvestigation("molecular-dimensions", ctx).status).toBe("unavailable");
    expect(storage.length).toBe(0);
  });

  test("a key family reassigned to another bead stops this module writing into it", () => {
    // The owner check is the one-owner-per-key rule, tested rather than asserted in a comment.
    const storage = new InMemoryStorage();
    const foreign = createKeyRegistry([
      {
        key: KEY,
        kind: "document",
        ownerBeadId: "am-someone-else",
        exportable: true,
        clearable: true,
        maxBytes: 300_000,
        schemaVersion: 1,
        label: "Discovery investigation: Brownian motion",
      },
    ]);
    const ctx = createStorageContext({ registry: foreign, getStorage: () => storage });
    expect(saveStoredInvestigation(PAPER, pinned(), ctx)).toBe("unregistered");
    expect(storage.length).toBe(0);
  });
});

describe("when the device will not keep it", () => {
  test("blocked storage reports unavailable, and the work is not lost from this session", () => {
    const ctx = context(new InMemoryStorage({ throwOnAnyAccess: new Error("blocked") }));
    const report = pinned();
    expect(saveStoredInvestigation(PAPER, report, ctx)).toBe("unavailable");
    // writeRaw's session fallback holds it, so the same page still reads it back.
    const read = readStoredInvestigation(PAPER, ctx);
    expect(read.status).toBe("ok");
    expect(read.report?.prediction).toBe("It will be smaller, but not half.");
  });

  test("a full disk is reported as quota, not as a silent success", () => {
    const ctx = context(new InMemoryStorage({ throwOnSet: quotaExceededError() }));
    expect(saveStoredInvestigation(PAPER, pinned(), ctx)).toBe("quota");
  });

  test("a report larger than the key's budget is refused before anything is written", () => {
    const storage = new InMemoryStorage();
    const ctx = context(storage, 2_000);
    expect(saveStoredInvestigation(PAPER, pinned(), ctx)).toBe("quota");
    expect(storage.rawGet(KEY)).toBeUndefined();
    // The control: the same report at the real budget is kept, so the refusal is about the budget.
    expect(saveStoredInvestigation(PAPER, pinned(), context(storage))).toBe("saved");
  });
});

describe("bytes this edition cannot read are set aside, never discarded", () => {
  test("a document from a newer edition is quarantined with its reason and reported unreadable", () => {
    const storage = new InMemoryStorage();
    const ctx = context(storage);
    const bytes = JSON.stringify({ schemaVersion: 99, report: {} });
    storage.rawSet(KEY, bytes);

    expect(readStoredInvestigation(PAPER, ctx).status).toBe("unreadable");
    const held = listQuarantine(ctx);
    expect(held).toHaveLength(1);
    expect(held[0]?.originalKey).toBe(KEY);
    expect(held[0]?.rawValue).toBe(bytes);
    expect(held[0]?.reason).toContain("99");
    // Moved, not copied: a returning reader must not re-quarantine the same bytes every visit.
    expect(storage.rawGet(KEY)).toBeUndefined();
  });

  test("a tampered report is quarantined under the refusal code that rejected it", () => {
    const storage = new InMemoryStorage();
    const ctx = context(storage);
    const report = JSON.parse(exportInvestigationJson(pinned()));
    report.score = 10;
    storage.rawSet(KEY, JSON.stringify({ schemaVersion: 1, report }));

    expect(readStoredInvestigation(PAPER, ctx).status).toBe("unreadable");
    expect(listQuarantine(ctx)[0]?.reason).toBe("report-unknown-field");
  });

  test("invalid JSON is quarantined rather than thrown", () => {
    const storage = new InMemoryStorage();
    const ctx = context(storage);
    storage.rawSet(KEY, "{not json");
    expect(readStoredInvestigation(PAPER, ctx).status).toBe("unreadable");
    expect(listQuarantine(ctx)[0]?.reason).toBe("investigation-invalid-json");
  });

  test("a failed quarantine write leaves the durable original available on a later visit", () => {
    const storage = new InMemoryStorage({ throwOnSet: quotaExceededError() });
    const bytes = JSON.stringify({ schemaVersion: 99, report: {} });
    storage.rawSet(KEY, bytes);
    const ctx = context(storage);

    expect(readStoredInvestigation(PAPER, ctx).status).toBe("unreadable");
    expect(listQuarantine(ctx)[0]?.rawValue).toBe(bytes);
    expect(storage.rawGet(QUARANTINE_KEY)).toBeUndefined();
    expect(storage.rawGet(KEY)).toBe(bytes);

    // A new context has no session fallback. The reader's only durable copy must still exist.
    expect(readStoredInvestigation(PAPER, context(storage)).status).toBe("unreadable");
    expect(storage.rawGet(KEY)).toBe(bytes);
  });

  test("when quarantine is full the unreadable bytes stay exactly where they are", () => {
    const storage = new InMemoryStorage();
    const ctx = context(storage);
    storage.rawSet(
      QUARANTINE_KEY,
      JSON.stringify({
        schemaVersion: 1,
        entries: Array.from({ length: 50 }, (_, i) => ({
          originalKey: `am:fixture:${i}`,
          rawValue: "x",
          reason: "fixture",
          quarantinedAt: "2026-10-27T00:00:00.000Z",
        })),
      }),
    );
    const bytes = JSON.stringify({ schemaVersion: 1, report: { format: "something-else" } });
    storage.rawSet(KEY, bytes);

    expect(readStoredInvestigation(PAPER, ctx).status).toBe("unreadable");
    expect(storage.rawGet(KEY)).toBe(bytes);
    expect(listQuarantine(ctx)).toHaveLength(50);
  });
});

describe("independent investigation writers preserve each other's work", () => {
  test("a stale edit and a stale clear cannot replace the report saved by another tab", () => {
    const storage = new InMemoryStorage();
    const original = pinned();
    saveStoredInvestigation(PAPER, original, context(storage));
    const first = createInvestigationPersistence(PAPER, context(storage));
    const second = createInvestigationPersistence(PAPER, context(storage));
    const newer = explained(original, "A newer explanation from the first tab.");
    const local = explained(original, "The second tab's independent explanation.");

    expect(first.save(newer)).toBe("saved");
    const durable = storage.rawGet(KEY);
    expect(second.save(local)).toBe("conflict");
    expect(second.clear()).toBe("conflict");
    expect(storage.rawGet(KEY)).toBe(durable);
    expect(readStoredInvestigation(PAPER, context(storage)).report?.explanation).toBe(
      newer.explanation,
    );
    expect(JSON.parse(exportInvestigationJson(local)).explanation).toBe(local.explanation);
  });

  test("a tab opened before the first save cannot overwrite a newly created report", () => {
    const storage = new InMemoryStorage();
    const first = createInvestigationPersistence(PAPER, context(storage));
    const second = createInvestigationPersistence(PAPER, context(storage));
    const report = pinned();
    expect(first.save(report)).toBe("saved");
    const durable = storage.rawGet(KEY);
    expect(second.save(explained(report, "An unrelated new investigation."))).toBe("conflict");
    expect(second.clear()).toBe("conflict");
    expect(storage.rawGet(KEY)).toBe(durable);
  });

  test("another tab's deletion stays deleted, and a conflict does not silently rebase", () => {
    const storage = new InMemoryStorage();
    const original = pinned();
    saveStoredInvestigation(PAPER, original, context(storage));
    const durable = storage.rawGet(KEY) as string;
    const first = createInvestigationPersistence(PAPER, context(storage));
    const second = createInvestigationPersistence(PAPER, context(storage));
    expect(first.clear()).toBe("cleared");
    expect(second.save(explained(original, "An edit after deletion."))).toBe("conflict");
    expect(storage.rawGet(KEY)).toBeUndefined();
    storage.rawSet(KEY, durable);
    expect(second.save(original)).toBe("conflict");
    expect(second.clear()).toBe("conflict");
    expect(storage.rawGet(KEY)).toBe(durable);
  });

  test("one writer can save successive changes, clear its copy, and start again", () => {
    const storage = new InMemoryStorage();
    const writer = createInvestigationPersistence(PAPER, context(storage));
    const original = pinned();
    expect(writer.save(original)).toBe("saved");
    expect(writer.save(explained(original, "A revised explanation."))).toBe("saved");
    expect(writer.clear()).toBe("cleared");
    expect(storage.rawGet(KEY)).toBeUndefined();
    expect(writer.save(original)).toBe("saved");
    expect(readStoredInvestigation(PAPER, context(storage)).report?.prediction).toBe(
      original.prediction,
    );
  });

  test("a failed save does not advance the durable comparison and can be retried", () => {
    const failures: { throwOnSet?: Error } = {};
    const storage = new InMemoryStorage(failures);
    const writer = createInvestigationPersistence(PAPER, context(storage));
    const original = pinned();
    expect(writer.save(original)).toBe("saved");
    const newer = explained(original, "The complete report after a quota failure.");
    failures.throwOnSet = quotaExceededError();
    expect(writer.save(newer)).toBe("quota");
    delete failures.throwOnSet;
    expect(writer.save(newer)).toBe("saved");
    expect(readStoredInvestigation(PAPER, context(storage)).report?.explanation).toBe(
      newer.explanation,
    );
  });

  test("a failed save's fallback cannot hide a later durable edit from another tab", () => {
    const failures: { throwOnSet?: Error } = {};
    const storage = new InMemoryStorage(failures);
    const original = pinned();
    saveStoredInvestigation(PAPER, original, context(storage));
    const firstContext = context(storage);
    const first = createInvestigationPersistence(PAPER, firstContext);
    const second = createInvestigationPersistence(PAPER, context(storage));
    const local = explained(original, "The first tab's unsaved explanation.");
    failures.throwOnSet = quotaExceededError();
    expect(first.save(local)).toBe("quota");
    expect(firstContext.fallback.has(KEY)).toBe(true);
    delete failures.throwOnSet;
    expect(second.save(explained(original, "A durable change in the other tab."))).toBe("saved");
    const durable = storage.rawGet(KEY);
    expect(first.save(local)).toBe("conflict");
    expect(first.clear()).toBe("conflict");
    expect(storage.rawGet(KEY)).toBe(durable);
  });

  test("storage becoming readable does not make a previously unseen report ours to overwrite", () => {
    const failures: { throwOnGet?: Error } = { throwOnGet: new Error("blocked") };
    const storage = new InMemoryStorage(failures);
    const original = pinned();
    const bytes = JSON.stringify({ schemaVersion: 1, report: original });
    storage.rawSet(KEY, bytes);
    const writer = createInvestigationPersistence(PAPER, context(storage));
    expect(writer.initial.status).toBe("unavailable");
    expect(writer.save(original)).toBe("unavailable");
    delete failures.throwOnGet;
    expect(writer.save(explained(original, "A report made while storage was blocked."))).toBe(
      "conflict",
    );
    expect(storage.rawGet(KEY)).toBe(bytes);
  });

  test("storage can recover from being blocked when there is no saved original to replace", () => {
    const failures: { throwOnGet?: Error } = { throwOnGet: new Error("blocked") };
    const storage = new InMemoryStorage(failures);
    const writer = createInvestigationPersistence(PAPER, context(storage));
    expect(writer.save(pinned())).toBe("unavailable");
    delete failures.throwOnGet;
    expect(writer.save(pinned())).toBe("saved");
    expect(writer.clear()).toBe("cleared");
  });

  test("an explicit local restart while storage was blocked from arrival never touches unseen data", () => {
    const storage = new InMemoryStorage({ throwOnGet: new Error("blocked") });
    const bytes = JSON.stringify({ schemaVersion: 1, report: pinned() });
    storage.rawSet(KEY, bytes);
    const writer = createInvestigationPersistence(PAPER, context(storage));
    expect(writer.initial.status).toBe("unavailable");
    expect(writer.clear()).toBe("session-only");
    expect(storage.rawGet(KEY)).toBe(bytes);
  });

  test("a previously saved investigation is retained when storage later becomes unreadable", () => {
    const failures: { throwOnGet?: Error } = {};
    const storage = new InMemoryStorage(failures);
    const writer = createInvestigationPersistence(PAPER, context(storage));
    expect(writer.save(pinned())).toBe("saved");
    const bytes = storage.rawGet(KEY);
    failures.throwOnGet = new Error("blocked");
    expect(writer.clear()).toBe("unavailable");
    expect(storage.rawGet(KEY)).toBe(bytes);
  });

  test("a failed quarantine keeps its original protected even when storage recovers", () => {
    const failures: { throwOnSet?: Error } = { throwOnSet: quotaExceededError() };
    const storage = new InMemoryStorage(failures);
    const bytes = JSON.stringify({ schemaVersion: 99, report: {} });
    storage.rawSet(KEY, bytes);
    const ctx = context(storage);
    const writer = createInvestigationPersistence(PAPER, ctx);
    expect(writer.initial.status).toBe("unreadable");
    expect(storage.rawGet(QUARANTINE_KEY)).toBeUndefined();
    expect(listQuarantine(ctx)[0]?.rawValue).toBe(bytes);
    delete failures.throwOnSet;
    expect(writer.save(pinned())).toBe("protected");
    expect(writer.clear()).toBe("protected");
    expect(storage.rawGet(KEY)).toBe(bytes);
  });

  test("a durable quarantine permits new work without losing the unreadable original", () => {
    const storage = new InMemoryStorage();
    const ctx = context(storage);
    const bytes = JSON.stringify({ schemaVersion: 99, report: {} });
    storage.rawSet(KEY, bytes);
    const writer = createInvestigationPersistence(PAPER, ctx);
    expect(writer.initial.status).toBe("unreadable");
    expect(writer.save(pinned())).toBe("saved");
    expect(listQuarantine(context(storage))[0]?.rawValue).toBe(bytes);
    expect(readStoredInvestigation(PAPER, context(storage)).status).toBe("ok");
  });

  test("quarantining old bytes cannot remove a newer report written during preservation", () => {
    const newer = JSON.stringify({ schemaVersion: 1, report: pinned() });
    class ContendedStorage extends InMemoryStorage {
      override setItem(key: string, value: string) {
        super.setItem(key, value);
        if (key === QUARANTINE_KEY) this.rawSet(KEY, newer);
      }
    }
    const storage = new ContendedStorage();
    const bytes = JSON.stringify({ schemaVersion: 99, report: {} });
    storage.rawSet(KEY, bytes);
    const writer = createInvestigationPersistence(PAPER, context(storage));
    expect(writer.initial.status).toBe("unreadable");
    expect(writer.save(pinned())).toBe("protected");
    expect(writer.clear()).toBe("protected");
    expect(storage.rawGet(KEY)).toBe(newer);
    expect(listQuarantine(context(storage))[0]?.rawValue).toBe(bytes);
  });
});
