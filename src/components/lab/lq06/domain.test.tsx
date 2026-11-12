import { afterEach, beforeEach, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { LQ06_DEFAULTS } from "../../../experiments/lq06/definition.ts";
import { evaluateLq06 } from "../../../experiments/lq06/session.ts";
import {
  installPredictPersistence,
  predictPersistence,
  REMEMBERS_NOTHING,
} from "../../../experiments/predict/predictPersistence.ts";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../../testing/reactDom.ts";
import { CoefficientMatchLab } from "./CoefficientMatchLab.tsx";
import { CoefficientMatchSideBySidePlot } from "./CoefficientMatchPlot.tsx";

let container: HTMLElement;
let root: Root;
let persistence: ReturnType<typeof predictPersistence>;
beforeEach(async () => {
  persistence = predictPersistence();
  installPredictPersistence(REMEMBERS_NOTHING);
  await installDom();
  document.documentElement.setAttribute("data-detail", "r1");
  container = createContainer();
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  removeContainer(container);
  await uninstallDom();
  installPredictPersistence(persistence);
});

function element<T extends Element>(selector: string): T {
  const found = container.querySelector<T>(selector);
  assert.ok(found, `Missing mounted element: ${selector}`);
  return found;
}

async function field(name: string, value: string) {
  const input = element<HTMLInputElement>(`input[type="text"][id$="-${name}"]`);
  const disclosure = input.closest("details");
  if (disclosure) disclosure.open = true;
  await act(async () => {
    input.value = value;
    input.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
  });
}

async function mount() {
  await act(async () => root.render(<CoefficientMatchLab restoreFromLocation={false} />));
  for (const button of container.querySelectorAll<HTMLButtonElement>(
    'button[aria-label^="Skip prediction for"]',
  ))
    await act(async () => button.click());
  expect(container.querySelector('[data-predict-gate="awaiting"]')).toBeNull();
  const choice = [
    ...container.querySelectorAll<HTMLButtonElement>(".lq06-subexpressions button"),
  ].find((button) => button.textContent?.includes("NE/(Rβν)"));
  assert.ok(choice);
  await act(async () => choice.click());
}

test("changing real controls withdraws the claim, preserves gas/formal results, and recovers with the choice intact", async () => {
  await mount();
  expect(element<HTMLElement>(".lq06-laws-verdict").textContent).toContain("The laws match");
  await field("temperature", "5000");
  await field("volumeRatio", "0.25");
  const unavailable = element<HTMLElement>('[data-correspondence="unavailable"]');
  expect(unavailable.textContent).toContain("1% Wien-to-Planck");
  expect(unavailable.textContent).not.toContain("The laws match");
  expect(unavailable.textContent).not.toContain("the two laws differ");
  expect(unavailable.closest('[data-predict-gate="awaiting"]')).toBeNull();
  for (const id of ["effectiveIndependentCount", "radiationEntropy", "entropyVolumeCoefficient"]) {
    const output = element<HTMLElement>(`[data-output="${id}"]`);
    expect(output.textContent).toContain("Wien regime");
    expect(output.querySelector(".sci")).toBeNull();
  }
  const gas = element<HTMLElement>('[data-output="gasEntropy"]').textContent;
  expect(gas).not.toContain("Wien regime");
  const formal = element<HTMLElement>('[data-view-id="lq-06-mean-energy-strip"]');
  expect(formal.textContent).toContain("outside the admitted Wien regime");
  expect(formal.textContent).toContain("1.2926 eV");
  expect(formal.textContent).not.toContain("0.7756 eV");

  await field("volumeRatio", "0");
  expect(element<HTMLElement>('[data-apply-failure="refused"]').textContent).toContain(
    "last accepted settings",
  );
  expect(element<HTMLElement>('[data-output="gasEntropy"]').textContent).toBe(gas);
  expect(element<HTMLElement>('[data-correspondence="unavailable"]').textContent).toContain("1%");

  await field("volumeRatio", "0.5");
  expect(container.querySelector('[data-apply-failure="refused"]')).toBeNull();
  expect(container.querySelector('[data-correspondence="unavailable"]')).toBeNull();
  expect(element<HTMLElement>(".lq06-laws-verdict").textContent).toContain("The laws match");
  expect(
    element<HTMLElement>('.lq06-subexpressions button[aria-pressed="true"]').textContent,
  ).toContain("NE/(Rβν)");
});

test("a linked out-of-regime state renders a readable domain exit instead of a successful default example", () => {
  const parameters = {
    ...LQ06_DEFAULTS,
    frequency: 2e14,
    temperature: 6000,
    selectedSubexpression: "N_E_over_R_beta_nu" as const,
  };
  const html = renderToStaticMarkup(
    <CoefficientMatchLab
      example={{
        sourceDigest: `source:sha256:${"b".repeat(64)}`,
        parameters,
        results: evaluateLq06(parameters).map((value) => JSON.stringify(value)),
        stepIndex: 0,
        simulationTime: 0,
      }}
      restoreFromLocation={false}
    />,
  );
  expect(html).toContain('data-correspondence="unavailable"');
  expect(html).toContain("only in the Wien regime");
  expect(html).not.toContain("The laws match:");
  expect(html).not.toContain("2.4814 eV");
  expect(html).toContain("1.5511 eV");
});

test("missing accepted scalar outputs never acquire default count or coefficient numbers in the plot", () => {
  const html = renderToStaticMarkup(
    <CoefficientMatchSideBySidePlot
      radiationEnergyJ={9e-9}
      frequencyHz={6e14}
      volumeRatio={0.5}
      gasParticles={10}
      effectiveCount={null}
      quantumEnergyEv={null}
      radVolumeCoeff={null}
      gasVolumeCoeff={null}
      radiationUnavailableReason={null}
      isMatch={true}
      hasSelection={true}
      selectedLabel="NE/(Rβν)"
    />,
  );
  expect(html).toContain("comparison is not reported");
  expect(html).not.toContain("The laws match:");
  expect(html).not.toContain("2.277774");
});
