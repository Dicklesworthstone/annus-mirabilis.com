"use client";

import { useId, useState } from "react";
import { CHANGE_CASES, CLASS_WORDS, kindOf } from "../../foundations/descriptionOrWorld.ts";
import { type HeadingLevel, headingTag } from "./headingLevel.ts";

/**
 * The "change the description, keep the world" comparison of foundation:conservation-symmetry.
 * The changes and their classes come from src/foundations/descriptionOrWorld.ts, in the runtime's
 * own command-class vocabulary; this component only lets a reader pick one and reads it out.
 */
export function DescriptionOrWorld({ headingLevel = 3 }: { readonly headingLevel?: HeadingLevel }) {
  const headingId = useId(),
    groupName = `change-${useId().replace(/[^a-zA-Z0-9]/g, "")}`,
    Title = headingTag(headingLevel),
    Sub = headingTag(headingLevel, 1);
  const [choice, setChoice] = useState(CHANGE_CASES[0]?.id ?? "");
  const picked = CHANGE_CASES.find((c) => c.id === choice) ?? CHANGE_CASES[0];

  return (
    <section
      className="foundation-construction"
      aria-labelledby={headingId}
      data-foundation-construction="conservation-symmetry"
    >
      <Title id={headingId} className="construction-title">
        Try it: a change of description, or a change of the world?
      </Title>
      <p>
        A body at rest sends out two equal pulses of light, L in all, in opposite directions. Pick
        something to do to this experiment, and read whether it changes how the experiment is
        described or the experiment itself.
      </p>

      <fieldset className="construction-controls">
        <legend>Pick a change</legend>
        {CHANGE_CASES.map((c) => (
          // .check: the site's radio row, 44px tall with a 20px control (globals.css).
          <label key={c.id} className="check">
            <input
              type="radio"
              name={groupName}
              value={c.id}
              checked={c.id === choice}
              onChange={() => setChoice(c.id)}
            />
            {c.label}
          </label>
        ))}
      </fieldset>

      {picked && (
        <div className="construction-display" role="status">
          <p>
            <strong>
              This is {CLASS_WORDS[picked.commandClass]}: a change of{" "}
              {kindOf(picked.commandClass) === "world" ? "the world" : "description"}.
            </strong>{" "}
            {kindOf(picked.commandClass) === "description"
              ? "Nothing in the experiment changes, only how it is described or recorded."
              : picked.outcomeChanges
                ? "The experiment and its outcome both change."
                : "The experiment is a new one, and its outcome is the same: that makes the change a symmetry."}
          </p>
          <p>What changes: {picked.changes}</p>
          <p>What stays: {picked.stays}</p>
        </div>
      )}

      <div className="construction-text-equivalent">
        <Sub>What it shows, in words</Sub>
        <p>
          Of the seven changes, two change the world: turning the whole apparatus, which is a new
          run and a symmetry because its outcome is the same, and heating the body, which changes
          the outcome. The other five change only the description: a moving observer sees the pulses
          carry 0.25L and L instead of 0.5L each, with each frame's energy balance still holding; a
          relabelling, a slower detector, a different estimate and a new colour change the numbers,
          the readings or the picture, never the experiment. These are the same classes the site's
          laboratories use to keep an observer change from ever starting a new experiment.
        </p>
      </div>
    </section>
  );
}
