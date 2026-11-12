import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { BM07_DEFAULTS, type Bm07Parameters } from "../../experiments/bm07/definition.ts";
import { createBm07Session, type PreparedBm07Example } from "../../experiments/bm07/session.ts";
import { BM08_DEFAULTS, type Bm08Parameters } from "../../experiments/bm08/definition.ts";
import { createBm08Session, type PreparedBm08Example } from "../../experiments/bm08/session.ts";
import { ParameterRefusalError } from "../../experiments/results/applyFailure.ts";
import { encodeResult } from "../../experiments/results/codec.ts";
import type {
  AcceptedSnapshot,
  NumericView,
  PublishedResult,
} from "../../experiments/store/instanceStore.ts";
import { installDom, uninstallDom } from "../../testing/reactDom.ts";
import { createBm07Recording, measureBm07 } from "../../workers/operations/bm07.ts";
import { createBm08Recording, measureBm08 } from "../../workers/operations/bm08.ts";
import { AcceptedEvidenceWorkbench } from "./AcceptedEvidenceWorkbench.tsx";
import { evidenceFromAccepted } from "./acceptedEvidence.ts";
import { createCameraInferenceSession, createRadiusSession } from "./session.ts";

const bm07: PreparedBm07Example = JSON.parse(
  readFileSync(new URL("../../generated/bm07-example.json", import.meta.url), "utf8"),
);
const bm08: PreparedBm08Example = JSON.parse(
  readFileSync(new URL("../../generated/bm08-example.json", import.meta.url), "utf8"),
);
function noWorker(): never {
  throw new Error("A pinned inference must not start a worker.");
}
function accepted(view: { accepted: AcceptedSnapshot | null }): AcceptedSnapshot {
  if (!view.accepted) throw new Error("Missing accepted test snapshot.");
  return view.accepted;
}
function prepared07(id = "pin-bm07") {
  return accepted(createBm07Session(id, bm07, noWorker).getSnapshot());
}
function prepared08(id = "pin-bm08") {
  return accepted(createBm08Session(id, bm08, noWorker).getSnapshot());
}
function increments(snapshot: AcceptedSnapshot): NumericView {
  const id = snapshot.experimentId === "bm-07" ? "observationIncrements" : "increments";
  const output = snapshot.outputs.find((row) => row.quantityId === id);
  if (output?.status !== "value" || typeof output.value === "number")
    throw new Error("Missing fixture observations.");
  return output.value;
}
async function real07(patch: Partial<Bm07Parameters>, id = "changed-bm07") {
  const parameters = { ...BM07_DEFAULTS, ...patch };
  const recording = await createBm07Recording(parameters, { yieldControl: async () => {} });
  if (recording.kind !== "accepted") throw new Error("The test recording failed.");
  const measured = await measureBm07(recording.data, parameters, false);
  if (measured.kind !== "accepted") throw new Error("The test observation failed.");
  return accepted(
    createBm07Session(
      id,
      {
        sourceDigest: bm07.sourceDigest,
        parameters,
        stepIndex: measured.data.stepIndex,
        simulationTime: measured.data.simulationTime,
        results: measured.data.outputs.map(encodeResult),
      },
      noWorker,
    ).getSnapshot(),
  );
}
async function real08(patch: Partial<Bm08Parameters>, id = "changed-bm08") {
  const parameters = { ...BM08_DEFAULTS, ...patch };
  const recording = await createBm08Recording(parameters, { yieldControl: async () => {} });
  if (recording.kind !== "accepted") throw new Error("The test camera recording failed.");
  const measured = await measureBm08(recording.data, parameters, false);
  if (measured.kind !== "accepted") throw new Error("The test camera observation failed.");
  return accepted(
    createBm08Session(
      id,
      {
        sourceDigest: bm08.sourceDigest,
        parameters,
        stepIndex: measured.data.stepIndex,
        simulationTime: measured.data.simulationTime,
        results: measured.data.outputs.map(encodeResult),
      },
      noWorker,
    ).getSnapshot(),
  );
}

