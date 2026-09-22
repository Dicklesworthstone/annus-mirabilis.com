"use client";

import { useEffect, useId, useState } from "react";
import type { LightInvestigationParameters } from "../../discovery/lightQuanta/investigation.ts";
import {
  encodeLightInvestigationSettings,
  exportLightInvestigationEvidence,
  LIGHT_INVESTIGATION_PATH,
  lightInvestigationCoefficientHref,
} from "../../discovery/lightQuanta/transfer.ts";
import type { AcceptedSnapshot } from "../../experiments/store/instanceStore.ts";

export function InvestigationTransfer({
  baseline,
  current,
  sourceDigest,
}: {
  baseline: AcceptedSnapshot;
  current: AcceptedSnapshot;
  sourceDigest: string;
}) {
  const id = useId();
  const [ready, setReady] = useState(false);
  const [shared, setShared] = useState<{ href: string; version: number } | null>(null);
  const [message, setMessage] = useState("");
  useEffect(() => {
    setReady(true);
  }, []);
  const coefficientHref = lightInvestigationCoefficientHref(current);
  async function share() {
    const url = new URL(LIGHT_INVESTIGATION_PATH, window.location.origin);
    url.search = encodeLightInvestigationSettings(
      current.parameters as LightInvestigationParameters,
      sourceDigest,
    );
    const version = current.snapshotVersion;
    setShared({ href: url.href, version });
    try {
      await navigator.clipboard.writeText(url.href);
      setMessage(
        `Link to these settings copied (result ${version}). Your prediction notes are not in it.`,
      );
    } catch {
      setMessage(
        `Copy the link below to share these settings (result ${version}). Your prediction notes are not in it.`,
      );
    }
  }
  function download() {
    try {
      const evidence = exportLightInvestigationEvidence(baseline, current, sourceDigest);
      const href = URL.createObjectURL(new Blob([evidence], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = href;
      link.download = `light-quanta-comparison-${current.snapshotVersion}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      // Do not revoke the object URL before the browser has started the download.
      setTimeout(() => URL.revokeObjectURL(href), 1000);
      setMessage(
        "Exported both accepted columns with their settings, typed results and source digest. Private notes are excluded.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "The accepted comparison could not be exported.",
      );
    }
  }
  return (
    <section aria-labelledby={`${id}-title`} data-investigation-transfer>
      <h2 id={`${id}-title`}>Carry this investigation forward</h2>
      <p>
        Share the current accepted settings or save both completed comparison columns. Unapplied
        form edits, predictions and interpretation choices are never included. A settings link opens
        a draft for explicit application; it does not claim to preserve results across source
        revisions.
      </p>
      <div className="actions">
        <button type="button" disabled={!ready} onClick={share}>
          Share accepted investigation settings
        </button>
        <button type="button" disabled={!ready} onClick={download}>
          Export accepted comparison as JSON
        </button>
      </div>
      <p role="status" aria-live="polite">
        {message}
      </p>
      {shared && (
        <div>
          <label htmlFor={`${id}-link`}>Settings link for snapshot {shared.version}</label>
          <input
            id={`${id}-link`}
            type="text"
            readOnly
            value={shared.href}
            style={{ width: "100%", boxSizing: "border-box" }}
            onFocus={(event) => event.target.select()}
          />
          {shared.version !== current.snapshotVersion && (
            <p className="fine">
              This link is for an earlier result. Share again to copy the current settings.
            </p>
          )}
        </div>
      )}
      {coefficientHref ? (
        <p>
          <a data-coefficient-handoff href={coefficientHref}>
            Open the entropy-law comparison with this radiation energy →
          </a>
        </p>
      ) : (
        <p className="notice">
          There is no accepted Wien inference to hand off. The specialist lab remains available with
          its own default example.
        </p>
      )}
      <p className="fine">
        The specialist page asks before applying linked settings. Without JavaScript, its prepared
        example remains visible, not a claimed calculation of the linked state.
      </p>
    </section>
  );
}
