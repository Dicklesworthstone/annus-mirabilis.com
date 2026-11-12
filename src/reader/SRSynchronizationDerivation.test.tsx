import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import {
  srSynchronizationChain as chain,
  srSynchronizationSourceLinks,
} from "../equations/derivations/srSynchronization.ts";
import { CLOCK_WORKED_EXAMPLES } from "../experiments/sr01/entranceScenario.ts";
import { decodeSr01Settings } from "../experiments/sr01/permalink.ts";
import { snapshotOutputs } from "../experiments/sr01/session.ts";
import { createContainer, installDom, removeContainer, uninstallDom } from "../testing/reactDom.ts";
import { SRSynchronizationDerivation } from "./SRSynchronizationDerivation.tsx";

const journeySource = readFileSync(
  new URL("../discovery/relativity/journeyIII.ts", import.meta.url),
  "utf8",
);
const moveBlock =
  /export const MOVE: JourneyMove = \{([\s\S]*?)\n\};/.exec(journeySource)?.[1] ?? "";
const linkedChain = /chainId:\s*"([^"]+)"/.exec(moveBlock)?.[1] ?? "";
const linkedStep = /stepId:\s*"([^"]+)"/.exec(moveBlock)?.[1] ?? "";
const moveHref = /export const MOVE_HREF\s*=\s*"([^"]+)"/.exec(journeySource)?.[1] ?? "";

test("§1 ships the marked definition and every algebraic step in initial HTML", () => {
  const html = renderToStaticMarkup(<SRSynchronizationDerivation activeDetail="0" />);
  expect(linkedChain).toBe(chain.id);
  expect(linkedStep).toBe(chain.steps.find((step) => step.isMove)?.id);
  expect(new URL(moveHref, "https://annus-mirabilis.com").hash).toBe(`#${linkedStep}`);
  expect(html).toContain('id="sr-synchronization-derivation"');
  expect(html).toContain('data-argument-id="arg-sr-synchronization"');
  expect(html).toContain('data-review="draft"');
  expect(html).toContain('data-route-kind="pedagogical-reconstruction"');
  expect(html).toContain(`<li id="${linkedStep}"`);
  expect([...html.matchAll(/data-is-move="true"/g)]).toHaveLength(1);
  expect([...html.matchAll(/data-step-id=/g)]).toHaveLength(chain.steps.length);
  expect(html).toContain("<details");
  expect(html).toContain("<math");
  expect(html).not.toContain("katex-error");
  expect(html).toContain("do not yet say what a distant clock");
  expect(html).toContain("The midpoint is forced by the equal-leg definition.");
  expect(html).toContain("does not change a clock’s rate");
  expect(html).not.toContain("Where Einstein does this");
  expect([...html.matchAll(/Read the source definition →/g)]).toHaveLength(chain.steps.length);
  for (const step of chain.steps) {
    expect(html).toContain(`id="${step.id}"`);
    expect(html).toContain(step.reasons.r0.replaceAll("'", "&#x27;"));
    expect(html).toContain(`/foundations/${step.tool!.replace("foundation:", "")}/`);
  }
  expect(html).toContain('data-detail="1" hidden=""');
  expect(html).not.toContain('data-detail="0" hidden=""');
});

test("source links and worked handoffs retain real targets and the same evaluator result", () => {
  const html = renderToStaticMarkup(<SRSynchronizationDerivation activeDetail="2" />);
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  expect(new Set(ids).size).toBe(ids.length);
  for (const source of srSynchronizationSourceLinks) {
    expect(ids).toContain(source.id);
    expect(html).toContain(`href="/papers/special-relativity/view/german/#${source.anchor}"`);
  }
  expect(html).toContain('href="/papers/special-relativity/view/german/#s1-p8"');
  expect(html).toContain('href="/papers/special-relativity/s3/#sr-coordinate-derivation"');
  for (const example of CLOCK_WORKED_EXAMPLES) {
    expect(html).toContain(`href="${example.labHref.replaceAll("&", "&amp;")}"`);
    const decoded = decodeSr01Settings(
      new URL(example.labHref, "https://annus-mirabilis.com").search,
    );
    expect(decoded.kind).toBe("settings");
    if (decoded.kind !== "settings")
      throw new Error("Worked example must have an exact lab handoff.");
    expect(decoded.parameters.emissionTimeA).toBe(example.readings.departure);
    expect(decoded.parameters.stationSeparationLs).toBe(example.separationLs);
    const assigned = snapshotOutputs(decoded.parameters).find(
      (output) => output.quantityId === "assignedRemoteTime",
    );
    expect(assigned?.status).toBe("value");
    if (assigned?.status === "value") expect(assigned.value).toBe(example.assigned);
  }
  expect(CLOCK_WORKED_EXAMPLES.map((example) => example.assigned)).toEqual([5, 25]);
  expect(html).toContain("two readings alone do not measure that distance");
});

describe("the discovery move opens the definition through the real shared renderer", () => {
  let container: HTMLElement;
  let root: Root;
  beforeEach(async () => {
    await installDom();
    container = createContainer();
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    removeContainer(container);
    await uninstallDom();
  });

  test("a direct move fragment reveals closed reader ancestors and the definition reasoning", async () => {
    window.history.replaceState({}, "", moveHref);
    await act(async () => {
      root.render(
        <details data-paper-disclosure>
          <summary>Read the argument</summary>
          <SRSynchronizationDerivation />
        </details>,
      );
    });
    const target = container.querySelector<HTMLElement>(`[id="${linkedStep}"]`)!;
    expect(container.querySelectorAll(`[id="${linkedStep}"]`)).toHaveLength(1);
    expect(target.closest("[data-derivation-chain]")?.getAttribute("data-derivation-chain")).toBe(
      linkedChain,
    );
    expect(container.querySelector<HTMLDetailsElement>("[data-paper-disclosure]")!.open).toBe(true);
    expect(target.querySelector<HTMLDetailsElement>(".step-local-steps")!.open).toBe(true);
    expect(target.dataset.isMove).toBe("true");
    expect(target.classList.contains("is-focused")).toBe(true);
    expect(document.activeElement).toBe(target);
    expect(target.textContent).toContain(chain.steps[0]!.reasons.r2);
  });

  test("an unrelated fragment keeps local reasoning closed until the move is selected", async () => {
    window.history.replaceState({}, "", "/papers/special-relativity/s1/#unrelated");
    await act(async () => root.render(<SRSynchronizationDerivation />));
    const target = container.querySelector<HTMLElement>(`[id="${linkedStep}"]`)!;
    const local = target.querySelector<HTMLDetailsElement>(".step-local-steps")!;
    expect(local.open).toBe(false);
    expect(document.activeElement).not.toBe(target);
    await act(async () => {
      window.history.replaceState({}, "", moveHref);
      window.dispatchEvent(new Event("hashchange"));
    });
    expect(local.open).toBe(true);
    expect(document.activeElement).toBe(target);
  });
});
