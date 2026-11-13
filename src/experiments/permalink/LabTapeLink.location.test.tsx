import { afterEach, beforeEach, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { act, type ReactNode, useSyncExternalStore } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../testing/reactDom.ts";
import { createMe03Session } from "../me03/session.ts";
import { ME03_TAPE } from "../me03/tape.ts";
import { decodeTapePermalink, encodeTapePermalink } from "./codec.ts";
import { LabTapeLink, type LabTapeLinkState, useLabTapeLink } from "./LabTapeLink.tsx";
import { tapeForSettings } from "./sessionTape.ts";

let container: HTMLElement;
let root: Root | null = null;

beforeEach(async () => {
  await installDom();
  container = createContainer();
});
afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  removeContainer(container);
  await uninstallDom();
});

function shared() {
  const tape = tapeForSettings(ME03_TAPE, { ...ME03_TAPE.defaults, boundary: "radiation" });
  assert.ok(tape, "The real owner must accept the shared radiation boundary.");
  return tape;
}

async function mount(element: ReactNode) {
  root = createRoot(container);
  await act(async () => root?.render(element));
}

async function until(check: () => boolean, reason: string) {
  const deadline = Date.now() + 2000;
  while (!check()) {
    assert.ok(Date.now() < deadline, reason);
    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });
  }
}

test("an independent instance can record and replay without consuming the primary URL", async () => {
  const owners = {
    primary: createMe03Session("location-primary"),
    comparison: createMe03Session("location-comparison"),
  };
  const comparisonBefore = owners.comparison.getSnapshot();
  const links = new Map<string, LabTapeLinkState>();
  const callbacks: string[] = [];
  function Probe({ name }: { name: keyof typeof owners }) {
    const owner = owners[name];
    const view = useSyncExternalStore(owner.subscribe, owner.getSnapshot, owner.getServerSnapshot);
    links.set(
      name,
      useLabTapeLink(
        ME03_TAPE,
        owner,
        view.accepted?.parameters,
        true,
        () => callbacks.push(name),
        { restoreFromLocation: name === "primary" },
      ),
    );
    return null;
  }
  history.replaceState({}, "", "/lab/me-03/?tape=" + encodeTapePermalink(shared()));
  await mount(
    <>
      <Probe name="primary" />
      <Probe name="comparison" />
    </>,
  );
  await until(() => callbacks.includes("primary"), "The primary instance must restore its URL.");
  expect(owners.primary.acceptedParameters().boundary).toBe("radiation");
  expect(owners.comparison.getSnapshot()).toBe(comparisonBefore);
  expect(callbacks).toEqual(["primary"]);

  const comparison = links.get("comparison");
  assert.ok(comparison?.shareTape && comparison.recordingTape && comparison.walkthrough);
  expect(comparison.shareTape.initialConditions.boundary).toBe(ME03_TAPE.defaults.boundary);
  expect(comparison.recordingTape.initialConditions.boundary).toBe(ME03_TAPE.defaults.boundary);
  const target = comparison.walkthrough;
  assert.equal(target.kind, "session");
  const primaryBefore = owners.primary.getSnapshot();
  await act(async () => {
    expect(target.restore(shared())).toEqual({ kind: "restored" });
  });
  expect(owners.comparison.acceptedParameters().boundary).toBe("radiation");
  expect(owners.primary.getSnapshot()).toBe(primaryBefore);
  expect(callbacks).toEqual(["primary", "comparison"]);
});

test("opting into location restoration later restores once without disabling recording", async () => {
  const owner = createMe03Session("location-opt-in");
  const before = owner.getSnapshot();
  let restored = 0;
  let current: LabTapeLinkState | undefined;
  const link = () => {
    assert.ok(current, "The hook must supply its current state.");
    return current;
  };
  function Probe({ restoreFromLocation }: { restoreFromLocation: boolean }) {
    const view = useSyncExternalStore(owner.subscribe, owner.getSnapshot, owner.getServerSnapshot);
    current = useLabTapeLink(
      ME03_TAPE,
      owner,
      view.accepted?.parameters,
      true,
      () => {
        restored += 1;
      },
      { restoreFromLocation },
    );
    return null;
  }
  history.replaceState({}, "", "/lab/me-03/?tape=" + encodeTapePermalink(shared()));
  await mount(<Probe restoreFromLocation={false} />);
  expect(owner.getSnapshot()).toBe(before);
  assert.ok(link().recordingTape);
  expect(restored).toBe(0);
  await act(async () => root?.render(<Probe restoreFromLocation />));
  await until(() => restored === 1, "Opting into the page URL must restore its accepted settings.");
  const accepted = owner.getSnapshot();
  await act(async () => root?.render(<Probe restoreFromLocation />));
  expect(owner.getSnapshot()).toBe(accepted);
  expect(restored).toBe(1);
});

test("the existing disabled state still disables URL restoration, sharing and playback", async () => {
  const owner = createMe03Session("location-disabled");
  const before = owner.getSnapshot();
  let current: LabTapeLinkState | undefined;
  const link = () => {
    assert.ok(current, "The hook must supply its current state.");
    return current;
  };
  let calls = 0;
  function Probe() {
    current = useLabTapeLink(
      ME03_TAPE,
      owner,
      owner.acceptedParameters(),
      false,
      () => {
        calls += 1;
      },
      { restoreFromLocation: true },
    );
    return null;
  }
  history.replaceState({}, "", "/lab/me-03/?tape=" + encodeTapePermalink(shared()));
  await mount(<Probe />);
  assert.ok(link());
  expect(owner.getSnapshot()).toBe(before);
  expect(calls).toBe(0);
  expect(link().shareTape).toBeNull();
  expect(link().recordingTape).toBeNull();
  expect(link().walkthrough).toBeUndefined();
});

test("an inline laboratory shares an absolute standalone URL for its own accepted settings", async () => {
  const owner = createMe03Session("location-inline-share");
  const before = owner.getSnapshot();
  function Probe() {
    const view = useSyncExternalStore(owner.subscribe, owner.getSnapshot, owner.getServerSnapshot);
    const link = useLabTapeLink(ME03_TAPE, owner, view.accepted?.parameters, true, undefined, {
      restoreFromLocation: false,
    });
    return <LabTapeLink link={link} sharePath="/lab/me-03/" />;
  }
  history.replaceState(
    {},
    "",
    "/papers/mass-energy/?detail=2&tape=" + encodeTapePermalink(shared()) + "#s0-p7",
  );
  await mount(<Probe />);
  const value = () =>
    container.querySelector<HTMLInputElement>('[data-testid="selectable-url"]')?.value ?? "";
  await until(() => value() !== "", "The inline instance must prepare a shareable recording.");
  const url = new URL(value());
  expect(url.origin).toBe(window.location.origin);
  expect(url.pathname).toBe("/lab/me-03/");
  expect([...url.searchParams.keys()]).toEqual(["tape"]);
  expect(url.hash).toBe("");
  const decoded = decodeTapePermalink(url);
  assert.equal(decoded.kind, "success");
  expect(decoded.tape.initialConditions.boundary).toBe(ME03_TAPE.defaults.boundary);
  expect(owner.getSnapshot()).toBe(before);
  expect(container.querySelector('[data-experiment-recorder="me-03"]')).not.toBeNull();
});
