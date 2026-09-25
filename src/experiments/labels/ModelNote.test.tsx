import { afterAll, afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { QUANTITY_LABELS } from "../../generated/quantity-labels.ts";
import { getLogger } from "../../testing/log/logger.ts";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../testing/reactDom.ts";
import { createInstanceStore } from "../store/instanceStore.ts";
import { ModelNote, outputName } from "./ModelNote.tsx";
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
      engineSentence: "Host calculation, summarizing the tracer positions above.",
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
    const engine = "Host calculation, by the site's own reference code.";
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
    // An output item is the one that says where its outputs were computed.
    const outputItems = [
      ...html.matchAll(/<li>((?:(?!<\/li>)[\s\S])*Computed in [\s\S]*?)<\/li>/gu),
    ].map((m) => m[1] ?? "");
    const text = (item: string) => item.replace(/<[^>]+>/g, "").replaceAll("&#x27;", "'");
    // Three groups: the three primary moments together; the secondary one, whose role differs; and
    // tracerPositions, whose owner differs.
    expect(outputItems.length).toBe(3);
    expect(outputItems.map(text)).toContain(
      "Model total mean square (modelSecondMoment), Model mean distance (modelMeanNorm) and Model RMS distance (modelRmsNorm): Host calculation, by the site's own reference code. Computed in diffusion.moments.",
    );
    for (const id of [
      "modelSecondMoment",
      "modelMeanNorm",
      "modelRmsNorm",
      "sampleMean",
      "tracerPositions",
    ]) {
      expect(outputItems.filter((item) => item.includes(`<code>${id}</code>`)).length).toBe(1);
    }
  });

  test("renders owners grouped by role, the exact seed string above 2^53, and the independent-trial sentence", () => {
    // In plain words since dispatch 212. Each value the note carried is still asserted; the words
    // around it replaced "Primary output <id>", "Owner <id>", "Model version", "Artifact digest",
    // "Constant set", "Stream-semantics version", "Accepted input revision" and "Snapshot version".
    const html = renderToStaticMarkup(createElement(ModelNote, { data: composite }));
    expect(html).toContain(
      "Tracer positions at the end of the interval (<code>tracerPositions</code>)",
    );
    expect(html).toContain("Computed with FrankenSim (brownian_frames).");
    expect(html).toContain("Computed in <code>fs-wasm.brownian_frames</code>.");
    expect(html).toContain(
      "Sample mean square (<code>sampleMeanSquare</code>) (secondary results)",
    );
    expect(html).toContain("Host calculation, summarizing the tracer positions above.");
    expect(html).toContain("Computed in <code>diffusion.ensembleMoments</code>.");
    expect(html).toContain("Version of the model: 1.0.0.");
    expect(html).toContain("Fingerprint of the exact program that ran: sha256:7b54a1.");
    expect(html).toContain("Physical constants: 1905 reference values (<code>period-1905</code>).");
    expect(html).toContain(
      "Seed 18446744073709551615: with the same settings, the same seed replays the same trial.",
    );
    expect(html).toContain(
      "Random-number stream version philox-box-muller-v1, which a replay with this seed also needs.",
    );
    expect(html).toContain("18446744073709551615");
    expect(html).not.toContain("18446744073709552000");
    expect(html).toContain("not an independent trial");
    expect(html).toContain(
      "Computed from the settings last applied (settings revision 3, result 7).",
    );
    // The store's own vocabulary is gone from what a reader reads.
    for (const internal of [
      "Primary output",
      "Secondary output",
      "Owner ",
      "Accepted input revision",
      "Snapshot version",
      "Stream-semantics",
      "Artifact digest",
      "Constant set",
    ]) {
      expect(html).not.toContain(internal);
    }
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
    // The default engine sentence is the public label in words; the owner is named once, after it.
    expect(note.outputs[0]?.engineSentence).toBe(
      "Host calculation, by the site's own reference code.",
    );
    const html = renderToStaticMarkup(createElement(ModelNote, { data: note }));
    expect(html).toContain("18446744073709551615");
    expect(html).toContain("Computed in <code>diffusion.ftcs1d</code>.");
    expect(html.split("diffusion.ftcs1d").length - 1).toBe(1);
  });

  test("each output leads with its name in words: the quantity registry's, else its id spelled out", () => {
    // A registered quantity takes its registry name (content/quantities), never a respelling.
    expect(QUANTITY_LABELS.lorentzFactor).toBe("Lorentz factor");
    expect(outputName("lorentzFactor")).toBe("Lorentz factor");
    expect(outputName("temperature")).toBe(QUANTITY_LABELS.temperature ?? "");
    // An id with neither a registry name nor an output label is spelled out. Every real output is
    // named (outputLabels.test.ts), so these ids are made up to exercise the fallback itself.
    expect(QUANTITY_LABELS.examplePlotSampleMean).toBeUndefined();
    expect(outputName("examplePlotSampleMean")).toBe("Example plot sample mean");
    expect(outputName("exampleDeltaSOverKb")).toBe("Example delta S over kb");
    // Names keep their capital and abbreviations their letters when an id is spelled out.
    expect(outputName("exampleEnergyNewtonian")).toBe("Example energy Newtonian");
    expect(outputName("exampleRmsNorm")).toBe("Example RMS norm");
    // Rendered: the name first, then the id in code.
    const html = renderToStaticMarkup(
      createElement(ModelNote, {
        data: {
          ...composite,
          outputs: [
            {
              outputId: "lorentzFactor",
              ownerId: "electron",
              role: "primary",
              engineSentence: "Host calculation, by the site's own reference code.",
            },
          ],
        },
      }),
    );
    expect(html).toContain(
      "Lorentz factor (<code>lorentzFactor</code>): Host calculation, by the site&#x27;s own reference code. Computed in <code>electron</code>.",
    );
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
        expect(details.textContent).toContain(
          "Tracer positions at the end of the interval (tracerPositions)",
        );
        expect(details.textContent).toContain("Computed with FrankenSim");
        expect(details.textContent).toContain(
          "Sample mean square (sampleMeanSquare) (secondary results)",
        );
        expect(details.textContent).toContain("summarizing the tracer positions above");
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
