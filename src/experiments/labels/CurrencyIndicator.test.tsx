import { afterAll, afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { getLogger } from "../../testing/log/logger.ts";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../testing/reactDom.ts";
import { makeRefusal } from "../results/refusals.ts";
import { createInstanceStore } from "../store/instanceStore.ts";
import { CurrencyIndicator } from "./CurrencyIndicator.tsx";
import { CURRENCY_STATES, deriveCurrencyState } from "./currencyState.ts";
import { ExecutionLabel } from "./ExecutionLabel.tsx";

const logger = getLogger("execution-labels");
const BEAD = "am-inst-execution-labels-5ywv";

function options() {
  return {
    experimentId: "bm-06",
    instanceId: "bm-06:currency-ui",
    initialParameters: { D: 1, seed: "0" },
    parameterClasses: { D: "input" as const, seed: "input" as const },
    outputs: {
      density: {
        statuses: ["value"] as const,
        unit: "1/m",
        semanticKind: "coordinate-density",
        ownerId: "diffusion.ftcs1d",
      },
    },
  };
}

const output = {
  quantityId: "density",
  unit: "1/m",
  semanticKind: "coordinate-density",
  ownerId: "diffusion.ftcs1d",
  status: "value" as const,
  value: 1,
};

describe("CurrencyIndicator: visually and textually distinguishable states", () => {
  test("each of the four states renders a unique heading, unique sentence, and unique data-currency-state", () => {
    const rendered = CURRENCY_STATES.map((state) => ({
      state,
      html: renderToStaticMarkup(createElement(CurrencyIndicator, { state })),
    }));
    const headings = rendered.map((row) => {
      const match = row.html.match(/execution-currency-heading">([^<]+)</);
      if (!match?.[1]) throw new Error(`missing heading for ${row.state}`);
      return match[1];
    });
    const texts = rendered.map((row) => {
      const match = row.html.match(/execution-currency-text">([^<]+)</);
      if (!match?.[1]) throw new Error(`missing text for ${row.state}`);
      return match[1];
    });
    const attrs = rendered.map((row) => {
      expect(row.html).toContain(`data-currency-state="${row.state}"`);
      return row.state;
    });
    expect(new Set(headings).size).toBe(4);
    expect(new Set(texts).size).toBe(4);
    expect(new Set(attrs).size).toBe(4);
    expect(rendered.find((row) => row.state === "stale")?.html).toContain("Not current");
    expect(rendered.find((row) => row.state === "running")?.html).toContain("in progress");
    expect(rendered.find((row) => row.state === "refused")?.html).toContain("refused");
    expect(rendered.find((row) => row.state === "accepted")?.html).toContain("match the current");
    logger.log({
      testId: "currency-indicator-four-texts",
      beadId: BEAD,
      extra: { headings, texts },
      outcome: "passed",
      message: "four currency states have distinct visible text",
    });
  });

  test("a refused indicator shows the registry sentence and never the code", () => {
    const refusal = makeRefusal("invalid-parameter", { parameterIds: ["D"] });
    const html = renderToStaticMarkup(
      createElement(CurrencyIndicator, { state: "refused", refusal }),
    );
    expect(html).toContain('data-refusal-code="invalid-parameter"');
    expect(html).toContain("stated requirements");
    const visible = html.replace(/data-refusal-code="[^"]+"/g, "");
    expect(visible).not.toContain("invalid-parameter");
  });

  test("the engine label stays on the last accepted wording while currency is running or stale", () => {
    const running = renderToStaticMarkup(
      createElement("div", null, [
        createElement(ExecutionLabel, { key: "label", state: "host-accepted" }),
        createElement(CurrencyIndicator, { key: "currency", state: "running" }),
      ]),
    );
    expect(running).toContain("Ideal model, host calculation");
    expect(running).toContain('data-currency-state="running"');
    const stale = renderToStaticMarkup(
      createElement("div", null, [
        createElement(ExecutionLabel, { key: "label", state: "host-accepted" }),
        createElement(CurrencyIndicator, { key: "currency", state: "stale" }),
      ]),
    );
    expect(stale).toContain("Ideal model, host calculation");
    expect(stale).toContain('data-currency-state="stale"');
  });
});

describe("CurrencyIndicator: stale is reachable from the real store, not a fixture object", () => {
  beforeEach(async () => {
    await installDom();
  });
  afterEach(async () => {
    await uninstallDom();
  });

  test("pause after setup-change renders data-currency-state=stale in the DOM", async () => {
    const store = createInstanceStore(options());
    const first = store.issue("setup-change");
    store.publish({ ...first, stepIndex: 0, simulationTime: 0, final: true, outputs: [output] });
    store.issue("setup-change", { D: 2 });
    store.pause();
    const view = store.getSnapshot();
    const currency = deriveCurrencyState(view);
    expect(currency).toBe("stale");

    const container = createContainer();
    const root = createRoot(container);
    try {
      await act(() => {
        root.render(createElement(CurrencyIndicator, { state: "stale", refusal: view.refusal }));
      });
      const element = container.querySelector("[data-currency-state]");
      if (!element) throw new Error("expected a currency indicator in the DOM");
      expect(element.getAttribute("data-currency-state")).toBe("stale");
      expect(element.textContent).toContain("Not current");
      expect(element.textContent).toContain("earlier accepted inputs");
      logger.log({
        testId: "currency-stale-reachable-in-dom",
        beadId: BEAD,
        inputRevision: view.requested?.revisions.input,
        acceptedInputRevision: view.accepted?.revisions.input,
        extra: { currencyState: "stale" },
        outcome: "passed",
        message: "stale currency rendered from a paused store view",
      });
    } finally {
      await act(() => {
        root.unmount();
      });
      removeContainer(container);
    }
  });
});

afterAll(async () => {
  await logger.flush();
});
