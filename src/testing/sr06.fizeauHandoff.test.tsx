import { afterEach, beforeEach, expect, test } from "bun:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { FizeauComparison } from "../components/lab/shelfOptics/FizeauComparison.tsx";
import { VelocityCompositionLab } from "../components/lab/sr06/VelocityCompositionLab.tsx";
import { prepareFizeauWorldCheck } from "../discovery/relativity/fizeauWorldCheck.ts";
import { evaluateShelfOptics } from "../experiments/shelfOptics/evaluation.ts";
import { shelfSnapshot } from "../experiments/shelfOptics/state.ts";
import { SR06_DEFAULTS } from "../experiments/sr06/definition.ts";
import { decodeSr06Settings, encodeSr06Settings } from "../experiments/sr06/permalink.ts";
import { DEFAULT_PREPARED_EXAMPLE } from "../experiments/sr06/session.ts";
import { createContainer, installDom, removeContainer, uninstallDom } from "./reactDom.ts";

beforeEach(installDom);
afterEach(uninstallDom);

test("water settings preserve signed flow and keep older links readable", () => {
  const settings = { ...SR06_DEFAULTS, mediumIndex: 1.5, flowSpeed: -9 };
  expect(decodeSr06Settings(encodeSr06Settings(settings))).toEqual({ kind: "settings", parameters: settings });
  expect(decodeSr06Settings("?n=1.5&flow=0")).toEqual({ kind: "settings", parameters: { ...settings, flowSpeed: 0 } });
  expect(decodeSr06Settings("?v=0.6&w=0.6&mode=collinear")).toEqual({ kind: "settings", parameters: SR06_DEFAULTS });
  for (const invalid of ["?flow=", "?flow=1001", "?n=1", "?n=3.1", "?n=1.3&n=1.7", "?flow=abc"]) {
    expect(decodeSr06Settings(invalid).kind).toBe("invalid");
  }
});

test("the accepted water experiment reaches the editable controls and the velocity calculation", async () => {
  const { record, example } = prepareFizeauWorldCheck();
  if (example.parameters.instrumentId !== "shelf-fizeau") throw new Error("Expected the water apparatus");
  const params = { ...example.parameters, refractiveIndex: 1.5, waterSpeed: -9 };
  const source = document.createElement("div");
  source.innerHTML = renderToStaticMarkup(
    <FizeauComparison record={record} snapshot={shelfSnapshot(evaluateShelfOptics(params), 2)} dirty />,
  );
  const link = source.querySelector<HTMLAnchorElement>('a[href^="/lab/sr-06/?"]');
  if (!link) throw new Error("No laboratory handoff at the measured water table");
  expect(source.querySelectorAll("[data-fizeau-observed]").length).toBe(19);
  window.history.replaceState(null, "", link.href);
  const container = createContainer();
  const root = createRoot(container);
  try {
    await act(async () => root.render(<VelocityCompositionLab example={DEFAULT_PREPARED_EXAMPLE} />));
    expect(container.querySelector<HTMLInputElement>('[name="mediumIndex"]')?.value).toBe("1.5");
    expect(container.querySelector<HTMLInputElement>('[name="flowSpeed"]')?.value).toBe("-9");
    const increment = () => Number(container.querySelector('[data-output="fizeauIncrement"]')?.textContent);
    expect(increment()).toBeGreaterThan(0);
    const form = container.querySelector("form");
    if (!form) throw new Error("No composition controls");
    await act(async () => { form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    // The Fresnel coefficient is 1 - 1/1.5². The exact increment also uses the signed speed in its denominator.
    expect(increment()).toBeCloseTo(-5 / (1 - 9 / (1.5 * 299792458)), 7);
    expect(Number(container.querySelector('[data-output="fresnelIncrement"]')?.textContent)).toBe(-5);
  } finally {
    await act(async () => root.unmount());
    removeContainer(container);
  }
});
