import { afterEach, beforeEach, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import {
  LQ03_DEFAULTS,
  type Lq03Parameters,
} from "../../../experiments/lq03/definition.ts";
import {
  createLq03Session,
  evaluateLq03,
} from "../../../experiments/lq03/session.ts";
import {
  installPredictPersistence,
  REMEMBERS_NOTHING,
} from "../../../experiments/predict/predictPersistence.ts";
import labDigests from "../../../generated/lab-source-digests.json";
import { installDom, uninstallDom } from "../../../testing/reactDom.ts";
import { SpectrumLab } from "./SpectrumLab.tsx";
import { TemperatureComparison } from "./TemperatureComparison.tsx";

let host: HTMLElement;
let root: Root | null = null;
let owner: ReturnType<typeof createLq03Session>;
let serial = 0;

beforeEach(async () => {
  await installDom({ intersections: "visible" });
  installPredictPersistence(REMEMBERS_NOTHING);
  host = document.createElement("div");
  document.body.append(host);
  owner = createLq03Session("temperature-main-" + ++serial);
});

afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  owner.disconnect();
  host.remove();
  installPredictPersistence(REMEMBERS_NOTHING);
  await uninstallDom();
});

function required<T extends Element = HTMLElement>(selector: string, scope: ParentNode = host): T {
  const found = scope.querySelector<T>(selector);
  assert.ok(found, "The mounted laboratory must contain " + selector);
  return found;
}

function button(label: string, scope: ParentNode = host): HTMLButtonElement {
  const found = [...scope.querySelectorAll("button")].find(
    (candidate) => candidate.textContent?.trim() === label,
  );
  assert.ok(found, "The laboratory must offer " + label);
  return found;
}

async function click(label: string, scope: ParentNode = host) {
  await act(async () => button(label, scope).click());
}

async function change(selector: string, value: string) {
  const control = required<HTMLInputElement | HTMLSelectElement>(selector);
  const key = Object.keys(control).find((name) => name.startsWith("__reactProps$"));
  assert.ok(key);
  const props = (control as unknown as Record<string, {
    onChange(event: { target: typeof control; currentTarget: typeof control }): void;
  }>)[key];
  assert.ok(props);
  await act(async () => {
    control.value = value;
    props.onChange({ target: control, currentTarget: control });
  });
}

