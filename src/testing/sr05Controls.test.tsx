/**
 * SR-05's typed controls drive its real owner. An unfinished or refused draft never becomes
 * a scientific input, and a preset, shared session or permalink cannot leave stale form values.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { MovingClocksLab } from "../components/lab/sr05/MovingClocksLab.tsx";
import { Sr05LiveEquation } from "../components/lab/sr05/Sr05LiveEquation.tsx";
import { decodeTapePermalink, encodeTapePermalink } from "../experiments/permalink/codec.ts";
import { settingsFromTape, tapeForSettings } from "../experiments/permalink/sessionTape.ts";
import { deriveHostExecution } from "../experiments/provenance/executionState.ts";
import { encodeResult } from "../experiments/results/codec.ts";
import { SR05_DEFAULTS, SR05_OUTPUTS, SR05_PRESETS } from "../experiments/sr05/definition.ts";
import {
  createSr05Session,
  evaluateSr05,
  type PreparedSr05Example,
} from "../experiments/sr05/session.ts";
import { SR05_TAPE } from "../experiments/sr05/tape.ts";
import example from "../generated/sr05-example.json";
import { PinnedEquationDock } from "../reader/layout/PinnedEquationCompanion.tsx";
import { PinnedEquationProvider } from "../reader/layout/PinnedEquationContext.tsx";
import { installDom, uninstallDom } from "./reactDom.ts";

let container: HTMLElement;
let root: Root | null = null;
let session: ReturnType<typeof createSr05Session>;

beforeEach(async () => {
  await installDom();
  container = document.createElement("div");
  document.body.append(container);
  session = createSr05Session("sr05-typed-controls", example as PreparedSr05Example);
});
afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  await uninstallDom();
});

async function mount(restoreFromLocation = false) {
  root = createRoot(container);
  await act(async () => {
    root?.render(
      <MovingClocksLab
        session={session}
        example={example as PreparedSr05Example}
        restoreFromLocation={restoreFromLocation}
      />,
    );
  });
}

type Handlers = {
  onChange?: (event: unknown) => void;
  onSubmit?: (event: unknown) => void;
};

/** Drive the mounted control's real handler, as labFormSweep does in happy-dom. */
function handlers(target: Element): Handlers {
  // Happy DOM's form and select proxies hide React's property from Object.keys. The input
  // exposes the same renderer key, which still addresses the real handler on either proxy.
  const key =
    Object.keys(target).find((name) => name.startsWith("__reactProps$")) ??
    Object.keys(field("speed")).find((name) => name.startsWith("__reactProps$"));
  if (!key) throw new Error("The mounted control has no React handlers.");
  const value = (target as unknown as Record<string, Handlers>)[key];
  if (!value) throw new Error("The mounted control has no handler record.");
  return value;
}

function field(name: string): HTMLInputElement | HTMLSelectElement {
  const control = container.querySelector<HTMLInputElement | HTMLSelectElement>(
    `form[aria-label="Moving clock settings"] [name="${name}"]`,
  );
  if (!control) throw new Error(`Missing clock setting: ${name}.`);
  return control;
}

async function edit(name: string, value: string) {
  const control = field(name);
  const change = handlers(control).onChange;
  if (!change) throw new Error(`The clock setting cannot change: ${name}.`);
  await act(async () => {
    control.value = value;
    change({ target: control, currentTarget: control });
  });
}

async function submit() {
  const form = container.querySelector('form[aria-label="Moving clock settings"]');
  if (!form) throw new Error("The clock settings form is missing.");
  const apply = handlers(form).onSubmit;
  if (!apply) throw new Error("The clock settings form cannot submit.");
  await act(async () => apply({ preventDefault() {} }));
}

async function click(label: string) {
  const button = [...container.querySelectorAll("button")].find(
    (candidate) => candidate.textContent?.trim() === label,
  );
  if (!button) throw new Error(`Missing button: ${label}.`);
  await act(async () => button.click());
}

