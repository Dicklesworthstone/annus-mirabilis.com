/**
 * The label BM-01 shows is earned by the snapshot's producer (am-frankensim-repin-and-bind-jvhg).
 * TracerLab is mounted in happy-dom on a session whose worker is BM-01's host with either the
 * FrankenSim recorder (the pinned module, loaded and verified) or the host recorder (what the
 * worker uses when the module is unavailable or fails verification). A trial is applied, and the
 * rendered page is read. bun test only (TSX); the worker path itself is also covered in both
 * lanes by bm01FrankenSimWorker.test.mjs.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { TracerLab } from "../components/lab/TracerLab.tsx";
import { BM01_DEFAULTS } from "../experiments/bm01/definition.ts";
import { createBm01Session } from "../experiments/bm01/session.ts";
import {
  FRANKENSIM_BROWNIAN_ENGINE_SENTENCE,
  PINNED_ARTIFACT,
} from "../experiments/provenance/pinnedFrankenSim.ts";
import example from "../generated/bm01-example.json";
import { createBm01Host } from "../workers/host/bm01Host.ts";
import type { Bm01Recorder } from "../workers/operations/bm01.ts";
import { loadPinnedFrankenSimRecorder } from "./bm01FrankenSimRecorder.ts";
import { createContainer, installDom, removeContainer, uninstallDom } from "./reactDom.ts";

function channel(recorder: Bm01Recorder | undefined) {
  return () => {
    let onMessage: ((m: unknown) => void) | null = null;
    const host = createBm01Host(
      (msg) => onMessage?.(structuredClone(msg)),
      example.sourceDigest,
      recorder,
    );
    return {
      send(message: unknown) {
        void host.receive(structuredClone(message));
      },
      listen(message: (m: unknown) => void) {
        onMessage = message;
        queueMicrotask(() => host.hello());
        return () => {
          onMessage = null;
        };
      },
      dispose() {
        host.dispose();
      },
    };
  };
}

async function labelAfterTrial(recorder: Bm01Recorder | undefined, id: string) {
  const session = createBm01Session(id, example, channel(recorder));
  const container = createContainer();
  const root = createRoot(container);
  await act(async () => {
    root.render(createElement(TracerLab, { example, instanceId: id, session }));
  });
  const before = container.textContent ?? "";
  const first = session.getSnapshot().accepted;
  await act(async () => {
    session.apply({ ...BM01_DEFAULTS, M: 40, H: 2, interval: 1, seed: "20260924" });
  });
  for (let i = 0; i < 200 && session.getSnapshot().accepted === first; i++)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
  const view = session.getSnapshot();
  const after = container.textContent ?? "";
  const label = container
    .querySelector("[data-execution-label]")
    ?.getAttribute("data-execution-label");
  await act(async () => root.unmount());
  session.disconnect();
  removeContainer(container);
  return { before, after, label, view };
}

describe("BM-01's execution label follows the snapshot's producer", () => {
  beforeEach(installDom);
  afterEach(uninstallDom);

  test("a snapshot the pinned FrankenSim module recorded is labelled computed with FrankenSim, with the artifact identity", async () => {
    const recorder = await loadPinnedFrankenSimRecorder();
    expect(typeof recorder).not.toBe("string");
    if (typeof recorder === "string") return;
    const r = await labelAfterTrial(recorder, "bm01-label-fs");
    expect(r.before).toContain("Static worked example");
    expect(r.view.status).toBe("accepted");
    expect(r.view.accepted?.outputs.find((o) => o.quantityId === "tracerPositions")?.ownerId).toBe(
      "fs-wasm.brownian_frames",
    );
    expect(r.after).toContain("Ideal model, computed with FrankenSim");
    expect(r.after).not.toContain("Ideal model, host calculation");
    expect(r.after).toContain(FRANKENSIM_BROWNIAN_ENGINE_SENTENCE);
    expect(r.after).toContain(PINNED_ARTIFACT.frankensimRevision.slice(0, 8));
    // The model notes say who produced this trial too: a sentence denying FrankenSim beside a
    // FrankenSim label is the contradiction TracerLab shipped with until the note followed the
    // snapshot.
    expect(r.after).toContain("FrankenSim computed these positions in a worker.");
    expect(r.after).not.toContain("No FrankenSim WASM artifact");
    expect(r.label).toBe("frankensim");
  });

  test("the fallback (no module, or one that failed verification) is labelled host calculation, never FrankenSim", async () => {
    const r = await labelAfterTrial(undefined, "bm01-label-host");
    expect(r.view.status).toBe("accepted");
    expect(r.view.accepted?.outputs.find((o) => o.quantityId === "tracerPositions")?.ownerId).toBe(
      "diffusion.recordTracers",
    );
    expect(r.after).toContain("Ideal model, host calculation");
    expect(r.after).not.toContain("computed with FrankenSim");
    expect(r.after).not.toContain(FRANKENSIM_BROWNIAN_ENGINE_SENTENCE);
    expect(r.after).toContain("No FrankenSim WASM artifact produced this trial.");
    expect(r.after).not.toContain("FrankenSim computed these positions");
    expect(r.label).toBe("host");
  });
});
