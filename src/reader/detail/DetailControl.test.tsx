import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../testing/reactDom.ts";
import { initialOverrideState, type OverrideState, setUnitOverride } from "./applyElsewhere.ts";
import { DetailControl } from "./DetailControl.tsx";

describe("DetailControl (am-read-detail-axis-sfc)", () => {
  let container: HTMLElement;
  let root: Root;

  beforeEach(async () => {
    await installDom();
    container = createContainer();
    root = createRoot(container);
  });

  afterEach(async () => {
    removeContainer(container);
    await uninstallDom();
  });

  async function render(state: OverrideState, onChange: (next: OverrideState) => void) {
    await act(async () => {
      root.render(<DetailControl state={state} onChange={onChange} />);
    });
  }

  function radio(value: 0 | 1 | 2): HTMLInputElement {
    const el = container.querySelector(`input[type="radio"][value="${value}"]`);
    if (!el) throw new Error(`radio ${value} not found`);
    return el as HTMLInputElement;
  }

  it("renders three labeled options with the global level checked", async () => {
    await render(initialOverrideState(1), () => {});

    expect(container.querySelectorAll('input[type="radio"]').length).toBe(3);
    expect(radio(0).checked).toBe(false);
    expect(radio(1).checked).toBe(true);
    expect(radio(2).checked).toBe(false);

    const labels = [...container.querySelectorAll("[data-detail-option]")].map(
      (el) => el.textContent,
    );
    expect(labels).toEqual(["Overview", "Full explanation", "Show every step"]);
  });

  it("omits 'Apply this to the rest of the page' when no override exists", async () => {
    await render(initialOverrideState(1), () => {});
    expect(container.querySelector("[data-detail-apply-elsewhere]")).toBeNull();
  });

  it("selecting a different option calls onChange with the new global level and leaves overrides untouched", async () => {
    const withOverride = setUnitOverride(initialOverrideState(1), "unit-a", 2);
    let latest: OverrideState | null = null;
    await render(withOverride, (next) => {
      latest = next;
    });

    await act(async () => {
      radio(0).click();
    });

    const resultState = latest as OverrideState | null;
    expect(resultState !== null).toBe(true);
    expect(resultState?.globalDetail).toBe(0);
    expect(resultState?.overrides).toBe(withOverride.overrides);
  });

  it("announces the new Detail exactly once per change, naming only the new level", async () => {
    let state = initialOverrideState(1);
    await render(state, (next) => {
      state = next;
    });

    await act(async () => {
      radio(2).click();
    });
    await render(state, (next) => {
      state = next;
    });

    const announcement = container.querySelector("[data-detail-announcement]");
    expect(announcement?.textContent).toBe("Detail set to Show every step");
  });

  it("shows the apply-elsewhere action once an override exists, and it clears overrides and sets the global level", async () => {
    const withOverride = setUnitOverride(initialOverrideState(1), "unit-a", 2);
    let latest: OverrideState | null = null;
    await render(withOverride, (next) => {
      latest = next;
    });

    const applyButton = container.querySelector(
      "[data-detail-apply-elsewhere]",
    ) as HTMLButtonElement | null;
    expect(applyButton).not.toBeNull();

    await act(async () => {
      applyButton?.click();
    });

    const resultState = latest as OverrideState | null;
    expect(resultState !== null).toBe(true);
    expect(resultState?.globalDetail).toBe(2);
    expect(resultState?.overrides.size).toBe(0);

    const announcement = container.querySelector("[data-detail-announcement]");
    expect(announcement?.textContent).toBe("Detail set to Show every step");
  });

  it("the global control alone never clears an existing override", async () => {
    const withOverride = setUnitOverride(initialOverrideState(1), "unit-a", 2);
    let latest: OverrideState | null = null;
    await render(withOverride, (next) => {
      latest = next;
    });

    await act(async () => {
      radio(0).click();
    });

    const resultState = latest as OverrideState | null;
    expect(resultState?.overrides.size).toBe(1);
    expect(resultState?.overrides.get("unit-a")).toBe(2);
  });
});
