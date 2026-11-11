import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import {
  MASS_ENERGY_LATER_EVIDENCE,
  MASS_ENERGY_SHELF_CARDS,
} from "../../content/massEnergyShelf.ts";
import { validateJourney } from "../../content/schemas/journey.ts";
import { evaluateMe01 } from "../../physics/reference/massEnergy.ts";
import { stepsLine } from "../cards/CardDetail.tsx";
import { validateCardCitation } from "../cards/cardRules.ts";
import { checkJourney } from "../checks/journeyChecks.ts";
import { REAL_JOURNEYS } from "../journeys/realJourneys.ts";
import { SHELF_CARD_CONTEXT } from "../journeys/shelves.ts";
import { MassEnergyStage } from "./MassEnergyStage.tsx";
import {
  COEFFICIENT_STAGE,
  MASS_ENERGY_STAGES,
  SUBTRACTION_STAGE,
  SYMMETRIC_EMISSION_STAGE,
  TWO_LEDGERS_STAGE,
} from "./stages.ts";

const journey = REAL_JOURNEYS.find((record) => record.paper === "mass-energy");
// These are published anchors and the order of the argument, not a target census.
const ARGUMENT_ANCHORS = ["step-01", "step-02", "step-03", "step-04", "step-05"];

describe("mass-energy's authored discovery stages (am-4k0m)", () => {
  test("the real journey carries the published argument in order and completes its authored skeleton", () => {
    expect(journey).toBeDefined();
    const parsed = validateJourney(journey);
    expect(parsed.stages.map((stage) => stage.id)).toEqual(ARGUMENT_ANCHORS);
    expect(parsed.completeness).toBe("complete");
    expect(parsed.pendingElements ?? []).toEqual([]);
    const findings = checkJourney(parsed, { cards: SHELF_CARD_CONTEXT });
    expect(findings.filter((finding) => finding.severity === "error")).toEqual([]);
    console.log(
      `[mass-energy stages] ${parsed.stages.length} authored argument stages; ${parsed.stages.reduce(
        (total, stage) => total + stage.premiseRefs.length,
        0,
      )} premise references checked`,
    );
  });

  test("every stage's premises are real shelf cards admitted in both directions", () => {
    const ids = new Set(ARGUMENT_ANCHORS);
    const imports = journey?.admittedImports?.map((entry) => entry.importId) ?? [];
    for (const stage of MASS_ENERGY_STAGES) {
      expect(stage.premiseRefs.length).toBeGreaterThan(0);
      for (const reference of stage.premiseRefs) {
        const card = MASS_ENERGY_SHELF_CARDS.find((entry) => entry.id === reference.cardId);
        expect(card, `${stage.id}: ${reference.cardId}`).toBeDefined();
        if (!card) continue;
        const source = card.sources[0];
        expect(
          typeof source === "object" &&
            source !== null &&
            "title" in source &&
            typeof source.title === "string" &&
            source.title.length > 0,
        ).toBe(true);
        expect(
          validateCardCitation(
            card,
            { stageId: stage.id, journeyId: "mass-energy", journeyAdmittedImports: imports },
            ids,
          ),
        ).toEqual([]);
        if (card.date.latestYear > 1904) {
          expect(reference.importId).toBe(card.id);
          expect(imports).toContain(card.id);
        }
      }
      for (const reason of stage.reasoning) {
        expect(stage.prerequisites).toContain(reason.foundationId);
        expect(existsSync(`content/foundations/${reason.foundationId}.json`)).toBe(true);
      }
    }
    expect(
      stepsLine(
        TWO_LEDGERS_STAGE.premiseRefs.flatMap((reference) => {
          const card = MASS_ENERGY_SHELF_CARDS.find((entry) => entry.id === reference.cardId);
          return reference.importId ? [...(card?.admittedStages ?? [])] : [];
        }),
      ),
    ).toBe("Steps 3, 4 and 5 of this route");
  });

  test("the renderer consumes the supplied narrative rather than a second hand-written copy", () => {
    const replacement = "This changed narrative reaches the reader from the stage record.";
    const changed = renderToStaticMarkup(
      <MassEnergyStage
        stage={{
          ...SYMMETRIC_EMISSION_STAGE,
          support: { ...SYMMETRIC_EMISSION_STAGE.support, explanation: replacement },
        }}
      />,
    );
    expect(changed).toContain(replacement);
    expect(changed).not.toContain("Put a body at rest in front of you");
  });

  test("the worked ledger values agree with the real owner and relaxing the offset does not invent kinetic energy", () => {
    const input = {
      emittedEnergyRestFrame: 10,
      frameSpeed: 0.6,
      emissionAngle: 0,
      premise: "unchanged" as const,
    };
    const accepted = evaluateMe01(input);
    expect(accepted.restBalanceLight).toMatchObject({ status: "value", value: 10 });
    expect(accepted.movingBalanceLight).toMatchObject({ status: "value", value: 12.5 });
    expect(accepted.kineticEnergyDifference.status).toBe("value");
    if (accepted.kineticEnergyDifference.status === "value") {
      expect(accepted.kineticEnergyDifference.value).toBeCloseTo(2.5, 12);
    }
    expect(TWO_LEDGERS_STAGE.support.workedExample.steps.join(" ")).toContain("12.5 joules");
    expect(SUBTRACTION_STAGE.support.workedExample.result).toContain("2.5 joules");
    const relaxed = evaluateMe01({ ...input, premise: "relaxed" });
    expect(relaxed.kineticEnergyDifference.status).toBe("underdetermined");
    expect(relaxed.subtractionDifference.status).toBe("value");
    expect(SUBTRACTION_STAGE.support.transferCase.whatChanges).toContain("undetermined");
    expect(COEFFICIENT_STAGE.meanings.modelStatus).toBe("approximation");
    expect(COEFFICIENT_STAGE.support.partialComparison.explanation).toContain(
      "not a quotient evaluated at zero",
    );
  });

  test("removing the 1905 import declaration is refused on the actual stages", () => {
    const parsed = validateJourney(journey);
    const planted = { ...parsed, admittedImports: [] };
    expect(
      checkJourney(planted, { cards: SHELF_CARD_CONTEXT }).map((finding) => finding.rule),
    ).toContain("stage-unadmitted-import");
  });

  test("a later measurement cannot become a premise of the historical argument", () => {
    const later = MASS_ENERGY_LATER_EVIDENCE.find(
      (card) => card.id === "cockcroft-walton-1932-lithium",
    );
    expect(later).toBeDefined();
    if (!later) return;
    const parsed = validateJourney(journey);
    const planted = {
      ...parsed,
      stages: parsed.stages.map((stage) =>
        stage.id === "step-03"
          ? { ...stage, premiseRefs: [...stage.premiseRefs, { cardId: later.id }] }
          : stage,
      ),
    };
    const findings = checkJourney(planted, {
      cards: {
        ...SHELF_CARD_CONTEXT,
        [later.id]: { id: later.id, status: later.status, date: later.date },
      },
    });
    expect(
      findings.some(
        (finding) =>
          finding.rule === "shelf-date-violation" &&
          finding.path === "journey.stages[2].premiseRefs",
      ),
    ).toBe(true);
  });
});
