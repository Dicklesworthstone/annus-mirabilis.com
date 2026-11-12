import { afterEach, beforeEach, expect, spyOn, test } from "bun:test";
import assert from "node:assert/strict";
import { act, useLayoutEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createContainer, installDom, uninstallDom } from "../../testing/reactDom.ts";
import { ME01_TAPE } from "../me01/tape.ts";
import * as browserCodec from "./browserCodec.ts";
import { encodeTapePermalink } from "./codec.ts";
import { ShareControl } from "./ShareControl.tsx";
import { tapeForSettings } from "./sessionTape.ts";
import type { TapeV2 } from "./types.ts";

let root: Root | null = null;
let restoreEncoder: (() => void) | null = null;
let jobs: { tape: TapeV2; release(): void; fail(): void }[] = [];

beforeEach(async () => {
  await installDom();
  jobs = [];
  // Hold only the async codec boundary, restoring its real export after each test. Happy DOM's
  // streams do not drive a custom TransformStream reliably. ShareControl.test.tsx and
  // browserCodec.test.ts retain real browser compression and cross-codec round-trip coverage.
  const encoder = spyOn(browserCodec, "encodeTapePermalinkInBrowser").mockImplementation(
    (recorded, options) => {
      const encoded = encodeTapePermalink(recorded, options);
      let settled = false;
      return new Promise<string>((resolve, reject) => {
        jobs.push({
          tape: recorded,
          release() {
            if (settled) return;
            settled = true;
            resolve(encoded);
          },
          fail() {
            if (settled) return;
            settled = true;
            reject(new Error("Compression could not complete"));
          },
        });
      });
    },
  );
  restoreEncoder = () => encoder.mockRestore();
  root = createRoot(createContainer());
});
afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  for (const job of jobs) job.release();
  restoreEncoder?.();
  restoreEncoder = null;
  await uninstallDom();
});
async function until(predicate: () => boolean) {
  const end = Date.now() + 5000;
  while (!predicate()) {
    assert.ok(Date.now() < end, "The share encoder must reach its controlled boundary.");
    await act(async () => new Promise((resolve) => setTimeout(resolve, 2)));
  }
}
function state() {
  const copy = document.querySelector<HTMLButtonElement>('[data-testid="copy-button"]');
  const url = document.querySelector<HTMLInputElement>('[data-testid="selectable-url"]');
  assert.ok(copy && url);
  return { copy, url };
}
function tape(speed: number) {
  const value = tapeForSettings(ME01_TAPE, { ...ME01_TAPE.defaults, frameSpeed: speed });
  assert.ok(value);
  return value;
}

type CommittedShare = Readonly<{ url: string; disabled: boolean }>;
function ObservedShare({
  recorded,
  baseUrl,
  onCommit,
}: Readonly<{
  recorded: TapeV2;
  baseUrl: string;
  onCommit(value: CommittedShare): void;
}>) {
  // Observe the DOM after this prop change commits, before passive effects can clear a stale URL.
  // An implementation which clears the URL only in useEffect must fail this regression.
  useLayoutEffect(() => {
    const { copy, url } = state();
    onCommit({ url: url.value, disabled: copy.disabled });
  });
  return <ShareControl tape={recorded} baseUrl={baseUrl} />;
}
async function render(recorded: TapeV2, baseUrl: string): Promise<CommittedShare> {
  let committed: CommittedShare | undefined;
  await act(async () =>
    root?.render(
      <ObservedShare
        recorded={recorded}
        baseUrl={baseUrl}
        onCommit={(value) => {
          committed = value;
        }}
      />,
    ),
  );
  assert.ok(committed, "The mounted share control must commit its changed props.");
  return committed;
}

test("changing accepted state immediately retires its old URL and a late encoder cannot replace the newest share", async () => {
  const baseUrl = "https://example.test/lab/me-01/";
  const firstTape = tape(0.1);
  expect(await render(firstTape, baseUrl)).toEqual({ url: "", disabled: true });
  await until(() => jobs.length === 1);
  expect(jobs[0]?.tape).toEqual(firstTape);
  await act(async () => jobs[0]?.release());
  await until(() => state().url.value.length > 0);
  const first = state().url.value;
  expect(first).toBe(`${baseUrl}?tape=${encodeTapePermalink(firstTape)}`);
  expect(await render(tape(0.2), baseUrl)).toEqual({ url: "", disabled: true });
  await until(() => jobs.length === 2);
  const newestTape = tape(0.3);
  expect(await render(newestTape, baseUrl)).toEqual({ url: "", disabled: true });
  await until(() => jobs.length === 3);
  await act(async () => jobs[2]?.release());
  await until(() => state().url.value.length > 0);
  const newest = state().url.value;
  expect(newest).toBe(`${baseUrl}?tape=${encodeTapePermalink(newestTape)}`);
  expect(newest).not.toBe(first);
  await act(async () => jobs[1]?.release());
  expect(state().url.value).toBe(newest);
  expect(state().copy.disabled).toBe(false);
});

test("a different destination or failed encoding cannot keep the prior valid link enabled", async () => {
  const recorded = tape(0.6);
  await render(recorded, "https://example.test/first/");
  await until(() => jobs.length === 1);
  await act(async () => jobs[0]?.release());
  await until(() => state().url.value.includes("/first/"));
  expect(await render(recorded, "https://example.test/second/")).toEqual({
    url: "",
    disabled: true,
  });
  await until(() => jobs.length === 2);
  await act(async () => jobs[1]?.fail());
  await until(() => document.querySelector('[role="alert"]') !== null);
  expect(state().url.value).toBe("");
  expect(state().copy.disabled).toBe(true);
  expect(document.body.textContent).toContain("Your accepted result remains available");
});
