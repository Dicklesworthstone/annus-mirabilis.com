import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { WaveDescriptionLab } from "../components/lab/WaveDescriptionLab.tsx";
import { LQ01_DRAFT_TAPE } from "../experiments/lq01/draftTape.ts";
import type { PreparedLq01Example } from "../experiments/lq01/session.ts";
import { encodeTapePermalink } from "../experiments/permalink/codec.ts";
import { type DraftTapeBinding, draftTapeForSettings } from "../experiments/permalink/draftTape.ts";
import rawLq01Example from "../generated/lq01-example.json";
import { createContainer, installDom, removeContainer, uninstallDom } from "./reactDom.ts";

/**
 * A worker laboratory's shared ?tape= link (am-inst-permalink-tape-s677; 38999 "yes, replace"):
 * the shared settings reach the form, the reader is told to apply them, and nothing is calculated
 * until they do. The tape's ShareControl replaced each lab's older share button.
 */
beforeEach(async () => {
  await installDom();
});
afterEach(async () => {
  await uninstallDom();
});

async function openShared(
  lab: string,
  binding: DraftTapeBinding,
  settings: Record<string, unknown>,
  element: ReturnType<typeof createElement>,
  field: string,
): Promise<{ value: string; root: Element | null; text: string }> {
  const tape = draftTapeForSettings(binding, settings);
  expect(tape).not.toBeNull();
  if (!tape) return { value: "", root: null, text: "" };
  window.history.replaceState(null, "", `/lab/${lab}/?tape=${encodeTapePermalink(tape)}`);
  const container = createContainer();
  const root = createRoot(container);
  try {
    await act(async () => {
      root.render(element);
    });
    const read = () => container.querySelector<HTMLInputElement>(field)?.value ?? "";
    const before = read();
    // The load decompresses asynchronously; wait for the field to move off the defaults.
    for (let i = 0; i < 100 && read() === before; i++) {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
    }
    const lab = container.querySelector("[data-instrument-id]");
    return {
      value: read(),
      root: lab ? (lab.cloneNode(false) as Element) : null,
      text: container.textContent ?? "",
    };
  } finally {
    await act(async () => {
      root.unmount();
    });
    removeContainer(container);
    window.history.replaceState(null, "", "/");
  }
}

describe("a worker laboratory's shared link fills the form and calculates nothing", () => {
  test("LQ-01: the phase field shows the shared 1.5 rad, the reader is told to apply, and no run starts", async () => {
    const example = rawLq01Example as unknown as PreparedLq01Example;
    expect(LQ01_DRAFT_TAPE.defaults.delta).toBe(0);
    const opened = await openShared(
      "lq-01",
      LQ01_DRAFT_TAPE,
      { ...LQ01_DRAFT_TAPE.defaults, delta: 1.5 },
      createElement(WaveDescriptionLab, { example }),
      'input[id$="-delta"]',
    );
    expect(Number(opened.value)).toBe(1.5);
    expect(opened.text).toContain(
      "The shared link's settings are in the form. Apply them to calculate.",
    );
    // The older decoder no longer calls the tape's address an invalid settings link.
    expect(opened.text).not.toContain("This wave description link is incomplete or unsupported");
    // Still the build's worked example: no calculation was requested.
    expect(opened.root?.getAttribute("data-input-revision")).toBe("1");
    expect(opened.root?.getAttribute("data-pending")).toBe("false");
  });
});
