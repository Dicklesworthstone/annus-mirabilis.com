import { afterEach, beforeEach, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { LightQuantaDerivation } from "../../reader/LightQuantaDerivation.tsx";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../testing/reactDom.ts";
import { DerivationChain } from "./DerivationChain.tsx";
import { lqCoefficientCorrespondence } from "./lightQuantaEntropy.ts";
import { derivationStepFromHash } from "./stepFragment.ts";

// Read the published declarations without loading the journey's generated world-check payload.
const journeySource = readFileSync(
  new URL("../../discovery/lightQuanta/journeyI.ts", import.meta.url),
  "utf8",
);
const moveBlock = /export const MOVE: JourneyMove = \{([\s\S]*?)\n\};/.exec(journeySource)?.[1] ?? "";
const linkedChain = /chainId:\s*"([^"]+)"/.exec(moveBlock)?.[1] ?? "";
const linkedStep = /stepId:\s*"([^"]+)"/.exec(moveBlock)?.[1] ?? "";
const moveHref = /export const MOVE_HREF\s*=\s*"([^"]+)"/.exec(journeySource)?.[1] ?? "";
const markedStep = lqCoefficientCorrespondence.steps.find((step) => step.isMove)!;

let container: HTMLElement;
let root: Root;
beforeEach(async () => {
  await installDom();
  container = createContainer();
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  removeContainer(container);
  await uninstallDom();
});

test("the Light Quanta discovery move names the actual published, qualified coefficient step", () => {
  expect(linkedChain).toBe(lqCoefficientCorrespondence.id);
  expect(linkedStep).toBe(markedStep.id);
  expect(new URL(moveHref, "https://annus-mirabilis.com").hash).toBe(`#${markedStep.id}`);
  expect(lqCoefficientCorrespondence.steps.filter((step) => step.isMove)).toHaveLength(1);
  expect(markedStep.reasons.r2).toMatch(/heuristic/i);
  expect(markedStep.reasons.r1).toMatch(/independen/i);

  const shell = document.createElement("div");
  shell.innerHTML = renderToStaticMarkup(<LightQuantaDerivation section="s6" />);
  const target = shell.querySelector<HTMLElement>(`[id="${linkedStep}"]`)!;
  expect(shell.querySelectorAll(`[id="${linkedStep}"]`)).toHaveLength(1);
  expect(target.dataset.isMove).toBe("true");
  expect(target.closest("[data-derivation-chain]")?.getAttribute("data-derivation-chain")).toBe(
    linkedChain,
  );
  expect(target.querySelector<HTMLElement>('[data-detail="1"]')?.hidden).toBe(false);
  expect(target.textContent).toContain(markedStep.reasons.r1);
});

test("a step fragment opens its enclosing disclosures and reasoning without toggle inversion", async () => {
  window.history.replaceState({}, "", moveHref);
  await act(async () => {
    root.render(
      <details data-paper-disclosure>
        <summary>Read the argument</summary>
        <LightQuantaDerivation section="s6" />
      </details>,
    );
  });
  const target = container.querySelector<HTMLElement>(`[id="${linkedStep}"]`)!;
  const local = target.querySelector<HTMLDetailsElement>(".step-local-steps")!;
  expect(container.querySelector<HTMLDetailsElement>("[data-paper-disclosure]")!.open).toBe(true);
  expect(local.open).toBe(true);
  expect(target.classList.contains("is-focused")).toBe(true);
  expect(document.activeElement).toBe(target);

  // A programmatic open dispatches the native event too. It must not invert React's state.
  await act(async () => {
    local.dispatchEvent(new Event("toggle"));
  });
  expect(local.open).toBe(true);
  await act(async () => {
    local.open = false;
    local.dispatchEvent(new Event("toggle"));
  });
  expect(local.open).toBe(false);
});

test("hash changes and history navigation reveal the move without taking unrelated focus", async () => {
  window.history.replaceState({}, "", "/papers/light-quanta/s6/#unrelated");
  await act(async () => {
    root.render(<LightQuantaDerivation section="s6" />);
  });
  const target = container.querySelector<HTMLElement>(`[id="${linkedStep}"]`)!;
  const local = target.querySelector<HTMLDetailsElement>(".step-local-steps")!;
  expect(local.open).toBe(false);
  expect(document.activeElement).not.toBe(target);
  await act(async () => {
    window.history.replaceState({}, "", moveHref);
    window.dispatchEvent(new Event("hashchange"));
  });
  expect(local.open).toBe(true);
  expect(document.activeElement).toBe(target);
  await act(async () => {
    local.open = false;
    local.dispatchEvent(new Event("toggle"));
  });
  expect(local.open).toBe(false);
  await act(async () => {
    window.dispatchEvent(new Event("popstate"));
  });
  expect(local.open).toBe(true);
  expect(document.activeElement).toBe(target);
});

test("a qualified open parameter cannot open the same step name in another chain", async () => {
  await act(async () => {
    root.render(
      <DerivationChain
        chains={[lqCoefficientCorrespondence]}
        initialOpenStepId={`derivation-step:another-chain/${markedStep.id}`}
      />,
    );
  });
  const target = container.querySelector<HTMLElement>(`[id="${markedStep.id}"]`)!;
  expect(target.querySelector<HTMLDetailsElement>(".step-local-steps")!.open).toBe(false);
  expect(target.classList.contains("is-focused")).toBe(false);
});

test("only well-formed native step fragments are accepted", () => {
  expect(derivationStepFromHash(`#${markedStep.id}`)).toBe(markedStep.id);
  expect(derivationStepFromHash("#lq%2Dcorrespondence%2Dmatch%2Dcoefficients")).toBe(markedStep.id);
  for (const hash of ["", "#", markedStep.id, "#%E0%A4%A", "#../step", "#<step>"]) {
    expect(derivationStepFromHash(hash)).toBeNull();
  }
});
