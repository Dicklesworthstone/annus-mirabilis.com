import type { Expression } from "../equations/ast.ts";
import { expressionToSpokenText } from "../equations/derivations/a11yText.ts";
import {
  type ClosingQuantaSection,
  closingQuantaExpressions,
  closingQuantaSteps,
  presentClosingQuantaExpression,
} from "../equations/derivations/lightQuantaClosing.ts";
import { renderExpressionMarkup } from "../equations/derivations/mathRenderer.ts";
import "../equations/derivations/derivation.css";

export type LightQuantaClosingDerivationProps = Readonly<{
  section: ClosingQuantaSection;
  activeDetail?: "0" | "1" | "2";
  perspective?: "historical" | "modern";
}>;

function Formula({ expression }: { readonly expression: Expression }) {
  const displayed = presentClosingQuantaExpression(expression);
  const rendered = renderExpressionMarkup(displayed);
  return (
    <section
      className="step-math"
      aria-label={expressionToSpokenText(displayed)}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: authored AST rendered by KaTeX with trust false.
      dangerouslySetInnerHTML={{ __html: rendered.html }}
    />
  );
}

/** Static mathematics and native disclosures remain complete when JavaScript is disabled. */
export function LightQuantaClosingDerivation({
  section,
  activeDetail = "1",
  perspective = "historical",
}: LightQuantaClosingDerivationProps) {
  const fluorescence = section === "s7";
  const anchor = fluorescence ? "lq-fluorescence-derivation" : "lq-ionization-derivation";
  const argument = fluorescence ? "arg-lq-fluorescence-budget" : "arg-lq-ionization-and-counts";
  return (
    <section
      id={anchor}
      className="local-steps"
      aria-labelledby={anchor + "-title"}
      data-argument-id={argument}
      data-closing-quanta-section={section}
      data-historical-status="pedagogical-reconstruction"
      data-perspective={perspective}
    >
      <h4 id={anchor + "-title"}>
        {fluorescence
          ? "Follow the energy from one colour of light to another"
          : "Separate the ionization threshold from the number of ions"}
      </h4>
      <p>
        {fluorescence
          ? "Section 7 applies the new quantum picture to fluorescence. One energy account gives a frequency bound. A separate counting argument explains the predicted dependence on brightness. The steps below keep those two claims apart."
          : "Section 9 makes two conditional claims. A quantum must carry enough energy for one ionization, and the total absorbed energy can count quanta. Turning that count into a number of ions needs an additional premise about what each absorption does."}
      </p>
      <p>
        These are teaching equations following the source’s order of reasoning. We write one
        quantum’s energy as <i>h</i>ν; the paper writes (<i>R</i>/<i>N</i>)βν. The symbols added for
        energy left over, rates and yields make the assumptions explicit. They are not extra printed
        equations or experimentally established laws.
      </p>
      <Formula expression={closingQuantaExpressions.quantumNotation} />

      <details className="step-local-steps">
        <summary>Which premises are being admitted?</summary>
        {fluorescence ? (
          <ul>
            <li>
              The exciting and emitted light are described by quanta of energy <i>h</i>ν, with
              <i> h</i> and both frequencies positive.
            </li>
            <li>
              One absorbed quantum acts independently in a sparse field. Other outgoing light and
              heat have nonnegative energy, and the body supplies no additional energy.
            </li>
            <li>
              The brightness calculation additionally holds the absorption conditions and the
              chosen channel’s yield fixed. That yield is an input, not a consequence of the
              frequency bound.
            </li>
          </ul>
        ) : (
          <ul>
            <li>
              The absorbed light is monochromatic, <i>h</i> and its frequency are positive, and
              <i> L</i> is the nonnegative energy actually absorbed over the exposure.
            </li>
            <li>
              One quantum supplies one elementary primary ionization. Its energy cannot be pooled
              with another quantum’s; secondary cascades and other energy sources are excluded.
            </li>
            <li>
              The ionization work per molecule is nonnegative. A yield between zero and one
              specifies which absorptions ionize; the paper’s count equality requires yield one.
            </li>
          </ul>
        )}
      </details>

      <ol className="derivation-steps-list">
        {closingQuantaSteps[section].map((step, index) => (
          <li
            key={step.id}
            id={step.id}
            className="derivation-step"
            data-closing-quanta-step={step.id}
            data-is-move={step.isMove ? "true" : "false"}
          >
            <h5>{index + 1}. {step.title}</h5>
            {step.isMove && <p className="step-move-label">The move: admit the one-quantum event.</p>}
            <div className="step-reasons">
              <p className="step-reason" data-reading="0" data-detail="0" hidden={activeDetail !== "0"}>
                <noscript><b className="reading-label">In one breath</b></noscript>
                {step.reasons.r0}
              </p>
              <p className="step-reason" data-reading="1" data-detail="1" hidden={activeDetail !== "1"}>
                <noscript><b className="reading-label">Full explanation</b></noscript>
                {step.reasons.r1}
              </p>
              <p className="step-reason" data-reading="2" data-detail="2" hidden={activeDetail !== "2"}>
                <noscript><b className="reading-label">Every step</b></noscript>
                {step.reasons.r2}
              </p>
            </div>
            {step.expressions.map((expression, expressionIndex) => (
              <Formula key={step.id + "-" + expressionIndex} expression={expression} />
            ))}
            {activeDetail !== "2" && (
              <details className="step-local-steps">
                <summary>See the assumptions and limits of this step</summary>
                <p>{step.reasons.r2}</p>
              </details>
            )}
            <p className="step-links">
              <a href={"/foundations/" + step.tool.replace("foundation:", "") + "/"}>
                {step.tool === "foundation:work-energy" ? "Review energy accounting" : "Review ratios and positive factors"}
              </a>
              {" · "}
              <a href={"/papers/light-quanta/view/german/#" + step.source.anchor}>
                {step.source.label}
              </a>
            </p>
          </li>
        ))}
      </ol>

      {fluorescence ? (
        <details className="step-local-steps" open>
          <summary>What changes when the one-quantum premises are withdrawn?</summary>
          <p>
            If <i>k</i> absorbed quanta pool their energy into one chosen emitted quantum, the same
            accounting permits the larger bound below. It does not supply the rate of that
            multi-quantum process.
          </p>
          <Formula expression={closingQuantaExpressions.pooledBudget} />
          <p>
            The paper also names radiation outside the energetic regime associated with Wien’s
            law. In that case this heuristic supplies no bound. The fluorescence laboratory
            reports that limitation instead of treating an unlicensed bound as a prediction.
          </p>
          <p>
            The laboratory’s thermal allowance is a separately labelled modern model: energy
            taken from the body can help pay for an emitted quantum. Its chosen thermal budget is
            not a universal temperature-dependent ceiling and is not the paper’s second exception.
          </p>
          <p>
            <a href="/papers/light-quanta/view/german/#s7-p3-s1">Read the two printed exceptions</a>
            {" · "}
            <a href="/lab/lq-07/">Compare the standard bound, pooled quanta and thermal allowance</a>
          </p>
        </details>
      ) : (
        <details className="step-local-steps" open>
          <summary>Which result can the laboratory actually report?</summary>
          <table>
            <caption>Energy permission and ionization yield answer different questions</caption>
            <thead>
              <tr><th scope="col">Accepted situation</th><th scope="col">What follows within this model</th></tr>
            </thead>
            <tbody>
              <tr><th scope="row">A quantum is below the threshold</th><td>No elementary single-quantum ionization is energetically allowed; the count law is not applicable.</td></tr>
              <tr><th scope="row">Enough energy, unknown yield</th><td>The count is underdetermined, with the absorbed quantum count as an upper bound.</td></tr>
              <tr><th scope="row">Enough energy, a declared yield</th><td>The declared fraction supplies a conditional count; the energy threshold did not determine that fraction.</td></tr>
              <tr><th scope="row">Enough energy, every absorbed quantum ionizes</th><td>The paper’s equality follows under that additional premise.</td></tr>
            </tbody>
          </table>
          <p>
            The printed Lenard and Stark comparisons estimate upper limits for the ionization
            work. They do not measure the count law. The paper proposes that further count test
            explicitly; the laboratory’s calculated counts are not independent evidence for it.
          </p>
          <p>
            <a href="/papers/light-quanta/view/german/#s9-p3-s4">Read the proposed experimental test</a>
            {" · "}
            <a href="/lab/lq-09/">Change the frequency and the share of absorptions that ionize</a>
          </p>
        </details>
      )}
    </section>
  );
}
