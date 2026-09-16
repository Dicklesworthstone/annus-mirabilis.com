import { describe, expect, test } from "bun:test";
import { type CrossTabChange, type CrossTabEventTarget, subscribeCrossTab } from "./crossTab.ts";

type FakeStorageEvent = { key: string | null; newValue: string | null; oldValue: string | null };

class FakeCrossTabTarget implements CrossTabEventTarget {
  private readonly listeners = new Set<(event: StorageEvent) => void>();

  addEventListener(_type: "storage", listener: (event: StorageEvent) => void): void {
    this.listeners.add(listener);
  }

  removeEventListener(_type: "storage", listener: (event: StorageEvent) => void): void {
    this.listeners.delete(listener);
  }

  dispatch(event: FakeStorageEvent): void {
    for (const listener of this.listeners) listener(event as unknown as StorageEvent);
  }

  get listenerCount(): number {
    return this.listeners.size;
  }
}

describe("subscribeCrossTab", () => {
  test("forwards a key change to the listener", () => {
    const target = new FakeCrossTabTarget();
    const changes: CrossTabChange[] = [];
    subscribeCrossTab((change) => changes.push(change), target);
    target.dispatch({ key: "am:settings:v1:theme", newValue: "slate", oldValue: "annalen" });
    expect(changes).toEqual([
      { key: "am:settings:v1:theme", newValue: "slate", oldValue: "annalen" },
    ]);
  });

  test("a null key (whole-storage clear from another tab) is not forwarded", () => {
    const target = new FakeCrossTabTarget();
    const changes: CrossTabChange[] = [];
    subscribeCrossTab((change) => changes.push(change), target);
    target.dispatch({ key: null, newValue: null, oldValue: null });
    expect(changes).toEqual([]);
  });

  test("unsubscribing removes the listener from the target", () => {
    const target = new FakeCrossTabTarget();
    const unsubscribe = subscribeCrossTab(() => {}, target);
    expect(target.listenerCount).toBe(1);
    unsubscribe();
    expect(target.listenerCount).toBe(0);
  });

  test("a removed value (newValue null) is still forwarded so a listener can react to deletion", () => {
    const target = new FakeCrossTabTarget();
    const changes: CrossTabChange[] = [];
    subscribeCrossTab((change) => changes.push(change), target);
    target.dispatch({ key: "am:notebook:v1", newValue: null, oldValue: '{"schemaVersion":1}' });
    expect(changes).toEqual([
      { key: "am:notebook:v1", newValue: null, oldValue: '{"schemaVersion":1}' },
    ]);
  });
});
