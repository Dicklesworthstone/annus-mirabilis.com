import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act } from "react";
import type { Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import BrownianRoute from "../../app/discover/brownian-motion/page.tsx";
import LightQuantaRoute from "../../app/discover/light-quanta/page.tsx";
import MassEnergyRoute from "../../app/discover/mass-energy/page.tsx";
import RelativityRoute from "../../app/discover/special-relativity/page.tsx";
import { DISPLACEMENT_SCALE_EXERCISE } from "../../discovery/brownian/journeyExercises.ts";
import { EINSTEIN_ONE_SECOND } from "../../discovery/brownian/numericExercises.ts";
import type { NumericExercisePart } from "../../discovery/exercises/numeric.ts";
import { DiscoveryNotebookProvider } from "../../discovery/notes/context.tsx";
import { getNotebookStore } from "../../reader/notebook/browserStore.ts";
import { exportNotebookHtml, exportNotebookJson } from "../../reader/notebook/export.ts";
import { createNotebookStore } from "../../reader/notebook/notebookStore.ts";
import { mountNotebookPanel } from "../../reader/notebook/panel.ts";
import { NOTEBOOK_KEY, type NotebookExerciseEntry } from "../../reader/notebook/schema.ts";
import { createNotebookStorage } from "../../reader/notebook/storage.ts";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../testing/reactDom.ts";
import { ExercisePart } from "./ExercisePart.tsx";
import { NumericPart } from "./NumericPart.tsx";

const binding = { title: "From one displacement axis to two", sourceAnchor: "arg-bm-gaussian" };
const guides = [
  { paper: "brownian-motion", Route: BrownianRoute },
  { paper: "light-quanta", Route: LightQuantaRoute },
  { paper: "special-relativity", Route: RelativityRoute },
  { paper: "mass-energy", Route: MassEnergyRoute },
] as const;

function BoundExercise({
  revision = "3",
  numeric,
  part = DISPLACEMENT_SCALE_EXERCISE,
}: {
  revision?: string;
  numeric?: NumericExercisePart;
  part?: typeof DISPLACEMENT_SCALE_EXERCISE;
}) {
  return (
    <DiscoveryNotebookProvider manifest={{ paper: "brownian-motion", revision, stages: [] }}>
      {numeric ? (
        <NumericPart part={numeric} notebook={binding} />
      ) : (
        <ExercisePart part={part} notebook={binding} />
      )}
    </DiscoveryNotebookProvider>
  );
}
function required<T>(value: T | null | undefined): T {
  if (value === null || value === undefined)
    throw new Error("The expected exercise control is missing.");
  return value;
}

describe("saved exercise responses on the four published discovery guides", () => {
  let container: HTMLElement;
  let root: Root;
  beforeEach(async () => {
    await installDom();
    window.localStorage.clear();
    expect(getNotebookStore().reloadConfirmed().ok).toBe(true);
    container = createContainer();
    const { createRoot } = await import("react-dom/client");
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    removeContainer(container);
    await uninstallDom();
  });
  async function type(field: HTMLInputElement, value: string) {
    await act(async () => {
      const setter = required(
        Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set,
      );
      setter.call(field, value);
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }
  function exercise() {
    return required(container.querySelector<HTMLElement>("[data-exercise-part]"));
  }
  function input() {
    return required(exercise().querySelector<HTMLInputElement>("input"));
  }
  function button(text: string, scope: ParentNode = container) {
    return required(
      [...scope.querySelectorAll<HTMLButtonElement>("button")].find(
        (item) => item.textContent === text,
      ),
    );
  }
  async function click(text: string, scope: ParentNode = container) {
    const target = button(text, scope);
    expect(target.disabled).toBe(false);
    await act(async () => target.click());
  }
  async function check() {
    await act(async () => {
      required(exercise().querySelector("form")).dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });
    for (let index = 0; index < 20 && !exercise().querySelector(".exercise-verdict"); index++)
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
      });
    expect(exercise().querySelector(".exercise-verdict")).not.toBeNull();
  }

  for (const { paper, Route } of guides) {
    test(`${paper}: every instrumented question has a public return anchor and keeps its complete no-script explanation`, () => {
      const view = document.createElement("div");
      view.innerHTML = renderToStaticMarkup(<Route />);
      const forms = [...view.querySelectorAll<HTMLFormElement>("form.exercise-form")];
      expect(forms.length).toBeGreaterThan(0);
      for (const form of forms) {
        const part = required(form.closest<HTMLElement>("[data-exercise-part]"));
        expect(part.id).toBe(`exercise-${part.dataset.exercisePart}`);
        expect(part.querySelector("[data-saved-exercise-response]")).not.toBeNull();
        expect(part.querySelector("details.exercise-worked")?.textContent?.length).toBeGreaterThan(
          40,
        );
        expect(part.textContent).toContain("Saving needs JavaScript");
        expect(button("Save response in my notebook", part).disabled).toBe(true);
      }
    });

    test(`${paper}: all rendered numeric and expression responses save, reload and appear in the notebook`, async () => {
      await act(async () => root.render(<Route />));
      const parts = [...container.querySelectorAll<HTMLElement>("[data-exercise-part]")].filter(
        (part) => part.querySelector("form.exercise-form"),
      );
      expect(parts.length).toBeGreaterThan(0);
      for (const part of parts) {
        const before = window.localStorage.getItem(NOTEBOOK_KEY);
        await type(required(part.querySelector<HTMLInputElement>("input")), "1");
        expect(window.localStorage.getItem(NOTEBOOK_KEY)).toBe(before);
        await click("Save response in my notebook", part);
      }
      const reopened = createNotebookStore(createNotebookStorage());
      reopened.open();
      const saved = reopened.getSnapshot().document.entries;
      expect(saved.map((entry) => entry.kind)).toEqual(parts.map(() => "exercise"));
      expect(saved.map((entry) => entry.frame.paper)).toEqual(parts.map(() => paper));
      for (const entry of saved) {
        if (entry.kind !== "exercise")
          throw new Error("The response must have its typed exercise capture.");
        expect(entry.text).toBe("1");
        expect(entry.exercise.definitionKey.length).toBeGreaterThan(0);
        expect(entry.frame.anchor).toStartWith("arg-");
        expect(
          entry.exercise.partKind === "expression"
            ? entry.exercise.unit === null
            : typeof entry.exercise.unit === "string",
        ).toBe(true);
      }
      await act(async () => root.render(<Route key="returned" />));
      for (const part of container.querySelectorAll<HTMLElement>("[data-saved-exercise-response]"))
        expect(part.textContent).toContain("Your saved responses");
    });
  }

  test("earlier expressions remain beside revisions; explicit restore clears verdicts and requires a fresh check", async () => {
    await act(async () => root.render(<BoundExercise />));
    await type(input(), "sqrt(4*D*t)");
    await check();
    expect(exercise().textContent).toContain("Numerically equivalent");
    await click("Save response in my notebook");
    await type(input(), "2*sqrt(D*t)");
    expect(exercise().querySelector(".exercise-verdict")).toBeNull();
    await click("Save response in my notebook");
    const store = getNotebookStore();
    expect(store.getSnapshot().document.entries.map((entry) => entry.text)).toEqual([
      "sqrt(4*D*t)",
      "2*sqrt(D*t)",
    ]);
    await act(async () => root.render(<BoundExercise key="returned" />));
    expect(input().value).toBe("");
    await click("Use this saved response");
    expect(input().value).toBe("sqrt(4*D*t)");
    expect(exercise().querySelector(".exercise-verdict")).toBeNull();
    expect(exercise().textContent).toContain("nothing was checked automatically");
    await check();
    expect(exercise().textContent).toContain("Numerically equivalent");

    const host = createContainer();
    const panel = mountNotebookPanel(host, store, () => {}, { inline: true });
    try {
      expect(host.textContent).toContain("Exercise response");
      expect(host.textContent).toContain("not a current checker verdict");
      expect(
        host.querySelector(
          'a[href="/discover/brownian-motion/#exercise-bm-displacement-scale-rewrite"]',
        ),
      ).not.toBeNull();
      expect(
        [...host.querySelectorAll("button")].some((item) => item.textContent === "Edit note"),
      ).toBe(false);
    } finally {
      panel.dispose();
      removeContainer(host);
    }
  });

  test("restoring over a changed draft requires confirmation and further editing invalidates that preview", async () => {
    await act(async () => root.render(<BoundExercise />));
    await type(input(), "sqrt(4*D*t)");
    await click("Save response in my notebook");
    await type(input(), "D*t");
    await click("Use this saved response");
    expect(input().value).toBe("D*t");
    expect(
      exercise().querySelector('[aria-label="Replace exercise answer preview"]'),
    ).not.toBeNull();
    await type(input(), "sqrt(D*t)");
    expect(exercise().querySelector('[aria-label="Replace exercise answer preview"]')).toBeNull();
    await click("Use this saved response");
    await click("Replace the answer with this saved response");
    expect(input().value).toBe("sqrt(4*D*t)");
    expect(getNotebookStore().getSnapshot().document.entries).toHaveLength(1);
  });

  test("numeric responses keep the selected unit and changed checking conditions cannot reuse a prior result", async () => {
    await act(async () => root.render(<BoundExercise numeric={EINSTEIN_ONE_SECOND} />));
    const select = required(exercise().querySelector<HTMLSelectElement>("select"));
    expect([...select.options].map((item) => item.value)).toContain("nm");
    await act(async () => {
      select.value = "nm";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await type(input(), "794.8");
    await check();
    await click("Save response in my notebook");
    const saved = getNotebookStore().getSnapshot().document.entries[0];
    expect(saved?.kind).toBe("exercise");
    if (saved?.kind !== "exercise") return;
    expect(saved.exercise.unit).toBe("nm");
    await act(async () =>
      root.render(<BoundExercise key="returned" numeric={EINSTEIN_ONE_SECOND} />),
    );
    await click("Use this saved response");
    expect(input().value).toBe("794.8");
    expect(exercise().querySelector<HTMLSelectElement>("select")?.value).toBe("nm");
    expect(exercise().querySelector(".exercise-verdict")).toBeNull();
    await check();
    const changed = {
      ...EINSTEIN_ONE_SECOND,
      reference: {
        ...EINSTEIN_ONE_SECOND.reference,
        value: 2 * EINSTEIN_ONE_SECOND.reference.value,
      },
    };
    await act(async () => root.render(<BoundExercise revision="4" numeric={changed} />));
    expect(input().value).toBe("");
    expect(exercise().querySelector(".exercise-verdict")).toBeNull();
    expect(exercise().textContent).toContain("exercise has changed");
    expect(
      [...exercise().querySelectorAll("button")].some(
        (item) => item.textContent === "Use this saved response",
      ),
    ).toBe(false);
  });

  test("restoring a response supersedes a pending expression check without publishing its late verdict", async () => {
    await act(async () => root.render(<BoundExercise />));
    await type(input(), "sqrt(4*D*t)");
    await click("Save response in my notebook");
    await type(input(), "sqrt(D*t)");
    const digest = crypto.subtle.digest.bind(crypto.subtle);
    const descriptor = Object.getOwnPropertyDescriptor(crypto.subtle, "digest");
    let release: (() => Promise<void>) | undefined;
    Object.defineProperty(crypto.subtle, "digest", {
      configurable: true,
      value: (algorithm: AlgorithmIdentifier, data: BufferSource) =>
        new Promise<ArrayBuffer>((resolve, reject) => {
          release = async () => {
            try {
              resolve(await digest(algorithm, data));
            } catch (error) {
              reject(error);
            }
          };
        }),
    });
    try {
      await act(async () => {
        required(exercise().querySelector("form")).dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        );
      });
      expect(exercise().textContent).toContain("Checking the submitted expression");
      expect(release).toBeDefined();
      await click("Use this saved response");
      await click("Replace the answer with this saved response");
      expect(input().value).toBe("sqrt(4*D*t)");
      await act(async () => {
        await required(release)();
      });
      expect(exercise().querySelector(".exercise-verdict")).toBeNull();
      expect(exercise().textContent).not.toContain("Checking the submitted expression");
      expect(exercise().textContent).toContain("nothing was checked automatically");
    } finally {
      if (descriptor) Object.defineProperty(crypto.subtle, "digest", descriptor);
      else Reflect.deleteProperty(crypto.subtle, "digest");
    }
  });

  test("exported responses import through the real merge path without automatic evaluation or draft replacement", async () => {
    await act(async () => root.render(<BoundExercise />));
    await type(input(), "sqrt(4*D*t)");
    await click("Save response in my notebook");
    const store = getNotebookStore();
    const exported = JSON.parse(exportNotebookJson(store.getSnapshot().document));
    const saved: NotebookExerciseEntry = exported.entries[0];
    exported.entries[0] = { ...saved, id: "imported-response", text: "constructor" };
    await type(input(), "2*sqrt(D*t)");
    await act(async () => {
      const preview = store.previewImport(exported);
      expect(preview.ok).toBe(true);
      if (preview.ok) expect(store.commitMerge(preview.review).ok).toBe(true);
    });
    expect(input().value).toBe("2*sqrt(D*t)");
    expect(exercise().querySelector(".exercise-verdict")).toBeNull();
    expect(exercise().textContent).toContain("constructor");
    expect(exportNotebookHtml(store.getSnapshot().document)).toContain("constructor");
  });

  test("blocked storage keeps responses exportable in the tab, with no request carrying private work", async () => {
    const descriptor = Object.getOwnPropertyDescriptor(window, "localStorage");
    const fetch = globalThis.fetch;
    let requests = 0;
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("Blocked", "SecurityError");
      },
    });
    globalThis.fetch = (() => {
      requests++;
      throw new Error("Private responses must not be sent.");
    }) as typeof fetch;
    try {
      await act(async () => root.render(<BoundExercise />));
      await type(input(), "sqrt(4*D*t)");
      await click("Save response in my notebook");
      expect(getNotebookStore().getSnapshot().persistence).toBe("session-only");
      expect(exercise().textContent).toContain("could not be saved on this device");
      expect(exportNotebookJson(getNotebookStore().getSnapshot().document)).toContain(
        "sqrt(4*D*t)",
      );
      expect(requests).toBe(0);
      expect(window.location.href).not.toContain("sqrt");
    } finally {
      globalThis.fetch = fetch;
      if (descriptor) Object.defineProperty(window, "localStorage", descriptor);
    }
  });
});
