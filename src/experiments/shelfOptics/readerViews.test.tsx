import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { getClarificationKind } from "../../reader/stack/kinds.ts";
import type { LabReference } from "../../reader/stack/stackStore.ts";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../testing/reactDom.ts";
import { RetainedSessionProvider } from "../store/retainedSession.tsx";
import { createSessionRetention } from "../store/sessionRetention.ts";
import { SHELF_DEFINITIONS, SHELF_IDS, type ShelfId } from "./definition.ts";

let root: Root;
let container: HTMLElement;
let cache: ReturnType<typeof createSessionRetention>;
let references: LabReference[];
let workers: number;
let previousWorker: unknown;

beforeEach(async () => {
  await installDom();
  container = createContainer();
  root = createRoot(container);
  cache = createSessionRetention();
  references = [];
  workers = 0;
  previousWorker = (globalThis as { Worker?: unknown }).Worker;
  (globalThis as { Worker?: unknown }).Worker = class {
    constructor() {
      workers++;
    }
    terminate() {}
    postMessage() {}
    addEventListener() {}
  };
});

afterEach(async () => {
  await act(async () => root.unmount());
  cache.dispose();
  removeContainer(container);
  (globalThis as { Worker?: unknown }).Worker = previousWorker;
  await uninstallDom();
});

function element<T extends Element>(selector: string): T {
  const result = container.querySelector<T>(selector);
  if (!result) throw new Error(`Missing mounted control: ${selector}`);
  return result;
}

type Handlers = Record<string, ((event: unknown) => void) | undefined>;
function handlers(control: Element): Handlers {
  const key = Object.getOwnPropertyNames(control).find((name) => name.startsWith("__reactProps$"));
  if (!key) throw new Error("The mounted React control has no handlers.");
  return (control as unknown as Record<string, Handlers>)[key] ?? {};
}

async function until(condition: () => boolean): Promise<void> {
  for (let tick = 0; tick < 100; tick++) {
    if (condition()) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }
  expect(condition()).toBe(true);
}

async function open(id: ShelfId, placementKey = "paper:shelf:primary"): Promise<void> {
  const definition = getClarificationKind("instrument-view");
  const parsed = definition?.parseId(id);
  const render = definition?.render;
  if (!render || !parsed) throw new Error("The real reader kind refused the shelf.");
  await act(async () => {
    root.render(
      <StrictMode>
        <RetainedSessionProvider
          cache={cache}
          placementKey={placementKey}
          instanceId={`${id}:reader`}
          previous={references.at(-1) ?? null}
          onReference={(reference) => references.push(reference)}
        >
          {render({ parsed, instanceId: `${id}:reader` })}
        </RetainedSessionProvider>
      </StrictMode>,
    );
  });
}

async function close(): Promise<void> {
  await act(async () => root.render(null));
}

function lab(id: ShelfId): HTMLElement {
  return element<HTMLElement>(`section.shelf-lab[data-instrument-id="${id}"]`);
}

function values(): (string | null)[] {
  return [...container.querySelectorAll("td[data-value]")].map((cell) =>
    cell.getAttribute("data-value"),
  );
}

async function change(name: string, value: string | boolean): Promise<void> {
  const input = element<HTMLInputElement>(`input[name="${name}"]`);
  await act(async () => {
    if (typeof value === "boolean") input.checked = value;
    else input.value = value;
    const onChange = handlers(input).onChange;
    if (!onChange) throw new Error("The input has no change handler.");
    onChange({ target: input, currentTarget: input });
  });
}

async function submit(): Promise<void> {
  const event = new Event("submit", { bubbles: true, cancelable: true });
  await act(async () => {
    element<HTMLFormElement>("section.shelf-lab form").dispatchEvent(event);
  });
  expect(event.defaultPrevented).toBe(true);
}

