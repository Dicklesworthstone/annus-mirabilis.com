import { afterEach, beforeEach, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { ME03_DEFAULTS } from "../../../experiments/me03/definition.ts";
import { createMe03Session, DEFAULT_PREPARED_EXAMPLE } from "../../../experiments/me03/session.ts";
import {
  installPredictPersistence,
  REMEMBERS_NOTHING,
} from "../../../experiments/predict/predictPersistence.ts";
import labDigests from "../../../generated/lab-source-digests.json";
import { comparisonReplayAdapter } from "../../../reader/notebook/comparisonAdapters.ts";
import { installDom, uninstallDom } from "../../../testing/reactDom.ts";
import { BoundaryLedgerLab } from "./BoundaryLedgerLab.tsx";

const example = { ...DEFAULT_PREPARED_EXAMPLE, sourceDigest: labDigests["me-03"] };
let host: HTMLElement;
let root: Root | null = null;
let owner: ReturnType<typeof createMe03Session>;

beforeEach(async () => {
  await installDom({ intersections: "visible" });
  installPredictPersistence(REMEMBERS_NOTHING);
  host = document.createElement("div");
  document.body.append(host);
  owner = createMe03Session("comparison-main-ledger");
});

afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  host.remove();
  installPredictPersistence(REMEMBERS_NOTHING);
  await uninstallDom();
});

function required<T extends Element = HTMLElement>(selector: string, scope: ParentNode = host): T {
  const element = scope.querySelector<T>(selector);
  assert.ok(element, `The mounted ledger must contain ${selector}`);
  return element;
}

function button(label: string, scope: ParentNode = host): HTMLButtonElement {
  const found = [...scope.querySelectorAll("button")].find(
    (element) => element.textContent?.trim() === label,
  );
  assert.ok(found, `The mounted ledger must offer ${label}`);
  return found;
}

async function click(label: string, scope: ParentNode = host) {
  await act(async () => button(label, scope).click());
}

async function mount(predict = false, showComparison = true) {
  installPredictPersistence({ ...REMEMBERS_NOTHING, asks: () => predict });
  root = createRoot(host);
  await act(async () => {
    root?.render(
      <StrictMode>
        <BoundaryLedgerLab
          example={example}
          session={owner}
          restoreFromLocation={false}
          showComparison={showComparison}
        />
      </StrictMode>,
    );
  });
}

type Control = HTMLInputElement | HTMLSelectElement;
type Handlers = { onChange(event: { target: Control; currentTarget: Control }): void };

async function change(selector: string, value: string) {
  const control = required<Control>(selector);
  const key =
    Object.keys(control).find((name) => name.startsWith("__reactProps$")) ??
    Object.keys(required("input")).find((name) => name.startsWith("__reactProps$"));
  assert.ok(key, "The real mounted field must have React handlers.");
  const props = (control as unknown as Record<string, Handlers>)[key];
  assert.ok(props);
  await act(async () => {
    control.value = value;
    props.onChange({ target: control, currentTarget: control });
  });
}

async function submit(label = "Controlled system-boundary settings") {
  await act(async () => {
    required<HTMLFormElement>(`form[aria-label="${label}"]`).dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
  });
}

const outputRow = (id: string) => required(`[data-comparison-output="${id}"]`);
const value = (id: string, column: "baseline" | "variant") => {
  const cells = outputRow(id).querySelectorAll("td");
  return cells[column === "baseline" ? 1 : 2]?.querySelector("[data-result-status] > span")
    ?.textContent;
};
const savedFields = () => required<HTMLFieldSetElement>(".replay-save fieldset");

test("server markup retains the worked ledger and keeps comparison opt-in disabled", () => {
  host.innerHTML = renderToStaticMarkup(
    <BoundaryLedgerLab example={example} session={owner} restoreFromLocation={false} />,
  );
  expect(host.textContent).toContain("JavaScript is off");
  expect(host.querySelector("[data-boundary-comparison]")).toBeNull();
  expect(button("Pin accepted emission for comparison").disabled).toBe(true);
  expect(
    required("[data-boundary-comparison-offer]").closest('[data-predict-response="awaiting"]'),
  ).not.toBeNull();
  expect(required<HTMLInputElement>('input[name="emittedEnergy"]').value).toBe("1");
  expect(host.textContent).toContain("System boundary energy ledger");
});

test("the predict-first gate must reveal before a comparison opens", async () => {
  await mount(true);
  const accepted = owner.getSnapshot().accepted;
  expect(button("Pin accepted emission for comparison").disabled).toBe(true);
  await click("Pin accepted emission for comparison");
  expect(host.querySelector("[data-boundary-comparison]")).toBeNull();
  await click("Skip prediction");
  await click("Pin accepted emission for comparison");
  expect(required("[data-boundary-comparison]").getAttribute("data-comparison-phase")).toBe("live");
  expect(owner.getSnapshot().accepted).toBe(accepted);
});

test("the real ledger pins one emission and compares body loss with complete-system conservation", async () => {
  await mount();
  const accepted = owner.getSnapshot().accepted;
  await click("Pin accepted emission for comparison");
  expect(value("energyChange", "baseline")).toBe("−1");
  expect(value("energyChange", "variant")).toBe("−1");
  await change('select[name="comparison-boundary"]', "combined-isolated-system");
  expect(savedFields().disabled).toBe(true);
  expect(value("energyChange", "variant")).toBe("−1");
  await submit();
  expect(value("energyChange", "baseline")).toBe("−1");
  expect(value("energyChange", "variant")).toBe("0");
  expect(value("massChange", "baseline")).toContain("10^−17");
  expect(value("massChange", "variant")).toBe("0");
  expect(value("radiationEnergyChange", "variant")).toBe("1");
  const results = required("[data-comparison-results]");
  expect(results.getAttribute("data-baseline-run-id")).toBe(
    results.getAttribute("data-variant-run-id"),
  );
  expect(required("[data-accepted-boundaries]").textContent).toContain(
    "The body and all emitted radiation",
  );
  expect(savedFields().disabled).toBe(false);
  expect(owner.getSnapshot().accepted).toBe(accepted);
});

