import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { CameraLab } from "../components/lab/CameraLab.tsx";
import { DriftDiffusionLab } from "../components/lab/DriftDiffusionLab.tsx";
import { InferenceLab } from "../components/lab/InferenceLab.tsx";
import { RodSimultaneityLab } from "../components/lab/RodSimultaneityLab.tsx";
import { TracerLab } from "../components/lab/TracerLab.tsx";
import { WalkLab } from "../components/lab/WalkLab.tsx";
import { WaveDescriptionLab } from "../components/lab/WaveDescriptionLab.tsx";
import { BM01_DRAFT_TAPE } from "../experiments/bm01/draftTape.ts";
import type { PreparedBm01Example } from "../experiments/bm01/session.ts";
import { BM04_DRAFT_TAPE } from "../experiments/bm04/draftTape.ts";
import type { PreparedBm04Example } from "../experiments/bm04/session.ts";
import { BM05_DRAFT_TAPE } from "../experiments/bm05/draftTape.ts";
import type { PreparedBm05Example } from "../experiments/bm05/session.ts";
import { BM07_DRAFT_TAPE } from "../experiments/bm07/draftTape.ts";
import type { PreparedBm07Example } from "../experiments/bm07/session.ts";
import { BM08_DRAFT_TAPE } from "../experiments/bm08/draftTape.ts";
import type { PreparedBm08Example } from "../experiments/bm08/session.ts";
import { LQ01_DRAFT_TAPE } from "../experiments/lq01/draftTape.ts";
import type { PreparedLq01Example } from "../experiments/lq01/session.ts";
import { decodeTapePermalink, encodeTapePermalink } from "../experiments/permalink/codec.ts";
import {
  type DraftTapeBinding,
  draftTapeForSettings,
  loadDraftTape,
} from "../experiments/permalink/draftTape.ts";
import { settingsFromTape } from "../experiments/permalink/sessionTape.ts";
import { SR03_DRAFT_TAPE } from "../experiments/sr03/draftTape.ts";
import type { PreparedSr03Example } from "../experiments/sr03/session.ts";
import rawBm01Example from "../generated/bm01-example.json";
import rawBm04Example from "../generated/bm04-example.json";
import rawBm05Example from "../generated/bm05-example.json";
import rawBm07Example from "../generated/bm07-example.json";
import rawBm08Example from "../generated/bm08-example.json";
import rawLq01Example from "../generated/lq01-example.json";
import rawSr03Example from "../generated/sr03-example.json";
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
): Promise<{ value: string; root: Element | null; text: string; shares: boolean }> {
  const tape = draftTapeForSettings(binding, settings);
  expect(tape).not.toBeNull();
  if (!tape) return { value: "", root: null, text: "", shares: false };
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
      shares: container.querySelector("[data-share-form]") !== null,
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
    expect(opened.shares).toBe(true);
  });

  test("BM-01: the seed field shows the shared seed, the reader is told to apply, and no worker starts", async () => {
    const example = rawBm01Example as unknown as PreparedBm01Example;
    expect(BM01_DRAFT_TAPE.defaults.seed).toBe("1905");
    const opened = await openShared(
      "bm-01",
      BM01_DRAFT_TAPE,
      { ...BM01_DRAFT_TAPE.defaults, seed: "2024" },
      createElement(TracerLab, { example }),
      'input[id$="-seed"]',
    );
    expect(opened.value).toBe("2024");
    expect(opened.text).toContain(
      "The shared link's settings are in the form. Apply them to calculate.",
    );
    expect(opened.text).not.toContain("This tracer link is incomplete or unsupported");
    expect(opened.root?.getAttribute("data-pending")).toBe("false");
    // The linked laboratory offers the tape's share control, the one the unlinked one must not.
    expect(opened.shares).toBe(true);
  });

  test("BM-01: the page's second, unlinked ensemble neither reads the link nor offers one", async () => {
    const example = rawBm01Example as unknown as PreparedBm01Example;
    const tape = draftTapeForSettings(BM01_DRAFT_TAPE, {
      ...BM01_DRAFT_TAPE.defaults,
      seed: "2024",
    });
    expect(tape).not.toBeNull();
    if (!tape) return;
    window.history.replaceState(null, "", `/lab/bm-01/?tape=${encodeTapePermalink(tape)}`);
    const container = createContainer();
    const root = createRoot(container);
    try {
      await act(async () => {
        root.render(createElement(TracerLab, { example, linked: false }));
      });
      for (let i = 0; i < 20; i++) {
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
        });
      }
      expect(container.querySelector<HTMLInputElement>('input[id$="-seed"]')?.value).toBe("1905");
      expect(container.textContent).not.toContain("The shared link's settings are in the form.");
      expect(container.querySelector("[data-share-form]")).toBeNull();
    } finally {
      await act(async () => {
        root.unmount();
      });
      removeContainer(container);
      window.history.replaceState(null, "", "/");
    }
  });

  /** One shared change per laboratory, each off its default and inside what the lab accepts. */
  const BROWNIAN: readonly {
    lab: string;
    binding: DraftTapeBinding;
    change: Record<string, unknown>;
    element: () => ReturnType<typeof createElement>;
    field: string;
    shown: string;
  }[] = [
    {
      lab: "bm-04",
      binding: BM04_DRAFT_TAPE,
      change: { profile: "step" },
      element: () =>
        createElement(DriftDiffusionLab, {
          example: rawBm04Example as unknown as PreparedBm04Example,
        }),
      field: 'select[id$="-profile"]',
      shown: "step",
    },
    {
      lab: "bm-05",
      binding: BM05_DRAFT_TAPE,
      change: { seed: "2024" },
      element: () =>
        createElement(WalkLab, { example: rawBm05Example as unknown as PreparedBm05Example }),
      field: 'input[id$="-seed"]',
      shown: "2024",
    },
    {
      lab: "bm-07",
      binding: BM07_DRAFT_TAPE,
      change: { d: 1 },
      element: () =>
        createElement(InferenceLab, { example: rawBm07Example as unknown as PreparedBm07Example }),
      field: 'select[id$="-d"]',
      shown: "1",
    },
    {
      lab: "bm-08",
      binding: BM08_DRAFT_TAPE,
      change: { dt: 2 },
      element: () =>
        createElement(CameraLab, { example: rawBm08Example as unknown as PreparedBm08Example }),
      field: 'select[id$="-dt"]',
      shown: "2",
    },
  ];

  for (const { lab, binding, change, element, field, shown } of BROWNIAN) {
    test(`${lab}: the shared setting reaches the form, the reader is told to apply, and no worker starts`, async () => {
      for (const [key, value] of Object.entries(change))
        expect(binding.defaults[key]).not.toBe(value);
      const opened = await openShared(
        lab,
        binding,
        { ...binding.defaults, ...change },
        element(),
        field,
      );
      expect(opened.value).toBe(shown);
      expect(opened.text).toContain(
        "The shared link's settings are in the form. Apply them to calculate.",
      );
      expect(opened.text).not.toContain("link is incomplete or unsupported");
      expect(opened.root?.getAttribute("data-pending") ?? "false").toBe("false");
      expect(opened.shares).toBe(true);
    });
  }

  /**
   * BM-07 and BM-08's older links always carried coverageTrials=0, and their decoders refuse any
   * other value: a reader runs a hundred hypothetical experiments on purpose, not by opening a
   * link. The tape keeps that. With an accepted trial that ran 100, the shared tape carries 0.
   */
  const COVERAGE: readonly {
    lab: string;
    binding: DraftTapeBinding;
    element: (coverageTrials: number) => ReturnType<typeof createElement>;
  }[] = [
    {
      lab: "bm-07",
      binding: BM07_DRAFT_TAPE,
      element: (coverageTrials) => {
        const example = rawBm07Example as unknown as PreparedBm07Example;
        return createElement(InferenceLab, {
          example: { ...example, parameters: { ...example.parameters, coverageTrials } },
        });
      },
    },
    {
      lab: "bm-08",
      binding: BM08_DRAFT_TAPE,
      element: (coverageTrials) => {
        const example = rawBm08Example as unknown as PreparedBm08Example;
        return createElement(CameraLab, {
          example: { ...example, parameters: { ...example.parameters, coverageTrials } },
        });
      },
    },
  ];

  for (const { lab, binding, element } of COVERAGE) {
    test(`${lab}: a shared tape carries no coverage experiments, even from a trial that ran 100`, async () => {
      const container = createContainer();
      const root = createRoot(container);
      try {
        await act(async () => {
          root.render(element(100));
        });
        let link = "";
        for (let i = 0; i < 100 && !link; i++) {
          await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 10));
          });
          link =
            container.querySelector<HTMLInputElement>('[data-testid="selectable-url"]')?.value ??
            "";
        }
        const decoded = decodeTapePermalink(link);
        expect(decoded.kind).toBe("success");
        if (decoded.kind !== "success") return;
        const shared = settingsFromTape(decoded.tape.initialConditions, binding.defaults);
        expect(shared.coverageTrials).toBe(0);
        // The rest of the accepted settings do travel: the seed is the example's.
        expect(shared.seed).toBe(binding.defaults.seed);
      } finally {
        await act(async () => {
          root.unmount();
        });
        removeContainer(container);
      }
    });
  }

  test("SR-03: the speed field shows the shared 0.8c, the reader is told to apply, and no worker starts", async () => {
    const example = rawSr03Example as unknown as PreparedSr03Example;
    expect(SR03_DRAFT_TAPE.defaults.v).toBe(0.6);
    const opened = await openShared(
      "sr-03",
      SR03_DRAFT_TAPE,
      { ...SR03_DRAFT_TAPE.defaults, v: 0.8 },
      createElement(RodSimultaneityLab, { example }),
      'input[id$="-v"]',
    );
    expect(Number(opened.value)).toBe(0.8);
    expect(opened.text).toContain(
      "The shared link's settings are in the form. Apply them to calculate.",
    );
    expect(opened.text).not.toContain("This rod simultaneity link is incomplete or unsupported");
    expect(opened.root?.getAttribute("data-pending")).toBe("false");
    expect(opened.shares).toBe(true);
  });

  test("SR-03: a custom event pair's optional coordinates travel in the tape", () => {
    // The defaults carry no custom coordinates; a tape keeps every key it carries.
    expect("customT1" in SR03_DRAFT_TAPE.defaults).toBe(false);
    const custom = { endpointPairId: "custom", customT1: 1, customX1: 2, customT2: 5, customX2: 3 };
    const tape = draftTapeForSettings(SR03_DRAFT_TAPE, { ...SR03_DRAFT_TAPE.defaults, ...custom });
    expect(tape).not.toBeNull();
    if (!tape) return;
    const loaded = loadDraftTape(SR03_DRAFT_TAPE, tape);
    expect(loaded.kind).toBe("loaded");
    if (loaded.kind === "loaded") expect(loaded.settings).toMatchObject(custom);
  });
});
