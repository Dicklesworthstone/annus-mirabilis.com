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
 * THE RELATIVITY CAPSTONE (am-disc-capstone-relativity-t8hg, dispatch 363).
 *
 * The fourth and largest. The record rendered: nine claims in the order the paper makes them, each
 * linked to the passage it is read from, the chain that fixes what must come before what, the ten
 * assumptions the claims lean on, four printed displays, and four instrument settings.
 *
 * BOTH HALVES OF THE PAPER ARE HERE, which is the reason this record is nine claims rather than
 * five. AGENTS.md: "The difficult closing sections (paper 3, sections 6 to 10) never disappear
 * behind the familiar headlines." Four of the nine are the electrodynamical part, and the anchors
 * reach sections six, eight, nine and ten.
 *
 * WHAT THE PAGE ASKS A READER TO SEPARATE is what the paper chooses from what it derives. The record
 * marks the two choices as assumptions rather than steps: the synchronization of distant clocks (a
 * stipulation, section one) and the definition of force behind the electron's two masses (a
 * convention, section ten). The assumptions section below names both in its opening sentence,
 * because a reader who misses them reads a definition as a discovery.
 *
 * NO MATHEMATICS IN THE RECORD'S PROSE. Claim text is rendered as text, so a formula in it would
 * reach a reader as raw LaTeX. The notation is therefore stated in words, which is also what the
 * concordance requires: Einstein's beta is the modern gamma, his tau is the moving system's time and
 * not the modern proper time, and section three's auxiliary coordinate is not the moving system's
 * own. The symbols themselves arrive through the four equation records, from their expression trees.
 *
 * NO JAVASCRIPT AT ALL. Every element is server-rendered markup and every action is a link, so the
 * page is identical with scripts off. The editable worksheet, where the claims arrive in `startOrder`
 * for the reader to arrange, belongs to am-disc-capstones-infra-3352 and is not built here, so this
 * page shows the paper's order; the record carries `startOrder` regardless, because that is the
 * worksheet's authored starting state.
 */

const PAPER = "special-relativity";

/**
 * The address of a passage in the edition.
 *
 * MEASURED FOR THIS PAPER rather than inherited from the sibling pages, against the built HTML of
 * all seven faces. The denominator is 20, read off this page's own rendered links rather than
 * counted by hand, which is how the first attempt at this comment came out at 19: it dropped the
 * field display. Of those 20, the paper's default route carries 0, the English face carries 7 (the
 * six displays and the section-one footnote, and none of the paragraphs), and the German, parallel
 * and facsimile faces each carry 20 of 20. The parallel face is chosen among those three for the
 * reason the earlier capstones give: it shows the English beside the German the claims were read
 * from.
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
  title: "Rebuild the electrodynamics of moving bodies",
  description:
    "The relativity paper's argument as nine claims across both of its parts, each linked to the passage it is read from, with the chain that orders them, the two steps the paper chooses rather than derives, and the displays and instruments that show what follows from them.",
  alternates: { canonical: "/capstones/special-relativity/" },
};

export default function SpecialRelativityCapstonePage() {
  const { capstone, equations } = loadCapstone(PAPER);
  const claimsById = new Map(capstone.claims.map((claim) => [claim.id, claim]));
  const ordered = capstone.paperOrder.flatMap((id) => {
    const claim = claimsById.get(id);
    return claim ? [claim] : [];
  });
  const edges = capstone.claims.flatMap((claim) =>
    claim.buildsOn.map((from) => ({ from, to: claim.id })),
  );
  // THE LIMIT IS RAISED BY ONE, DELIBERATELY AND MEASURED. `consistentOrderCount` enumerates
  // permutations and refuses past eight items, because eight is forty thousand arrangements and the
  // author would not pay for more at build time. This record has nine claims, fixed by its bead, so
  // the default returns undefined and the sentence below would fall back to saying nothing. Nine is
  // 362,880 arrangements and cost 690 ms, twice measured, once per build for this one page. The
  // answer, 105, was confirmed by counting linear extensions with a subset dynamic program, which
  // touches no permutation, and by hand from the chain's shape. A tenth claim would want the
  // dynamic program in the shared helper rather than a higher limit here.
  const arrangements = consistentOrderCount(
    capstone.claims.map((claim) => claim.id),
    edges,
    9,
  );
  const position = new Map(capstone.paperOrder.map((id, index) => [id, index + 1]));

  return (
    <>
      <header className="page-intro">
        <p className="eyebrow">On the electrodynamics of moving bodies · Capstone</p>
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
        <h2>The nine claims, in the order the paper makes them</h2>
        <p className="capstone-chain">
          {arrangements === undefined
            ? "The chain below fixes what must come before what. The paper's sequence is one arrangement that satisfies it."
            : `The chain below fixes what must come before what, and ${arrangements} ${
                arrangements === 1 ? "arrangement satisfies" : "arrangements satisfy"
              } it. The paper prints one of them; the others are not mistakes.`}
        </p>
        <p>
          The first five claims are the kinematical part and the last four are the electrodynamical
          one. The second half is where the paper does the work its title promises, and it is the
          half a summary usually drops.
        </p>
        <ol className="capstone-claims">
          {ordered.map((claim) => (
            <li className="capstone-claim" id={claim.id} key={claim.id}>
              <p className="capstone-claim-head">
                <span className="capstone-role">{roleLabel(claim.logicalRole)}</span>
                {claim.buildsOn.length > 0 ? (
                  <span className="capstone-builds">
                    {"Uses "}
                    {/* No claim in this record draws on more than two others, so the plain join
                        reads correctly; the light-quanta capstone needed a serial comma because its
                        central inference draws on three. */}
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
          Every claim above names the assumptions it uses. Two of them are the paper's own choices
          rather than things it establishes, and they are the two this capstone exists to separate
          out: the stipulation that light takes equal times out and back, which is how distant
          clocks are set, and the definition of force behind the electron's two masses, which the
          paper names as a choice in its closing paragraph. The rest are premises and idealizations.
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
                /* NOT aria-hidden, and that was wrong until dispatch 430. Measured at 320px on the
                   build of 570adcc4: one of these 13 elements overflows (scrollWidth 319 against
                   clientWidth 288, the mass-energy low-speed drop), and initFormulaOverflow scans
                   every element and gives any region that actually scrolls a tabindex="0" and an
                   aria-label. With aria-hidden on the wrapper that produced a focusable element
                   hidden from assistive technology: a tab stop that announces nothing, which is
                   worse than either state alone. The formula is still announced once, because the
                   KaTeX html carries aria-hidden on its own visual layer and holds no MathML, so
                   the spoken paragraph below remains the only thing read out. */
                <div
                  className="capstone-math"
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
