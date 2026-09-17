import { describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { PredictPanel } from "../../components/lab/PredictPanel.tsx";
import { strictParse } from "../../content/schemas/strictParse.ts";
import { ME02_PREDICT_PROMPT } from "../me02/definition.ts";
import { beginPrompt, reveal, submitPrediction } from "./predictState.ts";

const noop = () => undefined;

/**
 * Adversarial check for the diffusivity candidate's separating assumption (Criterion 14).
 * Must state 1/sqrt(2) or 1/\sqrt{2}, 0.7071067812, and explicitly deny 0.5.
 */
export function verifyDiffusivityCandidateSentence(assumption: string): {
  ok: boolean;
  error?: string;
} {
  const hasRootTwo = assumption.includes("1/sqrt(2)") || assumption.includes("1/\\sqrt{2}");
  if (!hasRootTwo) {
    return { ok: false, error: "Must state 1/sqrt(2) or 1/\\sqrt{2}" };
  }

  if (!assumption.includes("0.7071067812")) {
    return { ok: false, error: "Must state exact factor 0.7071067812" };
  }

  const deniesHalf = /not\s+(by\s+)?0\.5/i.test(assumption);
  if (!deniesHalf) {
    return { ok: false, error: "Must explicitly deny 0.5 (e.g. 'not by 0.5')" };
  }

  // Adversarial check: ensure no affirmative claim that displacement halves remains
  const sanitized = assumption.replace(/not\s+(by\s+)?0\.5/gi, "");
  if (
    /(displacement\s+halves|displacement\s+becomes\s+half|multiplies(\s+\w+)*\s+by\s+0\.5)/i.test(
      sanitized,
    )
  ) {
    return {
      ok: false,
      error: "Adversarial copy check failed: sentence affirms that displacement halves",
    };
  }

  return { ok: true };
}

describe("predictReveal (am-inst-predict-mode-ti7m)", () => {
  test("chosen non-supported candidate renders its separating assumption once; unchosen candidates do not", () => {
    // ME02_PREDICT_PROMPT supported candidate is "larger".
    // Choose "smaller" (non-supported candidate)
    const record = reveal(
      submitPrediction(beginPrompt(ME02_PREDICT_PROMPT.promptId), {
        form: "candidate",
        candidateId: "smaller",
      }),
    );

    const html = renderToStaticMarkup(
      <PredictPanel
        prompt={ME02_PREDICT_PROMPT}
        record={record}
        onRecord={noop}
        onSkip={noop}
        onKeepToSelf={noop}
        onAmend={noop}
      />,
    );

    const smallerCand = ME02_PREDICT_PROMPT.candidates.find((c) => c.id === "smaller")!;
    const largerCand = ME02_PREDICT_PROMPT.candidates.find((c) => c.id === "larger")!;
    const equalCand = ME02_PREDICT_PROMPT.candidates.find((c) => c.id === "equal")!;

    // Chosen non-supported candidate assumption is rendered
    expect(html).toContain(smallerCand.separatingAssumption);

    // Unchosen candidates' assumptions are NOT rendered
    expect(html).not.toContain(equalCand.separatingAssumption);
    expect(html).not.toContain(largerCand.separatingAssumption);
  });

  test("supported candidate does not render a separating assumption miss explanation", () => {
    // Choose "larger" (supported candidate)
    const record = reveal(
      submitPrediction(beginPrompt(ME02_PREDICT_PROMPT.promptId), {
        form: "candidate",
        candidateId: "larger",
      }),
    );

    const html = renderToStaticMarkup(
      <PredictPanel
        prompt={ME02_PREDICT_PROMPT}
        record={record}
        onRecord={noop}
        onSkip={noop}
        onKeepToSelf={noop}
        onAmend={noop}
      />,
    );

    expect(html).toContain("This is the relation the model supports.");
    for (const c of ME02_PREDICT_PROMPT.candidates) {
      expect(html).not.toContain(c.separatingAssumption);
    }
  });

  test("diffusivity candidate in bm-01.yaml states 1/sqrt(2), 0.7071067812, and denies 0.5", () => {
    const yamlPath = path.resolve(process.cwd(), "content/experiments/bm-01.yaml");
    const raw = strictParse(fs.readFileSync(yamlPath, "utf8"), "yaml") as any;

    const viscosityPrompt = raw.predictMode.prompts.find(
      (p: any) => p.promptId === "bm-01-predict-viscosity",
    );
    expect(viscosityPrompt).toBeDefined();

    const halfCand = viscosityPrompt.candidates.find(
      (c: any) => c.id === "bm-01-predict-viscosity-half",
    );
    expect(halfCand).toBeDefined();

    const assumption = halfCand.separatingAssumption;
    expect(assumption).toContain("1/sqrt(2)");
    expect(assumption).toContain("0.7071067812");
    expect(assumption).toContain("not by 0.5");

    const verdict = verifyDiffusivityCandidateSentence(assumption);
    expect(verdict.ok).toBe(true);
  });

  test("adversarial copy check fails planted negative sentences claiming displacement halves", () => {
    const planted1 = "Assumes that halving D multiplies the typical displacement by 0.5.";
    expect(verifyDiffusivityCandidateSentence(planted1).ok).toBe(false);

    const planted2 = "When viscosity doubles, diffusivity halves and the displacement halves.";
    expect(verifyDiffusivityCandidateSentence(planted2).ok).toBe(false);

    const planted3 =
      "That would hold if displacement were proportional to D, so displacement becomes half as large.";
    expect(verifyDiffusivityCandidateSentence(planted3).ok).toBe(false);
  });
});
