/** A server-readable worked case for the 1904 desk, owned by the guarded shelf evaluator. */
import type { Parameters } from "../store/instanceStore.ts";
import {
  SHELF_DEFINITIONS,
  SHELF_IDS,
  type ShelfId,
  shelfDefaults,
  shelfPath,
} from "./definition.ts";
import { evaluateShelf, type ShelfEvaluation } from "./session.ts";

/** Public addresses qualify the existing internal mode; desk links and live views share them. */
export const HISTORICAL_SHELF_BINDINGS = Object.freeze(
  Object.fromEntries(
    SHELF_IDS.map((instrumentId) => [
      instrumentId,
      Object.freeze({
        instrumentId,
        modeId: `${instrumentId}:1904`,
        presetId: `${instrumentId}-1904`,
        standalonePath: shelfPath(instrumentId, "1904"),
      }),
    ]),
  ),
) as Readonly<{
  [Id in ShelfId]: Readonly<{
    instrumentId: Id;
    modeId: `${Id}:1904`;
    presetId: `${Id}-1904`;
    standalonePath: string;
  }>;
}>;

export type HistoricalShelfExample = ShelfEvaluation &
  Readonly<{
    instrumentId: ShelfId;
    modeId: "1904";
    title: string;
    question: string;
    parameters: Parameters;
    notModeled: readonly string[];
  }>;

/** No client, generated artifact, modern calibration, or separate set of sample numbers. */
export function getHistoricalShelfExample(instrumentId: ShelfId): HistoricalShelfExample {
  const definition = SHELF_DEFINITIONS[instrumentId];
  const parameters = shelfDefaults(instrumentId, "1904");
  return Object.freeze({
    instrumentId,
    modeId: "1904",
    title: definition.title,
    question: definition.question,
    parameters,
    notModeled: definition.notModeled,
    ...evaluateShelf(instrumentId, "1904", parameters),
  });
}

/** Reader labels for existing owner identities; the Lorentz comparison is its 1904 substitution. */
export function historicalShelfModelLabel(model: string): string {
  switch (model) {
    case "no-drag":
      return "No drag";
    case "full-drag":
      return "Complete drag";
    case "fresnel-drag":
      return "Fresnel's partial drag";
    case "galilean":
      return "Galilean substitution";
    case "lorentz":
      return "Lorentz's 1904 substitution";
    default:
      return model;
  }
}

export function historicalShelfUnitLabel(unit: string): string {
  return unit === "dimensionless" ? "" : unit === "1/m2" ? "m⁻²" : unit;
}
