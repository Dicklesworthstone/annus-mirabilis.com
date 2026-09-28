import type { Metadata } from "next";
import { assumptionKindLabel } from "../../../discovery/capstone/capstoneLabels.ts";
import { loadCapstone } from "../../../discovery/capstone/loadCapstone.ts";
import { consistentOrderCount } from "../../../discovery/shared/dependencyFeedback.ts";
import { FACE_REGISTRY } from "../../../reader/faces/registry.ts";
import { roleLabel } from "../../../reader/passageKind.ts";
import { tapePath } from "../../../reader/sitePaths.ts";
import "../capstones.css";

/**
 * THE MASS-ENERGY CAPSTONE, AS SOMETHING TO READ AND PRINT (am-disc-capstones-infra-3352).
 *
 * WHAT THIS PAGE IS. The record rendered: the claims in the order the paper makes them, each linked
 * to the passage it is read from, with the chain that fixes what must come before what, the
 * assumptions each claim leans on, the three printed displays the capstone annotates, and the two
 * instrument settings that show the quantities moving. A reader who arrives can read the whole
 * argument and print it, which is most of what a capstone is for: explaining the result to another
 * person is done on paper as often as on a screen.
 *
 * WHAT IT IS NOT, AND WHY THAT IS NOT HIDDEN FROM THE READER RATHER THAN ANNOUNCED TO THEM. The
 * editable worksheet, where the claims arrive shuffled into `startOrder` and the reader arranges
 * them, is not built: it needs a notebook entry kind and a forward migration in another module.
 * This page therefore shows the paper's order rather than the shuffled one, because showing a
 * shuffled list with no way to move anything would be a puzzle with the pieces glued down. The
 * missing half is recorded on the bead and in the commit, not as a notice on the page: a reader is
 * owed a page that is honest about what it says, not a running account of what the site has not
 * finished.
 *
 * NO JAVASCRIPT AT ALL. Every element here is server-rendered markup and every action is a link, so
 * the page is identical with scripts off. That is not a fallback arranged for this page; it is what
 * the page is. The print rules live in ../capstones.css.
 *
 * THE NUMBER OF ARRANGEMENTS IS COMPUTED, not authored. `consistentOrderCount` enumerates them from
 * the record's own chain at build time, so the sentence cannot drift from the graph the way a typed
 * number would. It is there because the record's central editorial point is that the chain is a
 * partial order: the paper's sequence is one arrangement that works, not the answer.
 */

const PAPER = "mass-energy";

/**
 * The address of a passage in the edition.
 *
 * IT NAMES A FACE, and that is not a detail. A claim's anchor is a source unit, `s0-p7` or
 * `eq-s0-d4`, and the paper's DEFAULT route does not carry those ids: its default face is the
 * explanation, whose anchors are argument ids. Measured in the build of caa8689f, out/papers/
 * mass-energy/index.html contains none of this page's eight anchors, while the parallel, German and
 * gloss faces contain all eight and the English face five of eight. Linking to the default route
 * would have put every "Read this in the paper" at the top of a page instead of at the sentence.
 * The parallel face is chosen over the German because it shows the English beside it.
 *
 * The face id comes from the registry rather than a string, so removing or renaming that face stops
 * the typechecker here rather than leaving the links pointing at nothing.
 *
 * The path is built here rather than taken from the reader's route helper, because that helper
 * reaches the content compiler through src/content/server.ts and pulled 139 modules into this route
 * for the sake of one path.
 */
function passageHref(anchor: string): string {
  return `/papers/${PAPER}/view/${FACE_REGISTRY.parallel.id}/#${anchor}`;
}

export const metadata: Metadata = {
  title: "Rebuild the September argument",
  description:
    "The mass-energy paper's argument as six claims, each linked to the passage it is read from, with the chain that orders them, the premises they lean on, and the displays and instruments that show them working.",
  alternates: { canonical: "/capstones/mass-energy/" },
};

export default function MassEnergyCapstonePage() {
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
        <p className="eyebrow">Mass and energy · Capstone</p>
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
        <h2>The six claims, in the order the paper makes them</h2>
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
          or asserts rather than establishes, and the fourth claim is where one of them does the
          work.
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
