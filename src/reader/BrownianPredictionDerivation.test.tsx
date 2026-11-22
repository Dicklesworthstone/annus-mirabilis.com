import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { enrichBrownianPrediction } from "../content/results/predictionReconstruction.ts";
import { verifyBrownianPrediction } from "../equations/derivations/brownianPredictionProof.ts";
import { exportMarkup } from "../testing/exportMarkup.ts";
import { BrownianPredictionDerivation } from "./BrownianPredictionDerivation.tsx";
import { PaperReader } from "./PaperReader.tsx";

describe("Brownian prediction reading path", () => {
  test("the actual section joins the checked algebra and historical reconstruction before hydration", async () => {
    const html = await exportMarkup(await PaperReader({ section: "s5" }));
    expect(html).toContain('id="bm-prediction-derivation"');
    expect(html).toContain('data-prediction-proof="checked"');
    expect(html).toContain('data-constant-set="einstein-1905-brownian-printed"');
    expect(html).toContain("an editorial numerical input");
    expect(html).toContain("does not certify their historical rounding");
  });

  test("the complete formula join and source links render without client controls", () => {
    const html = renderToStaticMarkup(
      <BrownianPredictionDerivation
        report={enrichBrownianPrediction(verifyBrownianPrediction())}
      />,
    );
    expect(html).toContain('id="bm-prediction-derivation"');
    expect(html).toContain('data-prediction-proof="checked"');
    for (const anchor of ["eq-s5-d1", "eq-s5-d2", "eq-s5-d3", "eq-s5-d4", "s5-p2-s1", "s5-p2-s3"])
      expect(html).toContain(`href="/papers/brownian-motion/s5/#${anchor}"`);
    expect(html).toContain('href="/papers/brownian-motion/s4/#bm-gaussian-derivation"');
    expect(html).toContain('href="/lab/bm-01/"');
    expect(html).toContain("katex");
    expect(html).toContain('class="step-math" aria-label=');
    expect(html).not.toMatch(/<(button|input|select|textarea)(\s|>)/i);
  });

  test("radius and unit conversions stay visible beside the historical prediction", () => {
    const report = enrichBrownianPrediction(verifyBrownianPrediction());
    const html = renderToStaticMarkup(<BrownianPredictionDerivation report={report} />);
    expect(html).toContain("radius 0.5 micrometre = 5 × 10⁻⁷ m");
    expect(html).toContain("0.00135 Pa s; one poise is 0.1 Pa s");
    expect(html).toContain("290.15 K");
    expect(html).toContain("an editorial numerical input");
    expect(html).toContain("The same 6 × 10²³ per mole; no estimate is fitted here");
    expect(html).toContain('data-constant-set="einstein-1905-brownian-printed"');
    if (report.reconstruction?.status !== "value") throw new Error("Expected the historical rows.");
    for (const row of report.reconstruction.rows)
      expect(html).toContain(row.rmsMicrometres.toPrecision(6));
    expect(html).toContain("model predictions, not measured displacements");
    expect(html).toContain("does not certify their historical rounding");
  });

  test("an absent report retains the authored derivation without inventing numerical rows", () => {
    const html = renderToStaticMarkup(<BrownianPredictionDerivation />);
    expect(html).toContain('data-prediction-proof="unavailable"');
    expect(html).toContain("Exact check unavailable");
    expect(html).toContain("The numerical reconstruction is unavailable");
    expect(html).toContain('href="/papers/brownian-motion/s5/#eq-s5-d3"');
    expect(html).toContain("katex");
    expect(html).not.toContain("data-constant-set");
    expect(html).not.toContain("The conditional algebra checks pass");
  });

  test("a refused report exposes its reason and does not label the algebra checked", () => {
    const html = renderToStaticMarkup(
      <BrownianPredictionDerivation
        report={{
          passed: false,
          rows: [],
          refusalCode: "brownian-prediction-expression",
          reason: "The input molecular number changed identity.",
        }}
      />,
    );
    expect(html).toContain('data-prediction-proof="unavailable"');
    expect(html).toContain("The input molecular number changed identity.");
    expect(html).toContain("unavailable or refused");
    expect(html).not.toContain("The conditional algebra checks pass");
  });

  test("a missing numerical reconstruction does not erase a successful conditional algebra check", () => {
    const report = enrichBrownianPrediction(verifyBrownianPrediction());
    const html = renderToStaticMarkup(
      <BrownianPredictionDerivation
        report={{
          ...report,
          reconstruction: {
            status: "unavailable",
            reason: "The declared historical input set is incomplete.",
          },
        }}
      />,
    );
    expect(html).toContain('data-prediction-proof="checked"');
    expect(html).toContain("The declared historical input set is incomplete.");
    expect(html).not.toContain("data-constant-set");
  });
});
