import {
  SHELF_DEFINITIONS,
  SHELF_IDS,
  type ShelfId,
  shelfPath,
} from "../../../experiments/shelf/definition.ts";
import { HistoricalShelfLab } from "./HistoricalShelfLab.tsx";

/** Standalone destinations for the existing mode-bound settings-link codec. */
export function HistoricalShelfPage({ instrumentId }: { instrumentId: ShelfId }) {
  const definition = SHELF_DEFINITIONS[instrumentId];
  return (
    <article data-edition-status="explanatory-preview" data-historical-cutoff="1904">
      <header className="page-intro">
        <p className="eyebrow">1904 desk · Optical model comparison</p>
        <h1>{definition.title}</h1>
        <p className="lead">{definition.question}</p>
      </header>
      <HistoricalShelfLab instrumentId={instrumentId} title="Try the comparison" />
      {instrumentId === "shelf-fizeau" && (
        <p>
          <a href="/lab/shelf-fizeau/#fizeau-measurements">
            Compare with Fizeau’s nineteen printed observations
          </a>{" "}
          from the full memoir published in 1859. That companion comparison states its modern
          light-speed calibration and assumed refractive index separately from the measurements.
        </p>
      )}
      <p>
        <a href="/1904/">Return to the 1904 desk</a> to compare the unresolved questions and the
        experiments that could distinguish competing explanations.
      </p>
      <nav className="actions" aria-label="Other optical comparisons at the 1904 desk">
        {SHELF_IDS.filter((id) => id !== instrumentId).map((id) => (
          <a key={id} href={shelfPath(id, "1904")}>
            {SHELF_DEFINITIONS[id].title}
          </a>
        ))}
      </nav>
    </article>
  );
}
