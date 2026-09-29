import { notFound } from "next/navigation";
import { loadTeachingTapes } from "../../../content/teachingTapes.ts";
import { commandClassInWords } from "../../../experiments/commands/types.ts";
import { numberText, unitText } from "../../../experiments/controls/declaredDomain.ts";
import tapeLinks from "../../../generated/tape-links.json";
import "../tapes.css";

/**
 * ONE TEACHING TAPE, AS A WALKTHROUGH A READER CAN FOLLOW (am-2rl9).
 *
 * AGENTS.md names five teaching tapes as a feature and describes a scrubber that restores one.
 * Measured 2026-09-27, all 21 authored tapes reached no reader by any route: the replayer and the
 * recorder had no non-test consumer, no tour cited a tape, and the only implementation of the
 * replayer's `resolveTeachingTape` hook was a test fixture. The records were complete and nothing
 * read them.
 *
 * WHY A PAGE AND NOT A BUTTON. A tape is already a worked walkthrough on paper: initial conditions,
 * a sequence of changes each carrying the command class it belongs to, and at the checkpoints a
 * label, a teaching note and the numbers the author says to expect, with the unit and the constant
 * set each was computed under. Rendered as a page, all of that reaches a reader with no JavaScript,
 * on a slow phone, and through a shared link, which a control inside an instrument does not. The
 * instrument is one press away at the top and the bottom.
 *
 * WHAT THE PAGE DOES NOT CLAIM. It does not run anything. Every number here is the number the author
 * recorded, shown as an expectation, and the page says so rather than presenting it as a result.
 *
 * THE OPENING SETTINGS TRAVEL (am-2rl9, second unit). Where the laboratory accepts them, the link to
 * the instrument carries the walkthrough's opening state in the `?tape=` link the laboratory already
 * restores on load, so a reader arrives set up rather than copying numbers off this page by hand.
 * scripts/generate-tape-links.ts builds each link through the LABORATORY'S OWN binding, so a link
 * exists only where the instrument accepts that state; 19 of 21 do, and the other two keep the plain
 * link and this page's older sentence. The link carries the opening state only and replays nothing:
 * the recorded checkpoints hold placeholder digests, so a replay would verify nothing.
 *
 * WITHOUT JAVASCRIPT the settings do not arrive, because the laboratory reads the link after mount.
 * That is the state a laboratory is in anyway with no script, and it says so itself; the page does
 * not promise otherwise.
 *
 * WHAT THE READER IS SHOWN A QUANTITY CALLED, AND HOW MANY (dispatch 325). A checkpoint addresses the
 * evaluator's output by its snapshot field id, so this page showed rows named `pulseSumMoving` and
 * `pulseEnergyRatio`. Each label is now resolved through the canonical quantity registry where a
 * record says which quantity the field holds, and the field id stays beside the name in parentheses,
 * exactly as it already did for a control. WHICH HALF EACH ROW IS IN: of the 29 recorded values, 9 are
 * named through the registry (3 because the field id is itself a canonical quantity id, and 6 because
 * the instrument's own manifest declares which quantity that output or kernel identifier holds) and 20
 * keep their id. Those 20 are 18 distinct labels, and they are not one gap: 9 are already authored
 * prose ("center of mass shift", "lambda_x at 1 s", "system energy change") and want no translation,
 * while 9 are id-shaped with no record yet declaring which quantity they hold.
 *
 * THE NUMBER AND ITS UNIT COME FROM THE LABORATORIES' OWN WRITER, `numberText` and `unitText`, so a
 * tape and the instrument it belongs to do not disagree about how to print 10¹⁷ or a dimensionless
 * ratio. Before this, /tapes/the-two-pulses/ showed `0.4042339787513938 1`: sixteen significant
 * figures from a model whose inputs are rough, with a bare "1" hanging after them as a unit. The
 * recorded double is not lost, it moves into the `value` attribute of a `<data>` element, which keeps
 * the separation AGENTS.md asks for between a stored full-precision value and a formatted one and
 * leaves the record verifiable from the page itself.
 *
 * TWO SETTINGS ROWS STILL SHOW THEIR IDS, and the reason is worth writing down rather than papering
 * over: perrins-count sets `d` and `coverage`, and BM-07's manifest declares neither as a parameter,
 * so `conditionNames` has nothing for them and neither is a registry id. Its evaluator does carry a
 * private phrase table, and that table is NOT used here on purpose: it reads "the target interval
 * coverage, in percent," while the tape records the fraction 0.95, so borrowing it would label that
 * row wrong by a hundred. The repair belongs in bm-07's manifest, where a control is declared.
 */
