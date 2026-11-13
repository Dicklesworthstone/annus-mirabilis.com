import { afterEach, beforeEach, expect, test } from "bun:test";
import { act, type ReactNode, useSyncExternalStore } from "react";
import { createRoot, type Root } from "react-dom/client";
import { installDom, uninstallDom } from "../../testing/reactDom.ts";
import { createMe03Session } from "../me03/session.ts";
import { ME03_TAPE } from "../me03/tape.ts";
import { encodeTapePermalink } from "./codec.ts";
import { type LabTapeLinkState, useLabTapeLink } from "./LabTapeLink.tsx";
import { tapeForSettings } from "./sessionTape.ts";
import type { TapePredictionEvent, TapeV2 } from "./types.ts";

let root: Root | null = null;
beforeEach(async () => installDom());
afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  await uninstallDom();
});

const predictions: readonly TapePredictionEvent[] = [
  {
    promptId: "boundary-prediction",
    form: "candidate",
    payload: { candidateId: "radiation" },
  },
];

function shared(): TapeV2 {
  const tape = tapeForSettings(ME03_TAPE, { ...ME03_TAPE.defaults, boundary: "radiation" });
  if (!tape) throw new Error("The real boundary laboratory rejected the shared settings.");
  return { ...tape, predictions };
}

async function mount(element: ReactNode) {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root?.render(element));
}

function callbackSignal() {
  let complete: () => void = () => undefined;
  const received = new Promise<void>((resolve) => {
    complete = resolve;
  });
  return {
    complete: () => complete(),
    async wait() {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          received,
          new Promise<never>((_resolve, reject) => {
            timer = setTimeout(
              () => reject(new Error("The shared prediction callback did not complete.")),
              2_000,
            );
          }),
        ]);
      } finally {
        if (timer !== undefined) clearTimeout(timer);
      }
    },
  };
}

async function waitForNotice(link: () => LabTapeLinkState) {
  const deadline = Date.now() + 2_000;
  while (!link().notice) {
    if (Date.now() >= deadline) throw new Error("The malformed shared link was not reported.");
    // Check between act calls: awaiting a rendered notice inside one act can block its commit.
    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });
  }
}

test("shared predictions restore once and callbacks stay current", async () => {
  const owner = createMe03Session("shared-prediction-callback");
  const received = callbackSignal();
  const calls: {
    parameters: object;
    predictions: readonly TapePredictionEvent[] | undefined;
    marker: string;
  }[] = [];
  let current: LabTapeLinkState | null = null;
  function Probe({ marker }: { marker: string }) {
    const view = useSyncExternalStore(owner.subscribe, owner.getSnapshot, owner.getServerSnapshot);
    current = useLabTapeLink(
      ME03_TAPE,
      owner,
      view.accepted?.parameters,
      true,
      (parameters, restored) => {
        calls.push({ parameters, predictions: restored, marker });
        received.complete();
      },
    );
    return null;
  }
  const link = () => {
    if (!current) throw new Error("The laboratory link has not mounted.");
    return current;
  };
  window.history.replaceState({}, "", `/lab/me-03/?tape=${encodeTapePermalink(shared())}`);
  await mount(<Probe marker="first" />);
  await act(async () => received.wait());
  const parameters = { ...ME03_TAPE.defaults, boundary: "radiation" };
  expect(calls).toEqual([{ parameters, predictions, marker: "first" }]);
  const accepted = owner.getSnapshot();
  const target = link().walkthrough;
  if (!target || target.kind !== "session") throw new Error("Expected a session walkthrough.");

  await act(async () => root?.render(<Probe marker="latest" />));
  expect(owner.getSnapshot()).toBe(accepted);
  expect(calls).toEqual([{ parameters, predictions, marker: "first" }]);

  const nextPredictions: readonly TapePredictionEvent[] = [
    { promptId: "boundary-prediction", form: "candidate", payload: { candidateId: "matter" } },
  ];
  await act(async () => {
    expect(target.restore({ ...shared(), predictions: nextPredictions })).toEqual({
      kind: "restored",
    });
  });
  expect(calls).toEqual([
    { parameters, predictions, marker: "first" },
    { parameters, predictions: nextPredictions, marker: "latest" },
  ]);
});

