"use client";

import { useId, useState } from "react";
import { embedInstrument } from "../../experiments/embed/catalogue.ts";
import { ENTROPY_TEMPERATURE_CHECK } from "../../foundations/lessonInstruments.ts";
import { type HeadingLevel, headingTag } from "./headingLevel.ts";

/**
 * The entropy-temperature lesson's construction: the check §3 rests on, worked at one state, and
 * the radiation entropy workbench (LQ-04) opened at that state, by id, never reimplemented. Where
 * the workbench is not an admitted embed, the worked check stands alone with a status line.
 */
export function EntropyTemperatureCheck({
  headingLevel = 3,
  instrumentId = ENTROPY_TEMPERATURE_CHECK.instrumentId,
}: {
  readonly headingLevel?: HeadingLevel;
  /** Overridable so the unavailable path can be rendered in a test. */
  readonly instrumentId?: string;
}) {
  const headingId = useId(),
    Title = headingTag(headingLevel),
    Sub = headingTag(headingLevel, 1);
  const instrument = embedInstrument(instrumentId);
  // The frame is added only once the reader opens the disclosure: measured in Chromium, a lazy
  // iframe inside a closed <details> still fetched the laboratory.
  const [open, setOpen] = useState(false);
  const { frequencyTHz, temperatureK } = ENTROPY_TEMPERATURE_CHECK;

  return (
    <section
      className="foundation-construction"
      aria-labelledby={headingId}
      data-foundation-construction="entropy-temperature"
    >
      <Title id={headingId} className="construction-title">
        Try it: the entropy slope is one over the temperature
      </Title>
      <p>
        Wien's law gives the density ρ of light of one frequency ν at a temperature T: ρ = αν³e
        <sup>−βν/T</sup>. §3 of the light paper asks how fast the radiation's entropy density grows
        as its density grows, at fixed volume and frequency, and the answer has to be 1/T. Here is
        the check at one state, {frequencyTHz} terahertz and {temperatureK} kelvin.
      </p>
      <ol className="derivation-steps">
        <li>Solved for the exponent, Wien's law says ln(ρ/αν³) = −βν/T.</li>
        <li>
          The entropy density of that light is −(ρ/βν)(ln(ρ/αν³) − 1). Its slope with respect to ρ
          is −(1/βν) ln(ρ/αν³), because the derivative of ρ ln ρ − ρ is ln ρ.
        </li>
        <li>
          Put in the exponent: the slope is (βν/T) ÷ βν = 1/T, whatever βν is. At {temperatureK} K
          that is 1 ÷ {temperatureK} = 3.333 × 10⁻⁴ per kelvin.
        </li>
        <li>
          At {frequencyTHz} THz, βν = hν/k is about 28 800 K, so βν/T is about 9.60: the light is
          dilute, well inside the range where Wien's law holds.
        </li>
      </ol>

      {instrument ? (
        <>
          <p>
            The radiation entropy workbench, LQ-04, starts at this state, with the volume unchanged.
            Its table shows the temperature recovered from the density: {temperatureK} K at both
            ends. <a href={`/lab/${instrumentId}/`}>Open the {instrument.title.toLowerCase()}</a>.
          </p>
          <details onToggle={(e) => setOpen(e.currentTarget.open)}>
            <summary>Show the workbench here</summary>
            {open && (
              <iframe
                src={`/embed/lab/${instrumentId}/`}
                title={`${instrument.title}, at ${frequencyTHz} THz and ${temperatureK} K`}
                referrerPolicy="no-referrer"
              />
            )}
          </details>
        </>
      ) : (
        <p className="construction-status">
          The interactive version is not yet available. The worked check above is complete without
          it.
        </p>
      )}

      <div className="construction-text-equivalent">
        <Sub>What it shows, in words</Sub>
        <p>
          The temperature can be read from how an entropy changes: at fixed volume, the entropy of a
          body rises by the energy it gains divided by its temperature. For radiation obeying Wien's
          law the slope of the entropy density with respect to the energy density comes out exactly
          one over the temperature, at every frequency where the law holds. At {frequencyTHz}{" "}
          terahertz and {temperatureK} kelvin it is 3.333 × 10⁻⁴ per kelvin.
        </p>
      </div>
    </section>
  );
}
