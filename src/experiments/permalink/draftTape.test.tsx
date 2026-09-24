import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, createElement, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../testing/reactDom.ts";
import { BM04_DEFAULTS } from "../bm04/definition.ts";
import { validateBm04Parameters } from "../bm04/parameters.ts";
import { decodeTapePermalink, encodeTapePermalink } from "./codec.ts";
import {
  type DraftTapeBinding,
  draftTapeForSettings,
  loadDraftTape,
  loadDraftTapeFromUrl,
} from "./draftTape.ts";
import { LabTapeLink, useDraftTapeLink } from "./LabTapeLink.tsx";
import { tapeStateDigest } from "./sessionTape.ts";
import type { TapeV2 } from "./types.ts";

/**
 * A worker laboratory's ?tape= link puts the shared settings into the form and starts nothing
 * (am-inst-permalink-tape-s677). BM-04's real validator and defaults, under its manifest's tapeModel,
 * stand for the worker laboratories: the loader never calls a session, so no worker is involved.
 */
const BINDING: DraftTapeBinding = Object.freeze({
  environment: Object.freeze({
    experimentId: "bm-04",
    mode: "bm-04:default",
    modelId: "brownian-motion-drift-diffusion",
    modelVersion: 1,
    constantSetId: "modern-si-2019",
    streamVersion: "deterministic",
    allocationId: "deterministic",
  }),
  defaults: BM04_DEFAULTS,
  validate: validateBm04Parameters,
});

/** Twice the default force: a real change, inside what BM-04 accepts. */
const SHARED = { ...BM04_DEFAULTS, F: BM04_DEFAULTS.F * 2 };

function sharedTape(): TapeV2 {
  const tape = draftTapeForSettings(BINDING, SHARED);
  expect(tape).not.toBeNull();
  return tape as TapeV2;
}

describe("a worker lab's tape carries settings, checked, into the form", () => {
  test("a shared link's settings come back exactly, through the codec", () => {
    expect(validateBm04Parameters(SHARED).kind).toBe("accepted");
    const decoded = decodeTapePermalink(
      `https://x.test/lab/bm-04/?tape=${encodeTapePermalink(sharedTape())}`,
    );
    expect(decoded.kind).toBe("success");
    if (decoded.kind !== "success") return;
    const loaded = loadDraftTape(BINDING, decoded.tape);
    expect(loaded).toEqual({ kind: "loaded", settings: SHARED });
  });

  test("settings a lab refuses make no tape", () => {
    expect(draftTapeForSettings(BINDING, { ...SHARED, T: -5 })).toBeNull();
  });

  test("altered settings fail the tape's own check", () => {
    const tape = sharedTape();
    const loaded = loadDraftTape(BINDING, {
      ...tape,
      initialConditions: { ...tape.initialConditions, F: BM04_DEFAULTS.F * 3 },
    });
    expect(loaded.kind).toBe("not-restored");
    if (loaded.kind === "not-restored")
      expect(loaded.notice).toContain("do not match the check it carries");
  });

  test("another laboratory's tape, or another model's, is refused by name", () => {
    const other = loadDraftTape(BINDING, { ...sharedTape(), experimentId: "bm-05" });
    expect(other.kind).toBe("not-restored");
    if (other.kind === "not-restored") expect(other.notice).toContain("another laboratory, bm-05");
    const model = loadDraftTape(BINDING, {
      ...sharedTape(),
      modelIdentity: { modelId: "brownian-motion-drift-diffusion", modelVersion: 2 },
    });
    expect(model.kind).toBe("not-restored");
    if (model.kind === "not-restored") expect(model.notice).toContain("@v2");
  });

  test("a tape that records changes one at a time is refused, not half-applied", () => {
    const loaded = loadDraftTape(BINDING, {
      ...sharedTape(),
      events: [{ actionIndex: 1, commandClass: "setup-change", paramId: "T", value: 300 }],
    });
    expect(loaded.kind).toBe("not-restored");
    if (loaded.kind === "not-restored") expect(loaded.notice).toContain("one at a time");
  });

  test("a setting the lab refuses is refused in the lab's own sentence, even with a matching check", () => {
    const tape = sharedTape();
    const initialConditions = { ...tape.initialConditions, T: -5 };
    const loaded = loadDraftTape(BINDING, {
      ...tape,
      initialConditions,
      acceptedCheckpoint: {
        ...tape.acceptedCheckpoint,
        digest: tapeStateDigest(initialConditions, 0),
      },
    });
    expect(loaded.kind).toBe("not-restored");
    if (loaded.kind === "not-restored") {
      expect(loaded.notice).toMatch(/^This shared state could not be restored\. \S/);
      expect(loaded.notice).not.toContain("Error");
    }
  });

  test("an address with no tape is absent, and one with a tape loads", async () => {
    expect(await loadDraftTapeFromUrl(BINDING, "https://x.test/lab/bm-04/")).toEqual({
      kind: "absent",
    });
    const loaded = await loadDraftTapeFromUrl(
      BINDING,
      `https://x.test/lab/bm-04/?tape=${encodeTapePermalink(sharedTape())}`,
    );
    expect(loaded).toEqual({ kind: "loaded", settings: SHARED });
  });
});

describe("a page opened from a worker lab's tape", () => {
  beforeEach(async () => {
    await installDom();
  });
  afterEach(async () => {
    await uninstallDom();
  });

  function Probe() {
    const [form, setForm] = useState<string>("defaults");
    const link = useDraftTapeLink(BINDING, BM04_DEFAULTS, true, (settings) =>
      setForm(String(settings.F)),
    );
    return createElement(
      "div",
      null,
      createElement("output", { "data-form": form }),
      createElement(LabTapeLink, { link }),
    );
  }

  test("puts the settings in the form and says so, without an error", async () => {
    window.history.replaceState(null, "", `/lab/bm-04/?tape=${encodeTapePermalink(sharedTape())}`);
    const container = createContainer();
    const root = createRoot(container);
    try {
      await act(async () => {
        root.render(createElement(Probe));
      });
      let form = "";
      for (let i = 0; i < 100 && form !== String(SHARED.F); i++) {
        await act(async () => {
          await new Promise((r) => setTimeout(r, 10));
        });
        form = container.querySelector("output")?.getAttribute("data-form") ?? "";
      }
      expect(form).toBe(String(SHARED.F));
      expect(container.querySelector("[data-tape-loaded]")?.textContent).toContain(
        "Apply them to calculate",
      );
      expect(container.querySelector("[data-tape-notice]")).toBeNull();
    } finally {
      await act(async () => {
        root.unmount();
      });
      removeContainer(container);
      window.history.replaceState(null, "", "/");
    }
  });
});
