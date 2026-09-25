"use client";

import { useEffect, useId, useRef, useState } from "react";
import { assessLinearCertificate, decodeProofSetup, proofSetupHref } from "./linearProofState.ts";
import type { LinearProofView } from "./linearProofView.ts";
import "./linearProof.css";

export function LinearProofExplorer({
  proof,
  restoreSettings = true,
}: {
  proof: LinearProofView;
  restoreSettings?: boolean;
}) {
  const prefix = `linear-${useId().replace(/[^a-zA-Z0-9-]/g, "")}`;
  const [selected, setSelected] = useState<readonly string[]>(() =>
    proof.certificate.premises.map((p) => p.id),
  );
  const container = useRef<HTMLElement>(null);
  const [mode, setMode] = useState("full");
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (restoreSettings) {
      const setup = decodeProofSetup(proof.certificate, window.location.search);
      if (setup.kind === "setup") {
        setSelected(setup.selected);
        const disclosure = container.current?.closest<HTMLDetailsElement>(
          "[data-ledger-disclosure]",
        );
        if (disclosure) disclosure.open = true;
      }
      if (setup.kind === "invalid") setMessage(setup.message);
    }
    setReady(true);
  }, [proof, restoreSettings]);
  useEffect(() => {
    for (const detail of container.current?.querySelectorAll<HTMLDetailsElement>(
      ".linear-step-detail",
    ) ?? [])
      detail.open = mode === "full";
  }, [mode]);
  const assessment = assessLinearCertificate(proof.certificate, selected);
  const labels = new Map(proof.premises.map((p) => [p.id, p.label]));
  function equation(id: string) {
    const e = proof.equations.find((e) => e.id === id);
    if (!e) throw new Error(`Missing build-checked equation ${id}.`);
    return (
      <div className="linear-formula" data-proof-equation={e.id}>
        <div className="linear-formula-scroll">
          <div aria-hidden="true" {...{ dangerouslySetInnerHTML: { __html: e.html } }} />
        </div>
        <div className="linear-mathml" {...{ dangerouslySetInnerHTML: { __html: e.mathml } }} />
        <p className="fine">{e.spoken}</p>
      </div>
    );
  }
  function download() {
    let url: string | undefined;
    try {
      const payload = {
        schemaVersion: 1,
        kind: "mass-energy-elimination-selection",
        certificate: proof.certificate,
        sourceDigest: proof.sourceDigest,
        selectedPremises: proof.certificate.premises
          .map((p) => p.id)
          .filter((id) => selected.includes(id)),
        assessment,
        equations: proof.equations.map(({ id, plainLatex, treeDigest }) => ({
          id,
          plainLatex,
          treeDigest,
        })),
        scope:
          "Exact algebra conditional on the listed premises; not a source-review record or a proof of the physical premises.",
      };
      url = URL.createObjectURL(
        new Blob([JSON.stringify(payload, null, 2) + "\n"], { type: "application/json" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = "mass-energy-derivation.json";
      document.body.append(link);
      link.click();
      link.remove();
      setMessage("Downloaded the current premise selection and checked algebra certificate.");
    } catch {
      setMessage(
        "The download could not be created. The complete derivation and share link remain available.",
      );
    } finally {
      if (url) {
        const created = url;
        setTimeout(() => URL.revokeObjectURL(created), 0);
      }
    }
  }
  return (
    <section
      ref={container}
      className="linear-proof"
      data-source-digest={proof.sourceDigest}
      data-linear-proof={proof.certificate.id}
      data-proof-mode={mode}
      data-proof-ready={ready}
      aria-labelledby={`${prefix}-title`}
    >
      <h3 id={`${prefix}-title`}>Why does the shared unknown disappear?</h3>
      <p>
        Follow one checked elimination through five small steps. The equations below are the same
        semantic records used by the term inspector. The checker verifies the algebra exactly; it
        does not prove conservation, the light-energy transformation, or the unchanged-offset
        premise.
      </p>
      <p className="notice">
        Modern teaching derivation. No rest energy is assigned to the body, and no mass-energy
        conclusion is used as an input.
      </p>
      <noscript>
        <p>
          The full all-premise argument is readable below without JavaScript. A shared premise
          selection is restored only when JavaScript is enabled; controls do not change the source
          argument.
        </p>
      </noscript>
      <fieldset disabled={!ready} className="linear-controls">
        <legend>Which premises should this route be allowed to use?</legend>
        {proof.premises.map((p) => (
          <label key={p.id}>
            <input
              type="checkbox"
              checked={selected.includes(p.id)}
              data-proof-premise={p.id}
              onChange={(event) => {
                const enabled = event.currentTarget.checked;
                setSelected((current) =>
                  enabled
                    ? current.includes(p.id)
                      ? current
                      : [...current, p.id]
                    : current.filter((id) => id !== p.id),
                );
                setMessage("");
              }}
            />{" "}
            {p.label}
          </label>
        ))}
        <label htmlFor={`${prefix}-presentation`}>Presentation</label>{" "}
        <select
          id={`${prefix}-presentation`}
          value={mode}
          onChange={(event) => setMode(event.target.value)}
        >
          <option value="full">Equations with every explanation</option>
          <option value="compact">Compact equation sequence</option>
        </select>
        <button
          type="button"
          onClick={() => {
            setSelected(proof.certificate.premises.map((p) => p.id));
            setMessage("");
          }}
        >
          Restore all stated premises
        </button>
      </fieldset>
      <p role="status" aria-live="polite" aria-atomic="true" data-proof-status>
        {assessment.filter((s) => s.status === "supported").length} of {assessment.length} steps
        supported by this selection.
        {selected.includes("offset")
          ? " The unchanged-offset premise is in use."
          : " The unchanged-offset premise is not in use. The conservation comparison can survive without it."}
      </p>
      {message && <p role="status">{message}</p>}
      <nav aria-label="Steps in the elimination" className="linear-step-nav">
        {proof.steps.map((step, i) => (
          <a key={step.id} href={`#${prefix}-${step.id}`}>
            {i + 1}. {step.title}
          </a>
        ))}
      </nav>
      <details open>
        <summary>What is assumed, and what is only a definition?</summary>
        {proof.certificate.premises.map((p) => (
          <section key={p.id}>
            <h4>
              {labels.get(p.id)} · {p.kind}
            </h4>
            <p>{proof.premises.find((item) => item.id === p.id)?.explanation}</p>
            {p.equations.map((id) => (
              <div key={id}>{equation(id)}</div>
            ))}
          </section>
        ))}
      </details>
      <ol className="linear-step-list">
        {proof.steps.map((step, index) => {
          const checked = proof.certificate.steps[index];
          const result = assessment[index];
          if (!checked || checked.id !== step.id || !result)
            throw new Error("Checked derivation order is inconsistent.");
          return (
            <li
              key={step.id}
              id={`${prefix}-${step.id}`}
              tabIndex={-1}
              data-linear-step={step.id}
              data-step-state={result.status}
            >
              <h4>
                {index + 1}. {step.title}
                {step.move ? " · the additional premise" : ""}
              </h4>
              <p className="linear-support">
                {result.status === "supported"
                  ? "Algebra checked; supported under the selected premises."
                  : `Not established by this selection. This route needs: ${result.missing.map((id) => labels.get(id)).join("; ")}. The conditional step is retained below for explanation.`}
              </p>
              {equation(checked.equation)}
              <p className="linear-step-reason">{step.reason}</p>
              <details className="linear-step-detail" open>
                <summary>Why this step is allowed</summary>
                <p>{step.detail}</p>
                <p>
                  <a
                    href={`/foundations/${step.foundation}/`}
                    data-foundation={step.foundation}
                    data-return-caption={`Return to the mass-energy derivation: ${step.title}.`}
                  >
                    Open the mathematical tool behind this step →
                  </a>
                </p>
                <details>
                  <summary>Inspect the exact algebra certificate</summary>
                  <p>
                    For each equation, form left minus right. The result at this step is exactly the
                    following linear combination of earlier residuals, with no floating-point
                    tolerance:
                  </p>
                  <ul>
                    {checked.combination.map((term) => (
                      <li key={term.equation}>
                        {term.coefficient.num}
                        {term.coefficient.den === 1 ? "" : `/${term.coefficient.den}`} ×{" "}
                        {proof.equations.find((e) => e.id === term.equation)?.title}
                      </li>
                    ))}
                  </ul>
                  <p>
                    Matching these residuals proves a conditional implication, not the truth of the
                    starting equations.
                  </p>
                </details>
              </details>
            </li>
          );
        })}
      </ol>
      <details>
        <summary>What would a changed offset leave behind?</summary>
        <p>
          If the two offsets differ, substitution leaves their before-minus-after difference in the
          account. It cannot be cancelled. The kinetic-energy drop alone is then not fixed by the
          two conservation sheets.
        </p>
        <p>
          For an authored arithmetic example, let the frame differences be 6 before and 5.5 after,
          so their decrease is 0.5. Offsets of 2 before and 3 after correspond to kinetic energies
          of 4 and 2.5, whose decrease is 1.5. The conservation difference is still 0.5, but it is
          not the kinetic difference. These invented accounting numbers are not a claim about a
          realizable body or experimental evidence.
        </p>
      </details>
      <p>
        <strong>The mass conclusion is a further step.</strong> The exact energy drop is not yet a
        mass decrease. The low-speed comparison supplies the next premise and limit.
      </p>
      <div className="actions linear-controls">
        <a data-proof-share href={proofSetupHref(proof.certificate, selected)}>
          Share this premise selection
        </a>
        <button type="button" disabled={!ready} onClick={download}>
          Download this derivation and selection
        </button>
      </div>
      <p>
        <a href="/papers/mass-energy/#me-low-speed-derivation">
          Continue through the checked low-speed limit →
        </a>{" "}
        <a href="/lab/me-02/#coefficient-equations">
          Continue to the low-speed coefficient laboratory →
        </a>{" "}
        <a href="/papers/mass-energy/#arg-me-small-speed">Read the coefficient argument →</a>
      </p>
    </section>
  );
}
