import { describe, expect, test } from "bun:test";
import { storageKeyRegistry } from "../platform/storage/keys.ts";
import { createStorageContext } from "../platform/storage/store.ts";
import {
  clearJourneyChoice,
  DEFAULT_JOURNEY_STATE,
  getJourneyChoice,
  JOURNEY_STORAGE_NAMESPACE,
  readJourneyState,
  retryJourneyChoices,
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

  test("quota recovery combines unsaved choices with other tabs' changes at different forks", () => {
    const storage = createMemoryStorage();
    let full = true;
    const limited: Storage = {
      ...storage,
      setItem(key, value) {
        if (full) throw new DOMException("Full", "QuotaExceededError");
        storage.setItem(key, value);
      },
    };
    const local = createStorageContext({ getStorage: () => limited });
    const remote = createStorageContext({ getStorage: () => storage });
    expect(saveJourneyChoice(local, "fork-local", "local-idea").status).toBe("quota");
    expect(saveJourneyChoice(remote, "fork-remote", "remote-idea").status).toBe("ok");
    full = false;
    expect(saveJourneyChoice(local, "fork-next", "next-idea").status).toBe("ok");
    expect(readJourneyState(remote).value?.choices).toEqual({
      "fork-local": "local-idea",
      "fork-remote": "remote-idea",
      "fork-next": "next-idea",
    });
  });

  test("competing changes to one fork preserve both versions until the reader chooses again", () => {
    const storage = createMemoryStorage();
    let full = true;
    const local = createStorageContext({
      getStorage: () => ({
        ...storage,
        setItem(key, value) {
          if (full) throw new DOMException("Full", "QuotaExceededError");
          storage.setItem(key, value);
        },
      }),
    });
    const remote = createStorageContext({ getStorage: () => storage });
    saveJourneyChoice(local, "fork-shared", "local-idea");
    saveJourneyChoice(remote, "fork-shared", "remote-idea");
    const saved = storage.getItem(JOURNEY_STORAGE_NAMESPACE);
    full = false;
    const read = readJourneyState(local);
    expect(read.value?.choices["fork-shared"]).toBe("local-idea");
    expect(read.conflicts).toContain("fork-shared");
    expect(retryJourneyChoices(local).status).toBe("conflict");
    expect(storage.getItem(JOURNEY_STORAGE_NAMESPACE)).toBe(saved);
    expect(saveJourneyChoice(local, "fork-other", "other-idea").status).toBe("conflict");
    expect(storage.getItem(JOURNEY_STORAGE_NAMESPACE)).toBe(saved);
    expect(getJourneyChoice(local, "fork-other")).toBe("other-idea");
    expect(saveJourneyChoice(local, "fork-shared", "local-idea").status).toBe("ok");
    expect(readJourneyState(remote).value?.choices).toEqual({
      "fork-shared": "local-idea",
      "fork-other": "other-idea",
    });
  });

  test("a failed clear is merged without restoring that fork or losing another tab's new choice", () => {
    const storage = createMemoryStorage();
    const remote = createStorageContext({ getStorage: () => storage });
    saveJourneyChoice(remote, "fork-cleared", "old-idea");
    let full = true;
    const local = createStorageContext({
      getStorage: () => ({
        ...storage,
        setItem(key, value) {
          if (full) throw new DOMException("Full", "QuotaExceededError");
          storage.setItem(key, value);
        },
      }),
    });
    expect(clearJourneyChoice(local, "fork-cleared").status).toBe("quota");
    saveJourneyChoice(remote, "fork-remote", "remote-idea");
    full = false;
    expect(saveJourneyChoice(local, "fork-next", "next-idea").status).toBe("ok");
    expect(readJourneyState(remote).value?.choices).toEqual({
      "fork-remote": "remote-idea",
      "fork-next": "next-idea",
    });
  });

  test("unknown durable choices are never replaced when reading fails but writing would succeed", () => {
    const storage = createMemoryStorage();
    const saved = JSON.stringify({ schemaVersion: 1, choices: { "fork-remote": "remote-idea" } });
    storage.setItem(JOURNEY_STORAGE_NAMESPACE, saved);
    let blocked = true;
    let writes = 0;
    const local = createStorageContext({
      getStorage: () => ({
        ...storage,
        getItem(key) {
          if (blocked) throw new DOMException("Unreadable", "SecurityError");
          return storage.getItem(key);
        },
        setItem(key, value) {
          writes++;
          storage.setItem(key, value);
        },
      }),
    });
    expect(saveJourneyChoice(local, "fork-local", "local-idea").status).toBe("unavailable");
    expect(writes).toBe(0);
    expect(storage.getItem(JOURNEY_STORAGE_NAMESPACE)).toBe(saved);
    expect(getJourneyChoice(local, "fork-local")).toBe("local-idea");
    blocked = false;
    expect(saveJourneyChoice(local, "fork-local", "local-idea").status).toBe("ok");
    expect(readJourneyState(local).value?.choices).toEqual({
      "fork-remote": "remote-idea",
      "fork-local": "local-idea",
    });
  });

  test("a clear in another tab does not discard unsaved work or silently resurrect it", () => {
    const storage = createMemoryStorage();
    const remote = createStorageContext({ getStorage: () => storage });
    saveJourneyChoice(remote, "fork-old", "old-idea");
    let full = true;
    const local = createStorageContext({
      getStorage: () => ({
        ...storage,
        setItem(key, value) {
          if (full) throw new DOMException("Full", "QuotaExceededError");
          storage.setItem(key, value);
        },
      }),
    });
    expect(saveJourneyChoice(local, "fork-local", "local-idea").status).toBe("quota");
    storage.removeItem(JOURNEY_STORAGE_NAMESPACE);
    full = false;
    expect(readJourneyState(local).conflicts).toContain("fork-local");
    expect(getJourneyChoice(local, "fork-local")).toBe("local-idea");
    expect(storage.getItem(JOURNEY_STORAGE_NAMESPACE)).toBe(null);
    expect(saveJourneyChoice(local, "fork-local", "local-idea").status).toBe("ok");
    expect(readJourneyState(remote).value?.choices).toEqual({ "fork-local": "local-idea" });
  });

  test("resolving one pending fork after an external clear cannot revive another without consent", () => {
    const storage = createMemoryStorage();
    const remote = createStorageContext({ getStorage: () => storage });
    saveJourneyChoice(remote, "fork-old", "old-idea");
    let full = true;
    const local = createStorageContext({
      getStorage: () => ({
        ...storage,
        setItem(key, value) {
          if (full) throw new DOMException("Full", "QuotaExceededError");
          storage.setItem(key, value);
        },
      }),
    });
    saveJourneyChoice(local, "fork-first", "first-idea");
    saveJourneyChoice(local, "fork-second", "second-idea");
    storage.removeItem(JOURNEY_STORAGE_NAMESPACE);
    full = false;
    expect(readJourneyState(local).conflicts).toEqual(["fork-first", "fork-second"]);
    // Another saved choice after the clear is not consent to restore either pending choice.
    saveJourneyChoice(remote, "fork-new", "new-idea");
    const saved = storage.getItem(JOURNEY_STORAGE_NAMESPACE);
    expect(readJourneyState(local).conflicts).toEqual(["fork-first", "fork-second"]);
    expect(saveJourneyChoice(local, "fork-first", "first-idea").status).toBe("conflict");
    expect(readJourneyState(local).conflicts).toEqual(["fork-second"]);
    expect(storage.getItem(JOURNEY_STORAGE_NAMESPACE)).toBe(saved);
    expect(saveJourneyChoice(local, "fork-second", "second-idea").status).toBe("ok");
    expect(readJourneyState(remote).value?.choices).toEqual({
      "fork-new": "new-idea",
      "fork-first": "first-idea",
      "fork-second": "second-idea",
    });
  });
});
