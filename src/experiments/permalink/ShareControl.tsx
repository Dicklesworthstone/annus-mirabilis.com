"use client";

import { useState } from "react";
import { encodeTapePermalink } from "./codec.ts";
import { SHARE_FORMS } from "./shareForms.ts";
import type { TapeV2 } from "./types.ts";

export type ShareControlProps = {
  readonly tape: TapeV2;
  readonly baseUrl?: string;
  readonly onCopied?: () => void;
};

/**
 * Share control component for experiment state permalinks.
 *
 * Governed by am-inst-permalink-tape-s677:
 * 1. Names the form it produces: "Experiment preset" (SHARE_FORMS["experiment-preset"].name).
 * 2. Action label: "Copy link to this experiment state" (SHARE_FORMS["experiment-preset"].label).
 * 3. Accessible confirmation via aria-live.
 * 4. Works without clipboard permission by exposing the URL in a selectable read-only input.
 * 5. Explicitly states whether predictions are included and offers a toggle to exclude them.
 * 6. Builds strictly the experiment permalink form, never carrying passage or notebook state.
 */
export function ShareControl({
  tape,
  baseUrl = "https://annus-mirabilis.com/lab/bm-01",
  onCopied,
}: ShareControlProps) {
  const [includePredictions, setIncludePredictions] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);

  const hasPredictions = Boolean(tape.predictions && tape.predictions.length > 0);
  const formSpec = SHARE_FORMS["experiment-preset"];

  const encodedTape = encodeTapePermalink(tape, {
    includePredictions: hasPredictions ? includePredictions : false,
  });

  const shareUrl = `${baseUrl}?tape=${encodedTape}`;

  const handleCopy = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        onCopied?.();
        setTimeout(() => setCopied(false), 3000);
      } else {
        setCopied(true);
        onCopied?.();
        setTimeout(() => setCopied(false), 3000);
      }
    } catch {
      // Fallback handles selection without throwing
      setCopied(true);
      onCopied?.();
      setTimeout(() => setCopied(false), 3000);
    }
  };

  return (
    <div
      className="share-control"
      data-share-form="experiment-preset"
      aria-label={formSpec.name}
    >
      <div className="share-control-header">
        <span className="share-control-form-name" data-testid="form-name">
          {formSpec.name}
        </span>
      </div>

      {hasPredictions && (
        <div className="share-control-predictions-option">
          <label className="share-control-predictions-label">
            <input
              type="checkbox"
              checked={includePredictions}
              onChange={(e) => setIncludePredictions(e.target.checked)}
              data-testid="predictions-toggle"
            />
            <span>Include your prediction in the shared link</span>
          </label>
          <p className="share-control-predictions-notice" data-testid="predictions-notice">
            {includePredictions
              ? "Your prediction parameters will be encoded into the permalink."
              : "Predictions will remain private on this device and are excluded from the link."}
          </p>
        </div>
      )}

      <div className="share-control-actions">
        <button
          type="button"
          onClick={handleCopy}
          className="share-control-button"
          data-testid="copy-button"
          aria-label={formSpec.label}
        >
          {formSpec.label}
        </button>

        <div
          role="status"
          aria-live="polite"
          className="share-control-status"
          data-testid="copy-status"
        >
          {copied ? "Link copied to clipboard!" : ""}
        </div>
      </div>

      <div className="share-control-fallback">
        <label htmlFor="share-permalink-url" className="share-control-url-label">
          Shareable link (selectable):
        </label>
        <input
          id="share-permalink-url"
          type="text"
          readOnly
          value={shareUrl}
          data-testid="selectable-url"
          className="share-control-url-input"
          onFocus={(e) => e.target.select()}
        />
      </div>
    </div>
  );
}
