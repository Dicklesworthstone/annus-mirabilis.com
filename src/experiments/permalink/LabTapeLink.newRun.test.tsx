import { afterEach, beforeEach, expect, test } from "bun:test";
import { act, useSyncExternalStore } from "react";
import { createRoot, type Root } from "react-dom/client";
import { installDom, uninstallDom } from "../../testing/reactDom.ts";
import { createMe03Session } from "../me03/session.ts";
import { ME03_TAPE } from "../me03/tape.ts";
import { type LabTapeLinkState, useLabTapeLink } from "./LabTapeLink.tsx";
import {
  type TapeSession,
  tapeForSettings,
  tapeStateDigestV2,
  tapeStateOf,
} from "./sessionTape.ts";
import type { TapeV2 } from "./types.ts";
import { WalkthroughPlayer } from "./WalkthroughPlayer.tsx";
import type { WalkthroughCatalogue } from "./walkthroughCheckpoints.ts";

let root: Root | null = null;
beforeEach(async () => installDom());
afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  await uninstallDom();
});

async function click(label: string) {
  const button = [...document.querySelectorAll("button")].find(
    (entry) => entry.textContent?.trim() === label,
  );
  expect(button).toBeDefined();
  await act(async () => button?.click());
}

for (const supportsNewRun of [true, false]) {
  test(`the real player ${supportsNewRun ? "accepts a fresh run before clearing" : "keeps"} the recorded share`, async () => {
    const real = createMe03Session(`me03-player-new-run-${supportsNewRun}`);
    const session: TapeSession = supportsNewRun
      ? real
      : {
          apply: real.apply,
          getSnapshot: real.getSnapshot,
          acceptedParameters: real.acceptedParameters,
        };
    const opening = tapeForSettings(ME03_TAPE, ME03_TAPE.defaults);
    const parameters = { ...ME03_TAPE.defaults, boundary: "radiation" };
    const settings = tapeStateOf(parameters);
    if (!opening || !settings) throw new Error("Expected an accepted real boundary checkpoint.");
    const tape: TapeV2 = {
      ...opening,
      events: [
        {
          actionIndex: 1,
          commandClass: "measurement-change",
          paramId: "boundary",
          value: "radiation",
        },
      ],
      acceptedCheckpoint: {
        acceptedActionIndex: 1,
        acceptedInputRevision: 1,
        digest: tapeStateDigestV2(settings, 1),
      },
    };
    const catalogue: WalkthroughCatalogue = {
      walkthroughs: [
        {
          tapeId: "boundary-current-model",
          experimentId: "me-03",
          title: "The radiation boundary",
          checkpoints: [{ actionIndex: 1, label: "Radiation", settings, tape }],
        },
      ],
      problems: [],
    };
    let link: LabTapeLinkState | null = null;
    const restored: object[] = [];
    const load = async () => catalogue;
    function Probe() {
      const view = useSyncExternalStore(real.subscribe, real.getSnapshot, real.getServerSnapshot);
      const current = useLabTapeLink(
        ME03_TAPE,
        session,
        view.accepted?.parameters,
        true,
        (value) => {
          restored.push(value);
        },
      );
      link = current;
      return current.walkthrough ? (
        <WalkthroughPlayer target={current.walkthrough} load={load} />
      ) : null;
    }
    const currentLink = () => {
      if (!link) throw new Error("The laboratory link has not mounted.");
      return link;
    };
    window.history.replaceState({}, "", "/lab/me-03/?walkthrough=boundary-current-model&stop=1");
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    const original = real.getSnapshot();
    await act(async () => root?.render(<Probe />));
    expect(real.getSnapshot()).toBe(original);
    expect(restored).toEqual([]);

    await click("Restore checkpoint");
    expect(
      document
        .querySelector("[data-walkthrough-outcome]")
        ?.getAttribute("data-walkthrough-outcome"),
    ).toBe("replayed");
    expect(currentLink().shareTape).toBe(tape);
    expect(real.acceptedParameters()).toEqual(parameters);
    expect(restored).toEqual([parameters]);
    const checkpoint = real.getSnapshot().accepted;

    await click("Calculate these settings as a new run");
    const outcome = document
      .querySelector("[data-walkthrough-outcome]")
      ?.getAttribute("data-walkthrough-outcome");
    if (supportsNewRun) {
      expect(outcome).toBe("new-run");
      expect(real.getSnapshot().accepted?.runId).not.toBe(checkpoint?.runId);
      expect(real.getSnapshot().accepted?.parentRunId).toBe(checkpoint?.runId);
      expect(real.acceptedParameters()).toEqual(parameters);
      expect(restored).toEqual([parameters, parameters]);
      expect(currentLink().shareTape).not.toBe(tape);
      expect(currentLink().shareTape?.acceptedCheckpoint.acceptedActionIndex).toBe(0);
      expect(currentLink().shareTape?.initialConditions).toEqual(settings);
    } else {
      expect(outcome).toBe("refused");
      expect(real.getSnapshot().accepted).toBe(checkpoint);
      expect(currentLink().shareTape).toBe(tape);
      expect(restored).toEqual([parameters]);
    }
  });
}
