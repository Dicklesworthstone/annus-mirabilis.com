import type { Metadata } from "next";
import { assumptionKindLabel } from "../../../discovery/capstone/capstoneLabels.ts";
import { loadCapstone } from "../../../discovery/capstone/loadCapstone.ts";
import { consistentOrderCount } from "../../../discovery/shared/dependencyFeedback.ts";
import { FACE_REGISTRY } from "../../../reader/faces/registry.ts";
import { roleLabel } from "../../../reader/passageKind.ts";
import { tapePath } from "../../../reader/sitePaths.ts";
import "../capstones.css";

/**
 * THE LIGHT-QUANTA CAPSTONE, AS SOMETHING TO READ AND PRINT (am-1nnj follow-on, dispatch 360).
 *
 * The third capstone. The record rendered: the claims in the order the paper makes them, each linked
 * to the passage it is read from, the chain that fixes what must come before what, the assumptions
 * each claim leans on, the three printed displays it annotates, and the four instrument settings.
 *
 * THIS PAGE RENDERS A RECORD WHOSE CONCLUSION IS A HEURISTIC, and the page does nothing to firm it
 * up. The question, the claim texts and the limits all carry the paper's own restriction, so a
 * reader who reads only this page still meets an as-if about thermal behaviour in the regime where
 * Wien's law holds, and not a statement about what light is. The page adds no prose of its own to
 * the record beyond the two navigation sentences below, which is why that restriction survives
 * rendering.
 *
 * THE RECORD IS SPECIFIED BY am-disc-capstone-light-quanta-98xc, down to the claim table, both
 * orders and the sixty-three arrangements its five edges admit. The arrangement sentence below is
 * computed from the record, so if the chain is ever edited the page stops agreeing with the bead
 * rather than quietly printing a stale number.
 *
 * WHAT IT IS NOT. The editable worksheet, where the claims arrive in `startOrder` and the reader
 * arranges them, is not built here either, so this page shows the paper's order rather than the
 * shuffled one. A shuffled list with nothing to move would be a puzzle with the pieces glued down.
 * The record carries `startOrder` regardless, because that is the worksheet's starting state and it
 * is authored, not generated.
 *
 * NO JAVASCRIPT AT ALL. Every element is server-rendered markup and every action is a link, so the
 * page is identical with scripts off.
 *
 * THE NUMBER OF ARRANGEMENTS IS COMPUTED from the record's own chain by `consistentOrderCount`, not
 * authored, so the sentence cannot drift from the graph. It is there because the record's editorial
 * point is that the chain is a partial order: the paper's sequence is one arrangement that works.
 */

const PAPER = "light-quanta";

/**
 * The address of a passage in the edition.
 *
 * IT NAMES A FACE for the reason the earlier capstone pages give: a claim's anchor is a SOURCE
 * unit, `s6-p6` or `eq-s4-d5`, and the paper's default route is the explanation face, whose anchors
 * are argument ids. Measured for this paper rather than inherited: rendering /papers/light-quanta/
 * on its default face carries 0 of this page's 13 anchors, and the parallel face carries 13 of 13.
 * The parallel face is chosen over the German because it shows the English beside it.
 *
 * The face id comes from the registry rather than a string, so renaming that face stops the
 * typechecker here rather than leaving every link pointing at nothing.
 */
/**
 * "claim 1 and claim 4", "claim 1, claim 4 and claim 5".
 *
 * The earlier two capstones never needed it: no claim in either has more than two parents, so the
 * plain join read correctly there and "claim 1 and claim 4 and claim 5" only appears once a claim
 * draws on three, which this paper's central inference does.
 */
