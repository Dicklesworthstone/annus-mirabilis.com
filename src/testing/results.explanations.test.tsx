import { describe, it } from "bun:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import {
  containsIdentifierLeak,
  containsPhysicalWording,
  explainOutcome,
  explainRefusal,
  explainResult,
} from "../experiments/results/explanations.ts";
import { statusEnumIds } from "../experiments/results/ids.ts";
import {
  type ExecutionOutcome,
  type ExecutionOutcomeId,
  executionOutcomeRegistry,
} from "../experiments/results/outcomes.ts";
import {
  budgetExhaustedOutcomeExample,
  ftcsUnstableRefusalExample,
  lq02DivergentExample,
  planStatusExamples,
  valueExample,
} from "../experiments/results/planExamples.ts";
import { ResultStatusNote } from "../experiments/results/ResultStatusNote.tsx";
import { ResultValue } from "../experiments/results/ResultValue.tsx";
import { type RefusalCode, refusalCodeRegistry } from "../experiments/results/refusalCodes.ts";
import { makeRefusal } from "../experiments/results/refusals.ts";

describe("results.explanations: Reader-Facing Language & ResultStatusNote Component", () => {
  it("every output status resolves generic message and a next action", () => {
    for (const example of planStatusExamples) {
      const exp = explainResult(example);
      assert.ok(exp.message.length > 0, `Empty message for ${example.status}`);
      assert.ok(exp.nextAction.length > 0, `Empty nextAction for ${example.status}`);

      // Ensure no raw status enum leak in message or action
      const leaks = containsIdentifierLeak(`${exp.message} ${exp.nextAction}`, statusEnumIds);
      assert.deepEqual(
        leaks,
        [],
        `Status ${example.status} explanation leaked enum IDs: ${leaks.join(", ")}`,
      );
    }
  });

  it("every refusal code resolves a reader message and a repair action", () => {
    for (const code of Object.keys(refusalCodeRegistry) as RefusalCode[]) {
      const refusal = makeRefusal(code, { parameterIds: ["testParam"] });
      const exp = explainRefusal(refusal);
      assert.ok(exp.message.length > 0, `Empty message for refusal ${code}`);
      assert.ok(exp.nextAction.length > 0, `Empty nextAction for refusal ${code}`);

      // Ensure no raw refusal code leakage in reader strings
      const leaks = containsIdentifierLeak(`${exp.message} ${exp.nextAction}`, statusEnumIds);
      assert.deepEqual(
        leaks,
        [],
        `Refusal ${code} explanation leaked enum IDs: ${leaks.join(", ")}`,
      );

      // Enforce no-physical-wording check on numerical and input refusals
      const domain = refusalCodeRegistry[code].domainKind;
      if (domain === "numerical" || domain === "input") {
        assert.equal(
          containsPhysicalWording(`${exp.message} ${exp.nextAction}`),
          false,
          `Numerical/input refusal ${code} makes physical claim: "${exp.message}"`,
        );
      }
    }
  });

  it("every execution outcome resolves reader text in software language with retry guidance", () => {
    for (const outcomeId of Object.keys(executionOutcomeRegistry) as ExecutionOutcomeId[]) {
      const outcome: ExecutionOutcome =
        outcomeId === "budget-exhausted"
          ? {
              outcome: "budget-exhausted",
              ...executionOutcomeRegistry["budget-exhausted"],
              requested: { workUnits: 100, allocationBytes: 1024 },
              allowed: { workUnits: 50, allocationBytes: 512 },
            }
          : {
              outcome: outcomeId,
              ...executionOutcomeRegistry[outcomeId],
            };
      const exp = explainOutcome(outcome);
      assert.ok(exp.message.length > 0, `Empty message for outcome ${outcomeId}`);
      assert.ok(exp.nextAction.length > 0, `Empty nextAction for outcome ${outcomeId}`);

      // Ensure no physical claims in software execution outcomes
      assert.equal(
        containsPhysicalWording(`${exp.message} ${exp.nextAction}`),
        false,
        `Outcome ${outcomeId} makes physical claim: "${exp.message}"`,
      );

      // Ensure no identifier leak
      const leaks = containsIdentifierLeak(`${exp.message} ${exp.nextAction}`, statusEnumIds);
      assert.deepEqual(
        leaks,
        [],
        `Outcome ${outcomeId} explanation leaked enum IDs: ${leaks.join(", ")}`,
      );
    }
  });

  it("divergent text is distinct from every execution-outcome text and makes model statement", () => {
    const divExp = explainResult(lq02DivergentExample);
    assert.ok(divExp.message.includes("classical spectral energy density"));
    assert.ok(divExp.nextAction.includes("frequencyCutoff"));

    // Verify divergent is distinct from every execution outcome message
    for (const outcomeId of Object.keys(executionOutcomeRegistry) as ExecutionOutcomeId[]) {
      const outcome: ExecutionOutcome =
        outcomeId === "budget-exhausted"
          ? {
              outcome: "budget-exhausted",
              ...executionOutcomeRegistry["budget-exhausted"],
              requested: { workUnits: 100, allocationBytes: 1024 },
              allowed: { workUnits: 50, allocationBytes: 512 },
            }
          : {
              outcome: outcomeId,
              ...executionOutcomeRegistry[outcomeId],
            };
      const outExp = explainOutcome(outcome);
      assert.notEqual(divExp.message, outExp.message);
      assert.notEqual(divExp.nextAction, outExp.nextAction);
    }
  });

  it("ResultStatusNote renders static HTML with snapshotVersion and NO live region (no aria-live)", () => {
    const html = renderToStaticMarkup(
      <ResultStatusNote
        result={lq02DivergentExample}
        snapshotVersion={42}
        className="custom-note"
      />,
    );

    assert.ok(html.includes('data-snapshot-version="42"'), "Missing data-snapshot-version");
    assert.ok(html.includes('data-result-status="divergent"'), "Missing data-result-status");
    assert.ok(html.includes("custom-note"), "Missing className");
    assert.ok(html.includes("result-status-message"), "Missing message container");
    assert.ok(html.includes("result-status-action"), "Missing action container");

    // CRITICAL REQUIREMENT 10: ResultStatusNote must NOT render aria-live (owned by a11y policy)
    assert.equal(html.includes("aria-live"), false, "ResultStatusNote must NOT contain aria-live");
  });

  it("ResultStatusNote renders refusals and execution outcomes properly", () => {
    const refusalHtml = renderToStaticMarkup(
      <ResultStatusNote refusal={ftcsUnstableRefusalExample} snapshotVersion={10} />,
    );
    assert.ok(refusalHtml.includes('data-refusal-code="ftcs-unstable"'));
    assert.ok(refusalHtml.includes("explicit diffusion scheme"));
    assert.equal(refusalHtml.includes("aria-live"), false);

    const outcomeHtml = renderToStaticMarkup(
      <ResultStatusNote outcome={budgetExhaustedOutcomeExample} snapshotVersion={11} />,
    );
    assert.ok(outcomeHtml.includes('data-outcome="budget-exhausted"'));
    assert.ok(outcomeHtml.includes("exceeds the declared work"));
    assert.equal(outcomeHtml.includes("aria-live"), false);
  });

  it("ResultValue shows a finite number for value payloads and a status note otherwise", () => {
    const valueHtml = renderToStaticMarkup(
      <ResultValue result={valueExample} snapshotVersion={7} />,
    );
    assert.ok(valueHtml.includes("result-value"));
    assert.ok(valueHtml.includes('data-snapshot-version="7"'));
    assert.equal(valueHtml.includes("aria-live"), false);
    const leaks = containsIdentifierLeak(valueHtml.replace(/<[^>]+>/g, " "), statusEnumIds);
    assert.deepEqual(leaks, []);

    const noteHtml = renderToStaticMarkup(
      <ResultValue result={lq02DivergentExample} snapshotVersion={8} />,
    );
    assert.ok(noteHtml.includes("result-status-message"));
    assert.ok(noteHtml.includes("classical spectral energy density"));
    assert.equal(noteHtml.includes("NaN"), false);
    assert.equal(noteHtml.includes("Infinity"), false);
  });
});
