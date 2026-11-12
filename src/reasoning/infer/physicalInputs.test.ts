import { afterAll, beforeAll, expect, test } from "bun:test";
import { array, result, scalar } from "../../components/lab/presentation.ts";
import generated from "../../generated/inference-workbench.json" with { type: "json" };
import { conditionalMolecularNumberInterval } from "../../physics/reference/inference/identifiability.ts";
import { INFERENCE_CONSTANTS } from "../../physics/reference/inference/synthetic.ts";
import { estimateIncrements } from "../../physics/reference/inference.ts";
import { installDom, uninstallDom } from "../../testing/reactDom.ts";
import { mountInferenceCase } from "./browser.ts";
import { parseInferenceEvidence } from "./evidence.ts";
import { radiusInformationFor } from "./model.ts";
import { renderInferenceCase, renderRadiusResults } from "./render.ts";
import { createRadiusSession } from "./session.ts";

const evidence = parseInferenceEvidence(generated.examples[0]?.ideal);
const declaration = (temperatureUncertain = true, viscosityUncertain = true) => ({
  ...radiusInformationFor(evidence, true),
  radiusCoverage: 0.99,
  temperatureUncertain,
  temperatureLower: evidence.T * 0.98,
  temperatureUpper: evidence.T * 1.02,
  temperatureCoverage: 0.99,
  temperatureProvenance: "Declared synthetic temperature calibration.",
  viscosityUncertain,
  viscosityLower: evidence.eta * 0.9,
  viscosityUpper: evidence.eta * 1.1,
  viscosityCoverage: 0.99,
  viscosityProvenance: "Declared synthetic solvent measurement.",
});
function accepted(session: ReturnType<typeof createRadiusSession>) {
  const value = session.getSnapshot().accepted;
  if (!value) throw new Error("No accepted inference snapshot.");
  return value;
}

test("each optional physical interval uses the existing owner and preserves the observations and nominal family", () => {
  const estimated = estimateIncrements(
    Float64Array.from(evidence.increments),
    evidence.dt,
    evidence.d,
    "independent-increment-known-zero-drift",
  );
  if (estimated.kind !== "accepted") throw new Error("The fixed observations were refused.");
  for (const [temperature, viscosity] of [
    [false, false],
    [true, false],
    [false, true],
    [true, true],
  ]) {
    const session = createRadiusSession("physical-inputs", evidence, declaration(false, false));
    const before = accepted(session);
    const originalEvidence = session.evidence;
    const p = declaration(temperature, viscosity);
    const expected = conditionalMolecularNumberInterval(
      {
        estimate: estimated.data,
        T: evidence.T,
        eta: evidence.eta,
        alpha: 0.05,
        synthetic: true,
        radiusProvenance: "independently-declared",
        radius: {
          value: p.radius,
          interval: { lower: p.radiusLower, upper: p.radiusUpper, coverage: p.radiusCoverage },
          provenance: p.provenance,
        },
        ...(temperature
          ? {
              temperature: {
                value: evidence.T,
                interval: {
                  lower: p.temperatureLower,
                  upper: p.temperatureUpper,
                  coverage: p.temperatureCoverage,
                },
                provenance: p.temperatureProvenance,
              },
            }
          : {}),
        ...(viscosity
          ? {
              viscosity: {
                value: evidence.eta,
                interval: {
                  lower: p.viscosityLower,
                  upper: p.viscosityUpper,
                  coverage: p.viscosityCoverage,
                },
                provenance: p.viscosityProvenance,
              },
            }
          : {}),
      },
      INFERENCE_CONSTANTS,
    );
    if (expected.kind !== "accepted") throw new Error("Declared owner intervals were refused.");
    expect(session.apply(p).kind).toBe("accepted");
    const after = accepted(session);
    expect(array(after, "molecularInterval").copy()).toEqual(
      Float64Array.of(expected.data.lower, expected.data.upper),
    );
    expect(scalar(after, "simultaneousCoverage")).toBe(expected.data.coverage);
    expect(scalar(after, "avogadroNumberEstimate")).toBe(scalar(before, "avogadroNumberEstimate"));
    expect(array(after, "familyNumbers").copy()).toEqual(array(before, "familyNumbers").copy());
    expect(session.evidence).toBe(originalEvidence);
    expect(after.runId).toBe(before.runId);
    expect(after.revisions.input).toBe(before.revisions.input);
    expect(after.revisions.estimator).toBe(before.revisions.estimator + 1);
    if (temperature || viscosity) {
      expect(array(after, "molecularInterval").at(0)).toBeLessThan(
        array(before, "molecularInterval").at(0),
      );
      expect(array(after, "molecularInterval").at(1)).toBeGreaterThan(
        array(before, "molecularInterval").at(1),
      );
    }
  }
});

test("adding uncertain inputs cannot relabel the old radius coverage", () => {
  const session = createRadiusSession("coverage-budget", evidence);
  expect(session.apply({ ...declaration(true, false), radiusCoverage: 0.975 }).kind).toBe(
    "accepted",
  );
  expect(result(accepted(session), "molecularInterval").status).toBe("not-applicable");
  expect(accepted(session).parameters.radiusCoverage).toBe(0.975);
  expect(
    session.apply({
      ...declaration(),
      radiusCoverage: 0.9875,
      temperatureCoverage: 0.9875,
      viscosityCoverage: 0.9875,
    }).kind,
  ).toBe("accepted");
  expect(scalar(accepted(session), "simultaneousCoverage")).toBeCloseTo(0.95, 14);
  expect(session.apply({ ...declaration(), viscosityCoverage: 0.98 }).kind).toBe("accepted");
  expect(result(accepted(session), "molecularInterval").status).toBe("not-applicable");
});

