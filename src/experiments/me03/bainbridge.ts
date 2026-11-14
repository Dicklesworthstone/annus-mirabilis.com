import { datasetWithheldReason } from "../../content/datasets/plotVerdict.ts";
import { getDatasetShelfStatus } from "../../content/datasets/shelf.ts";
import {
  datasetValuesMayBeShown,
  type HistoricalDataset,
} from "../../content/schemas/experiment.ts";

export const BAINBRIDGE_1933_DATASET_ID = "bainbridge-1933-mass-energy";
export const BAINBRIDGE_MASS_UNIT = "O16-mass-unit";
export const BAINBRIDGE_REACTIONS = Object.freeze([
  Object.freeze({ id: "lithium-7-proton", label: "Lithium-7 + proton → two alpha particles" }),
  Object.freeze({ id: "lithium-6-deuteron", label: "Lithium-6 + deuteron → two alpha particles" }),
] as const);
export type BainbridgeReactionId = (typeof BAINBRIDGE_REACTIONS)[number]["id"];

export type BainbridgeReaction = Readonly<{
  id: BainbridgeReactionId;
  label: string;
  sourceDescription: string;
  energyGainMeV: number;
  reportedMassEquivalent: number;
  measuredMassDefect: number;
  quotedMassError: number;
  energyUncertainty: Readonly<{ kind: "not-reported"; reason: string }>;
}>;

export type BainbridgeRecord =
  | Readonly<{
      kind: "available";
      datasetId: typeof BAINBRIDGE_1933_DATASET_ID;
      massUnit: typeof BAINBRIDGE_MASS_UNIT;
      citation: string;
      evidenceLabel: string;
      sourcePageImage: string;
      uncertainty: string;
      reactions: readonly BainbridgeReaction[];
    }>
  | Readonly<{ kind: "withheld"; citation: string; reason: string }>;

const COLUMNS = Object.freeze([
  { quantityId: "reactionEnergyGain", unit: "MeV", role: "derived" },
  { quantityId: "energyEquivalentMass", unit: BAINBRIDGE_MASS_UNIT, role: "derived" },
  { quantityId: "reactionMassDefect", unit: BAINBRIDGE_MASS_UNIT, role: "observed" },
  { quantityId: "quotedMassMeasurementError", unit: BAINBRIDGE_MASS_UNIT, role: "derived" },
  { quantityId: "reactionEnergyMeasurementError", unit: "MeV", role: "derived" },
] as const);