describe("the real shelf instruments in the reader return stack", () => {
  for (const id of SHELF_IDS) {
    test(`${id} reopens a verified accepted comparison after the retained cache is gone`, async () => {
      history.replaceState(null, "", "/papers/special-relativity/?view=german&tape=foreign");
      await open(id);
      await until(() => container.querySelector("section.shelf-lab[data-ready=true]") !== null);
      const field = id === "shelf-fizeau" ? "waterSpeed" : "beta";
      await change(field, id === "shelf-fizeau" ? "-11" : "-0.23");
      if (id === "shelf-fizeau") {
        await change("reversal", true);
        await change("showLater", true);
      }
      await submit();
      const acceptedValues = values();
      const identity = {
        instance: lab(id).dataset.instanceId,
        run: lab(id).dataset.runId,
        version: lab(id).dataset.snapshotVersion,
      };
      const saved = references.at(-1);
      expect(saved?.compactTape).toContain('"readerCheckpointVersion":1');
      expect(saved?.checkpointDigest).not.toBe("");
      await close();
      cache.dispose();
      cache = createSessionRetention();
      await open(id);
      await until(() => container.querySelector("section.shelf-lab[data-ready=true]") !== null);
      expect(lab(id).dataset.instanceId).toBe(identity.instance);
      expect(lab(id).dataset.runId).toBe(identity.run);
      expect(lab(id).dataset.snapshotVersion).toBe(identity.version);
      expect(values()).toEqual(acceptedValues);
      expect(element<HTMLInputElement>(`input[name="${field}"]`).value).toBe(
        id === "shelf-fizeau" ? "-11" : "-0.23",
      );
      expect(lab(id).dataset.executionLabel).toBe("host");
      expect(element("[data-lab-return-notice]").textContent).toContain(
        "Restored the recorded accepted experiment",
      );
      expect(container.querySelector("[data-tape-notice]")).toBeNull();
      expect(container.querySelector("[data-share-form=experiment-preset]")).toBeNull();
      if (id === "shelf-fizeau") {
        expect(element<HTMLInputElement>("input[name=reversal]").checked).toBe(true);
        expect(element<HTMLInputElement>("input[name=showLater]").checked).toBe(true);
        expect(
          container.querySelector("[data-historical-status=later-development]"),
        ).not.toBeNull();
      }
      expect(workers).toBe(0);
    });

    test(`${id} applies, refuses, returns to the same accepted owner and isolates placements`, async () => {
      history.replaceState(
        null,
        "",
        "/papers/special-relativity/?view=german&detail=2&tape=not-a-lab-tape&beta=0.7&waterSpeed=100",
      );
      const paperUrl = location.href;
      await open(id);
      await until(() => container.querySelector("section.shelf-lab[data-ready=true]") !== null);
      const initialRun = lab(id).dataset.runId;
      const initialValues = values();
      const field = id === "shelf-fizeau" ? "waterSpeed" : "beta";
      const defaults = SHELF_DEFINITIONS[id].defaults;
      const defaultValue =
        defaults.instrumentId === "shelf-fizeau" ? defaults.waterSpeed : defaults.beta;
      expect(element<HTMLInputElement>(`input[name="${field}"]`).value).toBe(String(defaultValue));
      expect(lab(id).dataset.executionLabel).toBe("static");
      expect(container.querySelector('[data-testid="in-preparation-notice"]')).toBeNull();
      expect(container.querySelector("[data-tape-notice]")).toBeNull();
      expect(values().length).toBeGreaterThan(0);
      expect(location.href).toBe(paperUrl);

      await change(field, "0");
      expect(values()).toEqual(initialValues);
      expect(container.textContent).toContain("edits are not applied yet");
      await submit();
      const changedValues = values();
      expect(changedValues).not.toEqual(initialValues);
      const acceptedIdentity = {
        instance: lab(id).dataset.instanceId,
        run: lab(id).dataset.runId,
        version: lab(id).dataset.snapshotVersion,
      };
      expect(acceptedIdentity.run).not.toBe(initialRun);
      expect(lab(id).dataset.executionLabel).toBe("host");
      expect(lab(id).dataset.pending).toBe("false");
      expect(references.at(-1)?.runId).toBe(acceptedIdentity.run);
      expect(references.at(-1)?.modelIdentity).toMatch(/^source:sha256:[a-f0-9]{64}$/);

      await change(field, "1e500");
      await submit();
      expect(element("[data-shelf-error]").textContent).not.toBe("");
      expect(values()).toEqual(changedValues);
      expect(lab(id).dataset.runId).toBe(acceptedIdentity.run);
      expect(lab(id).dataset.snapshotVersion).toBe(acceptedIdentity.version);
      expect(location.href).toBe(paperUrl);

      await close();
      expect(cache.idleSize()).toBe(1);
      await open(id);
      await until(() => container.querySelector("section.shelf-lab[data-ready=true]") !== null);
      expect(lab(id).dataset.instanceId).toBe(acceptedIdentity.instance);
      expect(lab(id).dataset.runId).toBe(acceptedIdentity.run);
      expect(lab(id).dataset.snapshotVersion).toBe(acceptedIdentity.version);
      expect(values()).toEqual(changedValues);
      expect(element<HTMLInputElement>(`input[name="${field}"]`).value).toBe("0");
      expect(lab(id).dataset.executionLabel).toBe("host");
      expect(element("[data-shelf-error]").textContent).toBe("");

      await close();
      references = [];
      await open(id, "paper:shelf:another-passage");
      await until(() => container.querySelector("section.shelf-lab[data-ready=true]") !== null);
      expect(lab(id).dataset.instanceId).not.toBe(acceptedIdentity.instance);
      expect(values()).toEqual(initialValues);
      expect(element<HTMLInputElement>(`input[name="${field}"]`).value).toBe(String(defaultValue));
      expect(lab(id).dataset.executionLabel).toBe("static");
      expect(location.href).toBe(paperUrl);
      expect(workers).toBe(0);
    });
  }

  test("Fizeau's optional later comparison and flow protocol survive a reader return", async () => {
    await open("shelf-fizeau");
    await until(() => container.querySelector("section.shelf-lab[data-ready=true]") !== null);
    expect(container.querySelector("[data-historical-status=later-development]")).toBeNull();
    await change("waterSpeed", "-7");
    await change("reversal", true);
    await change("showLater", true);
    await submit();
    const acceptedValues = values();
    const runId = lab("shelf-fizeau").dataset.runId;
    expect(container.querySelector("[data-historical-status=later-development]")).not.toBeNull();
    expect(container.textContent).toContain("not a 1904 premise");
    await close();
    await open("shelf-fizeau");
    await until(() => container.querySelector("section.shelf-lab[data-ready=true]") !== null);
    expect(values()).toEqual(acceptedValues);
    expect(lab("shelf-fizeau").dataset.runId).toBe(runId);
    expect(element<HTMLInputElement>('input[name="waterSpeed"]').value).toBe("-7");
    expect(element<HTMLInputElement>('input[name="reversal"]').checked).toBe(true);
    expect(element<HTMLInputElement>('input[name="showLater"]').checked).toBe(true);
    expect(container.querySelector("[data-historical-status=later-development]")).not.toBeNull();
    expect(container.querySelector("[data-fizeau-observed]")).toBeNull();
    expect(container.querySelector('a[href="/lab/shelf-fizeau/"]')?.textContent).toContain(
      "historical observations",
    );
  });

  test("reading-only defers the shelf and disabling it mounts the real controls", async () => {
    document.documentElement.dataset.readingOnly = "on";
    await open("shelf-fizeau");
    await until(() => container.querySelector("[data-load-experiment]") !== null);
    expect(container.querySelector("section.shelf-lab")).toBeNull();
    expect(container.textContent).toContain("The static worked case stays in the page");
    expect(workers).toBe(0);
    // The shared gate reads the document preference after hydration. A warm lazy chunk may
    // briefly retain its pure initial example, but it must not calculate another run or work.
    expect(references.every((reference) => reference.runId.endsWith("/run/1"))).toBe(true);
    document.documentElement.dataset.readingOnly = "off";
    await until(() => container.querySelector("section.shelf-lab[data-ready=true]") !== null);
    expect(element<HTMLInputElement>('input[name="waterSpeed"]').disabled).toBe(false);
    expect(cache.size()).toBe(1);
    expect(lab("shelf-fizeau").dataset.runId).toMatch(/\/run\/1$/);
    expect(new Set(references.map((reference) => reference.instanceId)).size).toBe(1);
    expect(workers).toBe(0);
  });
});
