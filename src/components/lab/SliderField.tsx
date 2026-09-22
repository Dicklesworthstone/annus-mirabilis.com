/**
 * A slider with a typed value beside it. AGENTS.md: "Readers can type exact values as well as
 * drag", and "typed-value entry beside every slider".
 *
 * The <label> names the typed field, so the field's accessible name is the visible label text;
 * the slider takes the same name by reference. The typed field comes first, in the DOM and on
 * screen: it is the control the label belongs to, so a query by label finds it before the slider,
 * and the number reads before the thumb that sets it. Dragging commits at once. Typing edits a draft
 * that commits when the field loses focus or its form is submitted, so a half-typed "0." is
 * never sent to the model.
 *
 * The slider's range is the teaching range; the typed field may go further. A typed value the
 * slider cannot show pins the thumb to the nearer end and leaves the field saying what was typed,
 * so the number shown is always the number requested.
 */

import "./labShell.css";

export function SliderField({
  id,
  label,
  unit,
  min,
  max,
  step,
  value,
  readout,
  onDraft,
  onCommit,
}: {
  readonly id: string;
  readonly label: string;
  readonly unit: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  /** The typed text, which may be a draft the model has not accepted yet. */
  readonly value: string;
  /** An optional line under the pair, such as the value in another unit. */
  readonly readout?: string | undefined;
  readonly onDraft: (next: string) => void;
  readonly onCommit: (next: string) => void;
}) {
  const numeric = Number(value);
  const sliderValue = Number.isFinite(numeric) ? Math.min(max, Math.max(min, numeric)) : min;
  return (
    <div className="input-field lab-slider">
      <label id={`${id}-label`} htmlFor={id}>
        {label} {unit && <span>({unit})</span>}
      </label>
      <div className="lab-slider-pair">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={(e) => onDraft(e.target.value)}
          onBlur={(e) => onCommit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onCommit(e.currentTarget.value);
            }
          }}
        />
        <input
          type="range"
          aria-labelledby={`${id}-label`}
          min={min}
          max={max}
          step={step}
          value={sliderValue}
          onChange={(e) => onCommit(e.target.value)}
        />
      </div>
      {readout && <p className="fine lab-slider-readout">{readout}</p>}
    </div>
  );
}
