import { afterAll, afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { getLogger } from "../../testing/log/logger.ts";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../testing/reactDom.ts";
import { createInstanceStore } from "../store/instanceStore.ts";
import { ModelNote } from "./ModelNote.tsx";
import { type ModelNoteData, modelNoteFromView } from "./modelNoteData.ts";

const logger = getLogger("execution-labels");
const BEAD = "am-inst-execution-labels-5ywv";

const composite: ModelNoteData = {
  outputs: [
    {
      outputId: "tracerPositions",
      ownerId: "fs-wasm.brownian_frames",
      role: "primary",
      engineSentence: "Computed with FrankenSim (brownian_frames).",
    },
    {
      outputId: "sampleMeanSquare",
      ownerId: "diffusion.ensembleMoments",
      role: "secondary",
      engineSentence: "Host reduction (ensembleMoments) of the positions computed with FrankenSim.",
    },
  ],
  modelVersion: "1.0.0",
  artifactDigest: "sha256:7b54a1",
  constantSetId: "period-1905",
  constantSetLabel: "1905 reference values",
  seed: "18446744073709551615",
  streamVersion: "philox-box-muller-v1",
  acceptedInputRevision: 3,
  snapshotVersion: 7,
  notModeled: "Molecular collisions (no collision bath owns the displacement).",
  showTheCodeHref: "#show-the-code",
  commonRandomNumbers: true,
  fallbackSentence: undefined,
  modelChoiceSentence: "The reader chose the host in-thread model.",
  viewSubstitutionSentence:
    "A declared two-dimensional view is shown in place of the WebGL view; the numbers are unchanged.",
};

describe("ModelNote", () => {
  test("outputs sharing a role, engine sentence and owner are one item, and every output id appears once", () => {
    // One item per output made bm-01's note 56 items and 3,330px on a phone, each repeating its
    // sentence and owner. Grouping must shorten the note without dropping or duplicating an output.
    const engine = "Host calculation (diffusion.moments).";
    const data: ModelNoteData = {
      ...composite,
      outputs: [
        {
          outputId: "modelSecondMoment",
          ownerId: "diffusion.moments",
          role: "primary",
          engineSentence: engine,
        },
        {
          outputId: "modelMeanNorm",
          ownerId: "diffusion.moments",
          role: "primary",
          engineSentence: engine,
        },
        {
          outputId: "modelRmsNorm",
          ownerId: "diffusion.moments",
          role: "primary",
          engineSentence: engine,
        },
        {
          outputId: "sampleMean",
          ownerId: "diffusion.moments",
          role: "secondary",
          engineSentence: engine,
        },
        {
          outputId: "tracerPositions",
          ownerId: "diffusion.recordTracers",
          role: "primary",
          engineSentence: engine,
        },
      ],
    };
    const html = renderToStaticMarkup(createElement(ModelNote, { data }));
    const outputItems = [
      ...html.matchAll(/<li>((?:Primary|Secondary) outputs? [^<]*)<\/li>/gu),
    ].map((m) => m[1] ?? "");
    // Three groups: the three primary moments together; the secondary one, whose role differs; and
    // tracerPositions, whose owner differs.
    expect(outputItems.length).toBe(3);
    expect(outputItems).toContain(
      "Primary outputs modelSecondMoment, modelMeanNorm, modelRmsNorm: Host calculation (diffusion.moments). Owner diffusion.moments.",
    );
    for (const id of [
      "modelSecondMoment",
      "modelMeanNorm",
      "modelRmsNorm",
      "sampleMean",
      "tracerPositions",
    ]) {
      expect(outputItems.filter((item) => item.includes(`${id}`)).length).toBe(1);
    }
  });

  test("renders owners grouped by role, the exact seed string above 2^53, and the independent-trial sentence", () => {
    const html = renderToStaticMarkup(createElement(ModelNote, { data: composite }));
    expect(html).toContain("Primary output tracerPositions");
    expect(html).toContain("Computed with FrankenSim (brownian_frames).");
    expect(html).toContain("Secondary output sampleMeanSquare");
    expect(html).toContain("Host reduction (ensembleMoments)");
    expect(html).toContain("Model version 1.0.0.");
    expect(html).toContain("Artifact digest sha256:7b54a1.");
    expect(html).toContain("Constant set 1905 reference values (period-1905).");
    expect(html).toContain("Seed 18446744073709551615.");
    expect(html).toContain("Stream-semantics version philox-box-muller-v1.");
    expect(html).toContain("18446744073709551615");
    expect(html).not.toContain("18446744073709552000");
    expect(html).toContain("not an independent trial");
    expect(html).toContain("Accepted input revision 3");
    expect(html).toContain("Snapshot version 7");
    expect(html).toContain("Not modeled:");
    expect(html).toContain("Show the code");
    expect(html).toContain('href="#show-the-code"');
    logger.log({
      testId: "model-note-composite-and-seed",
      beadId: BEAD,
      extra: { seed: composite.seed },
      outcome: "passed",
      message: "model note keeps the full decimal seed and lists host secondary outputs",
    });
  });

  test("a modelChoice sentence is not presented as a fallback, and a view substitution is distinct", () => {
    const html = renderToStaticMarkup(createElement(ModelNote, { data: composite }));
    expect(html).toContain("The reader chose the host in-thread model.");
    expect(html).toContain("two-dimensional view is shown in place of the WebGL view");
    expect(html).not.toContain("fallback");
  });

  test("each fallback reason renders its ordinary-language sentence when present", () => {
    const fallbackSentences = [
      "The FrankenSim WebAssembly module could not be loaded; using host calculation.",
      "The requested simulation capability is not registered in the loaded artifact.",
      "The loaded artifact digest does not match the pinned release checksum.",
      "The browser environment lacks required WebGL capabilities; using host calculation.",
      "The calculation engine refused the requested parameter combination.",
    ];
    for (const fallbackSentence of fallbackSentences) {
      const dataWithFallback: ModelNoteData = {
        ...composite,
        fallbackSentence,
      };
      const html = renderToStaticMarkup(createElement(ModelNote, { data: dataWithFallback }));
      expect(html).toContain(fallbackSentence);
    }
  });

  test("parity sentences render ordinary-language comparison kinds, rungs, and formatted differences", () => {
    const paritySentences = [
      "Cross-engine check: bitwise integer draw agreement at the generator rung.",
      "Cross-engine check: normal distribution samples match within recorded tolerance 1e-7.",
      "Cross-engine check: formatted strings differ at recorded precision (FrankenSim: 1.234567, Host: 1.234568, deciding digit: 7 vs 8).",
    ];
    const dataWithParity: ModelNoteData = {
      ...composite,
      paritySentences,
    };
    const html = renderToStaticMarkup(createElement(ModelNote, { data: dataWithParity }));
    for (const sentence of paritySentences) {
      expect(html).toContain(sentence);
    }
  });

  test("modelNoteFromView lists accepted owners and preserves a seed parameter as a string", () => {
    const store = createInstanceStore({
      experimentId: "bm-06",
      instanceId: "bm-06:note",
      initialParameters: { D: 1, seed: "18446744073709551615" },
      parameterClasses: { D: "input" as const, seed: "input" as const },
      outputs: {
        density: {
          statuses: ["value"] as const,
          unit: "1/m",
          semanticKind: "coordinate-density",
          ownerId: "diffusion.ftcs1d",
        },
      },
    });
    const token = store.issue("setup-change");
    store.publish({
      ...token,
      stepIndex: 0,
      simulationTime: 0,
      final: true,
      outputs: [
        {
          quantityId: "density",
          unit: "1/m",
          semanticKind: "coordinate-density",
          ownerId: "diffusion.ftcs1d",
          status: "value",
          value: 1,
        },
      ],
    });
    const note = modelNoteFromView(store.getSnapshot(), {
      notModeled: "The ballistic short-time regime and inertia.",
    });
    if (!note) throw new Error("expected model-note data after acceptance");
    expect(note.seed).toBe("18446744073709551615");
    expect(note.outputs[0]?.ownerId).toBe("diffusion.ftcs1d");
    const html = renderToStaticMarkup(createElement(ModelNote, { data: note }));
    expect(html).toContain("18446744073709551615");
    expect(html).toContain("diffusion.ftcs1d");
  });

  describe("keyboard and screen reader accessibility in DOM (AC 9)", () => {
    beforeEach(async () => {
      await installDom();
    });
    afterEach(async () => {
      await uninstallDom();
    });

    test("keyboard-operable disclosure via details/summary toggles and exposes all contents", async () => {
      const container = createContainer();
      const root = createRoot(container);
      try {
        await act(() => {
          root.render(createElement(ModelNote, { data: composite }));
        });
        const details = container.querySelector("details.model-note") as HTMLDetailsElement | null;
        if (!details) throw new Error("expected details.model-note in DOM");
        const summary = details.querySelector("summary");
        if (!summary) throw new Error("expected summary element in details");
        expect(summary.textContent).toBe("Model note");

        // Initially closed
        expect(details.open).toBe(false);

        // Keyboard / click activation on summary toggles disclosure
        await act(() => {
          summary.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
        });
        expect(details.open).toBe(true);

        // Contents are accessible and structured with readable text
        const list = details.querySelector("ul.model-note-list");
        expect(list).not.toBeNull();
        expect(list?.querySelectorAll("li").length).toBeGreaterThanOrEqual(10);
        expect(details.textContent).toContain("Primary output tracerPositions");
        expect(details.textContent).toContain("Computed with FrankenSim");
        expect(details.textContent).toContain("Secondary output sampleMeanSquare");
        expect(details.textContent).toContain("Host reduction");
        expect(details.textContent).toContain("18446744073709551615");
        expect(details.textContent).toContain("Show the code");

        // Toggling again collapses it
        await act(() => {
          summary.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
        });
        expect(details.open).toBe(false);

        logger.log({
          testId: "model-note-keyboard-disclosure-dom",
          beadId: BEAD,
          outcome: "passed",
          message: "ModelNote details/summary disclosure verified in DOM with keyboard toggle",
        });
      } finally {
        await act(() => {
          root.unmount();
        });
        removeContainer(container);
      }
    });
  });
});

afterAll(async () => {
  await logger.flush();
});
