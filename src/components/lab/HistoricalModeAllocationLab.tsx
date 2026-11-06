"use client";

import { type FormEvent, useEffect, useId, useState } from "react";
import { typedOrNaN } from "../../experiments/controls/typedNumber.ts";
import { CurrencyForView } from "../../experiments/labels/CurrencyForView.tsx";
import {
  DEFAULT_HISTORICAL_LQ02_SNAPSHOT,
  evaluateHistoricalLq02,
  HISTORICAL_LQ02_CONSTANT_SET,
  HISTORICAL_LQ02_MODE,
  HISTORICAL_LQ02_PATH,
  type HistoricalLq02Inputs,
} from "../../experiments/lq02/historical.ts";
import {
  historicalLq02Tape,
  loadHistoricalLq02TapeFromUrl,
} from "../../experiments/lq02/historicalTape.ts";
import { encodeTapePermalinkInBrowser } from "../../experiments/permalink/browserCodec.ts";
import { refusalSentence } from "../../experiments/results/refusalSentence.ts";
import type { RequestRefusal } from "../../experiments/results/refusals.ts";
import { HistoricalModeAllocationReadout } from "./HistoricalModeAllocationPreview.tsx";

type Draft = Readonly<{ T: string; nuCutoff: string; probeFrequency: string }>;

function toDraft(inputs: HistoricalLq02Inputs): Draft {
  return {
    T: String(inputs.T),
    nuCutoff: String(inputs.nuCutoff),
    probeFrequency: String(inputs.probeFrequency),
  };
}

function fromDraft(draft: Draft): HistoricalLq02Inputs {
  return {
    T: typedOrNaN(draft.T),
    nuCutoff: typedOrNaN(draft.nuCutoff),
    probeFrequency: typedOrNaN(draft.probeFrequency),
    constantSetId: HISTORICAL_LQ02_CONSTANT_SET,
  };
}

const FIELDS = [
  { key: "T", label: "Temperature (K)" },
  { key: "nuCutoff", label: "Upper frequency (Hz)" },
  { key: "probeFrequency", label: "Probe frequency (Hz)" },
] as const;

