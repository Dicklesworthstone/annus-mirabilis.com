import { afterEach, beforeEach, expect, test } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createContainer, installDom, removeContainer, uninstallDom } from "../testing/reactDom.ts";
import { attachInlineLighting, type InlinePin } from "./InlineTermLighting.tsx";
import { TermHighlight } from "./TermHighlight.tsx";
import { openQuantityTerm, TERM_READY_EVENT } from "./termNavigation.ts";

let container: HTMLElement;
let reactRoot: Root | null = null;
let detach: (() => void) | null = null;

beforeEach(async () => {
  await installDom();
  container = createContainer();
});

afterEach(async () => {
  detach?.();
  detach = null;
  await act(async () => reactRoot?.unmount());
  reactRoot = null;
  removeContainer(container);
  await uninstallDom();
});

test("an unowned glyph is not a successfully opened term", () => {
  container.innerHTML =
    '<span data-paper="special-relativity"><span data-quantity-id="frameSpeed">v</span></span>';
  const before = location.href;
  expect(
    openQuantityTerm(container, { routeSlug: "special-relativity", termId: "frameSpeed" }),
  ).toBe(false);
  expect(
    openQuantityTerm(container, { routeSlug: "special-relativity", termId: "speed" }),
  ).toBe(false);
  expect(container.querySelector("[data-lit]")).toBeNull();
  expect(location.href).toBe(before);
});

test("a direct term request pins through the real display owner, is idempotent, and clears on Escape", async () => {
  reactRoot = createRoot(container);
  await act(async () => {
    reactRoot?.render(
      <>
        <TermHighlight data-paper="mass-energy" data-testid="other-paper">
          <span data-quantity-id="frameSpeed">v</span>
        </TermHighlight>
        <details>
          <summary>Open the formula</summary>
          <TermHighlight data-paper="special-relativity" data-testid="chosen">
            <span data-quantity-id="frameSpeed">v</span>
            <span data-quantity-id="frameSpeedSquared">v squared</span>
            <span data-quantity-id="frameSpeed">Speed of this frame</span>
          </TermHighlight>
        </details>
      </>,
    );
  });
  const block = container.querySelector<HTMLElement>('[data-testid="chosen"]');
  const other = container.querySelector<HTMLElement>('[data-testid="other-paper"]');
  expect(block).not.toBeNull();
  const before = location.href;
  await act(async () => {
    expect(
      openQuantityTerm(container, { routeSlug: "special-relativity", termId: "frameSpeed" }),
    ).toBe(true);
  });
  expect(block?.getAttribute("data-pinned-quantity-id")).toBe("frameSpeed");
  expect(
    [...(block?.querySelectorAll("[data-lit]") ?? [])].map((element) =>
      element.getAttribute("data-quantity-id"),
    ),
  ).toEqual(["frameSpeed", "frameSpeed"]);
  expect(other?.hasAttribute("data-pinned-quantity-id")).toBe(false);
  expect(container.querySelector("details")?.open).toBe(true);
  expect(document.activeElement).toBe(block);
  expect(location.href).toBe(before);

  await act(async () => {
    expect(
      openQuantityTerm(container, { routeSlug: "special-relativity", termId: "frameSpeed" }),
    ).toBe(true);
  });
  expect(block?.getAttribute("data-pinned-quantity-id")).toBe("frameSpeed");
  await act(async () => {
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  });
  expect(block?.hasAttribute("data-pinned-quantity-id")).toBe(false);
  expect(block?.querySelector("[data-lit]")).toBeNull();
});

test("inline navigation prefers the saved passage and uses the existing pin and cleanup lifecycle", () => {
  container.innerHTML = [
    '<p id="earlier"><span class="inline-math" data-inline-terms data-paper="mass-energy">',
    '<span data-quantity-id="speedOfLight">V</span></span></p>',
    '<p id="selected-source"><span class="inline-math" data-inline-terms data-paper="mass-energy">',
    '<span data-quantity-id="speedOfLight" id="selected-V">V</span>',
    '<span data-quantity-id="speed" id="other-quantity">v</span></span></p>',
    '<p><span class="inline-math" data-inline-terms data-paper="special-relativity">',
    '<span data-quantity-id="speedOfLight" id="other-paper">c</span></span></p>',
  ].join("");
  history.replaceState(
    { retained: 17 },
    "",
    "/papers/mass-energy/view/english/?open=term%3Amass-energy%2FspeedOfLight#selected-source",
  );
  const href = location.href;
  const pins: (InlinePin | null)[] = [];
  let ready = 0;
  document.addEventListener(TERM_READY_EVENT, () => ready++, { once: true });
  detach = attachInlineLighting(container, "mass-energy", (pin) => pins.push(pin));
  expect(ready).toBe(1);
  // A stale hover must not conceal the explicitly requested pin.
  container.querySelector("#other-quantity")?.dispatchEvent(new Event("pointerover", { bubbles: true }));
  expect(
    openQuantityTerm(container, { routeSlug: "mass-energy", termId: "speedOfLight" }),
  ).toBe(true);
  const formula = container.querySelector("#selected-V")?.closest(".inline-math");
  expect(pins.at(-1)?.quantityId).toBe("speedOfLight");
  expect(pins.at(-1)?.formula).toBe(formula);
  expect(document.activeElement).toBe(formula);
  expect(container.querySelector("#other-paper")?.hasAttribute("data-lit")).toBe(false);
  expect(container.querySelector("#other-quantity")?.hasAttribute("data-lit")).toBe(false);
  expect(container.querySelectorAll("[data-lit]").length).toBe(2);
  expect(location.href).toBe(href);
  expect(history.state).toEqual({ retained: 17 });

  expect(
    openQuantityTerm(container, { routeSlug: "mass-energy", termId: "speedOfLight" }),
  ).toBe(true);
  expect(pins.at(-1)?.quantityId).toBe("speedOfLight");
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  expect(pins.at(-1)).toBeNull();
  expect(container.querySelector("[data-lit]")).toBeNull();
  detach();
  detach = null;
  expect(
    openQuantityTerm(container, { routeSlug: "mass-energy", termId: "speedOfLight" }),
  ).toBe(false);
});

test("an acknowledged display request does not also pin a second inline inspector", async () => {
  const pins: (InlinePin | null)[] = [];
  detach = attachInlineLighting(container, "mass-energy", (pin) => pins.push(pin));
  reactRoot = createRoot(container);
  await act(async () => {
    reactRoot?.render(
      <TermHighlight
        className="inline-math"
        data-inline-terms=""
        data-paper="mass-energy"
        data-testid="owned"
      >
        <span data-quantity-id="speedOfLight">V</span>
      </TermHighlight>,
    );
  });
  await act(async () => {
    expect(
      openQuantityTerm(container, { routeSlug: "mass-energy", termId: "speedOfLight" }),
    ).toBe(true);
  });
  expect(
    container.querySelector("[data-term-highlight]")?.getAttribute("data-pinned-quantity-id"),
  ).toBe("speedOfLight");
  expect(pins).toEqual([]);
});