/** What scripts/generate-tape-links.ts writes for a tape whose instrument accepts its opening state. */
type TapeSettingsLinks = Readonly<
  Record<string, Readonly<{ experimentId: string; href: string; kind: string }> | undefined>
>;

/**
 * A recorded expectation as the laboratories write one: six significant figures, a power of ten
 * where the size asks for one, and no unit at all for a pure number, so a ratio reads "0.404234"
 * rather than "0.4042339787513938 1".
 */
function recordedValue(value: number, unit: string | undefined): string {
  const text = unitText(unit ?? "");
  return `${numberText(value)}${!text ? "" : text === "°" ? text : ` ${text}`}`;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return loadTeachingTapes().tapes.map((tape) => ({ tape: tape.tapeId }));
}

export async function generateMetadata({ params }: { params: Promise<{ tape: string }> }) {
  const { tape: tapeId } = await params;
  const tape = loadTeachingTapes().tapes.find((t) => t.tapeId === tapeId);
  if (!tape) return {};
  return {
    title: `${tape.title}: a teaching tape`,
    description: (tape.description ?? `A recorded walkthrough of ${tape.experimentId}.`).slice(
      0,
      160,
    ),
  };
}

export default async function Page({ params }: { params: Promise<{ tape: string }> }) {
  const { tape: tapeId } = await params;
  const tape = loadTeachingTapes().tapes.find((t) => t.tapeId === tapeId);
  if (!tape) notFound();
  const conditions = Object.entries(tape.initialConditions);
  const lab = `/lab/${tape.experimentId}/`;
  const settingsLink = (tapeLinks.links as unknown as TapeSettingsLinks)[tape.tapeId];
  const openHref = settingsLink?.href ?? lab;
  // The instrument's short id reads inside a sentence; its manifest name stands beside the title.
  const shortName = tape.instrument?.id ?? tape.experimentId;
  const openText = settingsLink
    ? `Open ${shortName} with these settings`
    : `Open ${shortName} and follow it`;
  return (
    <main className="tape-page">
      <p className="eyebrow">
        A teaching tape for {shortName}
        {tape.instrument ? `, ${tape.instrument.name}` : null}
      </p>
      <h1>{tape.title}</h1>
      {tape.description ? <p className="tape-description">{tape.description}</p> : null}
      <p className="tape-to-lab">
        <a href={openHref}>{openText}</a>
      </p>

      {conditions.length > 0 ? (
        <section aria-labelledby="tape-start">
          <h2 id="tape-start">Where it starts</h2>
          <section
            className="table-scroll"
            // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be focusable (WCAG 2.1.1)
            tabIndex={0}
            aria-label="The settings the tape begins from"
          >
            <table className="tape-table">
              <caption>
                The settings the tape begins from
                {tape.constantSetId ? `, under the constant set ${tape.constantSetId}` : ""}. Values
                are the model&apos;s own, not the laboratory control&apos;s display: a radius of
                5e-7 is half a micrometre.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Setting</th>
                  <th scope="col">Value</th>
                </tr>
              </thead>
              <tbody>
                {conditions.map(([name, value]) => (
                  <tr key={name}>
                    <th scope="row">
                      {tape.conditionNames[name]?.label ?? name}
                      {tape.conditionNames[name] ? (
                        <span className="tape-raw-id"> ({name})</span>
                      ) : null}
                    </th>
                    <td>{String(value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </section>
      ) : null}

      <section aria-labelledby="tape-steps">
        <h2 id="tape-steps">What it changes, and what to expect</h2>
        <ol className="tape-steps">
          {tape.steps.map((step) => (
            <li key={step.actionIndex}>
              <p className="tape-change">
                {step.parameterId ? (
                  <>
                    Set <b>{step.parameterName?.label ?? step.parameterId}</b>
                    {step.parameterName ? (
                      <span className="tape-raw-id"> ({step.parameterId})</span>
                    ) : null}
                    {step.value === undefined ? null : <> to {step.value}</>}
                  </>
                ) : step.actionIndex === 0 ? (
                  <>Where it starts, before anything changes</>
                ) : step.prediction ? (
                  <>A question to answer before the next change</>
                ) : (
                  <>Step {step.actionIndex}</>
                )}
                {step.commandClass ? (
                  <span className="tape-command-class" data-command-class={step.commandClass}>
                    {" "}
                    {commandClassInWords(step.commandClass) ?? step.commandClass}
                  </span>
                ) : null}
              </p>
              {step.label ? <p className="tape-step-label">{step.label}</p> : null}
              {step.teachingNote ? <p className="tape-note">{step.teachingNote}</p> : null}
              {/* THE PREDICTION THE WALKTHROUGH PAUSES ON (dispatch 393). Two of the 22 records
                  carry a prediction event, and it reached this page as the bare words "Step 1":
                  the question, its candidates and the author's own answer were all in the corpus
                  and none of them was rendered. The question and the candidates come from the
                  instrument's prompt record and the answer from the event's payload; nothing here
                  is authored. The author's choice sits inside a closed `details` so a reader can
                  answer first, which is the site's own pattern for a prediction and needs no
                  JavaScript. */}
              {step.prediction ? (
                <>
                  <p>{step.prediction.question}</p>
                  <ul>
                    {step.prediction.candidates.map((candidate) => (
                      <li key={candidate.label}>
                        <b>{candidate.label}</b>
                        {candidate.description ? <> {candidate.description}</> : null}
                      </li>
                    ))}
                  </ul>
                  {step.prediction.recorded ? (
                    <details data-tape-prediction>
                      <summary>The answer this tape&apos;s author recorded</summary>
                      <p className="tape-note">{step.prediction.recorded}</p>
                    </details>
                  ) : null}
                </>
              ) : null}
              {step.expected.length > 0 ? (
                <section
                  className="table-scroll"
                  // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be focusable (WCAG 2.1.1)
                  tabIndex={0}
                  aria-label="What the author recorded that a reader should see at this step"
                >
                  <table className="tape-table">
                    <caption>What the author recorded that a reader should see here.</caption>
                    <thead>
                      <tr>
                        <th scope="col">Quantity</th>
                        <th scope="col">Expected</th>
                        <th scope="col">Under</th>
                      </tr>
                    </thead>
                    <tbody>
                      {step.expected.map((value) => (
                        <tr key={value.label}>
                          <th scope="row">
                            {value.quantity?.text ?? value.label}
                            {value.quantity ? (
                              <span className="tape-raw-id"> ({value.label})</span>
                            ) : null}
                          </th>
                          <td>
                            <data value={String(value.value)}>
                              {recordedValue(value.value, value.unit)}
                            </data>
                          </td>
                          <td>
                            {value.constantSetId ?? tape.constantSetId ?? "the lab's own set"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              ) : null}
            </li>
          ))}
        </ol>
      </section>

      <p className="tape-honesty">
        These are the values the tape&apos;s author recorded, not a result this page computed.
        Nothing here runs the instrument.{" "}
        {settingsLink ? (
          <>
            <a href={settingsLink.href}>{openText}</a>
            {settingsLink.kind === "form"
              ? ": the link puts them in its form, and it calculates when you apply them."
              : ": the link opens it with them already in place."}{" "}
            Compare what it gives you with what is recorded here. The settings travel in the link
            and the laboratory reads them as it loads, so without JavaScript it opens at its worked
            example instead.
          </>
        ) : (
          <>
            Set them yourself in <a href={lab}>{shortName}</a> and compare what it gives you.
          </>
        )}
      </p>
      {/* WHAT THE PARAGRAPH ABOVE ASKS FOR (dispatch 393). That paragraph has always told a reader
          to compare what the instrument gives them with what is recorded here, and the page withheld
          the three things that decide whether a difference is a disagreement at all: the seed, the
          model version and the random-stream semantics. All three are in every one of the 22 records
          and none of them reached a reader. A run under a different seed is a different run.

          THE ARTIFACT DIGEST IS LEFT OUT ON PURPOSE. Measured 2026-09-28: 0 of the 22 records carry a
          real hex digest and all 22 carry a placeholder, so printing one would hand a reader a
          fabricated identity. AGENTS.md puts detailed artifact identity in an expandable model note
          rather than on the page, and there is nothing honest to put there yet. */}
      <section aria-labelledby="tape-recorded-under">
        <h2 id="tape-recorded-under">What these numbers were recorded under</h2>
        <section
          className="table-scroll"
          // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be focusable (WCAG 2.1.1)
          tabIndex={0}
          aria-label="The identities the recorded values belong to"
        >
          <table className="tape-table">
            <caption>
              The identities the recorded values belong to. The same instrument run under a
              different seed, or under a later version of its model, gives different numbers without
              either set being wrong.
            </caption>
            <thead>
              <tr>
                <th scope="col">Identity</th>
                <th scope="col">Recorded as</th>
              </tr>
            </thead>
            <tbody>
              {tape.model ? (
                <tr>
                  <th scope="row">Model</th>
                  <td>
                    {tape.model.id}{" "}
                    <span className="tape-raw-id">version {tape.model.version}</span>
                  </td>
                </tr>
              ) : null}
              {tape.seed ? (
                <tr>
                  <th scope="row">Seed</th>
                  <td>
                    <data value={tape.seed}>{tape.seed}</data>
                  </td>
                </tr>
              ) : null}
              {tape.streamVersion === undefined ? null : (
                <tr>
                  <th scope="row">Random-stream semantics</th>
                  <td>version {tape.streamVersion}</td>
                </tr>
              )}
              {/* NO CONSTANT-SET ROW, for two reasons found by the voice lint rather than by review.
                It is already on this page, in the caption of "Where it starts", so a row here was
                repeating the page to itself. And printing it twice doubled a leak: coin-to-bell's
                record carries `constantSetId: not-applicable`, a typed status name that AGENTS.md
                says never reaches a reader, and checkVoice went from 1 finding to 2 when this row
                existed. The leak is a content defect in that record and is reported, not patched
                here with a special case. */}
            </tbody>
          </table>
        </section>
      </section>

      {tape.passages.length > 0 ? (
        <nav className="tape-onward" aria-label="Where this is in the paper">
          {/* The instrument's manifest already declares the passages it interrogates
              (sourceRefs), and until now nothing downstream of a tape read them: the walkthrough
              named its instrument and the instrument named its paper, and the reader made the
              second hop themselves. Each href is resolved against the paper's own record, so a
              section that does not exist produces no link rather than a dead one. */}
          <h2>Where this is in the paper</h2>
          <ul>
            {tape.passages.map((passage) => (
              <li key={passage.href}>
                <a href={passage.href}>{passage.sectionTitle}</a>{" "}
                <span className="tape-paper-name">{passage.paperTitle}</span>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      <p className="tape-to-lab">
        <a href="/tapes/">Every teaching tape</a>
      </p>
    </main>
  );
}
