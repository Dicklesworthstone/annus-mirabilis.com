import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { act } from "react";
import type { Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { readInvestigationEvidence } from "../../../discovery/investigation/core.ts";
import { INVESTIGATIONS } from "../../../discovery/investigation/specs.ts";
import { encodeTapePermalink } from "../../../experiments/permalink/codec.ts";
import { tapeForSettings } from "../../../experiments/permalink/sessionTape.ts";
import { SR05_DEFAULTS } from "../../../experiments/sr05/definition.ts";
import { SR05_CLOCK_EVENT_MARKERS } from "../../../experiments/sr05/observer.ts";
import { createSr05Session, type PreparedSr05Example } from "../../../experiments/sr05/session.ts";
import { SR05_TAPE } from "../../../experiments/sr05/tape.ts";
import example from "../../../generated/sr05-example.json";
import { chapterInvestigationSession } from "../../../reader/chapterInvestigationSession.ts";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../../testing/reactDom.ts";
import { MovingClocksLab } from "./MovingClocksLab.tsx";

function required<T>(value: T | null | undefined): T {
  assert.ok(value, "The mounted clock experiment must expose this control or result.");
  return value;
}

describe("the same moving-clock events in an accepted observer description", () => {
  let container: HTMLElement;
  let root: Root;
  let session: ReturnType<typeof createSr05Session>;
  beforeEach(async () => {
    await installDom();
    window.localStorage.clear();
    window.history.replaceState(null, "", "/lab/sr-05/");
    container = createContainer();
    const { createRoot } = await import("react-dom/client");
    root = createRoot(container);
    session = createSr05Session("observer-ui", example as PreparedSr05Example);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    removeContainer(container);
    await uninstallDom();
  });
  async function mount(restoreFromLocation = false) {
    await act(async () =>
      root.render(
        <MovingClocksLab
          session={session}
          example={example as PreparedSr05Example}
          restoreFromLocation={restoreFromLocation}
        />,
      ),
    );
  }
  function field(name: string) {
    return required(container.querySelector<HTMLInputElement>(`input[name="${name}"]`));
  }
  async function edit(name: string, text: string) {
    const input = field(name);
    await act(async () => {
      const setter = required(
        Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set,
      );
      setter.call(input, text);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }
  async function submit(formName = "Moving clock observer") {
    const form = required(
      container.querySelector<HTMLFormElement>(`form[aria-label="${formName}"]`),
    );
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
  }
  function result() {
    return required(container.querySelector<HTMLElement>('[data-testid="sr05-observer-view"]'));
  }
  function cell(eventId: string, attribute: string): string | null {
    return required(result().querySelector(`[data-clock-event="${eventId}"] [${attribute}]`))
      .textContent;
  }
  async function click(label: string) {
    const button = required(
      [...container.querySelectorAll<HTMLButtonElement>("button")].find(
        (item) => item.textContent?.trim() === label,
      ),
    );
    await act(async () => button.click());
  }

  test("real published NumericViews render; applying the observer preserves the trip, event ids and unfinished physical draft", async () => {
    await mount();
    const before = required(session.getSnapshot().accepted);
    expect(
      [...result().querySelectorAll("[data-clock-event]")].map((row) =>
        row.getAttribute("data-clock-event"),
      ),
    ).toEqual(SR05_CLOCK_EVENT_MARKERS.map((marker) => marker.id));
    expect(cell("sr05-traveller-end", "data-event-reading")).toBe("8");
    await edit("speed", "unfinished trip");
    await edit("coordinateDuration", "27");
    await edit("frameOfDescription", "0.6");
    expect(session.getSnapshot().accepted).toBe(before);
    await submit();
    const after = required(session.getSnapshot().accepted);
    expect(after.runId).toBe(before.runId);
    expect(after.stepIndex).toBe(before.stepIndex);
    expect(session.acceptedParameters()).toMatchObject({
      speed: 0.6,
      coordinateDuration: 10,
      frameOfDescription: 0.6,
    });
    expect(field("speed").value).toBe("unfinished trip");
    expect(field("coordinateDuration").value).toBe("27");
    expect(cell("sr05-traveller-end", "data-event-time-k")).toBe("10");
    expect(cell("sr05-traveller-end", "data-event-time-observer")).toBe("12.5");
    expect(cell("sr05-traveller-end", "data-event-x-observer")).toBe("-7.5");
    expect(cell("sr05-traveller-end", "data-event-reading")).toBe("8");
    expect(cell("sr05-platform-end", "data-event-reading")).toBe("10");
    expect(container.querySelector('[data-field="reunionExactLag"]')?.textContent).toBe("2 s");
    expect(result().closest('[data-predict-response="awaiting"]')).not.toBeNull();
    expect(container.querySelector("[data-observer-notice]")?.textContent).toBe(
      "Observer coordinates updated for the same trip; the events and local clock readings are unchanged.",
    );
    expect(
      container
        .querySelector('form[aria-label="Moving clock observer"]')
        ?.closest("[data-predict-response]"),
    ).toBeNull();
  });

  for (const refused of ["", "1", "not a speed"]) {
    test(`observer ${JSON.stringify(refused)} refuses without replacing coordinates or discarding either draft`, async () => {
      await mount();
      await edit("frameOfDescription", "-0.6");
      await submit();
      const before = session.getSnapshot();
      const table = result().querySelector("table")?.textContent;
      await edit("speed", "my unfinished speed");
      await edit("frameOfDescription", refused);
      await submit();
      expect(session.getSnapshot()).toBe(before);
      expect(result().querySelector("table")?.textContent).toBe(table);
      expect(field("frameOfDescription").value).toBe(refused);
      expect(field("speed").value).toBe("my unfinished speed");
      expect(field("frameOfDescription").getAttribute("aria-invalid")).toBe("true");
      const error = required(
        document.getElementById(
          required(field("frameOfDescription").getAttribute("aria-describedby")),
        ),
      );
      expect(error.getAttribute("data-refusal-code")).toBe("invalid-parameter");
      expect(error.textContent).toContain("last accepted");
      expect(result().textContent).not.toMatch(/\b(?:NaN|Infinity)\b/u);
      await click("Use accepted observer");
      expect(field("frameOfDescription").value).toBe("-0.6");
      expect(field("frameOfDescription").getAttribute("aria-invalid")).toBeNull();
      expect(field("speed").value).toBe("my unfinished speed");
      expect(session.getSnapshot()).toBe(before);
    });
  }

  test("an accepted observer leaves an existing trip refusal visible until that trip is restored", async () => {
    await mount();
    await edit("speed", "1");
    await submit("Moving clock settings");
    expect(
      container.querySelector(
        'form[aria-label="Moving clock settings"] [data-apply-failure="refused"]',
      ),
    ).not.toBeNull();
    await edit("frameOfDescription", "0.4");
    await submit();
    expect(session.acceptedParameters().frameOfDescription).toBe(0.4);
    expect(field("speed").value).toBe("1");
    expect(
      container.querySelector(
        'form[aria-label="Moving clock settings"] [data-apply-failure="refused"]',
      ),
    ).not.toBeNull();
    await click("Use accepted settings");
    expect(field("speed").value).toBe("0.6");
    expect(field("frameOfDescription").value).toBe("0.4");
  });

  test("a circle exposes transverse separation rather than drawing its markers as a polygonal trip", async () => {
    await mount();
    await click("Constant-speed circle at 0.6c");
    await edit("frameOfDescription", "0.6");
    await submit();
    expect(cell("sr05-traveller-half", "data-event-x-k")).toBe("0");
    expect(cell("sr05-traveller-half", "data-event-time-k")).toBe("5");
    expect(cell("sr05-platform-half", "data-event-y-k")).toBe("0");
    expect(Number(cell("sr05-traveller-half", "data-event-y-k"))).toBeGreaterThan(1.9);
    expect(cell("sr05-traveller-half", "data-event-y-observer")).toBe(
      cell("sr05-traveller-half", "data-event-y-k"),
    );
    expect(result().querySelectorAll("polyline,path").length).toBe(0);
    expect(result().textContent).toContain("Overlapping x–t markers can be separated in y");
    expect(result().textContent).toContain("only departure and completion are shared events");
    expect(result().textContent).toContain("both origin clocks read zero");
  });

  test("zero-speed inertial clocks stay together and keep identical readings in every description", async () => {
    session.apply({ speed: 0, worldlinePreset: "inertial", frameOfDescription: 0.6 });
    await mount();
    expect(cell("sr05-platform-end", "data-event-reading")).toBe("10");
    expect(cell("sr05-traveller-end", "data-event-reading")).toBe("10");
    expect(cell("sr05-platform-end", "data-event-x-observer")).toBe(
      cell("sr05-traveller-end", "data-event-x-observer"),
    );
    expect(result().textContent).toContain("at zero speed the clocks stay together");
  });

  test("a shared tape restores the observer and its event coordinates before the next apply", async () => {
    const settings = {
      ...SR05_DEFAULTS,
      frameOfDescription: -0.6,
      worldlinePreset: "circle" as const,
    };
    const tape = required(tapeForSettings(SR05_TAPE, settings));
    window.history.replaceState(null, "", `/lab/sr-05/?tape=${encodeTapePermalink(tape)}`);
    await mount(true);
    await act(
      async () =>
        new Promise<void>((resolve, reject) => {
          let unsubscribe: (() => void) | undefined;
          const timeout = setTimeout(() => {
            unsubscribe?.();
            reject(new Error("The valid observer permalink was not restored."));
          }, 2000);
          const check = () => {
            if (session.acceptedParameters().frameOfDescription !== -0.6) return;
            clearTimeout(timeout);
            unsubscribe?.();
            resolve();
          };
          unsubscribe = session.subscribe(check);
          check();
        }),
    );
    expect(session.acceptedParameters()).toEqual(settings);
    expect(field("frameOfDescription").value).toBe("-0.6");
    expect(cell("sr05-traveller-end", "data-event-time-observer")).toBe("12.5");
    expect(cell("sr05-traveller-end", "data-event-x-observer")).toBe("7.5");
    const accepted = required(session.getSnapshot().accepted);
    await edit("frameOfDescription", "0.6");
    await submit();
    expect(session.getSnapshot().accepted?.runId).toBe(accepted.runId);
    expect(session.acceptedParameters().worldlinePreset).toBe("circle");
  });

  test("the prepared no-JavaScript example includes named event coordinates and a disabled observer form", () => {
    container.innerHTML = renderToStaticMarkup(
      <MovingClocksLab example={example as PreparedSr05Example} />,
    );
    expect(result().querySelectorAll("[data-clock-event]").length).toBe(
      SR05_CLOCK_EVENT_MARKERS.length,
    );
    expect(cell("sr05-traveller-end", "data-event-reading")).toBe("8");
    expect(cell("sr05-traveller-end", "data-event-time-observer")).toBe("10");
    expect(field("frameOfDescription").closest("fieldset")?.disabled).toBe(true);
    expect(container.textContent).toContain("values and explanations remain available");
  });

  async function mountChapter() {
    const chapter = chapterInvestigationSession(session);
    await act(async () =>
      root.render(
        <MovingClocksLab
          session={chapter}
          example={example as PreparedSr05Example}
          onValidationStateChange={chapter.validationStateChanged}
        />,
      ),
    );
    return chapter;
  }

  function chapterEvidence(
    chapter: ReturnType<typeof chapterInvestigationSession<ReturnType<typeof createSr05Session>>>,
  ) {
    return readInvestigationEvidence(
      INVESTIGATIONS["special-relativity"],
      chapter,
      example.sourceDigest,
    ).current;
  }

  test("chapter capture stays blocked after an accepted observer or observer reset while the trip remains refused", async () => {
    const chapter = await mountChapter();
    expect(chapterEvidence(chapter)).not.toBeNull();
    await edit("speed", "1");
    await submit("Moving clock settings");
    expect(chapterEvidence(chapter)).toBeNull();
    await edit("frameOfDescription", "0.6");
    await submit();
    const accepted = required(session.getSnapshot().accepted);
    expect(session.acceptedParameters().frameOfDescription).toBe(0.6);
    expect(field("speed").value).toBe("1");
    expect(chapterEvidence(chapter)).toBeNull();
    await edit("frameOfDescription", "1");
    await submit();
    await click("Use accepted observer");
    expect(field("frameOfDescription").value).toBe("0.6");
    expect(chapterEvidence(chapter)).toBeNull();
    expect(session.getSnapshot().accepted).toBe(accepted);
    await click("Use accepted settings");
    expect(field("speed").value).toBe("0.6");
    expect(session.getSnapshot().accepted).toBe(accepted);
    expect(chapterEvidence(chapter)?.parameters.frameOfDescription).toBe(0.6);
    expect(container.textContent).toContain(
      "Returned to the kept accepted settings. No new calculation was made.",
    );
  });

  test("chapter capture stays blocked after trip reset or trip success until the separate observer refusal is restored", async () => {
    const chapter = await mountChapter();
    await edit("speed", "1");
    await submit("Moving clock settings");
    await edit("frameOfDescription", "1");
    await submit();
    const beforeReset = session.getSnapshot().accepted;
    await click("Use accepted settings");
    expect(field("speed").value).toBe("0.6");
    expect(field("frameOfDescription").value).toBe("1");
    expect(session.getSnapshot().accepted).toBe(beforeReset);
    expect(chapterEvidence(chapter)).toBeNull();
    await edit("speed", "0.8");
    await submit("Moving clock settings");
    const accepted = required(session.getSnapshot().accepted);
    expect(session.acceptedParameters().speed).toBe(0.8);
    expect(field("frameOfDescription").value).toBe("1");
    expect(chapterEvidence(chapter)).toBeNull();
    await click("Use accepted observer");
    expect(field("frameOfDescription").value).toBe("0");
    expect(session.getSnapshot().accepted).toBe(accepted);
    expect(chapterEvidence(chapter)?.parameters.speed).toBe(0.8);
  });
});
