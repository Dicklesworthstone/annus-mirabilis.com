import { describe, expect, test } from "bun:test";
import { storageKeyRegistry } from "../platform/storage/keys.ts";
import { createStorageContext, writeDocument } from "../platform/storage/store.ts";
import {
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