/** Admit the source's observations and calculations with their distinct roles and historical units. */
export function evaluateBainbridgeRecord(
  dataset: HistoricalDataset,
  citation: string,
): BainbridgeRecord {
  const withheld = (reason: string): BainbridgeRecord =>
    Object.freeze({ kind: "withheld", citation, reason });
  if (!datasetValuesMayBeShown(dataset)) return withheld(datasetWithheldReason(dataset));
  if (dataset.id !== BAINBRIDGE_1933_DATASET_ID) {
    return withheld("This comparison needs Bainbridge's two reported reactions from 1933.");
  }
  const publication = dataset.publications.find((item) => item.id === dataset.primaryPublicationId);
  const shelf = getDatasetShelfStatus(dataset);
  if (
    publication?.publicationDate.earliest !== "1933-07-15" ||
    publication.publicationDate.latest !== "1933-07-15" ||
    shelf.badgeLabel !== "later evidence, published 1933"
  ) {
    return withheld("The reported comparisons must retain their 15 July 1933 publication date.");
  }
  if (
    dataset.uncertainty.type !== "quoted-mass-error-energy-error-unreported" ||
    !dataset.digitizer.sourcePageImage.trim()
  ) {
    return withheld(
      "The source page and its distinction between quoted and missing errors are needed.",
    );
  }
  const indices = COLUMNS.map((expected) => {
    const matches = dataset.columns
      .map((column, index) => ({ column, index }))
      .filter(({ column }) => column.quantityId === expected.quantityId);
    const match = matches[0];
    return matches.length === 1 &&
      match?.column.unit === expected.unit &&
      match.column.role === expected.role
      ? match.index
      : -1;
  });
  if (indices.some((index) => index < 0)) {
    return withheld(
      "The energy calculation and independent mass measurements need their declared roles and O16 mass units.",
    );
  }
  if (dataset.rows.length !== BAINBRIDGE_REACTIONS.length) {
    return withheld(
      "Both reported reactions are needed, including the unresolved second comparison.",
    );
  }
  const reactions: BainbridgeReaction[] = [];
  for (const definition of BAINBRIDGE_REACTIONS) {
    const rows = dataset.rows.filter((row) => row.seriesId === definition.id);
    const series = dataset.series?.find((item) => item.id === definition.id);
    const row = rows[0];
    if (rows.length !== 1 || !row || !series?.description.trim()) {
      return withheld(
        "Each observation must remain attached to its cited reaction and conditions.",
      );
    }
    const cells = indices.map((index) => row.cells[index]);
    const [energy, equivalent, mass, error, energyError] = cells;
    if (
      energy?.kind !== "number" ||
      equivalent?.kind !== "number" ||
      mass?.kind !== "number" ||
      error?.kind !== "number" ||
      energyError?.kind !== "missing" ||
      !energyError.reason.trim() ||
      [energy.value, equivalent.value, mass.value, error.value].some(
        (value) => !Number.isFinite(value) || value <= 0,
      )
    ) {
      return withheld(
        "The printed positive quantities and quoted mass errors must be present; unreported energy errors must stay missing.",
      );
    }
    reactions.push(
      Object.freeze({
        ...definition,
        sourceDescription: series.description,
        energyGainMeV: energy.value,
        reportedMassEquivalent: equivalent.value,
        measuredMassDefect: mass.value,
        quotedMassError: error.value,
        energyUncertainty: Object.freeze({ kind: "not-reported", reason: energyError.reason }),
      }),
    );
  }
  return Object.freeze({
    kind: "available",
    datasetId: BAINBRIDGE_1933_DATASET_ID,
    massUnit: BAINBRIDGE_MASS_UNIT,
    citation,
    evidenceLabel: shelf.badgeLabel,
    sourcePageImage: dataset.digitizer.sourcePageImage,
    uncertainty: dataset.uncertainty.description,
    reactions: Object.freeze(reactions),
  });
}

export type BainbridgeComparison =
  | Readonly<{
      kind: "available";
      reaction: BainbridgeReaction;
      massUnit: typeof BAINBRIDGE_MASS_UNIT;
      measuredMinusEquivalent: number;
      absoluteDifference: number;
      quotedMassRange: Readonly<{ lower: number; upper: number }>;
      differenceInQuotedMassErrors: number;
      withinQuotedMassRange: boolean;
      statisticalAgreement: Readonly<{ status: "underdetermined"; reason: string }>;
    }>
  | Readonly<{ kind: "unavailable"; reason: string }>;

/**
 * Compare printed numbers in their original mass scale. This is descriptive arithmetic, not a
 * nuclear-reaction model, a new E/c² conversion, or a statistical test with a complete error budget.
 */
export function compareBainbridgeReaction(
  record: BainbridgeRecord,
  reactionId: string,
): BainbridgeComparison {
  if (record.kind === "withheld") return { kind: "unavailable", reason: record.reason };
  const reaction = record.reactions.find((item) => item.id === reactionId);
  if (!reaction) {
    return {
      kind: "unavailable",
      reason: "Choose one of the two reactions reported in the letter.",
    };
  }
  const measuredMinusEquivalent = reaction.measuredMassDefect - reaction.reportedMassEquivalent;
  const absoluteDifference = Math.abs(measuredMinusEquivalent);
  return Object.freeze({
    kind: "available",
    reaction,
    massUnit: BAINBRIDGE_MASS_UNIT,
    measuredMinusEquivalent,
    absoluteDifference,
    quotedMassRange: Object.freeze({
      lower: reaction.measuredMassDefect - reaction.quotedMassError,
      upper: reaction.measuredMassDefect + reaction.quotedMassError,
    }),
    differenceInQuotedMassErrors: absoluteDifference / reaction.quotedMassError,
    withinQuotedMassRange: absoluteDifference <= reaction.quotedMassError,
    statisticalAgreement: Object.freeze({
      status: "underdetermined",
      reason:
        "The letter supplies no numerical energy uncertainty or complete joint error model. The ratio to the quoted mass error has no assigned statistical significance.",
    }),
  });
}
