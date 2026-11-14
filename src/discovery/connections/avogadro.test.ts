import { describe, expect, test } from "bun:test";
import {
  type ConstantSet,
  ConstantSetError,
  constantValue,
  getConstantSet,
  withHistoricalGuard,
} from "../../physics/reference/constants.ts";
import { brownianFrames, rmsDisplacement } from "../../physics/reference/diffusion.ts";
import { INFERENCE_STREAMS } from "../../physics/reference/inference/synthetic.ts";
import {
  estimateIncrements,
  estimatorInterval,
  identifiabilityFamily,
  independentModelAdmission,
  invertToMolecularNumber,
} from "../../physics/reference/inference.ts";
import { createPhiloxStream, StreamInputError } from "../../physics/reference/philox.ts";
import { avogadroFromPlanckConstants } from "../../physics/reference/radiation.ts";
import { explanationOutcome } from "../exercises/explanation.ts";
import {
  checkNumericAnswer,
  ExerciseReferenceError,
  numericPartProblems,
} from "../exercises/numeric.ts";
import {
  AVOGADRO_BROWNIAN_SET,
  AVOGADRO_EXERCISE,
  AVOGADRO_RADIATION_PART,
  AVOGADRO_RADIATION_SET,
  AVOGADRO_RADIUS_COMPARISON,
  avogadroFamilySamples,
  avogadroRadiationPart,
  buildAvogadroBrownianData,
  buildAvogadroExercise,
  AVOGADRO_BROWNIAN_DATA as data,
  AVOGADRO_BROWNIAN_PARTS as parts,
  requireAvogadroComputation,
  AVOGADRO_BROWNIAN_SETTINGS as settings,
} from "./avogadro.ts";
import {
  DISSERTATION_NUMERIC_PARTS,
  DISSERTATION_SOURCES,
} from "./dissertationHistorical.ts";

