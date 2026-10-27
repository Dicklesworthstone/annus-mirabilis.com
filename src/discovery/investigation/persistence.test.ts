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
