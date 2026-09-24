import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { BoundaryLedgerLab } from "../components/lab/me03/BoundaryLedgerLab.tsx";
import { DopplerAberrationLab } from "../components/lab/sr09/DopplerAberrationLab.tsx";
import { ME03_TAPE } from "../experiments/me03/tape.ts";
import { encodeTapePermalink } from "../experiments/permalink/codec.ts";
import type { LabTapeBinding } from "../experiments/permalink/sessionTape.ts";
import { tapeForSettings } from "../experiments/permalink/sessionTape.ts";
import type { PreparedSr09Example } from "../experiments/sr09/session.ts";
import { SR09_TAPE } from "../experiments/sr09/tape.ts";
import rawSr09Example from "../generated/sr09-example.json";
import { createContainer, installDom, removeContainer, uninstallDom } from "./reactDom.ts";

/**
 * A laboratory opened from a shared ?tape= link shows the shared settings in its own form, not only
 * in its results (am-inst-permalink-tape-s677).
 *
 * The form keeps a draft of its own. Seeded once from the defaults, it went on showing them over the
 * restored results, and pressing Apply put the defaults back: 13 of 13 laboratories that submit a
 * form lost the shared settings that way, measured in Chromium on a build of 4c0c2c7c. The two here
 * seed their drafts differently, SR-09 with the settings themselves and ME-03 with text fields.
 */
beforeEach(async () => {
  await installDom();
});
afterEach(async () => {
  await uninstallDom();
});

async function openShared(
  lab: string,
  binding: LabTapeBinding,
  settings: Record<string, unknown>,
  element: ReturnType<typeof createElement>,
  field: string,
): Promise<string> {
  const tape = tapeForSettings(binding, settings);
  expect(tape).not.toBeNull();
  if (!tape) return "";
  window.history.replaceState(null, "", `/lab/${lab}/?tape=${encodeTapePermalink(tape)}`);
  const container = createContainer();
  const root = createRoot(container);
  try {
    await act(async () => {
      root.render(element);
    });
    const read = () => container.querySelector<HTMLInputElement>(field)?.value ?? "";
    const before = read();
    // The restore decompresses asynchronously; wait for the field to move off the defaults.
    for (let i = 0; i < 100 && read() === before; i++) {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
    }
    expect(container.querySelector("[data-tape-notice]")).toBeNull();
    return read();
  } finally {
    await act(async () => {
      root.unmount();
    });
    removeContainer(container);
    window.history.replaceState(null, "", "/");
  }
}

describe("a shared link's settings reach the laboratory's form", () => {
  test("SR-09: the frame-speed field shows the shared 0.8, not the default 0.6", async () => {
    const example = rawSr09Example as unknown as PreparedSr09Example;
    expect(SR09_TAPE.defaults.beta).toBe(0.6);
    const value = await openShared(
      "sr-09",
      SR09_TAPE,
      { ...SR09_TAPE.defaults, beta: 0.8 },
      createElement(DopplerAberrationLab, { example }),
      'input[name="beta"]',
    );
    expect(Number(value)).toBe(0.8);
  });

  test("ME-03: the 1906 box's mass field shows the shared 3 kg, not the default 1", async () => {
    expect(ME03_TAPE.defaults.boxMass).toBe(1);
    const value = await openShared(
      "me-03",
      ME03_TAPE,
      { ...ME03_TAPE.defaults, mode: "box-1906", boxMass: 3, boxLength: 2, pulseEnergy: 5 },
      createElement(BoundaryLedgerLab, {}),
      'form[aria-label="1906 box parameters"] input',
    );
    expect(Number(value)).toBe(3);
  });
});