describe("molecular-number transfer exercise", () => {
  test("a refused, unavailable or interrupted reference cannot publish an exercise reference", () => {
    const owner = "inference.estimateIncrements";
    const valid = estimateIncrements(
      new Float64Array([1e-6, -1e-6]),
      1,
      1,
      "independent-increment-known-zero-drift",
    );
    expect(requireAvogadroComputation(valid, owner).dHat).toBe(5e-13);
    const rejected = [
      estimateIncrements(
        new Float64Array([1e-6, -1e-6]),
        0,
        1,
        "independent-increment-known-zero-drift",
      ),
      independentModelAdmission({
        equalSpacing: true,
        nonOverlapping: false,
        localizationStd: 0,
        exposureTime: 0,
        censored: false,
      }),
      brownianFrames({
        nSeries: 0xffffffff,
        steps: 1,
        stepKernel: 3,
        seed: "42",
        diffusion: 1,
        dt: 1,
      }),
    ];
    expect(rejected.map((result) => result.kind)).toEqual(["refused", "no-value", "outcome"]);
    for (const result of rejected) {
      let failure: unknown;
      try {
        requireAvogadroComputation<unknown>(result, owner);
      } catch (error) {
        failure = error;
      }
      expect(failure).toBeInstanceOf(ExerciseReferenceError);
      expect((failure as ExerciseReferenceError).code).toBe("exercise-reference-not-a-value");
      expect((failure as ExerciseReferenceError).message).toContain(result.kind);
    }
  });

  test("numeric or bigint seeds cannot bypass the recorded canonical-string contract", () => {
    expect(buildAvogadroBrownianData(settings.seed).seed).toBe(settings.seed);
    for (const seed of [Number(settings.seed), BigInt(settings.seed)]) {
      let failure: unknown;
      try {
        buildAvogadroBrownianData(seed as unknown as string);
      } catch (error) {
        failure = error;
      }
      expect(failure).toBeInstanceOf(StreamInputError);
      expect((failure as StreamInputError).code).toBe("invalid-seed");
    }
  });

  test("incomplete or nonfinite compatible families fail through the shared numeric-reference guard", () => {
    expect(avogadroFamilySamples(data.family)).toEqual(AVOGADRO_RADIUS_COMPARISON.unknown.family);
    const nonfiniteRadius = Float64Array.from(data.family.radii);
    nonfiniteRadius[0] = NaN;
    const nonfiniteNumber = Float64Array.from(data.family.numbers);
    nonfiniteNumber[20] = Infinity;
    const rejected = [
      { ...data.family, radii: data.family.radii.subarray(0, 20) },
      { ...data.family, numbers: data.family.numbers.subarray(0, 20) },
      { ...data.family, radii: nonfiniteRadius },
      { ...data.family, numbers: nonfiniteNumber },
    ];
    for (const family of rejected) {
      let failure: unknown;
      try {
        avogadroFamilySamples(family);
      } catch (error) {
        failure = error;
      }
      expect(failure).toBeInstanceOf(ExerciseReferenceError);
      expect((failure as ExerciseReferenceError).code).toBe("exercise-reference-not-a-value");
    }
  });

  test("radiation reference uses the real evaluator and corrected historical witness", () => {
    const set = getConstantSet(AVOGADRO_RADIATION_SET);
    const result = avogadroFromPlanckConstants(set);
    expect(AVOGADRO_RADIATION_PART.reference.value).toBe(result.avogadroConstant);
    expect(result.avogadroConstant / 6.170486e23).toBeCloseTo(1, 6);
    expect(AVOGADRO_RADIATION_PART.reference.constantSetId).toBe(set.id);
    expect(AVOGADRO_RADIATION_PART.reference.owner).toBe("radiation.avogadroFromPlanckConstants");
    expect(checkNumericAnswer(AVOGADRO_RADIATION_PART, "6.17e23", "1/mol").kind).toBe("agrees");
    expect(checkNumericAnswer(AVOGADRO_RADIATION_PART, "6.02214076e23", "1/mol").kind).toBe(
      "differs",
    );
    expect(AVOGADRO_RADIATION_PART.workedExplanation).toContain("corrected witness exponent");
    expect(AVOGADRO_RADIATION_PART.workedExplanation).toContain("editorial inputs");
  });

  test("the facsimile's uncorrected alpha gives one tenth and the intended slip feedback", () => {
    const set = getConstantSet(AVOGADRO_RADIATION_SET);
    const wrong: ConstantSet = {
      ...set,
      entries: set.entries.map((entry) =>
        entry.quantityId === "wienConstantAlpha"
          ? { ...entry, value: entry.value * 10, exactDecimal: "6.10e-56" }
          : entry,
      ),
    };
    const wrongPart = avogadroRadiationPart(wrong);
    expect(wrongPart.reference.value / AVOGADRO_RADIATION_PART.reference.value).toBeCloseTo(
      0.1,
      14,
    );
    const verdict = checkNumericAnswer(
      AVOGADRO_RADIATION_PART,
      String(wrongPart.reference.value),
      "1/mol",
    );
    expect(verdict.kind).toBe("slip");
    expect(verdict.message).toContain("uncorrected α exponent");
  });

  test("the recorded string seed regenerates independent logical increments", () => {
    const again = buildAvogadroBrownianData(settings.seed);
    expect(again.increments).toEqual(data.increments);
    expect(buildAvogadroBrownianData("190505110000000008").increments).not.toEqual(data.increments);
    expect(BigInt(settings.seed)).toBeGreaterThan(BigInt(Number.MAX_SAFE_INTEGER));
    const scale = rmsDisplacement(data.generatorD, settings.dt).result;
    expect(scale.status).toBe("value");
    if (scale.status !== "value" || typeof scale.value !== "number") return;
    for (let i = 0; i < settings.M; i++) {
      const stream = createPhiloxStream({
        seed: settings.seed,
        kernel: INFERENCE_STREAMS.latent,
        tile: i,
      });
      const independentlyReplayed = scale.value * stream.nextNormal();
      expect((data.increments[i] ?? NaN) / independentlyReplayed).toBeCloseTo(1, 14);
    }
    for (const invalid of ["01905", "-1", "18446744073709551616", 1905, 1905n])
      expect(() => buildAvogadroBrownianData(invalid as string)).toThrow();
  });

  test("historical R and a declared hidden N enter the generator, with no modern k_B", () => {
    expect(() => withHistoricalGuard(() => buildAvogadroBrownianData())).not.toThrow();
    expect(data.generatorSet.entries.map((entry) => entry.quantityId).sort()).toEqual([
      "avogadroConstant",
      "molarGasConstant",
    ]);
    expect(data.generatorSet.entries.every((entry) => entry.kind === "declared-scenario")).toBe(
      true,
    );
    expect(constantValue(data.generatorSet, "molarGasConstant").value).toBe(8.31);
    expect(constantValue(data.generatorSet, "avogadroConstant").value).toBe(data.hiddenNumber);
    expect(data.molecularNumber.semanticKind).toBe("synthetic-recovery");
    expect(data.molecularNumber.estimatedBoltzmannConstant).toBeNull();
    expect(data.molecularNumber.consistencyRatio).toBeNull();
  });

  test("binding modern exact constants or a circular R is refused even for synthetic data", () => {
    const historical = getConstantSet(AVOGADRO_BROWNIAN_SET);
    const modern = getConstantSet("modern-si-2019");
    const kB = modern.entries.find((entry) => entry.quantityId === "boltzmannConstant");
    if (!kB) throw new Error("The modern set needs k_B for this negative fixture.");
    const fixtures = [
      modern,
      { ...historical, entries: [...historical.entries, kB] },
      {
        ...historical,
        entries: historical.entries.map((entry) =>
          entry.quantityId === "molarGasConstant"
            ? { ...entry, dependsOn: ["avogadroConstant", "boltzmannConstant"] }
            : entry,
        ),
      },
    ];
    for (const fixture of fixtures) {
      try {
        buildAvogadroBrownianData(settings.seed, fixture);
        throw new Error("The invalid historical inputs were accepted.");
      } catch (error) {
        expect(error).toBeInstanceOf(ConstantSetError);
        expect((error as ConstantSetError).code).toBe("modern-constant-in-historical-path");
      }
    }
  });

  test("all three Brownian answers recompute through the real estimator and interval inversion", () => {
    const estimate = estimateIncrements(
      new Float64Array(data.increments),
      settings.dt,
      settings.d,
      "independent-increment-known-zero-drift",
    );
    expect(estimate.kind).toBe("accepted");
    if (estimate.kind !== "accepted") return;
    expect(estimate.data.q).toBe(settings.M);
    const interval = estimatorInterval(estimate.data, settings.alpha);
    expect(interval.kind).toBe("accepted");
    if (interval.kind !== "accepted") return;
    const input = {
      ...settings,
      dHat: estimate.data.dHat,
      interval: interval.data,
      radiusProvenance: "independently-declared" as const,
      synthetic: true,
    };
    const inferred = invertToMolecularNumber(input, getConstantSet(AVOGADRO_BROWNIAN_SET));
    expect(inferred.kind).toBe("accepted");
    if (inferred.kind !== "accepted") return;
    expect(parts.map((part) => part.reference.value)).toEqual([
      inferred.data.estimate,
      inferred.data.interval.lower,
      inferred.data.interval.upper,
    ]);
    expect(parts[1].reference.value).toBeLessThan(parts[0].reference.value);
    expect(parts[2].reference.value).toBeGreaterThan(parts[0].reference.value);
    expect(checkNumericAnswer(parts[1], String(parts[2].reference.value), "1/mol").kind).toBe(
      "differs",
    );
    expect(checkNumericAnswer(parts[2], String(parts[1].reference.value), "1/mol").kind).toBe(
      "differs",
    );
    expect(
      parts.every((part) =>
        part.workedExplanation.includes("conditional on the independently supplied radius"),
      ),
    ).toBe(true);
    const circular = invertToMolecularNumber(
      { ...input, radiusProvenance: "same-displacements" },
      getConstantSet(AVOGADRO_BROWNIAN_SET),
    );
    expect(circular.kind).toBe("refused");
    if (circular.kind === "refused")
      expect(circular.refusal.code).toBe("circular-radius-from-displacement");
  });

  test("removing the radius gives a compatible family and no single N or interval", () => {
    const unknown = AVOGADRO_RADIUS_COMPARISON.unknown;
    expect(unknown.status).toBe("underdetermined");
    for (const forbidden of ["estimate", "interval", "result", "value"])
      expect(Object.hasOwn(unknown, forbidden)).toBe(false);
    const family = identifiabilityFamily(
      {
        D: data.estimate.dHat,
        T: settings.T,
        eta: settings.eta,
        radiusRange: [0.25e-6, 1e-6],
        synthetic: true,
      },
      getConstantSet(AVOGADRO_BROWNIAN_SET),
    );
    expect(family.kind).toBe("accepted");
    if (family.kind !== "accepted") return;
    expect(unknown.product).toBe(family.data.product);
    for (const pair of unknown.family)
      expect((pair.radius * pair.molecularNumber) / unknown.product).toBeCloseTo(1, 14);
    const first = unknown.family[0],
      last = unknown.family.at(-1);
    if (!first || !last) throw new Error("The family needs distinct radii.");
    expect(last.radius / first.radius).toBeCloseTo(4, 12);
    expect(first.molecularNumber / last.molecularNumber).toBeCloseTo(4, 12);
  });

  test("every shipped numeric reference is finite, declared and accepted by the checker", () => {
    for (const part of [AVOGADRO_RADIATION_PART, ...parts]) {
      expect(numericPartProblems(part)).toEqual([]);
      expect(part.reference.executionLabel).toBe("Ideal model, host calculation");
      expect(part.reference.resultStatus).toBe("value");
      expect(part.reference.quantityId).not.toBe("unknown");
      expect(checkNumericAnswer(part, String(part.reference.value), "1/mol").kind).toBe("agrees");
      expect(checkNumericAnswer(part, String(part.reference.value), "1").kind).toBe("input-error");
    }
    for (const section of AVOGADRO_EXERCISE.sections)
      for (const item of section.parts)
        if (item.kind === "explanation")
          expect(explanationOutcome(item.part).kind).toBe("needs-human-reading");
  });

  test("pinned historical exercises do not depend on the full companion or lab presence", () => {
    for (const companionPresent of [false, true]) {
      const exercise = buildAvogadroExercise({ companionPresent, avogadroLabPresent: false });
      const dissertation = exercise.sections.find(
        (section) => section.id === "avogadro-dissertation",
      );
      expect(dissertation?.parts.map((entry) => entry.part.id)).toEqual(
        DISSERTATION_NUMERIC_PARTS.map((part) => part.id),
      );
      expect(dissertation?.parts.every((entry) => entry.kind === "numeric")).toBe(true);
      expect(dissertation?.title).toBe("Route 3: the dissertation and its correction");
      expect(dissertation?.paragraphs.join(" ")).toContain("do not fill missing experimental inputs");
      expect(dissertation?.links?.map((link) => link.href)).toEqual([
        DISSERTATION_SOURCES.dissertation.mainHref,
        DISSERTATION_SOURCES.dissertation.supplementHref,
        DISSERTATION_SOURCES.correction.href,
      ]);
      expect(exercise.links.some((link) => link.href === "/lab/avogadro-lab/")).toBe(false);
      expect(JSON.stringify(exercise)).not.toContain("/papers/molecular-dimensions/");
      expect(JSON.stringify(exercise)).not.toContain("two of the three were at first wrong");
    }
    const publishedLab = buildAvogadroExercise({
      companionPresent: false,
      avogadroLabPresent: true,
    });
    expect(publishedLab.links.some((link) => link.href === "/lab/avogadro-lab/")).toBe(true);
  });
});
