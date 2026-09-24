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
import { HydrationGate } from "./HydrationGate.tsx";

/*
 * The gate is disabled in the served HTML, so every control inside is inert for a reader without
 * JavaScript, and hydration lifts it (am-nojs-dead-controls-3agt). The browser half, over the
 * built pages with JavaScript off and on, is scripts/e2e/nojsDeadControls.e2e.test.ts.
 */
function Page() {
  return (
    <HydrationGate>
      <button type="button" data-probe="plain">
        Show
      </button>
      <button type="button" data-probe="own" disabled>
        Already disabled
      </button>
    </HydrationGate>
  );
}

beforeEach(async () => {
  await installDom();
});
afterEach(async () => {
  await uninstallDom();
});

describe("HydrationGate", () => {
  test("the served HTML disables the page's controls, in a fieldset that makes no group", () => {
    const html = renderToString(<Page />);
    expect(html).toMatch(/<fieldset class="hydration-gate" role="none" disabled="">/);
    expect(html).toContain('data-probe="plain"');
  });

  test("hydration lifts the gate, and a control disabled for its own reason stays disabled", async () => {
    const container = createContainer();
    container.innerHTML = renderToString(<Page />);
    const gate = container.querySelector("fieldset") as HTMLFieldSetElement;
    expect(gate.disabled).toBe(true);
    let root: ReturnType<typeof hydrateRoot> | undefined;
    await act(async () => {
      root = hydrateRoot(container, <Page />);
    });
    expect(gate.disabled).toBe(false);
    expect(gate.hasAttribute("disabled")).toBe(false);
    const own = container.querySelector('[data-probe="own"]') as HTMLButtonElement;
    expect(own.disabled).toBe(true);
    await act(async () => root?.unmount());
    removeContainer(container);
  });
});
