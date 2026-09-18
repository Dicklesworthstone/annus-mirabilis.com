"use client";

import {
  type ExportPreviewCandidateLookup,
  exportPreviewLines,
  type PredictionsDocumentV1,
} from "../../experiments/predict/predictStorage.ts";

export interface PredictExportPreviewProps {
  readonly doc: PredictionsDocumentV1;
  readonly lookups: Readonly<
    Record<string, Readonly<Record<string, ExportPreviewCandidateLookup>>>
  >;
  readonly includePredictions: boolean;
  readonly onToggleIncludePredictions?: (include: boolean) => void;
}

/**
 * PredictExportPreview (am-inst-predict-mode-ti7m):
 * Displays a preview of stored predictions before export,
 * rendered directly from the stored document.
 * Includes a control to "leave predictions out".
 */
export function PredictExportPreview({
  doc,
  lookups,
  includePredictions,
  onToggleIncludePredictions,
}: PredictExportPreviewProps) {
  const previewLines = includePredictions ? exportPreviewLines(doc, lookups) : [];

  return (
    <section
      className="predict-export-preview"
      data-predict-export-preview=""
      aria-label="Predictions export preview"
    >
      <div className="predict-export-controls">
        <label className="check">
          <input
            type="checkbox"
            checked={includePredictions}
            onChange={(e) => onToggleIncludePredictions?.(e.target.checked)}
          />{" "}
          Include recorded predictions in export
        </label>
      </div>

      {includePredictions ? (
        <div className="predict-export-list" data-preview-list="">
          <h4>Predictions to be exported ({previewLines.length})</h4>
          {previewLines.length === 0 ? (
            <p>No predictions recorded.</p>
          ) : (
            <ul>
              {previewLines.map((line) => (
                <li
                  key={`${line.instrumentId}-${line.promptId}`}
                  data-preview-prompt={line.promptId}
                >
                  <strong>{line.question}</strong>
                  <div className="preview-summary">
                    <span>Recorded: </span>
                    <span
                      data-preview-summary=""
                      className={
                        line.summary === "kept to yourself, not recorded" ? "unrecorded-note" : ""
                      }
                    >
                      {line.summary}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="predict-export-omitted" data-preview-omitted="">
          <p>Predictions are omitted from this export.</p>
        </div>
      )}
    </section>
  );
}