export function HistoricalModeAllocationLab({
  title = "What happens when the frequency range keeps widening?",
  restoreSettings = true,
}: {
  title?: string;
  /** The desk can host several instruments; shared links open the dedicated historical route. */
  restoreSettings?: boolean;
}) {
  const id = useId();
  const [snapshot, setSnapshot] = useState(DEFAULT_HISTORICAL_LQ02_SNAPSHOT);
  const [draft, setDraft] = useState(() => toDraft(snapshot.inputs));
  const [revision, setRevision] = useState(0);
  const [refusal, setRefusal] = useState<RequestRefusal | null>(null);
  const [showDivergence, setShowDivergence] = useState(false);
  const [notice, setNotice] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [copyNotice, setCopyNotice] = useState("");
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    if (!restoreSettings) return;
    let live = true;
    void loadHistoricalLq02TapeFromUrl(window.location.href).then((loaded) => {
      if (!live || loaded.kind === "absent") return;
      if (loaded.kind === "not-restored") {
        setNotice(loaded.notice);
        return;
      }
      const checked = evaluateHistoricalLq02(loaded.settings);
      if (checked.kind === "accepted") {
        setDraft(toDraft(checked.data.inputs));
        setNotice("Shared settings are in the form. Choose Apply settings to calculate them.");
      }
    });
    return () => {
      live = false;
    };
  }, [restoreSettings]);

  useEffect(() => {
    let live = true;
    const tape = historicalLq02Tape(snapshot.inputs);
    setShareUrl("");
    setCopyNotice("");
    if (tape)
      void encodeTapePermalinkInBrowser(tape).then(
        (encoded) => {
          if (!live) return;
          const address = new URL(HISTORICAL_LQ02_PATH, window.location.origin);
          address.searchParams.set("tape", encoded);
          setShareUrl(address.href);
        },
        () => {
          if (live) setCopyNotice("A settings link could not be prepared in this browser.");
        },
      );
    return () => {
      live = false;
    };
  }, [snapshot.inputs]);

  function apply(
    next: HistoricalLq02Inputs,
    message = "Allocation updated from the accepted settings.",
  ) {
    const checked = evaluateHistoricalLq02(next);
    if (checked.kind !== "accepted") {
      if (checked.kind === "refused") setRefusal(checked.refusal);
      return;
    }
    setSnapshot(checked.data);
    setDraft(toDraft(checked.data.inputs));
    setRevision((value) => value + 1);
    setRefusal(null);
    setShowDivergence(false);
    setNotice("");
    setAnnouncement(message);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    apply(fromDraft(draft));
  }

  function widen(factor: number) {
    const next = fromDraft(draft);
    apply(
      { ...next, nuCutoff: next.nuCutoff * factor },
      factor > 1
        ? "Upper frequency widened tenfold; allocation updated."
        : "Upper frequency narrowed tenfold; allocation updated.",
    );
  }

  async function copyLink() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(shareUrl);
      setCopyNotice("Link copied.");
    } catch {
      setCopyNotice("Select and copy the link below.");
    }
  }

  return (
    <section
      className="laboratory"
      aria-labelledby={`${id}-title`}
      data-instrument-id="lq-02"
      data-mode={HISTORICAL_LQ02_MODE}
      data-constant-set={HISTORICAL_LQ02_CONSTANT_SET}
      data-instance-id={id}
      data-run-id={`${id}-${revision}`}
      data-snapshot-version={revision}
      data-input-revision={revision}
      data-accepted-input-revision={revision}
      data-pending="false"
      data-currency-state={refusal ? "refused" : "accepted"}
    >
      <header className="lab-heading">
        <p className="eyebrow">Classical energy sharing · 1904 reconstruction</p>
        <h2 id={`${id}-title`}>{title}</h2>
        <span className="badge">
          {revision === 0 ? "Static worked example" : "Calculated from the accepted settings"}
        </span>
        <CurrencyForView validationRefusal={refusal} />
      </header>
      <p>
        Suppose equal energy sharing continues to every frequency you admit. Compare the energy in
        two finite ranges, then ask whether removing the upper limit leaves a finite answer. The
        unknown coefficient cancels from these comparisons.
      </p>
      <noscript>
        <p className="notice">
          JavaScript is off. The table shows the complete static worked example for the default
          settings. Changing settings requires JavaScript.
        </p>
      </noscript>
      <div className="lab-columns">
        <form className="controls" aria-label="1904 allocation settings" onSubmit={submit}>
          {FIELDS.map(({ key, label }) => (
            <label key={key} htmlFor={`${id}-${key}`}>
              <span>{label}</span>
              <input
                id={`${id}-${key}`}
                name={key}
                type="text"
                inputMode="decimal"
                value={draft[key]}
                aria-describedby={`${id}-requirements`}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, [key]: event.target.value }))
                }
              />
            </label>
          ))}
          <p id={`${id}-requirements`} className="fine">
            Use positive, finite numbers. The probe must be at or below the upper frequency for its
            share to be available.
          </p>
          <div className="actions">
            <button type="submit">Apply settings</button>
            <button type="button" onClick={() => widen(10)}>
              Widen tenfold
            </button>
            <button type="button" onClick={() => widen(0.1)}>
              Narrow tenfold
            </button>
            <button type="button" onClick={() => setShowDivergence(true)}>
              Remove the upper limit
            </button>
          </div>
          {refusal && (
            <p role="alert" data-refusal-code={refusal.code}>
              {refusalSentence(refusal)}
            </p>
          )}
          {notice && <p role="status">{notice}</p>}
        </form>
        <div className="lab-results">
          <HistoricalModeAllocationReadout snapshot={snapshot} />
          {showDivergence && snapshot.totalWithoutCutoff.status === "outside-domain" && (
            <p
              role="status"
              className="notice"
              data-output="classicalTotal"
              data-result-status="outside-domain"
            >
              No finite total: {snapshot.totalWithoutCutoff.reason}. The table keeps the last
              accepted finite upper frequency.
            </p>
          )}
          <p className="status-line" role="status" aria-live="polite">
            {announcement}
          </p>
        </div>
      </div>
      <p className="fine">
        Not modeled: cavity shape and walls; the approach to equilibrium; measured spectra;
        mechanisms coupling matter and radiation; any quantum hypothesis.
      </p>
      <details>
        <summary>Show the reasoning and the calculation</summary>
        <p>
          The assumed energy in a narrow frequency interval is proportional to its width, the
          temperature and the square of its frequency. Integrating up to an upper frequency gives
          the cubic dependence. Compare two such integrals to cancel the unknown coefficient. Above
          a probe, the fraction is 1 − (ν<sub>probe</sub>/ν<sub>max</sub>)<sup>3</sup>.
        </p>
        <p>
          Rayleigh's June 1900 proposal concerned long wavelengths. Extending equal shares across
          the whole range here is a stated assumption for this reconstruction; it is not his
          proposed complete spectrum, which also included an exponential factor. Source:{" "}
          <cite>Remarks upon the Law of Complete Radiation</cite>,{" "}
          <cite>Philosophical Magazine</cite> (5) 49, 539–540 (1900).
        </p>
        <p>
          <a href="https://github.com/Dicklesworthstone/annus-mirabilis.com/blob/main/src/physics/reference/radiation/classicalRelative.ts">
            Read the numerical owner for the ratios and shares
          </a>
          .
        </p>
      </details>
      {shareUrl && (
        <section aria-label="Share these historical settings">
          <h3>Experiment preset</h3>
          <p className="fine">
            This link opens the 1904 reconstruction with the accepted settings in its form.
          </p>
          <button type="button" onClick={() => void copyLink()}>
            Copy link to these settings
          </button>
          <label htmlFor={`${id}-share`}>Shareable link</label>
          <input
            id={`${id}-share`}
            type="text"
            value={shareUrl}
            readOnly
            onFocus={(event) => event.target.select()}
          />
        </section>
      )}
      {copyNotice && <p role="status">{copyNotice}</p>}
    </section>
  );
}
