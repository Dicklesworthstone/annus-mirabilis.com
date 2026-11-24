import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { PhotoelectricLab } from "../components/lab/lq08/PhotoelectricLab.tsx";
import {
  LQ08_DEFAULTS,
  type Lq08Distribution,
  type Lq08TransferModel,
} from "../experiments/lq08/definition.ts";
import { createLq08Session, evaluateLq08 } from "../experiments/lq08/session.ts";
import { lq08TapeFor } from "../experiments/lq08/tape.ts";
import { encodeTapePermalink } from "../experiments/permalink/codec.ts";
import { encodeResult } from "../experiments/results/codec.ts";
import type { AcceptedSnapshot } from "../experiments/store/instanceStore.ts";
import example from "../generated/lq08-example.json";
import { PinnedEquationDock } from "../reader/layout/PinnedEquationCompanion.tsx";
import { PinnedEquationProvider } from "../reader/layout/PinnedEquationContext.tsx";
import { containsHeading } from "./headingText.ts";
import { installDom, uninstallDom } from "./reactDom.ts";

/**
 * Heading assertions below compare case-insensitively (am-edit-voice-lint-trmf). They asserted
 * the exact capitalisation of a section heading in order to check that the SECTION IS PRESENT,
 * and so they broke when the de-slop pass normalised these pages from Title Case to the site's
 * sentence case, although every section they protect was still rendering.
 *
 * This is a partial hardening and it is worth being exact about the limit: lowercasing both
 * sides survives a case change and would NOT survive a rewording. The durable fix is a stable
 * per-section anchor, which these pages do not have - each carries one section id for the whole
 * page and none on the individual headings. Recorded rather than left implicit, so the next
 * person who hits this knows the ceiling of what is here.
 */

function getNumericValue(snap: AcceptedSnapshot | null, quantityId: string): number {
  if (!snap) throw new Error("Missing snapshot");
  const output = snap.outputs.find((o) => o.quantityId === quantityId);
  if (output?.status !== "value" || typeof output.value !== "number") {
    throw new Error(`Expected numeric value for ${quantityId}, got ${output?.status}`);
  }
  return output.value;
}

function getNotApplicableReason(snap: AcceptedSnapshot | null, quantityId: string): string {
  if (!snap) throw new Error("Missing snapshot");
  const output = snap.outputs.find((o) => o.quantityId === quantityId);
  if (output?.status !== "not-applicable") {
    throw new Error(`Expected not-applicable for ${quantityId}, got ${output?.status}`);
  }
  return output.reason;
}

describe("LQ-08 Photoelectric Apparatus Lab View & Route", () => {
  test("static page renders cleanly without javascript and includes key sections", async () => {
    const { default: PhotoelectricPage } = await import("../app/lab/lq-08/page.tsx");
    const html = renderToStaticMarkup(<PhotoelectricPage />);
    expect(html).toContain("Brighter light, more electrons.");
    expect(containsHeading(html, "The Single-Quantum Energy Conservation Law")).toBe(true);
    expect(html).toContain('data-view-id="lq-08-energy-diagram"');
    expect(html).toContain('data-view-id="lq-08-stopping-plot"');
    expect(html).toContain('data-view-id="lq-08-iv-curve"');
    expect(containsHeading(html, "Values at these settings")).toBe(true);
    expect(containsHeading(html, "What this model leaves out")).toBe(true);
    expect(html).toContain("Multi-photon or thermionic emission");
  });

  test("lab component renders with static worked example and displays defaults", () => {
    const html = renderToStaticMarkup(<PhotoelectricLab example={example} />);
    expect(html).toContain("600.0 THz");
    expect(html).toContain("2.20 eV");
    expect(html).toContain("1.00 mW");
    expect(html).toContain('data-quantity-id="maxKineticEnergy"');
    expect(html).toContain('data-quantity-id="stoppingPotentialMagnitude"');
  });

  test("session evaluates photoelectric physics correctly for sodium default", () => {
    const session = createLq08Session("test-session", example);
    const snap = session.getSnapshot().accepted;
    expect(snap).not.toBeNull();
    const p = session.acceptedParameters();
    expect(p.frequency).toBe(6.0e14);
    expect(p.workFunction).toBe(2.2);

    // At 600 THz on 2.2 eV sodium:
    // h*nu = 4.135667696e-15 * 6e14 = 2.4814 eV
    // K_max = 2.4814 - 2.2 = 0.2814 eV
    // V_s = 0.2814 V
    const vs = getNumericValue(snap, "stoppingPotentialMagnitude");
    expect(vs).toBeCloseTo(0.2814, 2);
  });

  test("doubling optical power changes photon and emission rates but preserves kinetic energy and stopping potential", () => {
    const session = createLq08Session("test-power-invariance", example);
    const initialSnap = session.getSnapshot().accepted;
    const initialVs = getNumericValue(initialSnap, "stoppingPotentialMagnitude");
    const initialQRate = getNumericValue(initialSnap, "quantumRate");

    session.apply({ incidentPower: 0.002 }); // Double to 2 mW
    const updatedSnap = session.getSnapshot().accepted;
    const updatedVs = getNumericValue(updatedSnap, "stoppingPotentialMagnitude");
    const updatedQRate = getNumericValue(updatedSnap, "quantumRate");

    // Rates double
    expect(updatedQRate).toBeCloseTo(initialQRate * 2, 5);
    // Stopping potential is completely invariant
    expect(updatedVs).toBeCloseTo(initialVs, 8);
  });

  test("sub-threshold frequency (h*nu < Phi) returns not-applicable for kinetic energy", () => {
    const session = createLq08Session("test-threshold", example);
    // 450 THz on 2.2 eV sodium: h*nu = 1.86 eV < 2.2 eV
    session.apply({ frequency: 4.5e14 });
    const snap = session.getSnapshot().accepted;
    const kMaxReason = getNotApplicableReason(snap, "maxKineticEnergy");
    expect(kMaxReason).toContain("no emitted electron in this model");

    const vsReason = getNotApplicableReason(snap, "stoppingPotentialMagnitude");
    expect(vsReason).toContain("no emitted electron in this model");
  });

  test("historical check preset produces about 4.3 V stopping potential", () => {
    const session = createLq08Session("test-historical-check", example);
    // UV spark ~ 1.03 PHz with Phi = 0
    session.apply({ frequency: 1.03e15, workFunction: 0.0 });
    const snap = session.getSnapshot().accepted;
    const vs = getNumericValue(snap, "stoppingPotentialMagnitude");
    expect(vs).toBeCloseTo(4.26, 1); // ~4.3 Volts
  });

  test("notModeled items are non-empty and properly disclosed", () => {
    const html = renderToStaticMarkup(<PhotoelectricLab example={example} />);
    expect(containsHeading(html, "What this model leaves out")).toBe(true);
    expect(html).toContain("Multi-photon or thermionic emission");
    expect(html).toContain("Contact potentials and surface states");
    expect(html).toContain("Space charge");
    expect(containsHeading(html, "Einstein’s 1905 §8 check, by order of magnitude")).toBe(true);
    expect(html).toContain("What was neglected:");
    expect(html).toContain("What it is not:");
  });
});

