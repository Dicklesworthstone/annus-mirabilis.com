/**
 * A reader who prefers reduced motion gets the same first render the server sent (dispatch 180).
 *
 * GraphDescriptionContainer read `prefers-reduced-motion` in its useState initializer. The server
 * cannot know the reader's preference, so it rendered the animated control as "Pause" while a
 * reduced-motion reader's first client render said "Resume": a hydration mismatch for every such
 * reader, the class of fault behind c3b3116b's React #418, waiting for the first page that mounts
 * this container. The preference is now read after mount, in the effect that already listened for
 * it, so the first client render matches the server and the view is paused a moment later.
 *
 * Server render with no matchMedia (as on the server), then hydrate with reduced motion ON.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../testing/reactDom.ts";
import { GraphDescriptionContainer } from "./provider.tsx";

beforeEach(async () => {
  await installDom();
});
afterEach(async () => {
  await uninstallDom();
});

function View() {
  return (
    <GraphDescriptionContainer
      layer1Statement="The walk spreads as the square root of time."
      layer2Template="Spread {spread} after {time}."
      templateData={{ statistics: { spread: "1 um", time: "1 s" } }}
      snapshotVersion={1}
      animated
    />
  );
}

/** matchMedia as a browser with the given reduced-motion preference answers it. */
function preferReducedMotion(on: boolean) {
  return (query: string) => ({
    matches: on && query.includes("prefers-reduced-motion: reduce"),
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  });
}

describe("GraphDescriptionContainer hydrates for a reduced-motion reader (dispatch 180)", () => {
  test("the first client render matches the server, then the view pauses", async () => {
    const w = window as unknown as { matchMedia?: unknown };
    const saved = w.matchMedia;
    // The server has no matchMedia; render as it does.
    w.matchMedia = undefined;
    const serverHtml = renderToString(<View />);
    expect(serverHtml).toContain(">Pause<");

    w.matchMedia = preferReducedMotion(true);
    const container = createContainer();
    container.innerHTML = serverHtml;
    const recoverable: unknown[] = [];
    const warnings: string[] = [];
    const originalError = console.error;
    console.error = (...args: unknown[]) => {
      const text = args.map(String).join(" ");
      if (/hydrat|didn't match|did not match/i.test(text)) warnings.push(text);
    };
    try {
      const root = hydrateRoot(container, <View />, {
        onRecoverableError: (error) => recoverable.push(error),
      });
      await act(async () => {});
      expect(recoverable).toEqual([]);
      expect(warnings).toEqual([]);
      // The preference still wins, one commit after hydration.
      const control = container.querySelector('button[aria-label*="simulation animation"]');
      expect(control?.textContent).toBe("Resume");
      await act(async () => root.unmount());
    } finally {
      console.error = originalError;
      w.matchMedia = saved;
      removeContainer(container);
    }
  });
});
