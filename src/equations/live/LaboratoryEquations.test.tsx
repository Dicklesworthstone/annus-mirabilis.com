import { afterEach, beforeEach, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { DopplerAberrationLab } from "../../components/lab/sr09/DopplerAberrationLab.tsx";
import type { PreparedSr09Example } from "../../experiments/sr09/session.ts";
import rayExample from "../../generated/sr09-example.json";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../testing/reactDom.ts";

beforeEach(async () => {
  await installDom();
});
afterEach(async () => {
  await uninstallDom();
});

const ray = rayExample as PreparedSr09Example;

function term(root: ParentNode, termId: string): HTMLElement {
  const value = root.querySelector<HTMLElement>('[data-term-value="' + termId + '"]');
  assert.ok(value, "The actual laboratory must render " + termId);
  return value;
}

function button(root: ParentNode, text: string): HTMLButtonElement {
  const found = Array.from(root.querySelectorAll<HTMLButtonElement>("button")).find(
    (candidate) => candidate.textContent?.includes(text),
  );
  assert.ok(found, "The laboratory must expose " + text);
  return found;
}

function checkIdentity(root: ParentNode, experimentId: string) {
  const laboratory = root.querySelector<HTMLElement>(
    '[data-instrument-id="' + experimentId + '"]',
  );
  const panel = root.querySelector<HTMLElement>(
    '[data-laboratory-equations="' + experimentId + '"]',
  );
  assert.ok(laboratory && panel);
  const regions = panel.querySelectorAll<HTMLElement>("[data-equation-values]");
  expect(regions.length).toBeGreaterThan(0);
  for (const region of regions) {
    expect(region.dataset.experimentId).toBe(experimentId);
    expect(region.dataset.instanceSlot).toBe("primary");
    for (const attribute of [
      "data-instance-id",
      "data-run-id",
      "data-snapshot-version",
      "data-input-revision",
      "data-accepted-input-revision",
      "data-pending",
      "data-execution-label",
    ]) {
      expect(region.getAttribute(attribute)).toBe(laboratory.getAttribute(attribute));
    }
  }
  return panel;
}

test("the Doppler equation panel serves the accepted worked example before JavaScript", () => {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(
    <DopplerAberrationLab
      example={ray}
      instanceId="static-equation-ray"
      restoreFromLocation={false}
    />,
  );
  const panel = checkIdentity(container, "sr-09");
  expect(term(panel, "eq-model-sr-doppler-factor.t.ratio").dataset.valueKind).toBe("value");
  for (const region of panel.querySelectorAll<HTMLElement>("[data-equation-values]")) {
    expect(region.dataset.executionLabel).toBe("static");
    expect(region.dataset.pending).toBe("false");
  }
});

test("Doppler controls update the accepted equation and its pinned companion", async () => {
  const container = createContainer();
  const root = createRoot(container);
  try {
    await act(async () => {
      root.render(
        <DopplerAberrationLab
          example={ray}
          instanceId="live-equation-ray"
          restoreFromLocation={false}
        />,
      );
    });
    const panel = checkIdentity(container, "sr-09");
    const ratioId = "eq-model-sr-doppler-factor.t.ratio";
    expect(term(panel, ratioId).textContent).toContain("0.5");
    const beforeVersion =
      panel.querySelector<HTMLElement>("[data-equation-values]")?.dataset.snapshotVersion;
    const pin = panel.querySelector<HTMLButtonElement>(
      '[data-pin-equation="eq-model-sr-doppler-factor"]',
    );
    assert.ok(pin && !pin.disabled);
    await act(async () => {
      pin.click();
    });
    expect(document.querySelectorAll('[data-term-value="' + ratioId + '"]').length).toBe(2);
    await act(async () => {
      button(container, "Transverse 0.6c").click();
    });
    checkIdentity(container, "sr-09");
    const afterVersion =
      panel.querySelector<HTMLElement>("[data-equation-values]")?.dataset.snapshotVersion;
    expect(afterVersion).not.toBe(beforeVersion);
    for (const value of document.querySelectorAll<HTMLElement>(
      '[data-term-value="' + ratioId + '"]',
    )) {
      expect(value.dataset.valueKind).toBe("value");
      expect(value.textContent).toContain("1.25");
      const identity = value.closest<HTMLElement>("[data-equation-values]")?.dataset;
      expect(identity?.snapshotVersion).toBe(afterVersion);
      expect(identity?.executionLabel).toBe("host");
    }
    expect(
      container.querySelector('.lab-results [data-quantity-id="dopplerFactor"]')?.textContent,
    ).toContain("1.25");
    expect(term(panel, "eq-model-sr-doppler-factor.t.light").dataset.valueKind).toBe(
      "symbolic",
    );
  } finally {
    await act(async () => {
      root.unmount();
    });
    removeContainer(container);
  }
});
