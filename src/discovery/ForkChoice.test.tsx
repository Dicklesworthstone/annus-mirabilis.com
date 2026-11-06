import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { createContainer, installDom, removeContainer, uninstallDom } from "../testing/reactDom.ts";
import { Fork } from "./Fork.tsx";
import { JOURNEY_STORAGE_NAMESPACE as KEY } from "./journeyStorage.ts";
import { FIXTURE_JOURNEY_BROWNIAN } from "./testing/fixtureJourney.ts";

const [first, second] = FIXTURE_JOURNEY_BROWNIAN.forks;
if (!first || !second) throw new Error("Two real fork shapes are required by this fixture");
const firstFork = first;
const secondFork = second;

describe("optional choices on the rendered discovery fork", () => {
  let container: HTMLElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(async () => {
    await installDom();
    window.localStorage.clear();
    container = createContainer();
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    removeContainer(container);
    await uninstallDom();
  });

  async function mount() {
    await act(async () => {
      root.render(
        <>
          <Fork fork={firstFork} />
          <Fork fork={secondFork} />
        </>,
      );
    });
  }
  function island(forkId = firstFork.id): HTMLElement {
    const found = container.querySelector<HTMLElement>(`[data-journey-choice="${forkId}"]`);
    if (!found) throw new Error("Missing choice island on the real Fork component");
    return found;
  }
  function radios(forkId = firstFork.id) {
    return [...island(forkId).querySelectorAll<HTMLInputElement>('input[type="radio"]')];
  }
  async function click(element: HTMLElement | undefined | null) {
    if (!element) throw new Error("Missing control");
    await act(async () => element.click());
  }
  function document() {
    return JSON.parse(window.localStorage.getItem(KEY) as string);
  }

  test("arrival writes no choices and every explanation is immediately available", async () => {
    await mount();
    expect(window.localStorage.getItem(KEY)).toBe(null);
    expect(radios().every((radio) => !radio.checked)).toBe(true);
    for (const branch of [...firstFork.branches, ...secondFork.branches]) {
      const rendered = container.querySelector(`[data-branch-id="${branch.id}"]`);
      expect(rendered?.textContent).toContain(branch.hypothesis);
      expect(rendered?.textContent).toContain(branch.outcome.plainLanguage);
      expect(rendered?.hasAttribute("hidden")).toBe(false);
    }
  });

  test("a selected route survives a remount, alongside its unchanged explanation", async () => {
    await mount();
    await click(radios()[0]);
    const choice = firstFork.branches[0];
    expect(document().choices[firstFork.id]).toBe(choice?.id);
    await act(async () => root.render(null));
    await mount();
    expect(radios()[0]?.checked).toBe(true);
    expect(island().textContent).toContain("Kept on this device.");
    expect(island().querySelector("a")?.getAttribute("href")).toBe(`#${choice?.id}`);
    expect(container.querySelector(`[data-branch-id="${choice?.id}"]`)?.textContent).toContain(
      choice?.outcome.plainLanguage ?? "missing outcome",
    );
  });

  test("clearing one question leaves the other saved choice and restores keyboard focus", async () => {
    await mount();
    await click(radios()[0]);
    await click(radios(secondFork.id)[1]);
    await click(island().querySelector("button"));
    expect(radios().some((radio) => radio.checked)).toBe(false);
    expect(Object.hasOwn(document().choices, firstFork.id)).toBe(false);
    expect(document().choices[secondFork.id]).toBe(secondFork.branches[1]?.id);
    expect(island().textContent).toContain("Your choice is cleared on this device.");
    expect(window.document.activeElement).toBe(radios()[0]);
  });

  test("a removed branch is never selected as another branch, and can be cleared", async () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ schemaVersion: 1, choices: { [firstFork.id]: "retired-branch" } }),
    );
    await mount();
    expect(radios().some((radio) => radio.checked)).toBe(false);
    expect(island().textContent).toContain("not part of this version");
    expect(island().querySelector<HTMLButtonElement>("button")?.disabled).toBe(false);
    await click(island().querySelector("button"));
    expect(Object.hasOwn(document().choices, firstFork.id)).toBe(false);
  });

  test("malformed imported choices are retained for the reader and do not break the fork", async () => {
    const raw = JSON.stringify({ schemaVersion: 1, choices: null });
    window.localStorage.setItem(KEY, raw);
    await mount();
    expect(island().textContent).toContain("Your saved choices could not be read");
    const held = JSON.parse(window.localStorage.getItem("am:quarantine:v1") as string);
    expect(held.entries.some((entry: { rawValue: string }) => entry.rawValue === raw)).toBe(true);
    await click(radios()[1]);
    expect(document().choices[firstFork.id]).toBe(firstFork.branches[1]?.id);
  });

  test("blocked storage keeps choices usable with an honest temporary-storage note", async () => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("Blocked", "SecurityError");
      },
    });
    await mount();
    await click(radios()[0]);
    await click(radios(secondFork.id)[1]);
    expect(radios()[0]?.checked).toBe(true);
    expect(radios(secondFork.id)[1]?.checked).toBe(true);
    expect(island().textContent).toContain("only while this page is open");
    expect(island().textContent).not.toContain("Kept on this device.");
    await click(island().querySelector("button"));
    expect(radios().some((radio) => radio.checked)).toBe(false);
    expect(radios(secondFork.id)[1]?.checked).toBe(true);
  });

  test("a quota failure keeps the new choice instead of showing older saved bytes", async () => {
    const storage = window.localStorage;
    const raw = JSON.stringify({
      schemaVersion: 1,
      choices: { [firstFork.id]: firstFork.branches[0]?.id },
    });
    storage.setItem(KEY, raw);
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        get length() {
          return storage.length;
        },
        getItem: (key: string) => storage.getItem(key),
        setItem() {
          throw new DOMException("Full", "QuotaExceededError");
        },
      },
    });
    await mount();
    await click(radios()[1]);
    expect(radios()[1]?.checked).toBe(true);
    expect(island().textContent).toContain("no room to save the choice");
    expect(storage.getItem(KEY)).toBe(raw);
    await click(island().querySelector("button"));
    expect(radios().some((radio) => radio.checked)).toBe(false);
    expect(island().textContent).toContain("an earlier choice may return");
    expect(storage.getItem(KEY)).toBe(raw);
  });

  test("changes and clearing from another tab refresh the visible choice without rewriting it", async () => {
    await mount();
    const raw = JSON.stringify({
      schemaVersion: 1,
      choices: { [firstFork.id]: firstFork.branches[1]?.id },
    });
    await act(async () => {
      window.localStorage.setItem(KEY, raw);
      window.dispatchEvent(new StorageEvent("storage", { key: KEY, newValue: raw }));
    });
    expect(radios()[1]?.checked).toBe(true);
    await act(async () => {
      window.localStorage.removeItem(KEY);
      window.dispatchEvent(new StorageEvent("storage", { key: KEY, newValue: null }));
    });
    expect(radios().some((radio) => radio.checked)).toBe(false);
    expect(window.localStorage.getItem(KEY)).toBe(null);
  });
});
