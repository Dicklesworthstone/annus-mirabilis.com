import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { TransformStream as NativeTransformStream } from "node:stream/web";
import { act, useSyncExternalStore } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../testing/reactDom.ts";
import { createMe01Session } from "../me01/session.ts";
import { ME01_TAPE } from "../me01/tape.ts";
import { encodeTapePermalink } from "./codec.ts";
import { type LabTapeLinkState, useLabTapeLink } from "./LabTapeLink.tsx";
import { restoreTapeFromUrl, tapeForSettings } from "./sessionTape.ts";

let root: Root | null = null;
let container: HTMLElement;

beforeEach(async () => {
  await installDom();
  container = createContainer();
});
afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  removeContainer(container);
  await uninstallDom();
});

function sharedUrl() {
  const tape = tapeForSettings(ME01_TAPE, { ...ME01_TAPE.defaults, frameSpeed: 0.25 });
  assert.ok(tape, "The real laboratory must accept the shared settings.");
  return `http://localhost/lab/me-01/?tape=${encodeTapePermalink(tape)}`;
}

function deferred() {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function bounded(promise: Promise<void>) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new Error("The real tape operation did not finish.")),
          2000,
        );
      }),
    ]);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

/** Pause only platform stream delivery; the real decompressor, codec and laboratory still run. */
function holdDecompression() {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "DecompressionStream");
  assert.ok(descriptor, "The runtime must provide the browser decompression API.");
  const NativeDecompressionStream = globalThis.DecompressionStream;
  const entered = deferred();
  const released = deferred();
  const finished = deferred();
  class HeldDecompressionStream {
    readonly readable;
    readonly writable;
    constructor(format: CompressionFormat) {
      const native = new NativeDecompressionStream(format);
      this.writable = native.writable;
      this.readable = native.readable.pipeThrough(
        new NativeTransformStream<Uint8Array, Uint8Array>({
          async transform(chunk, controller) {
            entered.resolve();
            await released.promise;
            controller.enqueue(chunk);
          },
          flush() {
            finished.resolve();
          },
        }),
      );
    }
  }
  Object.defineProperty(globalThis, "DecompressionStream", {
    configurable: true,
    writable: true,
    value: HeldDecompressionStream,
  });
  return {
    entered: () => bounded(entered.promise),
    finished: () => bounded(finished.promise),
    release: released.resolve,
    restore() {
      released.resolve();
      Object.defineProperty(globalThis, "DecompressionStream", descriptor);
    },
  };
}

describe("URL restoration cancellation preserves the accepted owner", () => {
  test("an already aborted request is refused while an ordinary URL stays absent", async () => {
    const owner = createMe01Session("tape-pre-aborted");
    const before = owner.getSnapshot();
    const controller = new AbortController();
    controller.abort();
    const result = await restoreTapeFromUrl(ME01_TAPE, owner, sharedUrl(), controller.signal);
    expect(result.kind).toBe("not-restored");
    if (result.kind === "not-restored") expect(result.notice).toContain("canceled");
    expect(owner.getSnapshot()).toBe(before);
    expect(
      await restoreTapeFromUrl(ME01_TAPE, owner, "http://localhost/lab/me-01/", controller.signal),
    ).toEqual({ kind: "absent" });
  });

  test("aborting during actual decoding prevents any live restore", async () => {
    const owner = createMe01Session("tape-aborted-during-decode");
    const before = owner.getSnapshot();
    const controller = new AbortController();
    const held = holdDecompression();
    try {
      const pending = restoreTapeFromUrl(ME01_TAPE, owner, sharedUrl(), controller.signal);
      await held.entered();
      expect(owner.getSnapshot()).toBe(before);
      controller.abort();
      held.release();
      const result = await pending;
      expect(result.kind).toBe("not-restored");
      if (result.kind === "not-restored") expect(result.notice).toContain("canceled");
      expect(owner.getSnapshot()).toBe(before);
    } finally {
      held.restore();
    }
  });

  test("an active signal preserves the existing successful result shape", async () => {
    const owner = createMe01Session("tape-active-signal");
    const controller = new AbortController();
    expect(await restoreTapeFromUrl(ME01_TAPE, owner, sharedUrl(), controller.signal)).toEqual({
      kind: "restored",
    });
    expect(owner.acceptedParameters().frameSpeed).toBe(0.25);
  });

  for (const departure of ["unmount", "disabled", "URL opt-out"] as const) {
    test(`${departure} during decoding preserves the owner and allows a later fresh restore`, async () => {
      const owner = createMe01Session(`tape-cleanup-${departure}`);
      const before = owner.getSnapshot();
      const received = deferred();
      const calls: object[] = [];
      let current: LabTapeLinkState | null = null;
      function Probe({ enabled = true, restoreFromLocation = true }) {
        const view = useSyncExternalStore(
          owner.subscribe,
          owner.getSnapshot,
          owner.getServerSnapshot,
        );
        current = useLabTapeLink(
          ME01_TAPE,
          owner,
          view.accepted?.parameters,
          enabled,
          (parameters) => {
            calls.push(parameters);
            received.resolve();
          },
          { restoreFromLocation },
        );
        return null;
      }
      function link() {
        assert.ok(current, "The mounted hook must expose its real link state.");
        return current;
      }
      window.history.replaceState({}, "", sharedUrl());
      const held = holdDecompression();
      try {
        root = createRoot(container);
        await act(async () => root?.render(<Probe />));
        await held.entered();
        expect(owner.getSnapshot()).toBe(before);
        if (departure === "unmount") {
          await act(async () => root?.unmount());
          root = null;
        } else {
          await act(async () =>
            root?.render(
              <Probe
                enabled={departure !== "disabled"}
                restoreFromLocation={departure !== "URL opt-out"}
              />,
            ),
          );
        }
        await act(async () => {
          held.release();
          await held.finished();
          // Drain the decoder's continuation after observing its final stream delivery.
          await new Promise<void>((resolve) => setTimeout(resolve, 0));
        });
        expect(owner.getSnapshot()).toBe(before);
        expect(calls).toEqual([]);
        expect(link().notice).toBe("");
        if (departure === "URL opt-out") expect(link().shareTape).not.toBeNull();
        if (departure === "disabled") expect(link().shareTape).toBeNull();

        if (!root) root = createRoot(container);
        await act(async () => {
          root?.render(<Probe />);
        });
        await act(async () => bounded(received.promise));
        expect(owner.acceptedParameters().frameSpeed).toBe(0.25);
        expect(calls).toEqual([{ ...ME01_TAPE.defaults, frameSpeed: 0.25 }]);
      } finally {
        held.restore();
      }
    });
  }
});
