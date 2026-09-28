import type { Metadata } from "next";
import { assumptionKindLabel } from "../../../discovery/capstone/capstoneLabels.ts";
import { loadCapstone } from "../../../discovery/capstone/loadCapstone.ts";
import { consistentOrderCount } from "../../../discovery/shared/dependencyFeedback.ts";
import { FACE_REGISTRY } from "../../../reader/faces/registry.ts";
import { roleLabel } from "../../../reader/passageKind.ts";
import { tapePath } from "../../../reader/sitePaths.ts";
import { renderedEquation } from "../renderedEquations.ts";
import "../capstones.css";

/**
 * THE BROWNIAN CAPSTONE, AS SOMETHING TO READ AND PRINT (am-1nnj follow-on, dispatch 355).
 *
 * The second capstone, built on the substrate the mass-energy page proved end to end. The record
 * rendered: the claims in the order the paper makes them, each linked to the passage it is read
 * from, the chain that fixes what must come before what, the assumptions each claim leans on, the
 * three printed displays it annotates, and the two instrument settings that show the quantities
 * moving.
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

const PAPER = "brownian-motion";

/**
 * The address of a passage in the edition.
 *
 * IT NAMES A FACE for the reason the mass-energy page gives: a claim's anchor is a SOURCE unit,
 * `s1-p3` or `eq-s4-1`, and the paper's default route is the explanation face, whose anchors are
 * argument ids. Verified for this paper rather than assumed from that one: rendering
 * /papers/brownian-motion/ on its default face carries none of this page's twelve anchors, and the
 * parallel face carries all twelve. The parallel face is chosen over the German because it shows
 * the English beside it.
 *
 * The face id comes from the registry rather than a string, so renaming that face stops the
 * typechecker here rather than leaving every link pointing at nothing.
 */
function passageHref(anchor: string): string {
  return `/papers/${PAPER}/view/${FACE_REGISTRY.parallel.id}/#${anchor}`;
}

/** This paper's build-time rendering for one equation id (../renderedEquations.ts). */
function math(equationId: string) {
  return renderedEquation(PAPER, equationId);
}

export const metadata: Metadata = {
  title: "Rebuild the argument for the spread",
  description:
    "The Brownian paper's argument as seven claims, each linked to the passage it is read from, with the chain that orders them, the premises they lean on, and the displays and instruments that show a spread growing as the square root of the time.",
  alternates: { canonical: "/capstones/brownian-motion/" },
};

export default function BrownianCapstonePage() {
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
        <p className="eyebrow">Brownian motion · Capstone</p>
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
                    {claim.buildsOn
                      .map((from) => `claim ${position.get(from) ?? from}`)
                      .join(" and ")}
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
          or asserts rather than establishes, and the first claim is where the contested one does
          the work: the paper adopts a view on which its conclusion follows and says plainly that
          classical thermodynamics denies it.
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
              {/* THE EQUATION ITSELF, from src/generated/<paper>-equations.json, which
                  scripts/build-equations.ts compiled from this record's expression tree. Nothing is
                  rendered or retyped here; see ../renderedEquations.ts for why the spoken form alone
                  was not enough. aria-hidden because the spoken paragraph below is this formula's
                  accessible name, and a reader with a screen reader should hear it once. */}
              {math(equation.equationId) === undefined ? null : (
                <div
                  className="capstone-math"
                  aria-hidden="true"
                  // biome-ignore lint/security/noDangerouslySetInnerHtml: KaTeX written by scripts/build-equations.ts from this record's own tree, the same bytes the reading faces render.
                  dangerouslySetInnerHTML={{ __html: math(equation.equationId)?.html ?? "" }}
                />
              )}
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