describe("accepted observation projection", () => {
  test("copies every coordinate and hashes the same fixed-data projection as the built examples", () => {
    for (const [snapshot, source] of [
      [prepared07(), bm07],
      [prepared08(), bm08],
    ] as const) {
      const pinned = evidenceFromAccepted(snapshot, source.sourceDigest);
      const e = pinned.evidence;
      expect(e.increments).toEqual(Array.from(increments(snapshot).copy()));
      expect(e.dt).toBe(snapshot.parameters.dt);
      expect(e.d).toBe(snapshot.parameters.d);
      expect(e.sourceDigest).toBe(source.sourceDigest);
      expect(pinned.source.runId).toBe(snapshot.runId);
      expect(pinned.source.snapshotVersion).toBe(snapshot.snapshotVersion);
      expect(pinned.source.revisions).toEqual(snapshot.revisions);
      const digest = createHash("sha256")
        .update(
          JSON.stringify({
            kind: e.kind,
            dt: e.dt,
            d: e.d,
            exposure: e.exposure,
            knownDrift: e.knownDrift,
            increments: e.increments,
          }),
        )
        .digest("hex");
      expect(e.observationDigest).toBe(digest);
      expect(Object.isFrozen(e.increments)).toBe(true);
      expect(Object.isFrozen(pinned.source.revisions)).toBe(true);
      const mutableCopy = increments(snapshot).copy();
      mutableCopy.fill(0);
      expect(e.increments.some((value) => value !== 0)).toBe(true);
      for (const forbidden of [
        "hiddenNumber",
        "generatorRadius",
        "generatorMolecularNumber",
        "D",
        "sigma",
        "noiseSeed",
        "radius",
        "a",
      ])
        expect(Object.hasOwn(e, forbidden)).toBe(false);
    }
  });

  test("uses the accepted measurement and inference conditions, without admitting a generating radius", async () => {
    const snapshot = await real07({
      M: 7,
      d: 1,
      calibrationScale: 1.4,
      T: 310,
      eta: 0.002,
      a: 0.9e-6,
    });
    const e = evidenceFromAccepted(snapshot, bm07.sourceDigest).evidence;
    expect(e.increments).toEqual(Array.from(increments(snapshot).copy()));
    expect(e.increments).toHaveLength(7);
    expect(e.T).toBe(310);
    expect(e.eta).toBe(0.002);
    const inference = accepted(createRadiusSession("no-radius-leak", e).getSnapshot());
    expect(
      inference.outputs.find((row) => row.quantityId === "avogadroNumberEstimate")?.status,
    ).toBe("underdetermined");
  });

  test("the smallest accepted ideal record remains complete", async () => {
    const snapshot = await real07({ M: 1, d: 1 });
    const e = evidenceFromAccepted(snapshot, bm07.sourceDigest).evidence;
    expect(e.increments).toHaveLength(1);
    expect(createRadiusSession("one-displacement", e).getSnapshot().accepted).not.toBeNull();
  });

  test("short and odd camera records retain all observations and refuse only the unavailable second spacing", async () => {
    for (const M of [3, 7]) {
      const snapshot = await real08({ M, d: 2, stageDrift: 0.1e-6, flowDrift: 0.2e-6 });
      const e = evidenceFromAccepted(snapshot, bm08.sourceDigest).evidence;
      expect(e.increments).toEqual(Array.from(increments(snapshot).copy()));
      expect(e.increments).toHaveLength(2 * M);
      expect(e.knownDrift).toBe(0.1e-6 + 0.2e-6);
      const inference = createCameraInferenceSession("odd-camera", e);
      expect(inference.apply({ information: "covariance" }).kind).toBe("accepted");
      const before = inference.getSnapshot().accepted;
      expect(inference.apply({ information: "second-interval" }).kind).toBe("refused");
      expect(inference.getSnapshot().accepted).toBe(before);
      expect(inference.evidence.increments).toEqual(e.increments);
    }
  });

  test("an even camera record supports all three information choices without a camera confidence interval", () => {
    const e = evidenceFromAccepted(prepared08(), bm08.sourceDigest).evidence;
    const inference = createCameraInferenceSession("paired-camera", e);
    for (const information of ["variance", "covariance", "second-interval"]) {
      expect(inference.apply({ information }).kind).toBe("accepted");
      expect(
        accepted(inference.getSnapshot()).outputs.find(
          (row) => row.quantityId === "diffusionConfidenceInterval",
        )?.status,
      ).toBe("not-applicable");
      expect(inference.evidence.increments).toEqual(e.increments);
    }
  });

  test("incomplete, foreign, ambiguous, wrongly dimensioned and oversized records are refused", () => {
    const original = prepared07();
    const observed = original.outputs.find((row) => row.quantityId === "observationIncrements");
    if (!observed) throw new Error("Missing observation output.");
    const replaceOutput = (patch: Partial<PublishedResult>): AcceptedSnapshot => ({
      ...original,
      outputs: original.outputs.map((row) =>
        row === observed ? ({ ...row, ...patch } as PublishedResult) : row,
      ),
    });
    const bad: AcceptedSnapshot[] = [
      { ...original, final: false },
      { ...original, experimentId: "measured-trajectory" },
      { ...original, outputs: [] },
      { ...original, outputs: [...original.outputs, observed] },
      replaceOutput({ unit: "pixel" }),
      replaceOutput({ ownerId: "unregistered" }),
      replaceOutput({ semanticKind: "measured-displacements" }),
      replaceOutput({ status: "value", value: 1 }),
      { ...original, parameters: { ...original.parameters, M: 1001 } },
      { ...original, parameters: { ...original.parameters, M: 49 } },
      { ...original, parameters: { ...original.parameters, d: 3 } },
    ];
    for (const snapshot of bad)
      expect(() => evidenceFromAccepted(snapshot, bm07.sourceDigest)).toThrow(
        ParameterRefusalError,
      );
    expect(() => evidenceFromAccepted(original, "not-a-source-digest")).toThrow();
  });

  test("imported data and a different constant basis cannot acquire synthetic provenance", () => {
    const original = prepared07();
    for (const patch of [
      { observationSet: "kitchen" },
      { observationSet: "perrin-1909" },
      { constantSetId: "modern-si-2019" },
    ])
      expect(() =>
        evidenceFromAccepted(
          { ...original, parameters: { ...original.parameters, ...patch } },
          bm07.sourceDigest,
        ),
      ).toThrow(ParameterRefusalError);
  });
});

