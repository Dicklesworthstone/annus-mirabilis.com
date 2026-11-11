import { describe, expect, test } from "bun:test";
import { checkVoice } from "../../content/checks/voice/index.ts";
import { constantValue, getConstantSet } from "../../physics/reference/constants.ts";
import { boostMatrixXT } from "../../physics/reference/kinematics.ts";
import { type AnswerVerdict, checkExerciseAnswer, snapshotExercise } from "../exercises/answer.ts";
import { explanationOutcome } from "../exercises/explanation.ts";
import {
  checkNumericAnswer,
  ExerciseReferenceError,
  numericPartProblems,
} from "../exercises/numeric.ts";
import {
  APPROACHING_FACTOR,
  BACKWARD_EIGENVALUE,
  DOPPLER_EXPRESSION,
  DOPPLER_REFERENCES,
  dopplerReferences,
  FORWARD_EIGENVALUE,
  RECEDING_FACTOR,
} from "./doppler.ts";
import {
  ENERGY_EQUIVALENT,
  ENERGY_EQUIVALENT_EXPLANATION,
  quantumEnergyEquivalent,
} from "./effectiveMass.ts";
import { CONNECTION_EXERCISE_LINKS, CROSS_JOURNEY_EXERCISES } from "./records.ts";
import { STATISTICAL_EXERCISE, STATISTICAL_EXPLANATION } from "./statistical.ts";

const status = (verdict: AnswerVerdict) =>
  verdict.kind === "checked" ? verdict.outcome.status : verdict.kind;

describe("Doppler factors and light-line eigenvalues", () => {
  test("both numeric comparisons distinguish direction and the sign of a whole eigenvector", () => {
    expect(DOPPLER_REFERENCES.receding.value).toBeCloseTo(0.5, 14);
    expect(DOPPLER_REFERENCES.approaching.value).toBeCloseTo(2, 14);
    for (const part of [RECEDING_FACTOR, FORWARD_EIGENVALUE]) {
      expect(checkNumericAnswer(part, "0.5", "1").kind).toBe("agrees");
      expect(checkNumericAnswer(part, "2", "1").kind).toBe("differs");
    }
    for (const part of [APPROACHING_FACTOR, BACKWARD_EIGENVALUE]) {
      expect(checkNumericAnswer(part, "2", "1").kind).toBe("agrees");
      expect(checkNumericAnswer(part, "0.5", "1").kind).toBe("differs");
      expect(checkNumericAnswer(part, "-2", "1").kind).toBe("differs");
    }
    expect(checkNumericAnswer(RECEDING_FACTOR, "0.5", "1/mol").kind).toBe("input-error");
  });

  test("both coordinates of each real boost eigenvector scale by the matching wave factor", () => {
    const c = constantValue(getConstantSet("modern-si-2019"), "speedOfLight").value;
    for (const beta of [-0.95, -0.6, -0.1, 0, 0.3, 0.6, 0.95]) {
      const refs = dopplerReferences(beta);
      const boost = boostMatrixXT(beta, c);
      expect(boost.status).toBe("value");
      if (boost.status !== "value") continue;
      for (const direction of [1, -1] as const) {
        const factor = direction === 1 ? refs.receding.value : refs.approaching.value;
        const eigenvalue = direction === 1 ? refs.forwardLightLine : refs.backwardLightLine;
        // Independently inspect both rows in the owner's (x,t) coordinates. A time-row-only
        // fixture would miss a sign/order error in how the full eigenvector is displayed.
        const transformedX =
          (boost.value[0]?.[0] ?? NaN) * direction * c + (boost.value[0]?.[1] ?? NaN);
        const transformedT =
          (boost.value[1]?.[0] ?? NaN) * direction * c + (boost.value[1]?.[1] ?? NaN);
        expect(transformedX / (direction * c)).toBeCloseTo(factor, 12);
        expect(transformedT).toBeCloseTo(factor, 12);
        expect(eigenvalue.value).toBeCloseTo(factor, 12);
        expect(eigenvalue.owner).toBe("kinematics.boostMatrixXT");
      }
      expect(refs.receding.value).toBeCloseTo(Math.sqrt((1 - beta) / (1 + beta)), 12);
      expect(refs.receding.value * refs.approaching.value).toBeCloseTo(1, 12);
    }
  });

  test("equivalent expressions agree while reversed direction and missing gamma do not", async () => {
    expect(snapshotExercise(DOPPLER_EXPRESSION).domains.beta).toEqual({
      min: -0.95,
      max: 0.95,
      scale: "linear",
    });
    for (const source of ["sqrt((1-beta)/(1+beta))", "(1-beta)/sqrt(1-beta^2)"])
      expect(status(await checkExerciseAnswer(DOPPLER_EXPRESSION, source))).toBe("equivalent");
    for (const source of ["sqrt((1+beta)/(1-beta))", "1-beta"])
      expect(status(await checkExerciseAnswer(DOPPLER_EXPRESSION, source))).toBe("not-equivalent");
  });

  test("nonphysical relative speeds cannot become finite exercise references", () => {
    for (const beta of [-1, 1, 1.01, Number.NaN, Number.POSITIVE_INFINITY])
      expect(() => dopplerReferences(beta)).toThrow(ExerciseReferenceError);
  });
});

