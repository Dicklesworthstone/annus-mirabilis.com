import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_SIGNED_DISPLACEMENT_SNAPSHOT } from "../../reader/entrances/signedDisplacementExercise.ts";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../testing/reactDom.ts";
import { HistoricalExperiment } from "./HistoricalExperiment.tsx";
import { DESK_EXPERIMENT_IDS, type DeskExperimentId } from "./model.ts";

function WorkedExample() {
  const { totals } = DEFAULT_SIGNED_DISPLACEMENT_SNAPSHOT;
  return (
    <>
      <p>Illustrative signed displacements, not a measured dataset.</p>
      <table>
        <caption>Arithmetic that remains readable</caption>
        <tbody>
          <tr>
            <th scope="row">Signed total</th>
            <td>{totals.signedSum}</td>
          </tr>
          <tr>
            <th scope="row">Mean absolute displacement</th>
            <td>{totals.meanAbsolute}</td>
          </tr>
          <tr>
            <th scope="row">Mean square</th>
            <td>{totals.meanSquare}</td>
          </tr>
        </tbody>
      </table>
      <a href="#authored-example-source">Read the example's source</a>
    </>
  );
}

test("the entire worked example and source link survive server rendering without a live mount", () => {
  const html = renderToStaticMarkup(
    <HistoricalExperiment id="signed-displacement" title="Compare signed displacements">
      <WorkedExample />
    </HistoricalExperiment>,
  );
  expect(html).toContain('class="desk-worked-case" open=""');
  expect(html).toContain("Illustrative signed displacements, not a measured dataset");
  expect(html).toContain('<th scope="row">Signed total</th><td>0</td>');
  expect(html).toContain('<th scope="row">Mean absolute displacement</th><td>2</td>');
  expect(html).toContain('<th scope="row">Mean square</th><td>5</td>');
  expect(html).toContain('href="#authored-example-source"');
  expect(html).toContain("<noscript>");
  expect(html).toContain('class="desk-experiment-actions" hidden=""');
  expect(html).not.toContain('data-exercise="signed-displacements"');
  expect(html).not.toContain("Loading the experiment");
});

async function until(check: () => boolean) {
  for (let attempt = 0; attempt < 100 && !check(); attempt++)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  expect(check()).toBe(true);
}

describe("explicit experiment loading on the reading-only desk", () => {
  let container: HTMLElement;
  let root: ReturnType<typeof createRoot>;
  beforeEach(async () => {
    await installDom();
    window.history.replaceState(null, "", "/1904/");
    document.documentElement.dataset.readingOnly = "on";
    container = createContainer();
    root = createRoot(container);
    await act(async () =>
      root.render(
        DESK_EXPERIMENT_IDS.map((id) => (
          <HistoricalExperiment key={id} id={id} title={`Historical ${id}`}>
            {id === "signed-displacement" ? (
              <WorkedExample />
            ) : (
              <p>Complete server-rendered worked case for {id}.</p>
            )}
          </HistoricalExperiment>
        )),
      ),
    );
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    removeContainer(container);
    await uninstallDom();
  });
  function wrapper(id: DeskExperimentId): HTMLElement {
    const element = container.querySelector<HTMLElement>(`[data-desk-experiment="${id}"]`);
    expect(element).not.toBeNull();
    return element as HTMLElement;
  }
  async function toggle(id: DeskExperimentId) {
    await act(async () =>
      wrapper(id).querySelector<HTMLButtonElement>(".desk-experiment-actions button")?.click(),
    );
  }
  function live(id: DeskExperimentId) {
    return wrapper(id).querySelector<HTMLElement>(".desk-live");
  }

  test("hydration and reading preference changes leave all six instruments unmounted until Open", async () => {
    expect(container.querySelectorAll("[data-desk-experiment]")).toHaveLength(6);
    for (const id of DESK_EXPERIMENT_IDS) {
      expect(wrapper(id).dataset.readingOnlyInstrument).toBe("on");
      expect(live(id)?.childElementCount).toBe(0);
      expect(wrapper(id).querySelector<HTMLDetailsElement>(".desk-worked-case")?.open).toBe(true);
      expect(wrapper(id).querySelector("button")?.getAttribute("aria-expanded")).toBe("false");
    }
    expect(container.querySelector("[data-instrument-id], [data-exercise]")).toBeNull();
    await act(async () => {
      document.documentElement.dataset.readingOnly = "off";
    });
    await until(() => wrapper("signed-displacement").dataset.readingOnlyInstrument === "off");
    expect(container.querySelector("[data-instrument-id], [data-exercise]")).toBeNull();
    await act(async () => {
      document.documentElement.dataset.readingOnly = "on";
    });
    await until(() => wrapper("signed-displacement").dataset.readingOnlyInstrument === "on");
    expect(container.querySelector("[data-instrument-id], [data-exercise]")).toBeNull();
  });

  test("Open mounts the real signed-displacement controls alone, and Close restores the worked case", async () => {
    await toggle("signed-displacement");
    expect(
      wrapper("signed-displacement").querySelector<HTMLDetailsElement>(".desk-worked-case")?.open,
    ).toBe(true);
    await until(
      () => !!live("signed-displacement")?.querySelector('[data-exercise="signed-displacements"]'),
    );
    expect(live("signed-displacement")?.querySelectorAll('input[name^="mark-"]')).toHaveLength(4);
    expect(
      live("signed-displacement")?.querySelector('[data-output="mean-square"]')?.textContent,
    ).toBe("5 squared units");
    for (const id of DESK_EXPERIMENT_IDS.filter((id) => id !== "signed-displacement"))
      expect(live(id)?.childElementCount).toBe(0);
    expect(
      wrapper("signed-displacement").querySelector('a[href="#authored-example-source"]'),
    ).not.toBeNull();
    expect(
      wrapper("signed-displacement").querySelector("button")?.getAttribute("aria-expanded"),
    ).toBe("true");
    await toggle("signed-displacement");
    expect(live("signed-displacement")?.childElementCount).toBe(0);
    expect(
      wrapper("signed-displacement").querySelector<HTMLDetailsElement>(".desk-worked-case")?.open,
    ).toBe(true);
    expect(wrapper("signed-displacement").textContent).toContain(
      "Arithmetic that remains readable",
    );
  });

  test("each of the other explicit openings resolves to the real bounded historical component", async () => {
    for (const id of DESK_EXPERIMENT_IDS.filter((id) => id !== "signed-displacement")) {
      await toggle(id);
      await until(() => !!live(id)?.querySelector(`[data-instrument-id="${id}"]`));
      expect(live(id)?.querySelector("form")).not.toBeNull();
      expect(wrapper(id).querySelector("button")?.getAttribute("aria-expanded")).toBe("true");
      expect(
        live(id)?.querySelector('input[name="showLaterAids"], input[name="candidateA"]'),
      ).toBeNull();
      await toggle(id);
      expect(live(id)?.childElementCount).toBe(0);
    }
  });
});