describe("pinned workbench interaction", () => {
  let root: Root;
  let container: HTMLElement;
  let initialHref: string;
  beforeEach(async () => {
    await installDom();
    history.replaceState({}, "", "/papers/brownian-motion/?level=2#arg-bm-inference");
    initialHref = location.href;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    expect(location.href).toBe(initialHref);
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    await act(async () => root.unmount());
    container.remove();
    await uninstallDom();
  });
  async function show(snapshot: AcceptedSnapshot, sourceDigest = bm07.sourceDigest) {
    await act(async () =>
      root.render(
        <AcceptedEvidenceWorkbench snapshot={snapshot} sourceDigest={sourceDigest} ready />,
      ),
    );
  }
  function button(text: string): HTMLButtonElement {
    const found = [...container.querySelectorAll("button")].find((node) =>
      node.textContent?.includes(text),
    );
    if (!found) throw new Error(`Missing button: ${text}`);
    return found;
  }
  async function click(text: string) {
    await act(async () => button(text).click());
  }
  function caseRoot(): HTMLElement {
    const element = container.querySelector<HTMLElement>("[data-infer-case]");
    if (!element) throw new Error("Missing pinned inference.");
    return element;
  }

  test("pinning and admitting a radius preserve observations and never use ambient randomness or network", async () => {
    const snapshot = prepared07();
    const sourceBefore = JSON.stringify(snapshot);
    await show(snapshot);
    expect(container.querySelector("[data-infer-case]")).toBeNull();
    const random = spyOn(Math, "random").mockImplementation(() => {
      throw new Error("No fresh trial.");
    });
    const request = spyOn(globalThis, "fetch").mockImplementation(() => {
      throw new Error("No handoff upload.");
    });
    try {
      await click("Explore accepted observations");
      const section = caseRoot();
      const run = section.dataset.runId;
      const digest = section.dataset.observationDigest;
      expect(section.dataset.inferCase).toBe("radius");
      expect(container.querySelector('[data-infer-case="camera"]')).toBeNull();
      expect(section.querySelector("[data-accepted-radius]")?.textContent).toContain(
        "No independent radius",
      );
      await click("Use the synthetic worked radius");
      expect(section.dataset.estimatorRevision).toBe("1");
      expect(section.dataset.runId).toBe(run);
      expect(section.dataset.observationDigest).toBe(digest);
      expect(section.querySelector("[data-accepted-radius]")?.textContent).toContain("0.5");
      expect(JSON.stringify(snapshot)).toBe(sourceBefore);
      expect(random).not.toHaveBeenCalled();
      expect(request).not.toHaveBeenCalled();
    } finally {
      random.mockRestore();
      request.mockRestore();
    }
  });

  test("a newer source result leaves the complete pinned inference intact until explicit replacement", async () => {
    await show(prepared07());
    await click("Explore accepted observations");
    await click("Use the synthetic worked radius");
    const first = caseRoot();
    const html = first.innerHTML;
    const digest = first.dataset.observationDigest;
    const next = await real07({ seed: "2026", M: 7, d: 1, T: 310 });
    await show(next);
    expect(caseRoot() === first).toBe(true);
    expect(first.innerHTML).toBe(html);
    expect(container.querySelector("[data-pinned-source-changed]")).not.toBeNull();
    await click("Replace with current accepted observations");
    expect(caseRoot() === first).toBe(false);
    expect(caseRoot().dataset.observationDigest).not.toBe(digest);
    expect(caseRoot().querySelectorAll("[data-observation-evidence] tbody tr")).toHaveLength(7);
    expect(caseRoot().querySelector("[data-accepted-radius]")?.textContent).toContain(
      "No independent radius",
    );
    expect(container.querySelector("[data-pinned-source-changed]")).toBeNull();
  });

  test("a refused replacement retains its old accepted results and reports the typed refusal", async () => {
    const snapshot = prepared07();
    await show(snapshot);
    await click("Explore accepted observations");
    await click("Use the synthetic worked radius");
    const section = caseRoot();
    const html = section.innerHTML;
    await show({
      ...snapshot,
      parameters: { ...snapshot.parameters, observationSet: "kitchen" },
      snapshotVersion: snapshot.snapshotVersion + 1,
    });
    await click("Replace with current accepted observations");
    expect(caseRoot() === section).toBe(true);
    expect(section.innerHTML).toBe(html);
    expect(
      container.querySelector('[data-refusal-code="invalid-parameter"]')?.textContent,
    ).toContain("previous pinned observations");
  });

  test("a numerically unavailable inverse is refused before a healthy pin is replaced", async () => {
    const snapshot = prepared08();
    await show(snapshot, bm08.sourceDigest);
    await click("Explore accepted observations");
    const section = caseRoot();
    const html = section.innerHTML;
    // Adversarial accepted-vector boundary, not a claim that BM08 permits zero generating D.
    const unavailable: AcceptedSnapshot = {
      ...snapshot,
      snapshotVersion: snapshot.snapshotVersion + 1,
      outputs: snapshot.outputs.map((output) => {
        if (
          output.quantityId !== "increments" ||
          output.status !== "value" ||
          typeof output.value === "number"
        )
          return output;
        const length = output.value.length;
        return {
          ...output,
          value: Object.freeze({
            length,
            at: (_index: number) => 0,
            copy: () => new Float64Array(length),
          }),
        };
      }),
    };
    expect(() => evidenceFromAccepted(unavailable, bm08.sourceDigest)).toThrow(
      ParameterRefusalError,
    );
    await show(unavailable, bm08.sourceDigest);
    await click("Replace with current accepted observations");
    expect(caseRoot() === section).toBe(true);
    expect(section.innerHTML).toBe(html);
    expect(
      container.querySelector('[data-refusal-code="invalid-parameter"]')?.textContent,
    ).toContain("positive coordinate variance");
  });

  test("camera information changes reuse the same recorded displacements, and odd records disable only the unavailable comparison", async () => {
    const snapshot = await real08({ M: 7 });
    await show(snapshot, bm08.sourceDigest);
    await click("Explore accepted observations");
    const section = caseRoot();
    expect(section.dataset.inferCase).toBe("camera");
    expect(container.querySelector('[data-infer-case="radius"]')).toBeNull();
    const digest = section.dataset.observationDigest;
    const second = section.querySelector<HTMLInputElement>(
      '[data-camera-information][value="second-interval"]',
    );
    expect(second?.disabled).toBe(true);
    expect(section.querySelector("[data-unpaired-observations]")?.textContent).toContain(
      "no trailing observations",
    );
    const covariance = section.querySelector<HTMLInputElement>(
      '[data-camera-information][value="covariance"]',
    );
    if (!covariance) throw new Error("Missing camera information choice.");
    await act(async () => {
      covariance.checked = true;
      covariance.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(section.dataset.estimatorRevision).toBe("1");
    expect(section.dataset.observationDigest).toBe(digest);
    expect(section.querySelectorAll("[data-observation-evidence] tbody tr")).toHaveLength(14);
    expect(section.textContent).toContain("point estimates, not confidence intervals");
    await click("Close pinned workbench");
    expect(container.querySelector("[data-infer-case]")).toBeNull();
    expect(document.activeElement === button("Explore accepted observations")).toBe(true);
  });

  test("two placements keep independent information choices", async () => {
    const first = prepared07("first-placement");
    const second = prepared07("second-placement");
    await act(async () =>
      root.render(
        <>
          <AcceptedEvidenceWorkbench snapshot={first} sourceDigest={bm07.sourceDigest} ready />
          <AcceptedEvidenceWorkbench snapshot={second} sourceDigest={bm07.sourceDigest} ready />
        </>,
      ),
    );
    const open = [...container.querySelectorAll<HTMLButtonElement>("button")].filter((node) =>
      node.textContent?.includes("Explore accepted observations"),
    );
    expect(open).toHaveLength(2);
    await act(async () => {
      open[0]?.click();
      open[1]?.click();
    });
    const cases = [...container.querySelectorAll<HTMLElement>('[data-infer-case="radius"]')];
    expect(cases).toHaveLength(2);
    const worked = cases[0]?.querySelector<HTMLButtonElement>("[data-radius-worked]");
    await act(async () => worked?.click());
    expect(cases[0]?.querySelector("[data-accepted-radius]")?.textContent).toContain("0.5");
    expect(cases[1]?.querySelector("[data-accepted-radius]")?.textContent).toContain(
      "No independent radius",
    );
  });
});
