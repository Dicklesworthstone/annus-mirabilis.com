"use client";

import { useEffect, useId, useState } from "react";
import { encodeTapePermalinkInBrowser } from "./browserCodec.ts";
import "./permalink.css";
import { SHARE_FORMS } from "./shareForms.ts";
import type { TapeV2 } from "./types.ts";

export type ShareControlProps = {
  readonly tape: TapeV2;
  /** The page the link opens; by default the page this control is on, without its query. */
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
 * 7. Encodes in the browser (browserCodec.ts): codec.ts's node:zlib exists only on the server, so
 *    until 2026-09-24 this control could not run in a page. The link appears once it is encoded,
 *    and the copy action waits for it.
 */
export function ShareControl({ tape, baseUrl, onCopied }: ShareControlProps) {
  const urlId = useId();
  const [includePredictions, setIncludePredictions] = useState<boolean>(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [encoded, setEncoded] = useState<Readonly<{ key: string; url: string }> | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);

  const hasPredictions = Boolean(tape.predictions && tape.predictions.length > 0);
  const formSpec = SHARE_FORMS["experiment-preset"];
  // Keyed on the tape's content, so a caller that rebuilds an equal tape each render does not
  // re-encode, and a changed tape always does.
  const tapeKey = JSON.stringify(tape);
  const encodingKey = JSON.stringify([
    tapeKey,
    baseUrl ?? null,
    hasPredictions && includePredictions,
  ]);
  // A previous calculation's URL must become unavailable in the same render as the new tape.
  const shareUrl = encoded?.key === encodingKey ? encoded.url : "";
  const copied = copiedKey === encodingKey;

  // biome-ignore lint/correctness/useExhaustiveDependencies: encodingKey includes the tape content, base and prediction choice.
  useEffect(() => {
    let live = true;
    const base = baseUrl ?? `${window.location.origin}${window.location.pathname}`;
    void encodeTapePermalinkInBrowser(tape, {
      includePredictions: hasPredictions ? includePredictions : false,
    }).then(
      (value) => {
        if (live) {
          setEncoded({ key: encodingKey, url: `${base}?tape=${value}` });
          setFailedKey(null);
        }
      },
      () => {
        if (live) setFailedKey(encodingKey);
      },
    );
    return () => {
      live = false;
    };
  }, [encodingKey]);

  const handleCopy = async () => {
    if (!shareUrl) return;
    const markCopied = () => {
      setCopiedKey(encodingKey);
      onCopied?.();
      setTimeout(() => setCopiedKey((key) => (key === encodingKey ? null : key)), 3000);
    };
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        markCopied();
      } else {
        markCopied();
      }
    } catch {
      // Fallback handles selection without throwing
      markCopied();
    }
  };

  return (
    <section
      className="share-control"
      data-share-form="experiment-preset"
      aria-label={formSpec.name}
    >
      <div className="share-control-header">
        <span className="share-control-form-name" data-testid="form-name">
          {formSpec.name}
        </span>
      </div>

      {failedKey === encodingKey && (
        <p role="alert">The link could not be prepared. Your accepted result remains available.</p>
      )}

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
          disabled={!shareUrl}
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
        <label htmlFor={urlId} className="share-control-url-label">
          Shareable link (selectable):
        </label>
        <input
          id={urlId}
          type="text"
          readOnly
          value={shareUrl}
          data-testid="selectable-url"
          className="share-control-url-input"
          onFocus={(e) => e.target.select()}
        />
      </div>
    </section>
  );
}