function usesPhrase(names: readonly string[]): string {
  if (names.length <= 2) return names.join(" and ");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function passageHref(anchor: string): string {
  return `/papers/${PAPER}/view/${FACE_REGISTRY.parallel.id}/#${anchor}`;
}

export const metadata: Metadata = {
  title: "Rebuild the heuristic viewpoint",
  description:
    "The light-quanta paper's argument as seven claims, each linked to the passage it is read from, with the chain that orders them, the regime the inference is confined to, the premises it leans on, and the displays and instruments that show what the entropy comparison licenses.",
  alternates: { canonical: "/capstones/light-quanta/" },
};

export default function LightQuantaCapstonePage() {
  const { capstone, equations } = loadCapstone(PAPER);
  const claimsById = new Map(capstone.claims.map((claim) => [claim.id, claim]));
  const ordered = capstone.paperOrder.flatMap((id) => {
    const claim = claimsById.get(id);
    return claim ? [claim] : [];
  });
  const edges = capstone.claims.flatMap((claim) =>
    claim.buildsOn.map((from) => ({ from, to: claim.id })),
  );
  const arrangements = consistentOrderCount(
    capstone.claims.map((claim) => claim.id),
    edges,
  );
  const position = new Map(capstone.paperOrder.map((id, index) => [id, index + 1]));

  return (
    <>
      <header className="page-intro">
        <p className="eyebrow">Light quanta · Capstone</p>
        <h1>{capstone.title}</h1>
        <p className="lead">{capstone.question}</p>
      </header>

      <section className="reading" id="the-task">
        <h2>What to do with this page</h2>
        <p>{capstone.explanationPrompt}</p>
        <p>
          Each claim below links to the passage it is read from. Follow the links and the argument
          is the paper's; read only this page and it is a summary of the paper, which is a different
          thing and says so.
        </p>
        <p>
          <a className="button" href={`/papers/${PAPER}/`}>
            Open the paper
          </a>
        </p>
      </section>

      <section className="reading" id="claims">
        <h2>The seven claims, in the order the paper makes them</h2>
        <p className="capstone-chain">
          {arrangements === undefined
            ? "The chain below fixes what must come before what. The paper's sequence is one arrangement that satisfies it."
            : `The chain below fixes what must come before what, and ${arrangements} ${
                arrangements === 1 ? "arrangement satisfies" : "arrangements satisfy"
              } it. The paper prints one of them; the others are not mistakes.`}
        </p>
        <ol className="capstone-claims">
          {ordered.map((claim) => (
            <li className="capstone-claim" id={claim.id} key={claim.id}>
              <p className="capstone-claim-head">
                <span className="capstone-role">{roleLabel(claim.logicalRole)}</span>
                {claim.buildsOn.length > 0 ? (
                  <span className="capstone-builds">
                    {"Uses "}
                    {usesPhrase(
                      claim.buildsOn.map((from) => `claim ${position.get(from) ?? from}`),
                    )}
                  </span>
                ) : (
                  <span className="capstone-builds">Needs nothing before it</span>
                )}
              </p>
              <p>{claim.text}</p>
              <p className="capstone-source">
                <a href={passageHref(claim.anchor)}>Read this in the paper</a>
              </p>
              {capstone.selfCheckNotes[claim.id] === undefined ? null : (
                <p className="capstone-note">{capstone.selfCheckNotes[claim.id]}</p>
              )}
            </li>
          ))}
        </ol>
      </section>

      <section className="reading" id="assumptions">
        <h2>What the argument is granted</h2>
        <p>
          Every claim above names the assumptions it uses. These are the things the paper is given
          or asserts rather than establishes. Two of them are worth finding before the rest: the
          regime is a boundary the argument stays inside rather than a premise it leans on, and the
          further hypothesis that light is emitted and absorbed in quanta is an extension of the
          result above it rather than a consequence of it.
        </p>
        <ul className="capstone-assumptions">
          {capstone.assumptions.map((assumption) => (
            <li key={assumption.id}>
              <p className="capstone-kind">{assumptionKindLabel(assumption.kind)}</p>
              <p>{assumption.statement}</p>
              {assumption.anchor === undefined ? null : (
                <p className="capstone-source">
                  <a href={passageHref(assumption.anchor)}>Where the paper says it</a>
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="reading" id="equations">
        <h2>The displays this argument turns on</h2>
        <ul className="capstone-equations">
          {equations.map((equation) => (
            <li className="capstone-equation" key={equation.equationId}>
              <h3>{equation.title}</h3>
              <p>{equation.purpose}</p>
              <p className="capstone-spoken">{equation.spoken}</p>
              <p className="capstone-source">
                <a href={passageHref(equation.displayUnit)}>See it printed in the paper</a>
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="reading" id="instruments">
        <h2>Where to watch the quantities move</h2>
        <ul className="capstone-settings">
          {capstone.presets.map((preset) => (
            <li
              className="capstone-setting"
              key={`${preset.instrumentId}-${preset.tapeId ?? preset.presetId ?? ""}`}
            >
              <p>{preset.purpose}</p>
              <p className="capstone-source">
                <a href={`/lab/${preset.instrumentId}/`}>
                  Open {preset.instrumentId.toUpperCase()}
                </a>
                {preset.tapeId === undefined ? null : (
                  <>
                    {" · "}
                    <a href={tapePath(preset.tapeId)}>Follow the tape</a>
                  </>
                )}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="reading" id="limits">
        <h2>What this does not claim</h2>
        <p className="capstone-limits">{capstone.limits}</p>
      </section>
    </>
  );
}
