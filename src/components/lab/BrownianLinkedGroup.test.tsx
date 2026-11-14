import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { loadBrownianRadiusGroup } from "../../experiments/groups/loadBrownianRadius.ts";
import { controlledOwner, smallBrownianExamples } from "../../experiments/groups/testSupport.ts";
import {
  createContainer,
  emitTestIntersection,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../testing/reactDom.ts";
import { BrownianLinkedGroup } from "./BrownianLinkedGroup.tsx";

const examples = await smallBrownianExamples();
const definition = loadBrownianRadiusGroup();

test("linked instruments render complete static plots and numbers without running a worker", () => {
  let creations = 0;
  const forbidden = () => {
    creations += 1;
    throw new Error("SSR must never start an owner.");
  };
  const html = renderToStaticMarkup(
    <BrownianLinkedGroup
      definition={definition}
      tracerExample={examples.tracer}
      densityExample={examples.density}
      workerFactories={[forbidden, forbidden]}
    />,
  );
  expect(creations).toBe(0);
  expect(html).toContain('data-group-enabled="false"');
  expect(html.match(/data-execution-state="static-example"/g)).toHaveLength(2);
  expect(html.match(/data-linked-output="radius"/g)).toHaveLength(2);
  expect(html).toContain("Model RMS displacement");
  expect(html).toContain("Displacement probability density");
  expect(html).toContain("<noscript>");
  expect(html.match(/<fieldset disabled/g)).toHaveLength(3);
  expect(html).not.toMatch(/<label[^>]*>[^<]*<input/);
});

describe("mounted linked instruments with the real Brownian owners", () => {
  let container: HTMLElement;
  let root: Root | null = null;
  let tracer: ReturnType<typeof controlledOwner>;
  let density: ReturnType<typeof controlledOwner>;

  beforeEach(async () => {
    await installDom({ intersections: "manual" });
    container = createContainer();
    root = createRoot(container);
    tracer = controlledOwner("bm-01", examples.tracer.sourceDigest);
    density = controlledOwner("bm-06", examples.density.sourceDigest);
    await act(async () =>
      root?.render(
        <StrictMode>
          <BrownianLinkedGroup
            definition={definition}
            tracerExample={examples.tracer}
            densityExample={examples.density}
            workerFactories={[tracer.factory, density.factory]}
          />
        </StrictMode>,
      ),
    );
  });

  afterEach(async () => {
    await act(async () => root?.unmount());
    root = null;
    removeContainer(container);
    await uninstallDom();
  });

  function element<T extends Element = HTMLElement>(selector: string): T {
    const found = container.querySelector<T>(selector);
    if (!found) throw new Error("The linked instruments must render " + selector);
    return found;
  }
  function button(text: string): HTMLButtonElement {
    const found = [...container.querySelectorAll("button")].find(
      (candidate) => candidate.textContent?.trim() === text,
    );
    if (!found) throw new Error("The linked instruments must offer " + text);
    expect(found.disabled).toBe(false);
    return found;
  }
  async function until(condition: () => boolean) {
    for (let attempt = 0; attempt < 1000 && !condition(); attempt++)
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
      });
    expect(condition()).toBe(true);
  }
  function radii() {
    return [...container.querySelectorAll('[data-linked-output="radius"]')].map((cell) =>
      cell.textContent?.trim(),
    );
  }
  function displayed() {
    return [...container.querySelectorAll<HTMLElement>("[data-linked-member]")].map((member) => ({
      run: member.dataset.runId,
      snapshot: member.dataset.snapshotVersion,
      generation: member.dataset.displayedGeneration,
    }));
  }
  async function setRadius(name: string, value: string) {
    const input = element<HTMLInputElement>('input[name="' + name + '"]');
    input.value = value;
    // happy-dom does not synthesize React's native input tracker. Invoke the rendered onChange
    // exactly as the repository's existing laboratory form tests do; submit still uses the DOM.
    const key = Object.keys(input).find((candidate) => candidate.startsWith("__reactProps$"));
    if (!key) throw new Error("The mounted input must have React's actual event handler.");
    const props = (
      input as unknown as Record<
        string,
        {
          onChange?: (event: { target: HTMLInputElement; currentTarget: HTMLInputElement }) => void;
        }
      >
    )[key];
    expect(typeof props?.onChange).toBe("function");
    await act(async () => props?.onChange?.({ target: input, currentTarget: input }));
    const form = input.closest("form");
    if (!form) throw new Error("The radius must belong to its visible form.");
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
  }

  test("the mounted plots hold one complete generation until both actual owners finish", async () => {
    const region = element("[data-linked-group]");
    expect(tracer.creations + density.creations).toBe(0);
    density.hold();
    const initial = displayed();
    await act(async () => {
      expect(emitTestIntersection(region, true)).toBe(1);
      button("Link the particle radius").click();
    });
    await until(
      () =>
        density.held.length === 1 &&
        element('[data-linked-member="bm-01"]').dataset.memberStatus === "accepted",
    );
    expect(region.dataset.groupStatus).toBe("pending");
    expect(displayed()).toEqual(initial.map((entry) => ({ ...entry, generation: "0" })));
    expect(container.textContent).toContain("before linking");
    await act(async () => density.release());
    await until(() => region.dataset.groupStatus === "accepted");
    expect(displayed().map((entry) => entry.generation)).toEqual(["1", "1"]);
    const first = displayed();

    density.hold();
    await setRadius("shared-radius", "1");
    await until(
      () =>
        density.held.length === 1 &&
        element('[data-linked-member="bm-01"]').dataset.memberStatus === "accepted",
    );
    expect(region.dataset.groupStatus).toBe("pending");
    expect(radii()).toEqual(["0.5 μm", "0.5 μm"]);
    expect(displayed()).toEqual(first);
    expect(container.textContent).toContain("last complete shared calculation");
    await act(async () => density.release());
    await until(() => region.dataset.groupStatus === "accepted");
    expect(radii()).toEqual(["1 μm", "1 μm"]);
    expect(displayed().map((entry) => entry.generation)).toEqual(["2", "2"]);

    const counts = [tracer.requests.length, density.requests.length];
    await setRadius("shared-radius", "0.05");
    expect(region.dataset.groupStatus).toBe("incomplete");
    expect(element('[data-refusal-code="invalid-parameter"]').textContent).toContain("BM-01");
    expect(radii()).toEqual(["1 μm", "1 μm"]);
    expect([tracer.requests.length, density.requests.length]).toEqual(counts);

    const accepted = displayed();
    await act(async () => button("Unlink").click());
    expect(region.dataset.groupEnabled).toBe("false");
    expect(container.querySelector("[data-link-chip]")).toBeNull();
    expect(displayed().map(({ run, snapshot }) => ({ run, snapshot }))).toEqual(
      accepted.map(({ run, snapshot }) => ({ run, snapshot })),
    );
    expect([tracer.requests.length, density.requests.length]).toEqual(counts);
    await setRadius("bm-01-radius", "2");
    await until(() => radii()[0] === "2 μm");
    expect(radii()[1]).toBe("1 μm");
    expect(density.requests.length).toBe(counts[1]);
    expect(tracer.errors).toEqual([]);
    expect(density.errors).toEqual([]);
  });

  test("a member refusal is visible while both displayed results retain their previous radius", async () => {
    const region = element("[data-linked-group]");
    await act(async () => {
      emitTestIntersection(region, true);
      button("Link the particle radius").click();
    });
    await until(() => region.dataset.groupStatus === "accepted");
    const previous = displayed();
    density.refuseNext();
    await setRadius("shared-radius", "1");
    await until(
      () =>
        region.dataset.groupStatus === "incomplete" &&
        element('[data-linked-member="bm-01"]').dataset.memberStatus === "accepted",
    );
    expect(element('[data-linked-member="bm-06"]').dataset.memberStatus).toBe("refused");
    expect(element('[data-apply-failure="refused"]').textContent).toContain(
      "This member refused the requested radius.",
    );
    expect(radii()).toEqual(["0.5 μm", "0.5 μm"]);
    expect(displayed()).toEqual(previous);
    expect(container.textContent).toContain("The shared update is incomplete");
    expect(tracer.requests.at(-1)?.parameters.a).toBe(1e-6);
    expect(density.requests.at(-1)?.parameters.a).toBe(1e-6);
  });
});
