import { expect, test } from "bun:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { BM06_DEFAULTS } from "../../experiments/bm06/definition.ts";
import { encodeResult } from "../../experiments/results/codec.ts";
import example from "../../generated/bm06-example.json";
import { evaluateBm06 } from "../../workers/operations/bm06.ts";
import { BrownianLab } from "./BrownianLab.tsx";

function readout(html: string, outputId: string): string | null {
  const start = html.indexOf(`<td data-output="${outputId}">`);
  if (start < 0) return null;
  return html
    .slice(html.indexOf(">", start) + 1, html.indexOf("</td>", start))
    .replace(/<!--[\s\S]*?-->/g, "");
}

test("the spreading readout uses copied D and labels the physical-settings value separately", async () => {
  const parameters = {
    ...BM06_DEFAULTS,
    t: 4,
    copiedDiffusivityInstanceId: "held-tracer",
    copiedDiffusivityRunId: "held-tracer-run",
    copiedDiffusivitySnapshotVersion: 7,
    copiedDiffusivityValue: 1.6e-12,
  };
  const evaluated = await evaluateBm06(parameters, { yieldControl: async () => {} });
  assert.equal(evaluated.kind, "accepted");
  if (evaluated.kind !== "accepted") return;
  const html = renderToStaticMarkup(
    <BrownianLab
      restoreFromLocation={false}
      example={{
        ...example,
        parameters,
        stepIndex: evaluated.data.stepIndex,
        simulationTime: evaluated.data.simulationTime,
        results: evaluated.data.outputs.map(encodeResult),
      }}
    />,
  );
  expect(readout(html, "activeDiffusionCoefficient")).toBe("1.6 μm²/s");
  expect(readout(html, "rmsDisplacement1d")).toBe("3.5777 μm");
  expect(readout(html, "diffusionCoefficient")).not.toBeNull();
  expect(readout(html, "diffusionCoefficient")).not.toBe("1.6 μm²/s");
  expect(html).toContain("Diffusion coefficient from physical settings (not used)");
  expect(html).toContain("a one-time value, not a live link");
});

test("ordinary physical settings show one governing diffusivity without an unused alternative", () => {
  const html = renderToStaticMarkup(<BrownianLab example={example} restoreFromLocation={false} />);
  expect(readout(html, "activeDiffusionCoefficient")).not.toBeNull();
  expect(readout(html, "diffusionCoefficient")).toBeNull();
  expect(html).not.toContain("physical settings (not used)");
  expect(html).toContain("D is calculated from these physical inputs.");
});