function readout(name: string): string {
  const target = container.querySelector(`[data-field="${name}"]`);
  if (!target) throw new Error(`Missing clock readout: ${name}.`);
  return target.textContent ?? "";
}

async function sharedTapeAt(speed: number) {
  const deadline = Date.now() + 2000;
  for (;;) {
    const url = container.querySelector<HTMLInputElement>('[data-testid="selectable-url"]')?.value;
    const decoded = decodeTapePermalink(url);
    if (url && decoded.kind === "success" && decoded.tape.initialConditions.speed === speed)
      return { url, tape: decoded.tape };
    if (Date.now() >= deadline) throw new Error("The accepted clock settings were not shared.");
    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 5));
    });
  }
}

describe("typed moving-clock investigation", () => {
  test("draft settings leave the accepted run alone until Apply calculates the selected trip", async () => {
    await mount();
    const before = session.getSnapshot();
    await edit("speed", "0.8");
    await edit("coordinateDuration", "20");
    await edit("lightClockArm", "2");
    expect(session.getSnapshot()).toBe(before);
    expect(readout("properTime")).toBe("8 s");
    expect(readout("coordinateTime")).toBe("10 s");
    expect(readout("lightProperTick")).toBe("2 s");

    await submit();
    expect(session.acceptedParameters()).toMatchObject({
      speed: 0.8,
      coordinateDuration: 20,
      lightClockArm: 2,
      worldlinePreset: "out-and-back",
    });
    expect(session.getSnapshot().accepted?.runId).not.toBe(before.accepted?.runId);
    expect(session.getSnapshot().pending).toBe(false);
    expect(readout("properTime")).toBe("12 s");
    expect(readout("coordinateTime")).toBe("20 s");
    expect(readout("reunionExactLag")).toBe("8 s");
    expect(readout("lightProperTick")).toBe("4 s");
    expect(readout("lightCoordinateTick")).toBe("6.66667 s");
  });

  test("the worldline selector preserves typed settings and distinguishes an open trip from a reunion", async () => {
    await mount();
    await edit("speed", "-0.8");
    await edit("coordinateDuration", "20");
    await edit("worldlinePreset", "inertial");
    await submit();
    expect(session.acceptedParameters()).toMatchObject({
      speed: -0.8,
      coordinateDuration: 20,
      worldlinePreset: "inertial",
    });
    expect(readout("properTime")).toBe("12 s");
    expect(container.querySelector('[data-field="reunionExactLag"]')).toBeNull();
    expect(container.textContent).toContain("no reunion event");

    await edit("worldlinePreset", "circle");
    await submit();
    expect(session.acceptedParameters().speed).toBe(-0.8);
    expect(readout("properTime")).toBe("12 s");
    expect(readout("reunionExactLag")).toBe("8 s");
  });

  for (const [name, value] of [
    ["speed", ""],
    ["speed", "abc"],
    ["speed", "0.96"],
    ["coordinateDuration", "0"],
    ["lightClockArm", "1001"],
  ] as const) {
    test(`${name}=${JSON.stringify(value)} is refused without replacing accepted results`, async () => {
      await mount();
      const before = session.getSnapshot();
      await edit(name, value);
      await submit();
      expect(session.getSnapshot()).toBe(before);
      expect(field(name).value).toBe(value);
      expect(readout("properTime")).toBe("8 s");
      expect(readout("lightProperTick")).toBe("2 s");
      expect(container.querySelector('[data-apply-failure="refused"]')?.textContent).toContain(
        "last accepted",
      );
      expect(
        container.querySelector("[data-apply-failure]")?.getAttribute("data-refusal-code"),
      ).toBe("invalid-parameter");
      expect(container.querySelector('[data-currency-state="refused"]')).not.toBeNull();
      expect(container.textContent).not.toMatch(/\b(?:NaN|Infinity)\b/);
    });
  }

  test("discarding a refused draft restores the accepted settings without starting another run", async () => {
    await mount();
    await edit("speed", "0.8");
    await submit();
    const accepted = session.getSnapshot();
    await edit("speed", "");
    await edit("coordinateDuration", "123");
    await submit();
    await click("Use accepted settings");
    expect(session.getSnapshot()).toBe(accepted);
    expect(field("speed").value).toBe("0.8");
    expect(field("coordinateDuration").value).toBe("10");
    expect(container.querySelector("[data-apply-failure]")).toBeNull();
    expect(container.querySelector('[data-currency-state="refused"]')).toBeNull();
  });

  test("presets replace every draft field and clear a previous refusal", async () => {
    await mount();
    await edit("speed", "0.99");
    await edit("lightClockArm", "3");
    await submit();
    await click("Low speed, β = 10⁻⁴");
    expect(field("speed").value).toBe("0.0001");
    expect(field("coordinateDuration").value).toBe("10");
    expect(field("lightClockArm").value).toBe("1");
    expect(field("worldlinePreset").value).toBe("inertial");
    expect(session.acceptedParameters().speed).toBe(0.0001);
    expect(container.querySelector("[data-apply-failure]")).toBeNull();
  });

  test("a shared owner's accepted change synchronizes the trip and the implemented observer control", async () => {
    await mount();
    await edit("speed", "unfinished");
    await act(async () => {
      expect(session.apply({ speed: 0.8, coordinateDuration: 20 }).kind).toBe("accepted");
    });
    expect(field("speed").value).toBe("0.8");
    expect(field("coordinateDuration").value).toBe("20");
    expect(readout("properTime")).toBe("12 s");
    expect(container.querySelector<HTMLInputElement>('[name="frameOfDescription"]')?.value).toBe(
      "0",
    );
    expect(container.querySelector('[data-testid="sr05-observer-view"]')).not.toBeNull();
  });

  test("an inline clock keeps its supplied owner, shares the standalone lab and replays accepted stops", async () => {
    const incoming = tapeForSettings(SR05_TAPE, {
      ...SR05_DEFAULTS,
      speed: 0.9,
      coordinateDuration: 30,
      worldlinePreset: "inertial",
    });
    if (!incoming) throw new Error("The real clock owner refused the incoming settings.");
    window.history.replaceState(
      {},
      "",
      `/papers/special-relativity/?tape=${encodeTapePermalink(incoming)}`,
    );
    const original = session.getSnapshot();
    const originalSettings = session.acceptedParameters();
    await mount();
    const shared = await sharedTapeAt(originalSettings.speed);
    expect(session.getSnapshot()).toBe(original);
    expect(field("speed").value).toBe(String(originalSettings.speed));
    expect(settingsFromTape(shared.tape.initialConditions, SR05_DEFAULTS)).toEqual(
      originalSettings,
    );
    expect(new URL(shared.url).pathname).toBe("/lab/sr-05/");
    expect(container.querySelector("[data-tape-notice]")).toBeNull();

    await edit("speed", "0.35");
    await click("Save starting point");
    expect(session.getSnapshot()).toBe(original);
    await edit("speed", "0.8");
    await edit("coordinateDuration", "20");
    await edit("lightClockArm", "2");
    await edit("worldlinePreset", "circle");
    await submit();
    const secondSettings = session.acceptedParameters();
    expect(secondSettings).toMatchObject({
      speed: 0.8,
      coordinateDuration: 20,
      lightClockArm: 2,
      worldlinePreset: "circle",
    });
    await click("Save current accepted settings");
    const second = session.getSnapshot();
    await edit("speed", "1.2");
    await submit();
    expect(session.getSnapshot()).toBe(second);
    expect(container.querySelector('[data-apply-failure="refused"]')).not.toBeNull();
    expect(
      settingsFromTape((await sharedTapeAt(0.8)).tape.initialConditions, SR05_DEFAULTS),
    ).toEqual(secondSettings);

    await click("Restore previous saved stop");
    expect(session.acceptedParameters()).toEqual(originalSettings);
    expect(field("speed").value).toBe(String(originalSettings.speed));
    expect(field("coordinateDuration").value).toBe("10");
    expect(field("lightClockArm").value).toBe("1");
    expect(field("worldlinePreset").value).toBe("out-and-back");
    expect(readout("properTime")).toBe("8 s");
    expect(container.querySelector("[data-apply-failure]")).toBeNull();
    expect(container.querySelector('[data-currency-state="refused"]')).toBeNull();
    await click("Restore next saved stop");
    expect(session.acceptedParameters()).toEqual(secondSettings);
    expect(field("speed").value).toBe("0.8");
    expect(field("coordinateDuration").value).toBe("20");
    expect(field("lightClockArm").value).toBe("2");
    expect(field("worldlinePreset").value).toBe("circle");
    expect(readout("properTime")).toBe("12 s");
    expect(readout("reunionExactLag")).toBe("8 s");
    expect(container.querySelector('[data-recording-outcome="replayed"]')).not.toBeNull();
  });

  test("a shared tape fills the form and Apply retains its settings instead of restoring defaults", async () => {
    const settings = {
      ...SR05_DEFAULTS,
      speed: 0.8,
      coordinateDuration: 20,
      lightClockArm: 2,
      worldlinePreset: "inertial" as const,
    };
    const tape = tapeForSettings(SR05_TAPE, settings);
    expect(tape).not.toBeNull();
    if (!tape) throw new Error("The real clock owner refused valid shared settings.");
    window.history.replaceState({}, "", `/lab/sr-05/?tape=${encodeTapePermalink(tape)}`);
    await mount(true);
    await act(async () => {
      await new Promise<void>((resolve, reject) => {
        // The browser codec imports and decompresses asynchronously. Wait for this owner's
        // accepted settings, with a deadline that fails instead of leaving the test hanging.
        let unsubscribe: (() => void) | undefined;
        const timeout = setTimeout(() => {
          unsubscribe?.();
          reject(new Error("The shared tape did not produce its accepted clock settings."));
        }, 2000);
        const check = () => {
          const accepted = session.acceptedParameters();
          if (
            !Object.entries(settings).every(([key, value]) =>
              Object.is(accepted[key as keyof typeof settings], value),
            )
          )
            return;
          clearTimeout(timeout);
          unsubscribe?.();
          resolve();
        };
        unsubscribe = session.subscribe(check);
        check();
      });
    });
    expect(session.acceptedParameters()).toEqual(settings);
    expect(field("speed").value).toBe("0.8");
    expect(field("coordinateDuration").value).toBe("20");
    expect(field("lightClockArm").value).toBe("2");
    expect(field("worldlinePreset").value).toBe("inertial");
    await submit();
    expect(session.acceptedParameters()).toEqual(settings);
    expect(readout("properTime")).toBe("12 s");
  });

  test("without JavaScript the worked result remains readable and the new controls are disabled", () => {
    container.innerHTML = renderToStaticMarkup(
      <MovingClocksLab example={example as PreparedSr05Example} />,
    );
    expect(readout("properTime")).toBe("8 s");
    for (const name of ["speed", "coordinateDuration", "lightClockArm", "worldlinePreset"]) {
      expect(field(name).closest("fieldset")?.disabled).toBe(true);
    }
    expect(container.querySelector("noscript")?.textContent).toContain("complete worked example");
  });
});

