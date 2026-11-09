import { afterAll, afterEach, beforeEach, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { TracerLab } from "../components/lab/TracerLab.tsx";
import { BM01_DEFAULTS } from "../experiments/bm01/definition.ts";
import { encodeTapePermalink } from "../experiments/permalink/codec.ts";
import { draftTapeForSettings } from "../experiments/permalink/draftTape.ts";
import { bm01Laboratory, bm01ReplayFixture } from "./bm01ReplayHarness.ts";
import { TestLogger } from "./log/logger.ts";
import { installDom, uninstallDom } from "./reactDom.ts";

const fixture = await bm01ReplayFixture();
const logger = new TestLogger("bm01-walkthrough-form");
afterAll(() => logger.flush());
let root: Root | null = null;
let labs: ReturnType<typeof bm01Laboratory>[];
beforeEach(async () => {
  await installDom({ intersections: "visible" });
  labs = [];
});
afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  for (const lab of labs) lab.session.disconnect();
  await uninstallDom();
});
function laboratory(options: Parameters<typeof bm01Laboratory>[1] = {}) {
  const lab = bm01Laboratory(fixture, options);
  labs.push(lab);
  return lab;
}
async function mount(search: string, lab: ReturnType<typeof bm01Laboratory>) {
  window.history.replaceState({}, "", `/lab/bm-01/${search}`);
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () =>
    root?.render(
      <TracerLab
        example={fixture.example}
        workerFactory={lab.factory}
        instanceId="brownian-walkthrough"
      />,
    ),
  );
}
async function until(check: () => boolean) {
  for (let attempt = 0; attempt < 300 && !check(); attempt++)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  expect(check()).toBe(true);
}
async function click(label: string) {
  const button = [...document.querySelectorAll("button")].find(
    (entry) => entry.textContent?.trim() === label,
  );
  assert.ok(button, label);
  await act(async () => button.click());
}
function input(name: string): HTMLInputElement {
  const element = document.querySelector<HTMLInputElement>(`input[name="${name}"]`);
  assert.ok(element, name);
  return element;
}
async function typeDraft(name: string, value: string) {
  const field = input(name);
  const key = Object.keys(field).find((candidate) => candidate.startsWith("__reactProps$"));
  const handler = key
    ? (field as unknown as Record<string, { onChange(event: unknown): void }>)[key]
    : undefined;
  assert.ok(handler, "React must install the input's actual onChange handler.");
  await act(async () => {
    field.value = value;
    handler.onChange({ target: field, currentTarget: field });
  });
}
const instrument = () => document.querySelector('[data-instrument-id="bm-01"]');
const outcome = () =>
  document.querySelector("[data-walkthrough-outcome]")?.getAttribute("data-walkthrough-outcome");

test("an ordinary source-pinned Brownian URL loads exact constants, seed and grid as a draft with no worker", async () => {
  const lab = laboratory();
  const settings = {
    ...BM01_DEFAULTS,
    constantSetId: "einstein-1905-brownian-printed",
    seed: "9007199254740993",
    M: 10,
    H: 2,
  };
  const tape = draftTapeForSettings(lab.binding, settings);
  assert.ok(tape);
  await mount(`?tape=${encodeTapePermalink(tape)}`, lab);
  await until(() => document.querySelector("[data-tape-loaded]") !== null);
  expect(input("seed").value).toBe("9007199254740993");
  expect(input("M").value).toBe("10");
  expect(input("H").value).toBe("2");
  expect(document.querySelector<HTMLSelectElement>('select[name="constantSetId"]')?.value).toBe(
    settings.constantSetId,
  );
  expect(instrument()?.getAttribute("data-execution-label")).toBe("static");
  expect(instrument()?.getAttribute("data-pending")).toBe("false");
  expect(document.querySelector('[data-constant-set-id="modern-si-2019"]')).not.toBeNull();
  expect(lab.channels).toHaveLength(0);
  expect(document.querySelector("[data-tape-notice]")).toBeNull();
  expect(outcome()).toBeUndefined();
  logger.log({ testId: "exact-shared-draft-no-worker", instrumentId: "bm-01", outcome: "passed" });
});

test("the real Brownian player waits for acceptance and preserves a newer draft before reverse seeking", async () => {
  const lab = laboratory({ hold: (channel) => channel === 1 });
  await mount("?walkthrough=einstein-0-8-micron&stop=2", lab);
  await until(
    () =>
      document
        .querySelector("[data-walkthrough-checkpoint]")
        ?.getAttribute("data-walkthrough-checkpoint") === "2",
  );
  expect(lab.channels).toHaveLength(0);
  expect(document.body.textContent).not.toContain("link is incomplete or unsupported");
  await click("Inspect previous checkpoint");
  await click("Inspect next checkpoint");
  expect(lab.channels).toHaveLength(0);
  const originalRun = instrument()?.getAttribute("data-run-id");
  await click("Restore checkpoint");
  await until(() => (lab.channels[1]?.results.length ?? 0) > 0);
  expect(outcome()).toBeUndefined();
  expect(instrument()?.getAttribute("data-pending")).toBe("true");
  expect(instrument()?.getAttribute("data-run-id")).toBe(originalRun);
  await typeDraft("seed", "9007199254740993");
  await typeDraft("interval", "0.4");
  await act(async () => lab.channels[1]?.release());
  await until(() => outcome() === "replayed");
  expect(instrument()?.getAttribute("data-pending")).toBe("false");
  expect(instrument()?.getAttribute("data-recording-draws")).toBe("1800000");
  expect(input("seed").value).toBe("9007199254740993");
  expect(input("interval").value).toBe("0.4");
  expect(document.body.textContent).toContain("Your newer entries are still in the form");
  expect(
    document.querySelector('[data-constant-set-id="einstein-1905-brownian-printed"]'),
  ).not.toBeNull();
  expect(lab.channels[0]?.disposed).toBe(true);

  await click("Restore checkpoint");
  await until(() => input("seed").value === "1905" && input("interval").value === "60");
  expect(document.body.textContent).not.toContain("Your newer entries are still in the form");
  const sameRun = instrument()?.getAttribute("data-run-id");
  await click("Inspect previous checkpoint");
  await click("Restore checkpoint");
  await until(() => input("interval").value === "1");
  expect(instrument()?.getAttribute("data-run-id")).toBe(sameRun);
  expect(lab.channels[1]?.recordings).toBe(1);
  expect(lab.channels[1]?.requests).toBe(3);
  expect(instrument()?.getAttribute("data-recording-reused")).toBe("1");
  logger.log({
    testId: "real-player-late-acceptance-keeps-draft",
    instrumentId: "bm-01",
    outcome: "passed",
  });
}, 15_000);

test("closing a Brownian player during live restoration disposes both owners and ignores the delayed reply", async () => {
  const lab = laboratory({ hold: (channel) => channel === 1 });
  await mount("?walkthrough=einstein-0-8-micron&stop=1", lab);
  await until(() => document.querySelector("[data-walkthrough-checkpoint]") !== null);
  await click("Restore checkpoint");
  await until(() => (lab.channels[1]?.results.length ?? 0) > 0);
  await act(async () => root?.unmount());
  root = null;
  expect(lab.channels.every((channel) => channel.disposed)).toBe(true);
  await act(async () => lab.channels[1]?.release());
  expect(document.querySelector("[data-walkthrough-outcome]")).toBeNull();
  logger.log({
    testId: "closing-player-cancels-owned-work",
    instrumentId: "bm-01",
    outcome: "passed",
  });
}, 15_000);
