import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { PhotoelectricLab } from "../components/lab/lq08/PhotoelectricLab.tsx";
import { createLq08Session } from "../experiments/lq08/session.ts";
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
  });
});