async function submit(label = "Temperature comparison settings") {
  const form = required<HTMLFormElement>('form[aria-label="' + label + '"]');
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

async function mountComparison(parameters: Lq03Parameters = LQ03_DEFAULTS) {
  owner.apply(parameters);
  root = createRoot(host);
  await act(async () => {
    root?.render(
      <StrictMode>
        <TemperatureComparison session={owner} sourceDigest={labDigests["lq-03"]} enabled />
      </StrictMode>,
    );
  });
  await click("Pin spectrum for temperature comparison");
}

function columns(input: string): (string | null)[] {
  return [...required('[data-comparison-input="' + input + '"]').querySelectorAll("td")].map(
    (cell) => cell.textContent,
  );
}

function readout(id: string) {
  return required('[data-comparison-output="' + id + '"]');
}

function identity() {
  const element = required("[data-comparison-results]");
  return [
    "data-baseline-run-id",
    "data-variant-run-id",
    "data-baseline-snapshot",
    "data-variant-snapshot",
  ].map((name) => element.getAttribute(name));
}

test("server output offers the comparison after the existing prediction boundary, without creating it", () => {
  host.innerHTML = renderToStaticMarkup(
    <SpectrumLab
      instanceId="temperature-static"
      restoreFromLocation={false}
      example={{
        parameters: LQ03_DEFAULTS,
        evaluation: evaluateLq03(LQ03_DEFAULTS),
        sourceDigest: labDigests["lq-03"],
      }}
    />,
  );
  expect(host.querySelector("[data-temperature-comparison]")).toBeNull();
  expect(button("Pin spectrum for temperature comparison").disabled).toBe(true);
  expect(required("[data-temperature-comparison-offer]").closest("[data-predict-response]")).not.toBeNull();
  expect(host.textContent).toContain("complete worked example");
});

test("pinning waits for the prediction reveal and ignores dirty fields in the real spectrum lab", async () => {
  root = createRoot(host);
  await act(async () => {
    root?.render(
      <StrictMode>
        <SpectrumLab
          instanceId={"temperature-integrated-" + serial}
          restoreFromLocation={false}
          example={{
            parameters: LQ03_DEFAULTS,
            evaluation: evaluateLq03(LQ03_DEFAULTS),
            sourceDigest: labDigests["lq-03"],
          }}
        />
      </StrictMode>,
    );
  });
  expect(button("Pin spectrum for temperature comparison").disabled).toBe(true);
  await click("Skip prediction");
  await change('input[name="nu1"]', "300000000000000");
  await change('input[name="probeNu"]', "");
  await click("Pin spectrum for temperature comparison");
  expect(columns("nu1")[1]).toContain("400");
  expect(columns("probeNu")[1]).toContain("600");
  const frozen = required("[data-comparison-results]").innerHTML;
  await submit("Radiation spectrum settings");
  expect(required("[data-comparison-results]").innerHTML).toBe(frozen);
  await change('input[name="probeNu"]', "200000000000000");
  await submit("Radiation spectrum settings");
  expect(required("[data-comparison-results]").innerHTML).toBe(frozen);
});

test("doubling temperature overlays two accepted curves and exposes the regime and distinct peak changes", async () => {
  await mountComparison();
  const mainBefore = owner.getSnapshot();
  await click("Double baseline temperature");
  expect(columns("T")[1]).toContain("5000");
  expect(columns("T")[2]).toContain("10000");
  expect(required("[data-spectrum-reference]").getAttribute("d")?.length).toBeGreaterThan(100);
  const variantPath = required("[data-temperature-comparison] path.lq03-curve:not([data-spectrum-reference])");
  expect(variantPath.getAttribute("d")).not.toBe(required("[data-spectrum-reference]").getAttribute("d"));
  expect(readout("peakFrequency").querySelector("[data-comparison-ratio]")?.textContent).toBe("2");
  expect(readout("peakWavelength").querySelector("[data-comparison-ratio]")?.textContent).toBe("0.5");
  expect(required('[data-temperature-regime="baseline"]').textContent).toContain("Wien's law meets");
  expect(required('[data-temperature-regime="variant"]').textContent).toContain("Neither");
  expect(owner.getSnapshot()).toBe(mainBefore);
  expect(host.textContent).toContain("fourth-power law applies to the integral over all frequencies");
  expect(required('a[download]').getAttribute("href")).toContain("application/json");
});

test("coordinate and scale switches keep both accepted identities and all quantitative readouts", async () => {
  await mountComparison();
  await change('input[name="comparison-temperature"]', "7500");
  await submit();
  const acceptedIds = identity();
  const band = readout("bandEnergy").innerHTML;
  const oldPath = required("[data-spectrum-reference]").getAttribute("d");
  await change('select[name="comparison-coordinate"]', "wavelength");
  expect(required("[data-spectrum-reference]").getAttribute("d")).not.toBe(oldPath);
  expect(host.textContent).toContain("per metre of wavelength");
  expect(host.textContent).toContain("c divided by the wavelength-density peak is not");
  expect(readout("bandEnergy").innerHTML).toBe(band);
  expect(identity()).toEqual(acceptedIds);
  await change('select[name="comparison-axis-scale"]', "linear");
  expect(readout("bandEnergy").innerHTML).toBe(band);
  expect(identity()).toEqual(acceptedIds);
});

test("a refused temperature keeps its draft and the previous accepted pair; a valid retry resumes", async () => {
  await mountComparison();
  await change('input[name="comparison-temperature"]', "7500");
  await submit();
  const acceptedIds = identity();
  const band = readout("bandEnergy").innerHTML;
  const path = required("[data-spectrum-reference]").getAttribute("d");
  await change('input[name="comparison-temperature"]', "20000");
  await submit();
  expect(required<HTMLInputElement>('input[name="comparison-temperature"]').value).toBe("20000");
  expect(required("[data-temperature-comparison]").getAttribute("data-currency-state")).not.toBe("current");
  expect(host.textContent).toContain("previous completed comparison is unchanged");
  expect(identity()).toEqual(acceptedIds);
  expect(readout("bandEnergy").innerHTML).toBe(band);
  expect(required("[data-spectrum-reference]").getAttribute("d")).toBe(path);
  await change('input[name="comparison-temperature"]', "6000");
  await submit();
  expect(columns("T")[2]).toContain("6000");
  expect(identity()).not.toEqual(acceptedIds);
});

test("a re-pinned temperature becomes the held reference and close leaves the main owner intact", async () => {
  await mountComparison();
  const main = owner.getSnapshot();
  await click("Double baseline temperature");
  await click("Pin variant as new baseline");
  expect(columns("T")[1]).toContain("10000");
  expect(button("Double baseline temperature").disabled).toBe(true);
  await click("Halve baseline temperature");
  expect(columns("T")[1]).toContain("10000");
  expect(columns("T")[2]).toContain("5000");
  await click("Return to baseline temperature");
  expect(columns("T")[2]).toContain("10000");
  await click("Close temperature comparison");
  expect(host.querySelector("[data-temperature-comparison]")).toBeNull();
  expect(owner.getSnapshot()).toBe(main);
});

test("historical calibration is visible and retained in the exported comparison", async () => {
  await mountComparison({
    ...LQ03_DEFAULTS,
    constantSetId: "einstein-1905-light-quanta-printed",
  });
  await click("Double baseline temperature");
  expect(columns("constantSetId")[1]).toBe("einstein-1905-light-quanta-printed");
  expect(columns("constantSetId")[2]).toBe("einstein-1905-light-quanta-printed");
  expect(host.textContent).toContain("corrected exponent of α");
  const link = required<HTMLAnchorElement>("a[download]");
  const record = decodeURIComponent(link.href.slice(link.href.indexOf(",") + 1));
  expect(record).toContain("einstein-1905-light-quanta-printed");
  expect(record).toContain(labDigests["lq-03"]);
});

test("the public laboratory can pin a spectrum without a prepared example prop", async () => {
  root = createRoot(host);
  await act(async () => {
    root?.render(
      <StrictMode>
        <SpectrumLab instanceId={"temperature-unprepared-" + serial} restoreFromLocation={false} />
      </StrictMode>,
    );
  });
  await click("Skip prediction");
  await click("Pin spectrum for temperature comparison");
  expect(required("[data-temperature-comparison]")).toBeDefined();
  expect(columns("T")[1]).toContain(String(LQ03_DEFAULTS.T));
  expect(host.textContent).not.toContain("needs the radiation evaluator's identified source");
  const link = required<HTMLAnchorElement>("a[download]");
  const record = decodeURIComponent(link.href.slice(link.href.indexOf(",") + 1));
  expect(record).toContain(labDigests["lq-03"]);
});
