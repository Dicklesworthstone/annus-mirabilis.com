import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { PhotoelectricLab } from "../components/lab/lq08/PhotoelectricLab.tsx";
import { strictParse } from "../content/schemas/strictParse.ts";
import { LQ08_DEFAULTS, type Lq08Parameters } from "../experiments/lq08/definition.ts";
import { createLq08Session } from "../experiments/lq08/session.ts";
import {
  createLq08ReplayRunner,
  LQ08_TAPE_ENVIRONMENT,
  lq08TapeFor,
  restoreLq08FromUrl,
  restoreLq08Tape,
} from "../experiments/lq08/tape.ts";
import { decodeTapePermalink, encodeTapePermalink } from "../experiments/permalink/codec.ts";
import { replayTape } from "../experiments/permalink/replay.ts";
import type { TapeV2 } from "../experiments/permalink/types.ts";
import { createContainer, installDom, removeContainer, uninstallDom } from "./reactDom.ts";

/**
 * LQ-08 restores its accepted state from ?tape= (am-inst-permalink-tape-s677).
 *
 * Reopened because 0 of 33 laboratories read a tape: the codec compressed with node:zlib, and no
 * laboratory had a runner. LQ-08 is the first. Every case runs the laboratory's real session, so the
 * validator, owner and store that accept a setting by hand are the ones that restore it.
 */
const SHARED: Lq08Parameters = Object.freeze({
  incidentPower: 0.004,
  frequency: 9.1e14,
  workFunction: 2.9,
  quantumEfficiency: 0.25,
  collectorPotential: -0.5,
});

const url = (tape: TapeV2) =>
  `https://annus-mirabilis.com/lab/lq-08/?tape=${encodeTapePermalink(tape)}`;

describe("an LQ-08 tape restores the settings it was recorded with", () => {
  test("the link a reader shares restores exactly those settings, and the recorded checkpoint", async () => {
    const tape = lq08TapeFor(SHARED);
    // The tape round-trips through the codec unchanged.
    const decoded = decodeTapePermalink(url(tape));
    expect(decoded.kind).toBe("success");
    const session = createLq08Session("lq08-tape-restore");
    expect(session.acceptedParameters()).toEqual(LQ08_DEFAULTS);
    const restored = await restoreLq08FromUrl(session, url(tape));
    expect(restored).toEqual({ kind: "restored" });
    expect(session.acceptedParameters()).toEqual(SHARED);
    // A fresh laboratory replaying the tape reaches the checkpoint the tape carries.
    const fresh = createLq08Session("lq08-tape-replay");
    const replayed = replayTape(tape, createLq08ReplayRunner(fresh));
    expect(replayed.kind).toBe("success");
    if (replayed.kind === "success")
      expect(replayed.acceptedCheckpoint).toEqual(tape.acceptedCheckpoint);
  });

  test("the tape's model identity is the manifest's tapeModel", () => {
    const manifest = strictParse(
      readFileSync(
        resolve(dirname(fileURLToPath(import.meta.url)), "../../content/experiments/lq-08.yaml"),
        "utf8",
      ),
      "yaml",
    ) as { tapeModel: { modelId: string; modelVersion: number } };
    expect(LQ08_TAPE_ENVIRONMENT.modelId).toBe(manifest.tapeModel.modelId);
    expect(LQ08_TAPE_ENVIRONMENT.modelVersion).toBe(manifest.tapeModel.modelVersion);
  });

  test("no link leaves the laboratory as it was", async () => {
    const session = createLq08Session("lq08-tape-absent");
    expect(await restoreLq08FromUrl(session, "https://annus-mirabilis.com/lab/lq-08/")).toEqual({
      kind: "absent",
    });
    expect(session.acceptedParameters()).toEqual(LQ08_DEFAULTS);
  });
});

describe("a tape LQ-08 cannot honour is refused in words, and the reader's settings stay", () => {
  const refusedWith = async (tape: TapeV2 | string) => {
    const session = createLq08Session(`lq08-tape-refused-${Math.random()}`);
    const restored =
      typeof tape === "string"
        ? await restoreLq08FromUrl(session, tape)
        : restoreLq08Tape(session, tape);
    expect(restored.kind).toBe("not-restored");
    expect(session.acceptedParameters()).toEqual(LQ08_DEFAULTS);
    return restored.kind === "not-restored" ? restored.notice : "";
  };

  test("a tape recorded under another model version", async () => {
    const tape = lq08TapeFor(SHARED);
    const notice = await refusedWith({
      ...tape,
      modelIdentity: { modelId: "lq-08", modelVersion: 2 },
    });
    expect(notice).toContain('"lq-08@v2"');
  });

  test("settings outside what LQ-08 accepts, named by the laboratory's own sentence", async () => {
    const tape = lq08TapeFor(SHARED);
    const notice = await refusedWith({
      ...tape,
      initialConditions: { ...tape.initialConditions, quantumEfficiency: 7 },
    });
    expect(notice).toMatch(/^This shared state could not be restored\. /);
    expect(notice).not.toContain("Error");
  });

  test("a checkpoint that replay does not reproduce", async () => {
    const tape = lq08TapeFor(SHARED);
    const notice = await refusedWith({
      ...tape,
      acceptedCheckpoint: { ...tape.acceptedCheckpoint, digest: "host:00000000" },
    });
    expect(notice).toContain("consistency checks");
  });

  test("a recorded change LQ-08 refuses stops the replay with parameters-rejected, in the lab's words", async () => {
    // The initial conditions are checked before replay; a recorded change is not, so the runner's
    // parameters-rejected refusal is what stops it. The reader gets the laboratory's sentence, not
    // the error it travels in.
    const tape = lq08TapeFor(SHARED);
    const notice = await refusedWith({
      ...tape,
      events: [
        { actionIndex: 1, commandClass: "setup-change", paramId: "quantumEfficiency", value: 7 },
      ],
    });
    expect(notice).toMatch(/^This shared state could not be restored\. Enter /);
    expect(notice).not.toContain("parameters-rejected");
    expect(notice).not.toContain("Error");
  });

  test("a tape recorded in another laboratory", async () => {
    const notice = await refusedWith({ ...lq08TapeFor(SHARED), experimentId: "lq-07" });
    expect(notice).toContain("another laboratory, lq-07");
  });

  test("a truncated link", async () => {
    const notice = await refusedWith(url(lq08TapeFor(SHARED)).slice(0, -12));
    expect(notice).toMatch(/^This shared state could not be restored/);
  });
});

describe("the LQ-08 page reads ?tape= from its address", () => {
  beforeEach(async () => {
    await installDom();
  });
  afterEach(async () => {
    await uninstallDom();
  });

  test("opening a shared link shows the shared settings", async () => {
    window.history.replaceState(
      null,
      "",
      `/lab/lq-08/?tape=${encodeTapePermalink(lq08TapeFor(SHARED))}`,
    );
    const container = createContainer();
    const root = createRoot(container);
    try {
      await act(async () => {
        root.render(createElement(PhotoelectricLab, {}));
      });
      let status = "";
      for (let i = 0; i < 50 && !status.includes("910 THz"); i++) {
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
        });
        status = container.querySelector('[role="status"].status-line')?.textContent ?? "";
      }
      // 9.1 × 10¹⁴ Hz is 910 THz; the default is 600.
      expect(status).toContain("a quantum of 910 THz light");
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
