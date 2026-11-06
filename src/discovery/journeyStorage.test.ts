import { describe, expect, test } from "bun:test";
import { storageKeyRegistry } from "../platform/storage/keys.ts";
import { createStorageContext } from "../platform/storage/store.ts";
import {
  clearJourneyChoice,
  DEFAULT_JOURNEY_STATE,
  getJourneyChoice,
  JOURNEY_STORAGE_NAMESPACE,
  readJourneyState,
  saveJourneyChoice,
} from "./journeyStorage.ts";

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => store.delete(key),
    setItem: (key: string, value: string) => store.set(key, value),
  };
}

describe("journeyStorage", () => {
  test("am:journeys:v1 is registered with am-disc-journey-framework-umbg as owner", () => {
    const entry = storageKeyRegistry.get(JOURNEY_STORAGE_NAMESPACE);
    expect(entry).toBeDefined();
    expect(entry?.ownerBeadId).toBe("am-disc-journey-framework-umbg");
    expect(entry?.exportable).toBe(true);
    expect(entry?.clearable).toBe(true);
    expect(entry?.maxBytes).toBe(64_000);
  });

  test("saving and reading a journey choice round-trips correctly", () => {
    const storage = createMemoryStorage();
    const ctx = createStorageContext({ getStorage: () => storage });

    const initial = readJourneyState(ctx);
    expect(initial.value).toEqual(DEFAULT_JOURNEY_STATE);

    const writeRes = saveJourneyChoice(ctx, "arg-bm-observable", "choice-double");
    expect(writeRes.status).toBe("ok");

    const savedChoice = getJourneyChoice(ctx, "arg-bm-observable");
    expect(savedChoice).toBe("choice-double");

    const state = readJourneyState(ctx);
    expect(state.status).toBe("ok");
    expect(state.value?.choices["arg-bm-observable"]).toBe("choice-double");
    const nextVisit = createStorageContext({ getStorage: () => storage });
    expect(getJourneyChoice(nextVisit, "arg-bm-observable")).toBe("choice-double");
  });

  test("changing and clearing one fork preserves choices at the other forks", () => {
    const storage = createMemoryStorage();
    const ctx = createStorageContext({ getStorage: () => storage });
    saveJourneyChoice(ctx, "fork-first", "branch-a");
    saveJourneyChoice(ctx, "fork-second", "branch-b");
    saveJourneyChoice(ctx, "fork-first", "branch-c");
    expect(getJourneyChoice(ctx, "fork-first")).toBe("branch-c");
    expect(getJourneyChoice(ctx, "fork-second")).toBe("branch-b");
    expect(clearJourneyChoice(ctx, "fork-first").status).toBe("ok");
    const nextVisit = createStorageContext({ getStorage: () => storage });
    expect(getJourneyChoice(nextVisit, "fork-first")).toBeUndefined();
    expect(getJourneyChoice(nextVisit, "fork-second")).toBe("branch-b");
    expect(getJourneyChoice(nextVisit, "toString")).toBeUndefined();
  });

  test("a quota failure cannot resurrect an older choice or overwrite another fork", () => {
    const storage = createMemoryStorage();
    const original = JSON.stringify({
      schemaVersion: 1,
      choices: { "fork-first": "branch-old", "fork-second": "branch-other" },
    });
    storage.setItem(JOURNEY_STORAGE_NAMESPACE, original);
    const full: Storage = {
      ...storage,
      setItem: () => {
        throw new DOMException("Full", "QuotaExceededError");
      },
    };
    const ctx = createStorageContext({ getStorage: () => full });
    expect(saveJourneyChoice(ctx, "fork-first", "branch-new").status).toBe("quota");
    expect(getJourneyChoice(ctx, "fork-first")).toBe("branch-new");
    expect(clearJourneyChoice(ctx, "fork-first").status).toBe("quota");
    expect(getJourneyChoice(ctx, "fork-first")).toBeUndefined();
    expect(getJourneyChoice(ctx, "fork-second")).toBe("branch-other");
    expect(storage.getItem(JOURNEY_STORAGE_NAMESPACE)).toBe(original);
  });

  for (const choices of [null, [], "not-a-map", { fork: 4 }, { fork: "" }]) {
    test(`an unreadable choices map is preserved instead of trusted: ${JSON.stringify(choices)}`, () => {
      const storage = createMemoryStorage();
      const raw = JSON.stringify({ schemaVersion: 1, choices });
      storage.setItem(JOURNEY_STORAGE_NAMESPACE, raw);
      const ctx = createStorageContext({ getStorage: () => storage });
      expect(readJourneyState(ctx)).toEqual({ status: "corrupt", value: DEFAULT_JOURNEY_STATE });
      const held = JSON.parse(storage.getItem("am:quarantine:v1") as string);
      expect(held.entries.some((entry: { rawValue: string }) => entry.rawValue === raw)).toBe(true);
      expect(saveJourneyChoice(ctx, "fork", "branch").status).toBe("ok");
      expect(getJourneyChoice(ctx, "fork")).toBe("branch");
    });
  }

  test("a full quarantine keeps the durable original and new choices work only in memory", () => {
    const storage = createMemoryStorage();
    const original = JSON.stringify({ schemaVersion: 99, choices: { fork: "future" } });
    storage.setItem(JOURNEY_STORAGE_NAMESPACE, original);
    storage.setItem(
      "am:quarantine:v1",
      JSON.stringify({ schemaVersion: 1, entries: Array.from({ length: 50 }, () => ({})) }),
    );
    const ctx = createStorageContext({ getStorage: () => storage });
    expect(saveJourneyChoice(ctx, "fork", "new").status).toBe("unavailable");
    expect(getJourneyChoice(ctx, "fork")).toBe("new");
    expect(storage.getItem(JOURNEY_STORAGE_NAMESPACE)).toBe(original);
    expect(clearJourneyChoice(ctx, "fork").status).toBe("unavailable");
    expect(getJourneyChoice(ctx, "fork")).toBeUndefined();
    expect(storage.getItem(JOURNEY_STORAGE_NAMESPACE)).toBe(original);
  });

  test("blocked or unavailable backend degrades gracefully to in-memory fallback", () => {
    const ctx = createStorageContext({
      getStorage: () => {
        throw new Error("Storage disabled by user privacy settings");
      },
    });

    const writeRes = saveJourneyChoice(ctx, "arg-fork-1", "branch-paper");
    expect(writeRes.status).toBe("unavailable");

    const choice = getJourneyChoice(ctx, "arg-fork-1");
    expect(choice).toBe("branch-paper");
  });

  test("unknown future version document is quarantined and reports corrupt rather than crashing", () => {
    const storage = createMemoryStorage();
    const ctx = createStorageContext({ getStorage: () => storage });

    // Write a future version document
    storage.setItem(JOURNEY_STORAGE_NAMESPACE, JSON.stringify({ schemaVersion: 99, choices: {} }));

    const read = readJourneyState(ctx);
    expect(read.status).toBe("corrupt");
    expect(read.value).toEqual(DEFAULT_JOURNEY_STATE);
  });

  test("writing to am:predictions:v1 from this bead fails one-owner discipline", () => {
    const predictionsEntry = storageKeyRegistry.get("am:predictions:v1");
    expect(predictionsEntry?.ownerBeadId).toBe("am-inst-predict-mode-ti7m");
    expect(predictionsEntry?.ownerBeadId).not.toBe("am-disc-journey-framework-umbg");
  });
});