test("malformed declarations and intervals excluding the nominal conditions leave accepted state untouched", () => {
  const session = createRadiusSession("invalid-physical-inputs", evidence, declaration());
  const before = session.getSnapshot();
  let notices = 0;
  session.subscribe(() => notices++);
  for (const patch of [
    { temperatureUncertain: "true" },
    { temperatureLower: evidence.T + 1, temperatureUpper: evidence.T + 2 },
    { viscosityUpper: evidence.eta * 0.99 },
    { temperatureCoverage: Infinity },
    { viscosityCoverage: 1.01 },
    { viscosityLower: 0 },
    { temperatureProvenance: " " },
    { viscosityProvenance: "x".repeat(513) },
  ]) {
    expect(session.apply({ ...declaration(), ...patch }).kind).toBe("refused");
    expect(session.getSnapshot()).toBe(before);
  }
  expect(notices).toBe(0);
  expect(session.getSnapshot().pending).toBe(false);
});

test("temperature and viscosity declarations cannot replace independent radius information", () => {
  const session = createRadiusSession("missing-radius", evidence);
  expect(session.apply({ ...declaration(), radiusKnown: false, provenance: "" }).kind).toBe(
    "accepted",
  );
  expect(result(accepted(session), "molecularInterval").status).toBe("underdetermined");
});

test("the static route exposes nominal conditions and escapes every accepted provenance", () => {
  const altered = parseInferenceEvidence({ ...evidence, T: 313.15, eta: 0.002 });
  const markup = renderInferenceCase(altered, "different-conditions", generated.sourceDigest);
  expect(markup).toContain('name="temperatureLower" value="313.15"');
  expect(markup).toContain('name="viscosityLower" value="2"');
  expect(markup).toContain("98⅓%");
  const session = createRadiusSession("escaped", evidence, {
    ...declaration(),
    temperatureProvenance: '<img src=x onerror="x">',
  });
  const html = renderRadiusResults(accepted(session));
  expect(html).toContain("&lt;img");
  expect(html).not.toContain("<img");
  expect(html).toContain("conditional on the nominal temperature and viscosity");
});

beforeAll(async () => {
  await installDom();
});
afterAll(async () => {
  await uninstallDom();
});

test("the mounted workbench admits physical uncertainty, retains rejected drafts, and can restore exact-input assumptions", () => {
  const host = document.createElement("div");
  host.innerHTML = renderInferenceCase(evidence, "physical-dom", generated.sourceDigest);
  document.body.append(host);
  const root = host.querySelector<HTMLElement>("[data-infer-workbench]");
  if (!root) throw new Error("Missing workbench.");
  const dispose = mountInferenceCase(root, evidence, "physical-dom");
  const section = root.querySelector<HTMLElement>('[data-infer-case="radius"]');
  const form = root.querySelector<HTMLFormElement>("form");
  if (!section || !form) throw new Error("Missing controls.");
  const field = (name: string) => {
    const input = root.querySelector<HTMLInputElement>(`[data-radius-field="${name}"]`);
    if (!input) throw new Error(`Missing field ${name}.`);
    return input;
  };
  const select = (name: string, checked: boolean) => {
    const input = root.querySelector<HTMLInputElement>(`[data-radius-uncertain="${name}"]`);
    if (!input) throw new Error(`Missing ${name} choice.`);
    input.checked = checked;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const submit = () => form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  try {
    const initialRun = section.dataset.runId;
    const observations = root.querySelector("[data-observation-evidence]")?.innerHTML;
    for (const [name, value] of Object.entries({
      provenance: "Separate radius declaration.",
      radiusCoverage: "99",
      temperatureLower: String(evidence.T * 0.98),
      temperatureUpper: String(evidence.T * 1.02),
      temperatureProvenance: "Thermometer declaration.",
      viscosityLower: String(evidence.eta * 900),
      viscosityUpper: String(evidence.eta * 1100),
      viscosityProvenance: "Solvent declaration.",
    }))
      field(name).value = value;
    select("temperature", true);
    select("viscosity", true);
    submit();
    expect(section.dataset.applyFailure).toBeUndefined();
    expect(section.querySelector("[data-accepted-auxiliary]")?.textContent).toContain(
      "Thermometer declaration.",
    );
    expect(
      root.querySelector("[data-output=molecularInterval]")?.getAttribute("data-lower"),
    ).not.toBeNull();
    expect(section.dataset.runId).toBe(initialRun);
    expect(root.querySelector("[data-observation-evidence]")?.innerHTML).toBe(observations);
    const acceptedHtml = section.querySelector("[data-infer-results]")?.innerHTML;
    field("temperatureLower").value = String(evidence.T * 2);
    submit();
    expect(section.dataset.refusalCode).toBe("invalid-parameter");
    expect(section.querySelector("[data-infer-results]")?.innerHTML).toBe(acceptedHtml);
    select("temperature", false);
    select("viscosity", false);
    submit();
    expect(section.dataset.refusalCode).toBeUndefined();
    expect(section.querySelector("[data-accepted-auxiliary]")?.textContent).toContain("held exact");
    root.querySelector<HTMLButtonElement>("[data-radius-worked]")?.click();
    expect(field("temperatureLower").value).toBe(String(evidence.T));
    expect(field("viscosityLower").value).toBe(String(evidence.eta * 1000));
    expect(section.dataset.runId).toBe(initialRun);
  } finally {
    dispose();
    host.remove();
  }
});
