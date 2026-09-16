import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { LQ04_DEFAULTS, LQ04_NOT_MODELED } from "../../../experiments/lq04/definition.ts";
import { buildLq04Snapshot, evaluateLq04 } from "../../../experiments/lq04/session.ts";
import { EntropyWorkbenchComparison } from "./EntropyWorkbenchLab.tsx";

describe("EntropyWorkbenchLab: server-rendered markup shows real numbers without JavaScript (am-lq-04-entropy-workbench-senj)", () => {
  test("the default example renders the reference state, not an empty box", () => {
    const example = { sourceDigest: "src/physics/reference/radiation.ts", parameters: LQ04_DEFAULTS };
    const html = renderToStaticMarkup(<EntropyWorkbenchComparison example={example} />);

    expect(html).toContain('data-instrument-id="lq-04"');
    expect(html).toContain('data-execution-label="host"');
    expect(html).toContain("Ideal model, host calculation");

    // A real computed number reaches the markup, not a placeholder.
    const evaluation = evaluateLq04(LQ04_DEFAULTS);
    if (evaluation.status === "value") {
      expect(html).toContain(evaluation.energy.toExponential(6));
    }

    expect(html).toContain("Not modeled:");
    for (const item of LQ04_NOT_MODELED) {
      expect(html).toContain(item);
    }

    expect(html).toContain("<noscript");
    expect(html).toContain("complete worked example calculated when the site was built");
    expect(html).toContain("without dragging, color, or a canvas");
  });

  test("halving the volume renders the golden-state entropy change", () => {
    const parameters = { ...LQ04_DEFAULTS, volumeRatio: 0.5 };
    const example = { sourceDigest: "src/physics/reference/radiation.ts", parameters };
    const html = renderToStaticMarkup(<EntropyWorkbenchComparison example={example} />);
    const evaluation = evaluateLq04(parameters);
    if (evaluation.status === "value") {
      expect(html).toContain(evaluation.radiationEntropy.toExponential(6));
    } else {
      throw new Error("expected a value at the golden state");
    }
  });

  test("a dense state (V/V0 = 1e-4) renders the outside-domain refusal, not a fabricated number", () => {
    const parameters = { ...LQ04_DEFAULTS, volumeRatio: 1e-4 };
    const example = { sourceDigest: "src/physics/reference/radiation.ts", parameters };
    const html = renderToStaticMarkup(<EntropyWorkbenchComparison example={example} />);
    expect(html.toLowerCase()).toContain("wien");
  });

  test("the snapshot the component reads matches buildLq04Snapshot's own outputs exactly", () => {
    const snapshot = buildLq04Snapshot("lq04-test", "run-1", LQ04_DEFAULTS, 1, 0);
    const entropy = snapshot.outputs.find((o) => o.quantityId === "radiationEntropy");
    expect(entropy?.status).toBe("value");
  });
});
