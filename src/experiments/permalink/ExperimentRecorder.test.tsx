import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../testing/reactDom.ts";
import { ME01_TAPE } from "../me01/tape.ts";
import { ExperimentRecorder } from "./ExperimentRecorder.tsx";
import { restoreTape, tapeForSettings } from "./sessionTape.ts";
import type { WalkthroughTarget } from "./walkthroughActions.ts";

function tapeAt(frameSpeed: number) {
  const tape = tapeForSettings(ME01_TAPE, { ...ME01_TAPE.defaults, frameSpeed });
  if (!tape) throw new Error("The laboratory must accept the test settings.");
  return tape;
}
function button(host: HTMLElement, name: string): HTMLButtonElement {
  const found = [...host.querySelectorAll("button")].find(
    (element) => element.textContent === name,
  );
  expect(found).toBeDefined();
  if (!found) throw new Error(`Missing button: ${name}`);
  return found;
}

describe("ExperimentRecorder reader controls", () => {
  beforeEach(installDom);
  afterEach(uninstallDom);

  test("saving two accepted states and selecting one do not run the lab; Restore does", async () => {
    const host = createContainer();
    const root = createRoot(host);
    const session = ME01_TAPE.createSession("recording-ui-reader");
    const initial = session.getSnapshot();
    let restores = 0;
    const target: WalkthroughTarget = {
      kind: "session",
      experimentId: "me-01",
      restore(tape) {
        restores++;
        const result = restoreTape(ME01_TAPE, session, tape);
        return result.kind === "restored"
          ? result
          : {
              kind: "not-restored",
              notice: result.kind === "not-restored" ? result.notice : "No tape.",
            };
      },
    };
    try {
      await act(async () =>
        root.render(createElement(ExperimentRecorder, { target, tape: tapeAt(0.6) })),
      );
      await act(async () => button(host, "Save starting point").click());
      await act(async () =>
        root.render(createElement(ExperimentRecorder, { target, tape: tapeAt(-0.2) })),
      );
      await act(async () => button(host, "Save current accepted settings").click());
      expect(host.textContent).toContain("2 of 64 saved stops");
      expect(restores).toBe(0);
      expect(session.getSnapshot()).toBe(initial);
      const select = host.querySelector<HTMLSelectElement>("select");
      expect(select).not.toBeNull();
      await act(async () => {
        if (select) {
          select.value = "0";
          select.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });
      expect(restores).toBe(0);
      await act(async () => button(host, "Restore saved stop").click());
      expect(restores).toBe(1);
      expect(session.acceptedParameters()).toMatchObject({ frameSpeed: 0.6 });
      expect(host.querySelector('[data-recording-outcome="replayed"]')).not.toBeNull();
      // Losing a recordable current state must not unmount or discard saved work.
      await act(async () => root.render(createElement(ExperimentRecorder, { target, tape: null })));
      expect(host.textContent).toContain("2 of 64 saved stops");
    } finally {
      await act(async () => root.unmount());
      removeContainer(host);
    }
  });

  test("metadata and recorder controls cannot accidentally submit the laboratory's Apply form", async () => {
    const host = createContainer();
    const root = createRoot(host);
    let submitted = 0;
    const target: WalkthroughTarget = {
      kind: "form",
      experimentId: "me-01",
      load: () => ({ kind: "loaded" }),
    };
    try {
      await act(async () =>
        root.render(
          createElement(
            "form",
            {
              onSubmit: (event) => {
                event.preventDefault();
                submitted++;
              },
            },
            createElement(ExperimentRecorder, { target, tape: tapeAt(0.6) }),
          ),
        ),
      );
      const input = host.querySelector<HTMLInputElement>('input:not([type="file"])');
      expect(input).not.toBeNull();
      /*
       * THE HANDLER IS CALLED THROUGH ITS PROPS, NOT BY DISPATCHING AN EVENT.
       *
       * This dispatched a native KeyboardEvent on the input and asserted `enter.defaultPrevented`.
       * Under this repository's happy-dom harness a dispatched DOM event NEVER reaches React, so the
       * component's onKeyDown was never invoked and defaultPrevented was false whatever the component
       * did. The test was red against a component that has had `preventMetadataSubmit` wired to both
       * metadata inputs since it was written: it was measuring the harness, not the guard.
       *
       * Reading the handler off the element's props is the form the rest of this repository uses for
       * the same reason - see ModeAllocationLab.refusals.test.tsx and
       * MovingMirrorLab.numberRange.test.tsx. The handler is asserted to EXIST first, so a component
       * that lost it fails here instead of passing vacuously.
       */
      const propsKey = Object.keys(input as object).find((k) => k.startsWith("__reactProps$"));
      expect(propsKey).toBeDefined();
      const inputProps = (input as unknown as Record<string, { onKeyDown?: (e: unknown) => void }>)[
        propsKey as string
      ];
      expect(typeof inputProps?.onKeyDown).toBe("function");
      let prevented = false;
      await act(async () => {
        inputProps?.onKeyDown?.({
          key: "Enter",
          nativeEvent: { isComposing: false },
          preventDefault: () => {
            prevented = true;
          },
        });
      });
      expect(prevented).toBe(true);

      // And the negative, so the guard is not simply "prevent everything": an ordinary character must
      // pass through, or typing a title would be impossible.
      let preventedOnLetter = false;
      await act(async () => {
        inputProps?.onKeyDown?.({
          key: "a",
          nativeEvent: { isComposing: false },
          preventDefault: () => {
            preventedOnLetter = true;
          },
        });
      });
      expect(preventedOnLetter).toBe(false);
      await act(async () => button(host, "Save starting point").click());
      expect(submitted).toBe(0);
      expect(
        [...host.querySelectorAll("button")].every((element) => element.type === "button"),
      ).toBe(true);
      await act(async () => button(host, "Load saved settings into form").click());
      expect(host.querySelector('[data-recording-outcome="loaded"]')?.textContent).toContain(
        "has not been verified",
      );
    } finally {
      await act(async () => root.unmount());
      removeContainer(host);
    }
  });

  test("a failed checkpoint verification remains visible and does not change accepted settings", async () => {
    const host = createContainer();
    const root = createRoot(host);
    const session = ME01_TAPE.createSession("recording-ui-refusal");
    const initial = session.getSnapshot();
    const tape = tapeAt(0.6);
    const corrupt = {
      ...tape,
      acceptedCheckpoint: { ...tape.acceptedCheckpoint, digest: "host:0000000000000000" },
    };
    const target: WalkthroughTarget = {
      kind: "session",
      experimentId: "me-01",
      restore(recorded) {
        const result = restoreTape(ME01_TAPE, session, recorded);
        return result.kind === "restored"
          ? result
          : {
              kind: "not-restored",
              notice: result.kind === "not-restored" ? result.notice : "No tape.",
            };
      },
    };
    try {
      await act(async () =>
        root.render(createElement(ExperimentRecorder, { target, tape: corrupt })),
      );
      await act(async () => button(host, "Save starting point").click());
      await act(async () => button(host, "Restore saved stop").click());
      expect(host.querySelector('[role="alert"][data-recording-outcome="refused"]')).not.toBeNull();
      expect(session.getSnapshot()).toBe(initial);
      expect(host.textContent).toContain("1 of 64 saved stops");
    } finally {
      await act(async () => root.unmount());
      removeContainer(host);
    }
  });
});