test("disabled laboratories adopt no shared prediction until enabled", async () => {
  const owner = createMe03Session("shared-prediction-disabled");
  const received = callbackSignal();
  const before = owner.getSnapshot();
  const calls: (readonly TapePredictionEvent[] | undefined)[] = [];
  function Probe({ enabled }: { enabled: boolean }) {
    const view = useSyncExternalStore(owner.subscribe, owner.getSnapshot, owner.getServerSnapshot);
    useLabTapeLink(
      ME03_TAPE,
      owner,
      view.accepted?.parameters,
      enabled,
      (_parameters, restored) => {
        calls.push(restored);
        received.complete();
      },
    );
    return null;
  }
  window.history.replaceState({}, "", `/lab/me-03/?tape=${encodeTapePermalink(shared())}`);
  await mount(<Probe enabled={false} />);
  expect(owner.getSnapshot()).toBe(before);
  expect(calls).toEqual([]);

  await act(async () => root?.render(<Probe enabled />));
  await act(async () => received.wait());
  expect(owner.acceptedParameters()).toEqual({ ...ME03_TAPE.defaults, boundary: "radiation" });
  expect(calls).toEqual([predictions]);
});

test("malformed walkthrough predictions preserve the accepted snapshot", async () => {
  const owner = createMe03Session("shared-prediction-malformed");
  const before = owner.getSnapshot();
  const calls: (readonly TapePredictionEvent[] | undefined)[] = [];
  let current: LabTapeLinkState | null = null;
  function Probe() {
    const view = useSyncExternalStore(owner.subscribe, owner.getSnapshot, owner.getServerSnapshot);
    current = useLabTapeLink(
      ME03_TAPE,
      owner,
      view.accepted?.parameters,
      true,
      (_parameters, restored) => {
        calls.push(restored);
      },
    );
    return null;
  }
  const link = () => {
    if (!current) throw new Error("The laboratory link has not mounted.");
    return current;
  };
  window.history.replaceState({}, "", "/lab/me-03/");
  await mount(<Probe />);
  const target = link().walkthrough;
  if (!target || target.kind !== "session") throw new Error("Expected a session walkthrough.");
  const malformed: TapeV2 = {
    ...shared(),
    predictions: [
      { promptId: "boundary-prediction", form: "candidate", payload: { candidateId: "" } },
    ],
  };
  await act(async () => {
    const result = target.restore(malformed);
    expect(result.kind).toBe("not-restored");
    if (result.kind === "not-restored") expect(result.notice).toContain("recorded predictions");
  });
  expect(owner.getSnapshot()).toBe(before);
  expect(calls).toEqual([]);
});

test("malformed shared URLs leave the run and prediction callback untouched", async () => {
  const owner = createMe03Session("shared-prediction-invalid-url");
  const before = owner.getSnapshot();
  const calls: (readonly TapePredictionEvent[] | undefined)[] = [];
  let current: LabTapeLinkState | null = null;
  function Probe() {
    current = useLabTapeLink(
      ME03_TAPE,
      owner,
      owner.acceptedParameters(),
      true,
      (_parameters, restored) => {
        calls.push(restored);
      },
    );
    return null;
  }
  const link = () => {
    if (!current) throw new Error("The laboratory link has not mounted.");
    return current;
  };
  window.history.replaceState({}, "", "/lab/me-03/?tape=not-a-valid-record");
  await mount(<Probe />);
  await waitForNotice(link);
  expect(owner.getSnapshot()).toBe(before);
  expect(calls).toEqual([]);
  expect(link().notice).not.toBe("");
});
