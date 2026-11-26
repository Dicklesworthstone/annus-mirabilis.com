import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { decodeMe01Settings } from "../experiments/me01/permalink.ts";
import { createMe01Session } from "../experiments/me01/session.ts";
import { PaperPage } from "../reader/PaperPage.tsx";
import { exportMarkup } from "../testing/exportMarkup.ts";
import { MassEnergyStepSource } from "./MassEnergyStepSource.tsx";
import {
  ARGUMENT_STEPS,
  type ArgumentStepId,
  assessArgument,
  CONSISTENCY_ARGUMENT,
  WORKED_ARGUMENT,
} from "./massEnergyArgument.ts";
import { argumentLedgerHandoff } from "./massEnergyArgumentHandoff.ts";

test("each card's citation reaches its printed sentence or display in the English edition", async () => {
  const september = await exportMarkup(await PaperPage({ paperId: "mass-energy", face: "english" }));
  const june = await exportMarkup(await PaperPage({ paperId: "special-relativity", face: "english" }));
  expect(ARGUMENT_STEPS).toHaveLength(16);
  for (const card of ARGUMENT_STEPS) {
    const citation = renderToStaticMarkup(<MassEnergyStepSource card={card} />);
    expect(citation).toContain(`href="/papers/mass-energy/view/english/#${card.source.anchor}"`);
    expect(september).toContain(`id="${card.source.anchor}"`);
    if (card.id === "light-transform") {
      expect(citation).toContain('href="/papers/special-relativity/view/english/#eq-s8-d4"');
      expect(june).toContain('id="eq-s8-d4"');
    }
    if (card.id === "assume-rest-energy" || card.id === "rest-energy-check") {
      expect(citation).toContain("Modern comparison");
    }
  }
});

function linkedKineticResult(order: readonly ArgumentStepId[]) {
  const handoff = argumentLedgerHandoff(assessArgument(order));
  if (!handoff) throw new Error("Expected a two-ledger handoff");
  const parsed = decodeMe01Settings(new URL(handoff.href, "https://example.test").search);
  if (parsed.kind !== "settings") throw new Error("Expected valid laboratory settings");
  const lab = createMe01Session();
  expect(lab.apply(parsed.parameters).kind).toBe("accepted");
  return lab.evaluate(lab.acceptedParameters()).kineticEnergyDifference;
}

test("the laboratory calculation follows supported premises, including a blocked or removed offset", () => {
  const relaxed = WORKED_ARGUMENT.filter((id) => id !== "unchanged-offset");
  const misplaced: ArgumentStepId[] = ["unchanged-offset", ...relaxed];
  expect(linkedKineticResult(relaxed).status).toBe("underdetermined");
  expect(linkedKineticResult(misplaced).status).toBe("underdetermined");
  expect(linkedKineticResult([...relaxed, "unchanged-offset"]).status).toBe("underdetermined");
  const held = linkedKineticResult(WORKED_ARGUMENT);
  expect(held.status).toBe("value");
  if (held.status === "value") {
    expect(typeof held.value).toBe("number");
    if (typeof held.value === "number") expect(held.value).toBeCloseTo(0.25);
  }
  const withoutFinalSubstitution = WORKED_ARGUMENT.filter((id) => id !== "kinetic-drop");
  expect(assessArgument(withoutFinalSubstitution).outcome).toBe("offset-fixed");
  expect(linkedKineticResult(withoutFinalSubstitution).status).toBe("value");
});

test("an incomplete balance or a rest-energy consistency check cannot supply the laboratory premises", () => {
  for (const order of [[], CONSISTENCY_ARGUMENT, WORKED_ARGUMENT.filter((id) => id !== "kinetic-offset")]) {
    expect(argumentLedgerHandoff(assessArgument(order))).toBeNull();
  }
});