describe("the photoelectric equations follow the accepted apparatus", () => {
  const maximum = "eq-model-lq-photoelectric-maximum";
  const stopping = "eq-model-lq-stopping-energy";
  const threshold = "eq-model-lq-threshold-frequency";
  const maximumBound = "eq-model-lq-photoelectric-maximum-bound";
  const stoppingBound = "eq-model-lq-stopping-bound";
  let container: HTMLElement;
  let root: Root | null = null;
  let session: ReturnType<typeof createLq08Session>;

  beforeEach(async () => {
    await installDom();
    container = document.createElement("div");
    document.body.append(container);
    session = createLq08Session("lq08-live-equations", example);
  });
  afterEach(async () => {
    await act(async () => root?.unmount());
    root = null;
    await uninstallDom();
  });

  function required<T extends Element = HTMLElement>(parent: ParentNode, selector: string): T {
    const element = parent.querySelector<T>(selector);
    assert(element, `The actual photoelectric surface must render ${selector}.`);
    return element;
  }

  function card(parent: ParentNode = container): HTMLDetailsElement {
    return required(parent, "[data-lq08-live-equations]");
  }

  function term(parent: ParentNode, id: string): HTMLElement {
    return required(parent, `[data-term-value="${id}"]`);
  }

  function text(parent: ParentNode, id: string): string {
    return term(parent, id).textContent?.replace(/\s+/g, " ").trim() ?? "";
  }

  function expectValue(parent: ParentNode, id: string, value: string) {
    expect(term(parent, id).getAttribute("data-value-kind")).toBe("value");
    expect(text(parent, id)).toBe(value);
  }

  function expectStoppingSentence(parent: ParentNode) {
    const equation = term(parent, `${stopping}.t.stopping`).closest("[data-equation-id]");
    assert(equation);
    const sentence = required(equation, ".equation-sentence");
    expect(sentence.textContent).toBe(
      "The charge times the stopping potential is the largest kinetic energy, which the budget puts at h times the frequency, less the escape work.",
    );
    expect(
      [...sentence.querySelectorAll("span")].filter((part) => part.textContent === " times "),
    ).toHaveLength(2);
  }

  function expectIdentity(parent: ParentNode, owner = session) {
    const accepted = owner.getSnapshot().accepted;
    assert(accepted);
    const groups = parent.querySelectorAll("[data-equation-values]");
    expect(groups.length).toBeGreaterThan(0);
    for (const group of groups) {
      expect(group.getAttribute("data-experiment-id")).toBe("lq-08");
      expect(group.getAttribute("data-instance-id")).toBe(accepted.instanceId);
      expect(group.getAttribute("data-run-id")).toBe(accepted.runId);
      expect(group.getAttribute("data-snapshot-version")).toBe(String(accepted.snapshotVersion));
      expect(group.getAttribute("data-accepted-input-revision")).toBe(
        String(accepted.revisions.input),
      );
    }
  }

  async function mount(inheritPins = false, other?: ReturnType<typeof createLq08Session>) {
    root = createRoot(container);
    const primary = (
      <PhotoelectricLab
        session={session}
        predict={false}
        linked={false}
        readings={false}
        showComparison={false}
      />
    );
    await act(async () => {
      root?.render(
        inheritPins ? (
          <PinnedEquationProvider>
            {primary}
            {other ? (
              <section data-independent-photoelectric>
                <PhotoelectricLab
                  session={other}
                  predict={false}
                  linked={false}
                  readings={false}
                  showComparison={false}
                />
              </section>
            ) : null}
            <PinnedEquationDock />
          </PinnedEquationProvider>
        ) : (
          primary
        ),
      );
    });
    await act(async () => required<HTMLElement>(card(), "summary").click());
    expect(card().open).toBe(true);
  }

  function field(name: string): HTMLInputElement {
    return required(container, `input[type="text"][id$="-${name}"]`);
  }

  function handlers(control: Element): Readonly<Record<string, (event: unknown) => void>> {
    const key = Object.keys(control).find((name) => name.startsWith("__reactProps$"));
    assert(key, "The mounted input must expose its real React handlers.");
    const value = (
      control as unknown as Record<string, Readonly<Record<string, (event: unknown) => void>>>
    )[key];
    assert(value, "The mounted input must have its actual handler record.");
    return value;
  }

  async function edit(name: string, value: string) {
    const control = field(name);
    const change = handlers(control).onChange;
    assert(change);
    await act(async () => {
      control.value = value;
      change({ target: control, currentTarget: control });
    });
  }

  async function apply(name: string) {
    const control = field(name);
    const submit = handlers(control).onKeyDown;
    assert(submit);
    await act(async () => submit({ key: "Enter", preventDefault() {}, currentTarget: control }));
  }

  function currentPlot(): HTMLElement {
    return required(container, '[data-view-id="lq-08-iv-curve"]');
  }

  function currentSweep() {
    const sweep = session.getSnapshot().collectorSweep;
    assert(sweep, "The accepted owner must provide the actual current sweep.");
    return sweep;
  }

  function expectCurrentIdentity() {
    const accepted = session.getSnapshot().accepted;
    assert(accepted);
    expect(currentSweep().samples.length).toBeGreaterThan(0);
    expect(currentPlot().getAttribute("data-instance-id")).toBe(accepted.instanceId);
    expect(currentPlot().getAttribute("data-run-id")).toBe(accepted.runId);
    expect(currentPlot().getAttribute("data-snapshot-version")).toBe(
      String(accepted.snapshotVersion),
    );
    expect(currentPlot().getAttribute("data-action-index")).toBe(String(accepted.actionIndex));
    expect(currentPlot().getAttribute("data-constant-set-id")).toBe("modern-si-2019");
    expect(currentPlot().getAttribute("data-owner-id")).toBe(currentSweep().ownerId);
  }

  async function chooseDistribution(value: Lq08Distribution) {
    const control = required<HTMLSelectElement>(container, 'select[id$="-distributionModel"]');
    // Happy DOM's select proxy hides this property from Object.keys. The sibling input exposes
    // the same renderer key, which addresses the actual select's handler record.
    const key = Object.keys(field("frequency")).find((name) => name.startsWith("__reactProps$"));
    assert(key);
    const change = (
      control as unknown as Record<string, Readonly<Record<string, (event: unknown) => void>>>
    )[key]?.onChange;
    assert(change);
    await act(async () => {
      control.value = value;
      change({ target: control, currentTarget: control });
    });
  }

  async function chooseTransfer(value: Lq08TransferModel) {
    const control = required<HTMLSelectElement>(container, 'select[id$="-transferModel"]');
    const key = Object.keys(field("frequency")).find((name) => name.startsWith("__reactProps$"));
    assert(key);
    const change = (
      control as unknown as Record<string, Readonly<Record<string, (event: unknown) => void>>>
    )[key]?.onChange;
    assert(change);
    await act(async () => {
      control.value = value;
      change({ target: control, currentTarget: control });
    });
  }

  async function pin(parent: ParentNode, equation = maximum): Promise<HTMLElement> {
    const button = required<HTMLButtonElement>(parent, `[data-pin-equation="${equation}"]`);
    await act(async () => button.click());
    return required(container, `[data-pinned-equation="${equation}"]`);
  }

  test("all three equations render real SI values and their selected-term inspector shares the accepted identity", async () => {
    await mount();
    expect(card().getAttribute("data-constant-set-id")).toBe("modern-si-2019");
    expect(card().querySelectorAll("[data-equation-id]")).toHaveLength(3);
    const values = card().querySelectorAll("[data-term-value]");
    expect(values).toHaveLength(13);
    for (const value of values) expect(value.getAttribute("data-value-kind")).toBe("value");
    expectValue(card(), `${maximum}.t.maxKineticEnergy`, "4.5085 × 10−20 J");
    expectValue(card(), `${maximum}.t.escapeWork`, "3.5248 × 10−19 J");
    expectValue(card(), `${maximum}.t.planck`, "6.6261 × 10−34 J s");
    expectValue(card(), `${stopping}.t.charge`, "1.6022 × 10−19 C");
    expectValue(card(), `${stopping}.t.stopping`, "0.2814 V");
    expectIdentity(card());
    expectStoppingSentence(card());
    expect(field("workFunction").value).toBe("2.2");

    const before = session.getSnapshot();
    await act(async () =>
      required<HTMLButtonElement>(card(), `button[data-node-id="${maximum}.t.escapeWork"]`).click(),
    );
    const inspector = required(card(), `[data-inspector-value="${maximum}.t.escapeWork"]`);
    expect(inspector.getAttribute("data-value-kind")).toBe("value");
    expect(inspector.textContent).toContain("3.5248");
    expect(inspector.getAttribute("data-instance-id")).toBe(before.accepted?.instanceId ?? "");
    expect(inspector.getAttribute("data-snapshot-version")).toBe(
      String(before.accepted?.snapshotVersion),
    );
    expect(session.getSnapshot()).toBe(before);
    expectStoppingSentence(card());
  });

  test("frequency and escape-work drafts change the equations only when the actual typed control applies them", async () => {
    await mount();
    const before = session.getSnapshot();
    await edit("frequency", "800");
    expect(session.getSnapshot()).toBe(before);
    expectValue(card(), `${stopping}.t.stopping`, "0.2814 V");
    expectIdentity(card());
    await apply("frequency");
    expect(session.acceptedParameters().frequency).toBe(8e14);
    expectValue(card(), `${stopping}.t.stopping`, "1.1085 V");
    expectIdentity(card());
    const frequencyAccepted = session.getSnapshot();
    await edit("workFunction", "3");
    expect(session.getSnapshot()).toBe(frequencyAccepted);
    expectValue(card(), `${stopping}.t.stopping`, "1.1085 V");
    await apply("workFunction");
    expect(session.acceptedParameters().workFunction).toBe(3);
    expectValue(card(), `${stopping}.t.stopping`, "0.30853 V");
    expectValue(card(), `${maximum}.t.escapeWork`, "4.8065 × 10−19 J");
    expectIdentity(card());
    expectStoppingSentence(card());
  });

  test("unfinished and refused drafts retain the accepted values in the source and standalone pinned dock", async () => {
    await mount();
    const companion = await pin(card());
    expect(companion.closest("[data-bottom-sheet]")).not.toBeNull();
    const before = session.getSnapshot();
    for (const invalid of ["", "-10"]) {
      await edit("frequency", invalid);
      await apply("frequency");
      expect(session.getSnapshot()).toBe(before);
      expect(field("frequency").value).toBe(invalid);
      expect(container.querySelector('[role="alert"]')).not.toBeNull();
      for (const surface of [card(), required(container, "[data-pinned-equation]")]) {
        expectValue(surface, `${maximum}.t.maxKineticEnergy`, "4.5085 × 10−20 J");
        expectIdentity(surface);
        expect(surface.textContent).not.toMatch(/\b(?:NaN|Infinity)\b/u);
      }
    }
    await edit("frequency", "800");
    await apply("frequency");
    expectValue(
      required(container, "[data-pinned-equation]"),
      `${maximum}.t.maxKineticEnergy`,
      "1.7761 × 10−19 J",
    );
    expectIdentity(required(container, "[data-pinned-equation]"));
  });

  test("raising lamp power updates the accepted trial and current without changing any energy-equation term", async () => {
    await mount();
    const before = session.getSnapshot().accepted;
    assert(before);
    const initialTerms = [...card().querySelectorAll("[data-term-value]")].map(
      (value) => value.textContent,
    );
    const initialRate = getNumericValue(before, "quantumRate");
    const initialCurrent = getNumericValue(before, "photocurrent");
    await edit("incidentPower", "2");
    await apply("incidentPower");
    expect(session.acceptedParameters().incidentPower).toBe(0.002);
    const after = session.getSnapshot().accepted;
    assert(after);
    expect(after.runId).not.toBe(before.runId);
    expect(getNumericValue(after, "quantumRate")).toBe(initialRate * 2);
    expect(getNumericValue(after, "photocurrent")).toBe(initialCurrent * 2);
    expect(
      [...card().querySelectorAll("[data-term-value]")].map((value) => value.textContent),
    ).toEqual(initialTerms);
    expectIdentity(card());
  });

  test("the below-threshold preset keeps undefined electron energies unavailable in both source and pinned equations", async () => {
    await mount();
    await pin(card(), stopping);
    const preset = [...container.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "Red light, 450 THz, below the threshold",
    );
    assert(preset);
    await act(async () => preset.click());
    expect(session.acceptedParameters().frequency).toBe(4.5e14);
    expect(
      required(card(), "[data-lq08-equation-domain]").getAttribute("data-lq08-equation-domain"),
    ).toBe("below-threshold");
    expect(card().textContent).toContain("rather than zero or negative");
    for (const surface of [card(), required(container, "[data-pinned-equation]")]) {
      for (const id of [`${stopping}.t.maxKineticEnergy`, `${stopping}.t.stopping`]) {
        expect(term(surface, id).getAttribute("data-value-kind")).toBe("status");
        expect(text(surface, id)).toContain("no emitted electron in this model");
      }
      expectIdentity(surface);
    }
    expect(term(card(), `${threshold}.t.threshold`).getAttribute("data-value-kind")).toBe("value");
    expectValue(card(), `${maximum}.t.escapeWork`, "3.5248 × 10−19 J");
  });

  test("the exact threshold has genuine zero energy, without promising a measurable current", async () => {
    await mount();
    const accepted = session.getSnapshot().accepted;
    assert(accepted);
    // Use the owner's threshold, not a rounded caption or a second implementation of Phi/h.
    const frequency = getNumericValue(accepted, "thresholdFrequency");
    await edit("frequency", String(frequency / 1e12));
    await apply("frequency");
    expect(session.acceptedParameters().frequency).toBe(frequency);
    expectValue(card(), `${maximum}.t.maxKineticEnergy`, "0 J");
    expectValue(card(), `${stopping}.t.stopping`, "0 V");
    expect(
      required(card(), "[data-lq08-equation-domain]").getAttribute("data-lq08-equation-domain"),
    ).toBe("threshold");
    expect(card().textContent).toContain("does not guarantee a measurable current");
    expectIdentity(card());
  });

  test("a signed collector measurement does not become the stopping-potential magnitude", async () => {
    await mount();
    await pin(card(), stopping);
    const before = session.getSnapshot().accepted;
    assert(before);
    await edit("collectorPotential", "-0.1");
    await apply("collectorPotential");
    const after = session.getSnapshot().accepted;
    assert(after);
    expect(session.acceptedParameters().collectorPotential).toBe(-0.1);
    expect(after.runId).toBe(before.runId);
    expect(after.revisions.input).toBe(before.revisions.input);
    expect(after.revisions.measurement).toBeGreaterThan(before.revisions.measurement);
    expect(after.outputs.find((output) => output.quantityId === "photocurrent")?.status).toBe(
      "underdetermined",
    );
    for (const surface of [card(), required(container, "[data-pinned-equation]")]) {
      expectValue(surface, `${stopping}.t.stopping`, "0.2814 V");
      expectValue(surface, `${stopping}.t.maxKineticEnergy`, "4.5085 × 10−20 J");
      expectIdentity(surface);
    }
  });

  test("an inherited reader companion stays with the independently pinned apparatus instance", async () => {
    const other = createLq08Session("another-photoelectric-apparatus", example);
    expect(other.apply({ frequency: 8e14 }).kind).toBe("accepted");
    const otherBefore = other.getSnapshot();
    await mount(true, other);
    const independent = card(required(container, "[data-independent-photoelectric]"));
    await act(async () => required<HTMLElement>(independent, "summary").click());
    const companion = await pin(independent, stopping);
    expect(container.querySelectorAll("[data-pinned-equation]")).toHaveLength(1);
    expectValue(companion, `${stopping}.t.stopping`, "1.1085 V");
    expectIdentity(companion, other);
    await edit("frequency", "450");
    await apply("frequency");
    expect(term(card(), `${stopping}.t.stopping`).getAttribute("data-value-kind")).toBe("status");
    expectValue(companion, `${stopping}.t.stopping`, "1.1085 V");
    expectIdentity(companion, other);
    await chooseTransfer("partial");
    expectValue(companion, `${stopping}.t.stopping`, "1.1085 V");
    expectIdentity(companion, other);
    expect(other.getSnapshot()).toBe(otherBefore);
  });

  test("the built example includes its full semantic equations and owned values without JavaScript", () => {
    container.innerHTML = renderToStaticMarkup(
      <PhotoelectricLab example={example} predict={false} linked={false} showComparison={false} />,
    );
    expect(card().querySelectorAll(".equation-visual .katex")).toHaveLength(3);
    const maths = card().querySelectorAll(".equation-mathml math");
    expect(maths).toHaveLength(3);
    for (const math of maths) {
      expect(math.getAttribute("xmlns")).toBe("http://www.w3.org/1998/Math/MathML");
      expect(required(math, 'annotation[encoding="application/x-tex"]').textContent).not.toBe("");
    }
    expectValue(card(), `${maximum}.t.maxKineticEnergy`, "4.5085 × 10−20 J");
    expectValue(card(), `${stopping}.t.stopping`, "0.2814 V");
    for (const group of card().querySelectorAll("[data-equation-values]")) {
      expect(group.getAttribute("data-execution-label")).toBe("static");
    }
    expect(card().textContent).toContain("modern SI constants");
    expect(card().textContent).toContain("printed 1905 notation");
    expect(container.querySelector("noscript")?.textContent).toContain("complete worked example");
    expect(currentPlot().getAttribute("data-distribution-model")).toBe("none");
    expect(currentPlot().querySelector("[data-lq08-current-band]")).not.toBeNull();
    expect(currentPlot().querySelectorAll("[data-lq08-sweep-potential]").length).toBeGreaterThan(0);
    expect(required<HTMLSelectElement>(container, 'select[id$="-distributionModel"]').value).toBe(
      "none",
    );
    expect(
      required(currentPlot(), "[data-lq08-current-response]").getAttribute("data-predict-response"),
    ).toBe("shown");
  });
  test("an unspecified electron distribution shows an allowed current region without a guessed curve or operating dot", async () => {
    await mount();
    await edit("collectorPotential", "-0.1");
    await apply("collectorPotential");
    const sweep = currentSweep();
    const accepted = session.getSnapshot().accepted;
    assert(accepted);
    expect(sweep.distributionModel).toBe("none");
    expect(sweep.operatingPoint.result.status).toBe("underdetermined");
    expect(accepted.outputs.find((output) => output.quantityId === "photocurrent")?.status).toBe(
      "underdetermined",
    );
    const band = required(currentPlot(), "[data-lq08-current-band]");
    expect(Number(band.getAttribute("data-min-potential"))).toBe(
      -getNumericValue(accepted, "stoppingPotentialMagnitude"),
    );
    expect(Number(band.getAttribute("data-max-potential"))).toBe(0);
    expect(band.getAttribute("data-min-included")).toBe("false");
    expect(band.getAttribute("data-max-included")).toBe("false");
    expect(Number(band.getAttribute("data-lower-current"))).toBe(0);
    expect(Number(band.getAttribute("data-upper-current"))).toBe(sweep.saturationCurrent);
    expect(currentPlot().querySelector("[data-lq08-operating-point]")).toBeNull();
    const allowed = required(currentPlot(), "[data-lq08-operating-range]");
    expect(Number(allowed.getAttribute("data-collector-potential"))).toBe(-0.1);
    expect(Number(allowed.getAttribute("data-lower-current"))).toBe(0);
    expect(Number(allowed.getAttribute("data-upper-current"))).toBe(sweep.saturationCurrent);
    expect(currentPlot().querySelector('path[d*="Q"]')).toBeNull();
    const paths = [...currentPlot().querySelectorAll("[data-lq08-current-segment]")];
    expect(paths.length).toBeGreaterThan(0);
    for (const path of paths) {
      const end = Number(path.getAttribute("data-end-potential"));
      const start = Number(path.getAttribute("data-start-potential"));
      expect(end <= Number(band.getAttribute("data-min-potential")) || start >= 0).toBe(true);
    }
    const row = required(currentPlot(), '[data-lq08-sweep-potential="-0.1"]');
    expect(
      required(row, "[data-lq08-current-status]").getAttribute("data-lq08-current-status"),
    ).toBe("underdetermined");
    expect(row.textContent).toContain("Between");
    expect(currentPlot().textContent).toContain(
      "do not establish a universal current–voltage curve",
    );
    expectCurrentIdentity();
  });

  test("the model selector distinguishes all-at-maximum and uniform currents while keeping the accepted energy budget", async () => {
    await mount();
    const before = session.getSnapshot().accepted;
    assert(before);
    const halfRetarding = -getNumericValue(before, "stoppingPotentialMagnitude") / 2;
    await edit("collectorPotential", String(halfRetarding));
    await apply("collectorPotential");
    const energyTerms = [...card().querySelectorAll("[data-term-value]")].map(
      (node) => node.textContent,
    );
    const unknown = session.getSnapshot().accepted;
    assert(unknown);
    await chooseDistribution("all-at-kmax");
    const all = session.getSnapshot().accepted;
    assert(all);
    expect(all.runId).not.toBe(unknown.runId);
    expect(all.revisions.input).toBeGreaterThan(unknown.revisions.input);
    expect(getNumericValue(all, "photocurrent")).toBe(currentSweep().saturationCurrent);
    expect(
      Number(
        required(currentPlot(), "[data-lq08-operating-point]").getAttribute("data-current-amperes"),
      ),
    ).toBe(getNumericValue(all, "photocurrent"));
    expect(currentPlot().querySelector("[data-lq08-current-band]")).toBeNull();
    expect(currentPlot().querySelector("[data-lq08-operating-range]")).toBeNull();
    await chooseDistribution("uniform");
    const uniform = session.getSnapshot().accepted;
    assert(uniform);
    expect(uniform.runId).not.toBe(all.runId);
    expect(getNumericValue(uniform, "photocurrent")).toBeCloseTo(
      currentSweep().saturationCurrent / 2,
      12,
    );
    expect(
      Number(
        required(currentPlot(), "[data-lq08-operating-point]").getAttribute("data-current-amperes"),
      ),
    ).toBe(getNumericValue(uniform, "photocurrent"));
    expect(
      [...card().querySelectorAll("[data-term-value]")].map((node) => node.textContent),
    ).toEqual(energyTerms);
    expect(currentPlot().textContent).toContain("uniformly spread");
    expectIdentity(card());
    expectCurrentIdentity();
  });

  test("the all-at-maximum sweep preserves the stopping discontinuity and the exact cutoff current", async () => {
    await mount();
    await chooseDistribution("all-at-kmax");
    const accepted = session.getSnapshot().accepted;
    assert(accepted);
    const cutoff = -getNumericValue(accepted, "stoppingPotentialMagnitude");
    await edit("collectorPotential", String(cutoff));
    await apply("collectorPotential");
    expect(getNumericValue(session.getSnapshot().accepted, "photocurrent")).toBe(0);
    expect(
      Number(
        required(currentPlot(), "[data-lq08-operating-point]").getAttribute("data-current-amperes"),
      ),
    ).toBe(0);
    const endpoints = [...currentPlot().querySelectorAll("[data-lq08-segment-endpoint]")].filter(
      (point) => Number(point.getAttribute("data-collector-potential")) === cutoff,
    );
    expect(
      endpoints.some(
        (point) =>
          point.getAttribute("data-endpoint-included") === "true" &&
          Number(point.getAttribute("data-current-amperes")) === 0,
      ),
    ).toBe(true);
    expect(
      endpoints.some(
        (point) =>
          point.getAttribute("data-endpoint-included") === "false" &&
          Number(point.getAttribute("data-current-amperes")) === currentSweep().saturationCurrent,
      ),
    ).toBe(true);
    for (const segment of currentPlot().querySelectorAll("[data-lq08-current-segment]")) {
      const start = Number(segment.getAttribute("data-start-potential"));
      const end = Number(segment.getAttribute("data-end-potential"));
      expect(start < cutoff && end > cutoff).toBe(false);
    }
    await edit("collectorPotential", String(cutoff * 0.999));
    await apply("collectorPotential");
    expect(getNumericValue(session.getSnapshot().accepted, "photocurrent")).toBe(
      currentSweep().saturationCurrent,
    );
    expectCurrentIdentity();
  });

  test("changing the distribution preserves unfinished and refused numeric drafts and their feedback", async () => {
    await mount();
    await edit("frequency", "800");
    await chooseDistribution("uniform");
    expect(field("frequency").value).toBe("800");
    expect(session.acceptedParameters().frequency).toBe(6e14);
    expect(session.acceptedParameters().distributionModel).toBe("uniform");
    await edit("frequency", "");
    await apply("frequency");
    const unfinishedMessage = required(container, '[role="alert"]').textContent;
    await chooseDistribution("all-at-kmax");
    expect(field("frequency").value).toBe("");
    expect(required(container, '[role="alert"]').textContent).toBe(unfinishedMessage);
    expect(session.acceptedParameters().frequency).toBe(6e14);
    expect(session.acceptedParameters().distributionModel).toBe("all-at-kmax");
    await edit("frequency", "-10");
    await apply("frequency");
    const refusedMessage = required(container, '[role="alert"]').textContent;
    await chooseDistribution("none");
    expect(field("frequency").value).toBe("-10");
    expect(required(container, '[role="alert"]').textContent).toBe(refusedMessage);
    expect(session.acceptedParameters().frequency).toBe(6e14);
    expectCurrentIdentity();
    expectValue(card(), `${stopping}.t.stopping`, "0.2814 V");
    await edit("frequency", "800");
    await apply("frequency");
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(session.acceptedParameters().frequency).toBe(8e14);
    expect(session.acceptedParameters().distributionModel).toBe("none");
    expectCurrentIdentity();
  });

  test("the accepted sweep includes a typed collector beyond the slider and distinguishes exact zero current from unavailable electron energies", async () => {
    await mount();
    await chooseDistribution("uniform");
    await edit("collectorPotential", "10");
    await apply("collectorPotential");
    expect(session.acceptedParameters().collectorPotential).toBe(10);
    expect(Number(currentPlot().getAttribute("data-domain-max"))).toBeGreaterThanOrEqual(10);
    expect(
      Number(
        required(currentPlot(), "[data-lq08-operating-point]").getAttribute(
          "data-collector-potential",
        ),
      ),
    ).toBe(10);
    expect(required(currentPlot(), '[data-lq08-sweep-potential="10"]').textContent).not.toContain(
      "not determined",
    );
    await edit("incidentPower", "0");
    await apply("incidentPower");
    expect(getNumericValue(session.getSnapshot().accepted, "photocurrent")).toBe(0);
    expect(currentPlot().querySelector("[data-lq08-current-band]")).toBeNull();
    expect(
      Number(
        required(currentPlot(), "[data-lq08-operating-point]").getAttribute("data-current-amperes"),
      ),
    ).toBe(0);
    expect(
      currentSweep().samples.every(
        (sample) => sample.result.status === "value" && sample.result.value === 0,
      ),
    ).toBe(true);
    expect(term(card(), `${maximum}.t.maxKineticEnergy`).getAttribute("data-value-kind")).toBe(
      "value",
    );
    const belowThreshold = [...container.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "Red light, 450 THz, below the threshold",
    );
    assert(belowThreshold);
    await act(async () => belowThreshold.click());
    expect(session.acceptedParameters().distributionModel).toBe("none");
    expect(getNumericValue(session.getSnapshot().accepted, "photocurrent")).toBe(0);
    expect(term(card(), `${maximum}.t.maxKineticEnergy`).getAttribute("data-value-kind")).toBe(
      "status",
    );
    expect(currentPlot().querySelector("[data-lq08-current-band]")).toBeNull();
    expect(
      currentSweep().samples.every(
        (sample) => sample.result.status === "value" && sample.result.value === 0,
      ),
    ).toBe(true);
    expectCurrentIdentity();
  });

  test("opening a real shared apparatus link restores its distribution and accepted current sweep", async () => {
    const saved = createLq08Session("saved-uniform-current");
    expect(saved.apply({ distributionModel: "uniform", collectorPotential: -0.1 }).kind).toBe(
      "accepted",
    );
    const tape = lq08TapeFor(saved.acceptedParameters());
    assert(tape);
    window.history.replaceState(null, "", `/lab/lq-08/?tape=${encodeTapePermalink(tape)}`);
    root = createRoot(container);
    try {
      await act(async () => {
        root?.render(
          <PhotoelectricLab
            session={session}
            predict={false}
            readings={false}
            showComparison={false}
          />,
        );
      });
      for (
        let attempt = 0;
        attempt < 50 && session.acceptedParameters().distributionModel !== "uniform";
        attempt++
      ) {
        await act(async () => {
          await new Promise<void>((resolve) => setTimeout(resolve, 10));
        });
      }
      expect(container.querySelector("[data-tape-notice]")).toBeNull();
      expect(session.acceptedParameters()).toEqual(saved.acceptedParameters());
      expect(required<HTMLSelectElement>(container, 'select[id$="-distributionModel"]').value).toBe(
        "uniform",
      );
      expect(currentPlot().getAttribute("data-distribution-model")).toBe("uniform");
      expect(
        Number(
          required(currentPlot(), "[data-lq08-operating-point]").getAttribute(
            "data-current-amperes",
          ),
        ),
      ).toBe(getNumericValue(saved.getSnapshot().accepted, "photocurrent"));
      expect(currentPlot().querySelector("[data-lq08-operating-range]")).toBeNull();
      expectCurrentIdentity();
    } finally {
      window.history.replaceState(null, "", "/");
    }
  });
  test("unknown energy transfer binds the two inequalities to unknown left sides and accepted SI budgets", async () => {
    await mount();
    const before = session.getSnapshot().accepted;
    assert(before);
    const energyCeiling = getNumericValue(before, "maxKineticEnergy");
    const voltageCeiling = getNumericValue(before, "stoppingPotentialMagnitude");
    await chooseTransfer("partial");
    const after = session.getSnapshot().accepted;
    const budget = session.getSnapshot().energyBudget;
    assert(after && budget);
    expect(after.runId).not.toBe(before.runId);
    expect(card().getAttribute("data-transfer-model")).toBe("partial");
    expect(card().querySelectorAll("[data-equation-id]")).toHaveLength(3);
    expect(
      card().querySelector('[data-pin-equation="eq-model-lq-photoelectric-maximum"]'),
    ).toBeNull();
    expect(card().querySelector('[data-pin-equation="eq-model-lq-stopping-energy"]')).toBeNull();
    for (const id of [`${maximumBound}.t.maxKineticEnergy`, `${stoppingBound}.t.stopping`]) {
      expect(term(card(), id).getAttribute("data-value-kind")).toBe("status");
    }
    expectValue(card(), `${maximumBound}.t.planck`, "6.6261 × 10−34 J s");
    expectValue(card(), `${maximumBound}.t.escapeWork`, "3.5248 × 10−19 J");
    expectValue(card(), `${stoppingBound}.t.charge`, "1.6022 × 10−19 C");
    assert(budget.maxKineticEnergy.status === "underdetermined");
    assert(budget.stoppingPotentialMagnitude.status === "underdetermined");
    expect(budget.maxKineticEnergy.upperBound).toBe(energyCeiling);
    expect(budget.stoppingPotentialMagnitude.upperBound).toBe(voltageCeiling);
    expect(
      required(container, '[data-output="maxKineticEnergy"]').getAttribute("data-result-status"),
    ).toBe("underdetermined");
    expect(required(container, '[data-output="maxKineticEnergy"]').textContent).toContain(
      "At most",
    );
    expect(required(container, '[data-output="stoppingPotentialMagnitude"]').textContent).toContain(
      "actual value is not determined",
    );
    const ladder = required(container, '[data-view-id="lq-08-energy-diagram"]');
    expect(ladder.querySelector("[data-lq08-energy-bound]")).not.toBeNull();
    expect(ladder.querySelector("circle")).toBeNull();
    const stoppingPlot = required(container, '[data-view-id="lq-08-stopping-plot"]');
    expect(stoppingPlot.querySelector("[data-lq08-stopping-point]")).toBeNull();
    expect(stoppingPlot.querySelector("[data-lq08-stopping-ceiling]")).not.toBeNull();
    expect(
      Number(
        required(stoppingPlot, "[data-lq08-stopping-range]").getAttribute("data-upper-voltage"),
      ),
    ).toBe(voltageCeiling);
    expect(card().textContent).toContain("necessary");
    expect(card().textContent).toContain("does not guarantee emission");
    expect(required(container, '[data-quantity-id="thresholdFrequency"]').textContent).toContain(
      "Necessary energy-budget frequency limit",
    );
    expect(card().textContent).toContain("prescribed quantum efficiency");
    expectIdentity(card());
    expectCurrentIdentity();
  });

  test("a declared distribution cannot replace the missing transfer share in a retarding measurement", async () => {
    await mount();
    await chooseDistribution("uniform");
    await edit("collectorPotential", "-0.1");
    await apply("collectorPotential");
    expect(currentSweep().operatingPoint.result.status).toBe("value");
    await chooseTransfer("partial");
    expect(session.acceptedParameters().distributionModel).toBe("uniform");
    expect(currentSweep().operatingPoint.result.status).toBe("underdetermined");
    expect(currentPlot().querySelector("[data-lq08-operating-point]")).toBeNull();
    expect(currentPlot().querySelector("[data-lq08-operating-range]")).not.toBeNull();
    expect(currentPlot().textContent).toContain("separately prescribed ideal emission yield");
    await chooseDistribution("all-at-kmax");
    expect(currentSweep().operatingPoint.result.status).toBe("underdetermined");
    expect(currentPlot().querySelector("[data-lq08-current-band]")).not.toBeNull();
    await chooseTransfer("complete");
    expect(session.acceptedParameters().collectorPotential).toBe(-0.1);
    expect(getNumericValue(session.getSnapshot().accepted, "photocurrent")).toBe(
      currentSweep().saturationCurrent,
    );
    expect(currentPlot().querySelector("[data-lq08-operating-range]")).toBeNull();
    expect(
      card().querySelector('[data-pin-equation="eq-model-lq-photoelectric-maximum"]'),
    ).not.toBeNull();
    expectCurrentIdentity();
  });

  test("changing transfer assumptions unpins only obsolete relations and retains the explicitly qualified threshold", async () => {
    await mount();
    await pin(card(), maximum);
    await chooseTransfer("partial");
    expect(container.querySelector("[data-pinned-equation]")).toBeNull();
    expect(required(container, "[data-lq08-pin-change]").textContent).toContain(
      "different energy-transfer assumption",
    );
    await pin(card(), maximumBound);
    await chooseTransfer("complete");
    expect(container.querySelector("[data-pinned-equation]")).toBeNull();
    const thresholdPin = await pin(card(), threshold);
    await chooseTransfer("partial");
    expect(required(container, "[data-pinned-equation]")).toBe(thresholdPin);
    expect(thresholdPin.textContent).toContain("complete-transfer threshold");
    expectIdentity(thresholdPin);
    await chooseTransfer("complete");
    expect(required(container, "[data-pinned-equation]")).toBe(thresholdPin);
    expectIdentity(thresholdPin);
  });

  test("an unknown transferred share keeps even the exact zero ceiling distinct from attained zero and from no emission", async () => {
    await mount();
    const thresholdFrequency = getNumericValue(
      session.getSnapshot().accepted,
      "thresholdFrequency",
    );
    await chooseTransfer("partial");
    await edit("frequency", String(thresholdFrequency / 1e12));
    await apply("frequency");
    const zero = session.getSnapshot().energyBudget;
    assert(zero);
    for (const result of [zero.maxKineticEnergy, zero.stoppingPotentialMagnitude]) {
      expect(result.status).toBe("underdetermined");
      assert(result.status === "underdetermined");
      expect(result.bounds).toEqual([0, 0]);
    }
    expect(term(card(), `${maximumBound}.t.maxKineticEnergy`).getAttribute("data-value-kind")).toBe(
      "status",
    );
    expect(
      Number(required(container, "[data-lq08-energy-bound]").getAttribute("data-upper-energy-ev")),
    ).toBe(0);
    expect(
      Number(required(container, "[data-lq08-stopping-range]").getAttribute("data-upper-voltage")),
    ).toBe(0);
    expect(container.querySelector("[data-lq08-stopping-point]")).toBeNull();
    expect(required(container, '[data-output="maxKineticEnergy"]').textContent).toContain(
      "actual value is not determined",
    );
    await edit("frequency", "450");
    await apply("frequency");
    expect(session.getSnapshot().energyBudget?.maxKineticEnergy.status).toBe("not-applicable");
    expect(container.querySelector("[data-lq08-energy-bound]")).toBeNull();
    expect(container.querySelector("[data-lq08-stopping-range]")).toBeNull();
    expect(required(container, '[data-output="maxKineticEnergy"]').textContent).toContain(
      "no emitted electron",
    );
    await edit("frequency", String(thresholdFrequency / 1e12));
    await apply("frequency");
    await chooseTransfer("complete");
    expectValue(card(), `${maximum}.t.maxKineticEnergy`, "0 J");
    expectValue(card(), `${stopping}.t.stopping`, "0 V");
  });

  test("transfer selection uses accepted settings while retaining a numeric draft and its refusal feedback", async () => {
    await mount();
    const ceiling = getNumericValue(session.getSnapshot().accepted, "maxKineticEnergy");
    await edit("frequency", "800");
    await chooseTransfer("partial");
    expect(field("frequency").value).toBe("800");
    expect(session.acceptedParameters().frequency).toBe(6e14);
    const budget = session.getSnapshot().energyBudget;
    assert(budget?.maxKineticEnergy.status === "underdetermined");
    expect(budget.maxKineticEnergy.upperBound).toBe(ceiling);
    await edit("frequency", "-10");
    await apply("frequency");
    const refusal = required(container, '[role="alert"]').textContent;
    const accepted = session.getSnapshot().accepted;
    await chooseTransfer("complete");
    expect(field("frequency").value).toBe("-10");
    expect(required(container, '[role="alert"]').textContent).toBe(refusal);
    expect(session.getSnapshot().accepted?.parameters.frequency).toBe(
      accepted?.parameters.frequency,
    );
    expectValue(card(), `${stopping}.t.stopping`, "0.2814 V");
  });

  test("a shared partial-transfer apparatus restores unknown energy and current without inventing equalities", async () => {
    const saved = createLq08Session("saved-partial-current");
    expect(
      saved.apply({
        transferModel: "partial",
        distributionModel: "uniform",
        collectorPotential: -0.1,
      }).kind,
    ).toBe("accepted");
    const tape = lq08TapeFor(saved.acceptedParameters());
    assert(tape);
    window.history.replaceState(null, "", `/lab/lq-08/?tape=${encodeTapePermalink(tape)}`);
    root = createRoot(container);
    try {
      await act(async () => {
        root?.render(
          <PhotoelectricLab
            session={session}
            predict={false}
            readings={false}
            showComparison={false}
          />,
        );
      });
      for (
        let attempt = 0;
        attempt < 50 && session.acceptedParameters().transferModel !== "partial";
        attempt++
      ) {
        await act(async () => {
          await new Promise<void>((resolve) => setTimeout(resolve, 10));
        });
      }
      expect(container.querySelector("[data-tape-notice]")).toBeNull();
      expect(session.acceptedParameters()).toEqual(saved.acceptedParameters());
      expect(required<HTMLSelectElement>(container, 'select[id$="-transferModel"]').value).toBe(
        "partial",
      );
      expect(card().getAttribute("data-transfer-model")).toBe("partial");
      expect(currentSweep().operatingPoint.result.status).toBe("underdetermined");
      expect(currentPlot().querySelector("[data-lq08-operating-point]")).toBeNull();
      expect(currentPlot().querySelector("[data-lq08-operating-range]")).not.toBeNull();
      expect(term(card(), `${stoppingBound}.t.stopping`).getAttribute("data-value-kind")).toBe(
        "status",
      );
      expectIdentity(card());
    } finally {
      window.history.replaceState(null, "", "/");
    }
  });

  test("a genuine partial worked example renders its inequalities, bounds and assumptions without JavaScript", () => {
    const parameters = { ...LQ08_DEFAULTS, transferModel: "partial" as const };
    const prepared = {
      ...example,
      parameters,
      results: evaluateLq08(parameters).map(encodeResult),
    };
    container.innerHTML = renderToStaticMarkup(
      <PhotoelectricLab example={prepared} predict={false} linked={false} showComparison={false} />,
    );
    expect(card().querySelectorAll(".equation-visual .katex")).toHaveLength(3);
    const maths = [...card().querySelectorAll("annotation")].map((node) => node.textContent);
    expect(maths.some((text) => text?.includes("\\le"))).toBe(true);
    expect(term(card(), `${maximumBound}.t.maxKineticEnergy`).getAttribute("data-value-kind")).toBe(
      "status",
    );
    expect(required(container, "[data-lq08-energy-bound]")).not.toBeNull();
    expect(required(container, "[data-lq08-stopping-ceiling]")).not.toBeNull();
    expect(card().textContent).toContain("necessary");
    expect(card().textContent).toContain("prescribed quantum efficiency");
    for (const group of card().querySelectorAll("[data-equation-values]")) {
      expect(group.getAttribute("data-execution-label")).toBe("static");
    }
  });
});
