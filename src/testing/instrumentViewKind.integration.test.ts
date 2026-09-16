/**
 * am-read-return-stack-oxa. instrument-view mounted through the REAL dispatcher
 * (am-inst-registry-dispatcher-66l0): no fixture dispatcher, no parallel resolution logic. A
 * fixture view loader stands in for the not-yet-wired production loader map (dispatch.tsx's own
 * docblock: that map is am-inst-lab-route-f8f3's scope, which does not exist yet).
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { getClarificationKind } from "../reader/stack/kinds.ts";
import { installDom, uninstallDom } from "./reactDom.ts";

beforeEach(installDom);
afterEach(uninstallDom);

describe("instrument-view: real dispatcher, fixture instrument", () => {
  test("a known id with a fixture view loader mounts the fixture view", async () => {
    const def = getClarificationKind("instrument-view")!;
    const parsed = def.parseId("bm-01")!;
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        def.render?.({
          parsed,
          instanceId: "bm-01:test",
          viewLoaders: {
            "bm-01": () =>
              Promise.resolve({
                default: ({ instanceId }: { instanceId: string }) =>
                  createElement(
                    "div",
                    { "data-testid": "fixture-view" },
                    `fixture view for ${instanceId}`,
                  ),
              }),
          },
        }),
      );
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const fixtureView = container.querySelector('[data-testid="fixture-view"]');
    expect(fixtureView).not.toBeNull();
    expect(fixtureView?.textContent).toBe("fixture view for bm-01:test");
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  test("a well-formed but unknown experiment id fails explicitly: the unknown-experiment notice, never another instrument", async () => {
    const def = getClarificationKind("instrument-view")!;
    const parsed = def.parseId("zz-99")!;
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(def.render?.({ parsed, instanceId: "zz-99:test" }));
    });
    const notice = container.querySelector('[data-testid="unknown-experiment-notice"]');
    expect(notice).not.toBeNull();
    expect(notice?.textContent).toContain("zz-99");
    // Never a substitute instrument: no other instrument's markup is present.
    expect(container.querySelector('[data-testid="fixture-view"]')).toBeNull();
    expect(container.querySelector('[data-testid="in-preparation-notice"]')).toBeNull();
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  test("a known, real catalogue id with no view loader renders the in-preparation surface, never a fabricated result", async () => {
    const def = getClarificationKind("instrument-view")!;
    const parsed = def.parseId("bm-01")!;
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(def.render?.({ parsed, instanceId: "bm-01:test" }));
    });
    expect(container.querySelector('[data-testid="in-preparation-notice"]')).not.toBeNull();
    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