test("the radiation boundary shows its inapplicable mass and explains unavailable arithmetic", async () => {
  await mount();
  await click("Pin accepted emission for comparison");
  await change('select[name="comparison-boundary"]', "radiation");
  await submit();
  expect(value("energyChange", "variant")).toBe("1");
  expect(value("massChange", "variant")).toContain("not assigned an inertial rest mass");
  expect(
    outputRow("massChange").querySelectorAll('[data-result-status="not-applicable"]'),
  ).toHaveLength(1);
  expect(required("[data-comparison-ratio]", outputRow("massChange")).textContent).toContain(
    "finite numeric values",
  );
  expect(
    outputRow("radiationMassChange").querySelectorAll('[data-result-status="not-applicable"]'),
  ).toHaveLength(2);
});

test("a new draft or refused boundary cannot save stale evidence, and applying a valid choice recovers", async () => {
  await mount();
  await click("Pin accepted emission for comparison");
  await change('select[name="comparison-boundary"]', "combined-isolated-system");
  await submit();
  const completed = required("[data-comparison-results]").getAttribute("data-variant-snapshot");
  await change('select[name="comparison-boundary"]', "radiation");
  expect(savedFields().disabled).toBe(true);
  expect(value("energyChange", "variant")).toBe("0");
  expect(host.textContent).toContain("This boundary choice has not been calculated");
  await change('select[name="comparison-boundary"]', "invalid-boundary");
  expect(required("[data-boundary-comparison] [role=alert]").textContent).toContain(
    "Choose the body",
  );
  expect(savedFields().disabled).toBe(true);
  expect(required("[data-comparison-results]").getAttribute("data-variant-snapshot")).toBe(
    completed,
  );
  await change('select[name="comparison-boundary"]', "radiation");
  await submit();
  expect(savedFields().disabled).toBe(false);
  expect(value("energyChange", "variant")).toBe("1");
});

test("a prediction belongs to the comparison requested before it, not a later choice", async () => {
  await mount();
  await click("Pin accepted emission for comparison");
  await change('select[name="comparison-boundary"]', "combined-isolated-system");
  await change('select[name="comparison-prediction"]', "larger");
  await submit();
  const predictions = comparisonReplayAdapter("me-03").predictions;
  expect(required(".replay-save").textContent).toContain(predictions.larger);
  await change('select[name="comparison-prediction"]', "smaller");
  expect(required(".replay-save").textContent).toContain(predictions.larger);
  expect(required(".replay-save").textContent).not.toContain(predictions.smaller);
  expect(host.textContent).toContain("zero is larger than a negative change");
});

test("explicit repinning reverses the boundary comparison without inventing a ratio to zero", async () => {
  await mount();
  await click("Pin accepted emission for comparison");
  await change('select[name="comparison-boundary"]', "combined-isolated-system");
  await submit();
  await click("Pin current variant as new baseline");
  expect(value("energyChange", "baseline")).toBe("0");
  await change('select[name="comparison-boundary"]', "body-alone");
  await submit();
  expect(value("energyChange", "variant")).toBe("−1");
  expect(required("[data-comparison-ratio]", outputRow("massChange")).textContent).toContain(
    "baseline is zero",
  );
  await click("Return variant to pinned boundary");
  expect(value("energyChange", "variant")).toBe("0");
});

test("1905 energy controls make invalid inputs and the external-heating refusal repairable", async () => {
  await mount();
  const accepted = owner.getSnapshot().accepted;
  await change('input[name="emittedEnergy"]', "");
  await submit("Energy ledger parameters");
  expect(owner.getSnapshot().accepted).toBe(accepted);
  expect(host.textContent).toContain("greater than zero");
  await change('input[name="emittedEnergy"]', "2");
  await change('input[name="inputEnergy"]', "1");
  await submit("Energy ledger parameters");
  expect(owner.acceptedParameters().emittedEnergy).toBe(2);
  expect(owner.acceptedParameters().inputEnergy).toBe(1);
  await click("Pin accepted emission for comparison");
  expect(host.querySelector("[data-boundary-comparison]")).toBeNull();
  expect(required("[data-boundary-comparison-offer] [role=alert]").textContent).toContain(
    "external energy input to zero",
  );
  await change('input[name="inputEnergy"]', "0");
  await submit("Energy ledger parameters");
  await click("Pin accepted emission for comparison");
  expect(value("energyChange", "baseline")).toBe("−2");
  await change('input[name="emittedEnergy"]', "4");
  await submit("Energy ledger parameters");
  expect(owner.acceptedParameters().emittedEnergy).toBe(4);
  expect(value("energyChange", "baseline")).toBe("−2");
  await click("Close controlled comparison");
  await click("Pin accepted emission for comparison");
  expect(value("energyChange", "baseline")).toBe("−4");
});

test("chapter hosts can retain one actionable owner without an independent comparison", async () => {
  await mount(false, false);
  expect(host.querySelector("[data-boundary-comparison-offer]")).toBeNull();
  expect(host.querySelector("[data-boundary-comparison]")).toBeNull();
  await change('input[name="emittedEnergy"]', "3");
  await submit("Energy ledger parameters");
  expect(owner.acceptedParameters()).toEqual({ ...ME03_DEFAULTS, emittedEnergy: 3 });
});
