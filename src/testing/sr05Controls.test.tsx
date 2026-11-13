/**
 * SR-05's typed controls drive its real owner. An unfinished or refused draft never becomes
 * a scientific input, and a preset, shared session or permalink cannot leave stale form values.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { MovingClocksLab } from "../components/lab/sr05/MovingClocksLab.tsx";
import { encodeTapePermalink } from "../experiments/permalink/codec.ts";
import { tapeForSettings } from "../experiments/permalink/sessionTape.ts";
import { SR05_DEFAULTS } from "../experiments/sr05/definition.ts";
import {
  createSr05Session,
  type PreparedSr05Example,
} from "../experiments/sr05/session.ts";
import { SR05_TAPE } from "../experiments/sr05/tape.ts";
import example from "../generated/sr05-example.json";
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
  const key = Object.keys(target).find((name) => name.startsWith("__reactProps$"));
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
      expect(
        container.querySelector('[data-apply-failure="refused"]')?.textContent,
      ).toContain("last accepted");
      expect(
        container
          .querySelector("[data-apply-failure]")
          ?.getAttribute("data-refusal-code"),
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

  test("a shared owner's accepted change synchronizes the form without exposing unimplemented observer settings", async () => {
    await mount();
    await edit("speed", "unfinished");
    await act(async () => {
      expect(session.apply({ speed: 0.8, coordinateDuration: 20 }).kind).toBe("accepted");
    });
    expect(field("speed").value).toBe("0.8");
    expect(field("coordinateDuration").value).toBe("20");
    expect(readout("properTime")).toBe("12 s");
    expect(container.querySelector('[name="frameOfDescription"]')).toBeNull();
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
            !Object.entries(settings).every(
              ([key, value]) => Object.is(accepted[key as keyof typeof settings], value),
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
