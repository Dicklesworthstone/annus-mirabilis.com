import assert from "node:assert/strict";
import test from "node:test";
import { nativeFacsimileClient, parseNativeFacsimileStatus } from "./facsimiles.ts";

const source = { key: "ap-18-639", pdfUrl: "/papers/pdfs/ap-18-639.pdf" };
const verified = {
  key: source.key,
  state: "verified",
  bytesExpected: 12345,
  bytesReceived: 12345,
  progress: 1,
  path: source.pdfUrl,
};

test("native PDF status binds verified bytes and the exact cached path to the selected source", () => {
  assert.deepEqual(parseNativeFacsimileStatus(verified, source), verified);
  for (const change of [
    { key: "ap-17-891" },
    { path: "https://annus-mirabilis.com/papers/pdfs/ap-18-639.pdf" },
    { path: "/papers/pdfs/other.pdf" },
    { path: undefined },
    { bytesReceived: 12344 },
    { bytesExpected: 0 },
    { progress: 0.99 },
    { progress: Number.NaN },
    { bytesReceived: -1 },
    { bytesExpected: Number.MAX_SAFE_INTEGER + 1 },
    { reason: "x".repeat(1025) },
    { state: "ready" },
  ])
    assert.equal(parseNativeFacsimileStatus({ ...verified, ...change }, source), null);
});

test("only verified statuses carry a navigable PDF path", () => {
  for (const state of ["not-downloaded", "downloading", "failed", "evicted", "unavailable"]) {
    const { path: _path, ...fields } = verified;
    const status = { ...fields, state };
    assert.ok(parseNativeFacsimileStatus(status, source));
    assert.equal(parseNativeFacsimileStatus({ ...status, path: source.pdfUrl }, source), null);
  }
});

test("the bridge sends only the selected pin key and keeps status separate from download", async () => {
  const requests: unknown[] = [];
  const host = {
    __AM_APP__: { bridgeVersion: 1 },
    webkit: {
      messageHandlers: {
        amEdition: {
          postMessage(message: unknown) {
            requests.push(message);
            return Promise.resolve({ status: "ok", value: verified });
          },
        },
      },
    },
    setTimeout,
    clearTimeout,
  } as unknown as Window;
  const client = nativeFacsimileClient(host, source);
  assert.ok(client);
  assert.deepEqual(requests, []);
  assert.deepEqual(await client.status(), verified);
  assert.deepEqual(requests, [{ v: 1, type: "facsimile.status", body: { key: source.key } }]);
  await client.request();
  assert.deepEqual(requests[1], { v: 1, type: "facsimile.request", body: { key: source.key } });
});

test("browsers are untouched and unavailable, rejected or failed hosts are plain results", async () => {
  assert.equal(nativeFacsimileClient({} as Window, source), null);
  assert.equal(
    nativeFacsimileClient({ __AM_APP__: { bridgeVersion: 2 } } as unknown as Window, source),
    null,
  );
  for (const reply of [
    { status: "unavailable" },
    { status: "missing" },
    { status: "rejected" },
    undefined,
  ]) {
    const host = {
      __AM_APP__: { bridgeVersion: 1 },
      webkit: { messageHandlers: { amEdition: { postMessage: () => reply } } },
      setTimeout,
      clearTimeout,
    } as unknown as Window;
    const result = await nativeFacsimileClient(host, source)?.status();
    if (reply?.status === "unavailable" || reply?.status === "missing")
      assert.equal(result?.state, "unavailable");
    else assert.equal(result, null);
  }
  const rejected = {
    __AM_APP__: { bridgeVersion: 1 },
    webkit: {
      messageHandlers: { amEdition: { postMessage: () => Promise.reject("host disconnected") } },
    },
    setTimeout,
    clearTimeout,
  } as unknown as Window;
  assert.equal(await nativeFacsimileClient(rejected, source)?.request(), null);
});

test("an unresponsive host has a bounded wait and returns a retryable empty result", async () => {
  let timeout: (() => void) | undefined;
  let cleared = false;
  const host = {
    __AM_APP__: { bridgeVersion: 1 },
    webkit: { messageHandlers: { amEdition: { postMessage: () => new Promise(() => {}) } } },
    setTimeout(callback: () => void, delay: number) {
      assert.equal(delay, 12_000);
      timeout = callback;
      return 1;
    },
    clearTimeout(id: number) {
      assert.equal(id, 1);
      cleared = true;
    },
  } as unknown as Window;
  const pending = nativeFacsimileClient(host, source)?.status();
  assert.ok(timeout);
  timeout();
  assert.equal(await pending, null);
  assert.equal(cleared, true);
});