describe("the moving-clock equation reads the accepted platform-frame calculation", () => {
  const equationId = "eq-model-sr-time-dilation";

  function required<T extends Element = HTMLElement>(parent: ParentNode, selector: string): T {
    const element = parent.querySelector<T>(selector);
    assert(element, `The real moving-clock surface must render ${selector}.`);
    return element;
  }

  function card(): HTMLElement {
    return required(container, "[data-sr05-live-equation]");
  }

  function expectValues(parent: ParentNode, coordinate: string, factor: string, proper: string) {
    for (const [term, text] of [
      ["coordinate", `${coordinate} s`],
      ["factor", `${factor} 1`],
      ["proper", `${proper} s`],
    ]) {
      const value = required(parent, `[data-term-value="${equationId}.t.${term}"]`);
      expect(value.getAttribute("data-value-kind")).toBe("value");
      expect(value.textContent?.replace(/\s+/g, " ").trim()).toBe(text);
    }
  }

  function expectIdentity(parent: ParentNode, owner = session) {
    const accepted = owner.getSnapshot().accepted;
    assert(accepted);
    const region = required(parent, "[data-equation-values]");
    expect(region.getAttribute("data-experiment-id")).toBe("sr-05");
    expect(region.getAttribute("data-instance-id")).toBe(accepted.instanceId);
    expect(region.getAttribute("data-run-id")).toBe(accepted.runId);
    expect(region.getAttribute("data-snapshot-version")).toBe(String(accepted.snapshotVersion));
    expect(region.getAttribute("data-accepted-input-revision")).toBe(
      String(accepted.revisions.input),
    );
  }

  async function mountWithPins(other?: ReturnType<typeof createSr05Session>) {
    const otherView = other?.getSnapshot();
    root = createRoot(container);
    await act(async () => {
      root?.render(
        <PinnedEquationProvider>
          <MovingClocksLab session={session} example={example as PreparedSr05Example} />
          {otherView ? (
            <section data-independent-clock>
              <Sr05LiveEquation
                view={otherView}
                execution={deriveHostExecution(
                  otherView,
                  SR05_OUTPUTS,
                  example.sourceDigest,
                  false,
                )}
              />
            </section>
          ) : null}
          <PinnedEquationDock />
        </PinnedEquationProvider>,
      );
    });
  }

  async function chooseInertial() {
    const preset = required<HTMLButtonElement>(container, '[data-preset-id="sr-05-inertial-0.6c"]');
    await act(async () => preset.click());
    expect(session.acceptedParameters().worldlinePreset).toBe("inertial");
  }

  async function pin(parent: ParentNode) {
    const button = required<HTMLButtonElement>(parent, `[data-pin-equation="${equationId}"]`);
    await act(async () => button.click());
    return required(container, `[data-pinned-equation="${equationId}"]`);
  }

  test("the inertial preset exposes all three live terms and the inspector uses that exact accepted snapshot", async () => {
    await mountWithPins();
    expect(container.querySelector("[data-sr05-live-equation]")).toBeNull();
    expect(required(container, "[data-sr05-equation-domain]").textContent).toContain(
      "no single inertial rest frame",
    );
    await chooseInertial();
    const before = session.getSnapshot();
    expectValues(card(), "10", "1.25", "8");
    expectIdentity(card());
    expect(readout("properTime")).toBe("8 s");
    expect(readout("coordinateTime")).toBe("10 s");
    const properTerm = required<HTMLButtonElement>(
      card(),
      `button[data-node-id="${equationId}.t.proper"]`,
    );
    await act(async () => properTerm.click());
    const inspector = required(card(), `[data-inspector-value="${equationId}.t.proper"]`);
    expect(inspector.getAttribute("data-value-kind")).toBe("value");
    expect(inspector.textContent).toContain("8 s");
    expect(inspector.getAttribute("data-instance-id")).toBe(before.accepted?.instanceId ?? "");
    expect(inspector.getAttribute("data-snapshot-version")).toBe(
      String(before.accepted?.snapshotVersion),
    );
    expect(session.getSnapshot()).toBe(before);
  });

  test("unapplied speed and duration drafts retain the equation until the real form accepts a new trip", async () => {
    await mountWithPins();
    await chooseInertial();
    const before = session.getSnapshot();
    await edit("speed", "-0.8");
    await edit("coordinateDuration", "20");
    expect(session.getSnapshot()).toBe(before);
    expectValues(card(), "10", "1.25", "8");
    expectIdentity(card());
    await submit();
    expect(session.acceptedParameters()).toMatchObject({ speed: -0.8, coordinateDuration: 20 });
    expect(session.getSnapshot().accepted?.runId).not.toBe(before.accepted?.runId);
    expectValues(card(), "20", "1.6667", "12");
    expectIdentity(card());
    expect(readout("properTime")).toBe("12 s");
    expect(readout("coordinateTime")).toBe("20 s");
  });

  test("unfinished and outside-domain drafts keep the accepted equation and its pinned values", async () => {
    await mountWithPins();
    await chooseInertial();
    await pin(card());
    const before = session.getSnapshot();
    for (const invalid of ["", "1.2"]) {
      await edit("speed", invalid);
      await submit();
      expect(session.getSnapshot()).toBe(before);
      expect(field("speed").value).toBe(invalid);
      expect(container.querySelector('[data-apply-failure="refused"]')).not.toBeNull();
      for (const surface of [card(), required(container, "[data-pinned-equation]")]) {
        expectValues(surface, "10", "1.25", "8");
        expectIdentity(surface);
        expect(surface.textContent).not.toMatch(/\b(?:NaN|Infinity)\b/u);
      }
    }
  });

  test("an observer change preserves the platform comparison while updating the real event description", async () => {
    await mountWithPins();
    await chooseInertial();
    await pin(card());
    const before = session.getSnapshot().accepted;
    assert(before);
    const observer = required<HTMLInputElement>(container, '[name="frameOfDescription"]');
    const change = handlers(observer).onChange;
    assert(change);
    await act(async () => {
      observer.value = "0.6";
      change({ target: observer, currentTarget: observer });
    });
    const observerForm = required(container, 'form[aria-label="Moving clock observer"]');
    const apply = handlers(observerForm).onSubmit;
    assert(apply);
    await act(async () => apply({ preventDefault() {} }));
    const after = session.getSnapshot().accepted;
    assert(after);
    expect(after.runId).toBe(before.runId);
    expect(after.revisions.input).toBe(before.revisions.input);
    expect(after.revisions.observer).toBeGreaterThan(before.revisions.observer);
    expect(after.snapshotVersion).toBeGreaterThan(before.snapshotVersion);
    expect(session.acceptedParameters().frameOfDescription).toBe(0.6);
    for (const surface of [card(), required(container, "[data-pinned-equation]")]) {
      expectValues(surface, "10", "1.25", "8");
      expectIdentity(surface);
    }
    expect(
      required(container, '[data-clock-event="sr05-traveller-end"] [data-event-time-k]')
        .textContent,
    ).toBe("10");
    expect(
      required(container, '[data-clock-event="sr05-traveller-end"] [data-event-time-observer]')
        .textContent,
    ).toBe("8");
  });

  test("a pin follows accepted inertial changes and retires only when a closed trip is accepted", async () => {
    await mountWithPins();
    await chooseInertial();
    await pin(card());
    await edit("speed", "0.8");
    await edit("coordinateDuration", "20");
    await submit();
    expectValues(required(container, "[data-pinned-equation]"), "20", "1.6667", "12");
    expectIdentity(required(container, "[data-pinned-equation]"));

    for (const worldline of ["out-and-back", "circle"]) {
      if (worldline === "circle") {
        await chooseInertial();
        await pin(card());
      }
      const before = session.getSnapshot();
      await edit("worldlinePreset", worldline);
      expect(session.getSnapshot()).toBe(before);
      expect(container.querySelector("[data-sr05-live-equation]")).not.toBeNull();
      expect(container.querySelector("[data-pinned-equation]")).not.toBeNull();
      await submit();
      expect(session.acceptedParameters().worldlinePreset).toBe(worldline);
      expect(container.querySelector("[data-sr05-live-equation]")).toBeNull();
      expect(container.querySelector("[data-pinned-equation]")).toBeNull();
      expect(required(container, "[data-sr05-equation-domain]").textContent).toContain(
        "add its proper time along the trip",
      );
    }
    await chooseInertial();
    expectValues(card(), "10", "1.25", "8");
    expect(container.querySelector("[data-pinned-equation]")).toBeNull();
  });

  test("changing one lab to a closed trip preserves the same equation pinned from another instance", async () => {
    const other = createSr05Session("independent-inertial-clock", example as PreparedSr05Example);
    expect(other.apply({ worldlinePreset: "inertial", coordinateDuration: 20 }).kind).toBe(
      "accepted",
    );
    const otherBefore = other.getSnapshot();
    await mountWithPins(other);
    await chooseInertial();
    await pin(required(container, "[data-independent-clock]"));
    await edit("worldlinePreset", "circle");
    await submit();
    expect(session.acceptedParameters().worldlinePreset).toBe("circle");
    const companion = required(container, "[data-pinned-equation]");
    expectValues(companion, "20", "1.25", "16");
    expectIdentity(companion, other);
    expect(other.getSnapshot()).toBe(otherBefore);
    expect(
      required(container, '[data-testid="moving-clocks-lab"]').querySelector(
        "[data-sr05-live-equation]",
      ),
    ).toBeNull();
  });

  test("a genuine prepared inertial calculation renders its formula and complete values without JavaScript", () => {
    const preset = SR05_PRESETS["sr-05-inertial-0.6c"];
    assert(preset);
    const prepared: PreparedSr05Example = {
      ...example,
      parameters: preset.parameters,
      results: evaluateSr05(preset.parameters).map((result) => encodeResult(result)),
    };
    // A fresh session is necessary: useSyncExternalStore serves its construction-time snapshot
    // during server rendering, so applying a preset to an older session would prove the wrong case.
    container.innerHTML = renderToStaticMarkup(<MovingClocksLab example={prepared} />);
    expectValues(card(), "10", "1.25", "8");
    expect(required(card(), "[data-equation-values]").getAttribute("data-execution-label")).toBe(
      "static",
    );
    expect(card().querySelector(".equation-visual .katex")).not.toBeNull();
    const math = required(card(), ".equation-mathml math");
    expect(math.getAttribute("xmlns")).toBe("http://www.w3.org/1998/Math/MathML");
    expect(required(math, 'annotation[encoding="application/x-tex"]').textContent).toBe(
      "\\Delta t = \\gamma\\,\\Delta\\tau",
    );
    expect(card().textContent).toContain("platform frame");
    expect(card().textContent).toContain("not the paper's tau");
    expect(field("speed").closest("fieldset")?.disabled).toBe(true);
    expect(container.querySelector("noscript")?.textContent).toContain("complete worked example");
  });

  test("the standalone laboratory supplies its own pin control and retires the dock when the accepted trip turns", async () => {
    await mount();
    await chooseInertial();
    const before = session.getSnapshot();
    const companion = await pin(card());
    expectValues(companion, "10", "1.25", "8");
    expectIdentity(companion);
    expect(companion.closest("[data-bottom-sheet]")).not.toBeNull();
    expect(session.getSnapshot()).toBe(before);
    await edit("worldlinePreset", "circle");
    expect(container.querySelector("[data-pinned-equation]")).not.toBeNull();
    await submit();
    expect(session.acceptedParameters().worldlinePreset).toBe("circle");
    expect(container.querySelector("[data-sr05-live-equation]")).toBeNull();
    expect(container.querySelector("[data-pinned-equation]")).toBeNull();
    expect(required(container, "[data-sr05-equation-domain]").textContent).toContain(
      "no single inertial rest frame",
    );
  });
});