describe("the modern energy-equivalent comparison", () => {
  test("500 nm gives h/(lambda c), accepts mass-unit conversion and rejects a zero photon-mass answer", () => {
    const reference = ENERGY_EQUIVALENT.reference;
    expect(reference.value / 4.420438188608467e-36).toBeCloseTo(1, 14);
    expect(reference.resultStatus).toBe("analytic-limit");
    expect(reference.constantSetId).toBe("modern-si-2019");
    expect(reference.owner).toContain("photoelectric.quantumEnergy");
    expect(reference.owner).toContain("massEnergy.limitingCoefficient");
    expect(checkNumericAnswer(ENERGY_EQUIVALENT, "4.4204e-36", "kg").kind).toBe("agrees");
    expect(checkNumericAnswer(ENERGY_EQUIVALENT, "4.4204e-33", "g").kind).toBe("agrees");
    expect(checkNumericAnswer(ENERGY_EQUIVALENT, "0", "kg").kind).toBe("differs");
    expect(checkNumericAnswer(ENERGY_EQUIVALENT, "4.4204e-33", "kg").kind).toBe("differs");
    expect(quantumEnergyEquivalent(1000e-9).value / reference.value).toBeCloseTo(0.5, 14);
  });

  test("invalid wavelengths are refused through the real evaluator boundary", () => {
    for (const wavelength of [0, -500e-9, Number.NaN, Number.POSITIVE_INFINITY])
      expect(() => quantumEnergyEquivalent(wavelength)).toThrow(ExerciseReferenceError);
  });

  test("the explanation keeps invariant mass, momentum balance and historical dependence distinct", () => {
    expect(explanationOutcome(ENERGY_EQUIVALENT_EXPLANATION).kind).toBe("needs-human-reading");
    expect(ENERGY_EQUIVALENT_EXPLANATION.criteria.join(" ")).toContain("zero invariant mass");
    expect(ENERGY_EQUIVALENT_EXPLANATION.workedExplanation).toContain("may recoil");
    expect(ENERGY_EQUIVALENT_EXPLANATION.workedExplanation).toContain("not a quantum hypothesis");
  });
});

describe("four authored tasks use the shared checker contracts", () => {
  test("stable anchors match the course links, and every answer part is admitted", () => {
    expect(CROSS_JOURNEY_EXERCISES.map((exercise) => exercise.id)).toEqual(
      CONNECTION_EXERCISE_LINKS.map((link) => link.id),
    );
    const ids: string[] = [];
    for (const exercise of CROSS_JOURNEY_EXERCISES)
      for (const section of exercise.sections)
        for (const entry of section.parts) {
          ids.push(entry.part.id);
          if (entry.kind === "numeric") {
            expect(numericPartProblems(entry.part)).toEqual([]);
            expect(
              checkNumericAnswer(
                entry.part,
                String(entry.part.reference.value),
                entry.part.units[0] ?? "",
              ).kind,
            ).toBe("agrees");
          } else if (entry.kind === "expression") {
            expect(() => snapshotExercise(entry.part)).not.toThrow();
          } else {
            expect(explanationOutcome(entry.part).kind).toBe("needs-human-reading");
          }
        }
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("the statistical comparison is verbal and distinguishes a heuristic from a conditional prediction", () => {
    expect(
      STATISTICAL_EXERCISE.sections.flatMap((section) => section.parts).map((entry) => entry.kind),
    ).toEqual(["explanation"]);
    expect(explanationOutcome(STATISTICAL_EXPLANATION).kind).toBe("needs-human-reading");
    expect(STATISTICAL_EXPLANATION.criteria.join(" ")).toContain("Wien regime");
    expect(STATISTICAL_EXPLANATION.criteria.join(" ")).toContain(
      "predicts an observable displacement law",
    );
    expect(STATISTICAL_EXPLANATION.criteria.join(" ")).toContain("independent information");
    expect(STATISTICAL_EXPLANATION.workedExplanation).toContain("missing empirical test");
  });

  test("all task prose and worked feedback pass the existing editorial voice checker", () => {
    const prose = CROSS_JOURNEY_EXERCISES.flatMap((exercise) => [
      exercise.title,
      ...exercise.introduction,
      ...exercise.links.map((link) => link.label),
      ...exercise.sections.flatMap((section) => [
        section.title,
        ...section.paragraphs,
        ...(section.links ?? []).map((link) => link.label),
        ...section.parts.flatMap((entry) => [
          entry.part.prompt,
          entry.part.workedExplanation,
          ...(entry.kind === "explanation" ? entry.part.criteria : []),
        ]),
      ]),
    ]);
    const errors = prose.flatMap((text) =>
      checkVoice(text, { context: "task-feedback" }).filter(
        (finding) => finding.severity === "error",
      ),
    );
    expect(errors.map((finding) => `${finding.rule}: ${finding.matchedText}`)).toEqual([]);
  });
});
