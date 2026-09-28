import { notFound } from "next/navigation";
import { loadTeachingTapes } from "../../../content/teachingTapes.ts";
import { commandClassInWords } from "../../../experiments/commands/types.ts";
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
 */
/** What scripts/generate-tape-links.ts writes for a tape whose instrument accepts its opening state. */
type TapeSettingsLinks = Readonly<
  Record<string, Readonly<{ experimentId: string; href: string; kind: string }> | undefined>
>;

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
          <table className="tape-table">
            <caption>
              The settings the tape begins from
              {tape.constantSetId ? `, under the constant set ${tape.constantSetId}` : ""}. Values
              are the model&apos;s own, not the laboratory control&apos;s display: a radius of 5e-7
              is half a micrometre.
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
              {step.expected.length > 0 ? (
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
                        <th scope="row">{value.label}</th>
                        <td>
                          {value.value}
                          {value.unit ? ` ${value.unit}` : ""}
                        </td>
                        <td>{value.constantSetId ?? tape.constantSetId ?? "the lab's own set"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
