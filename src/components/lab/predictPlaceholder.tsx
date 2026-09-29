/**
 * THE NOTE THAT STANDS WHERE A GATED RESULT WILL BE (dispatch 512).
 *
 * The mechanism is 82d42a82's, written for BM-01 and extracted here because two more laboratories
 * need it. It is keyed on CSS rather than on React, and that is the whole design: PredictGate
 * computes `open` after mount, so the SERVER renders `data-predict-response="awaiting"` for every
 * gated laboratory, and a reader without JavaScript is served exactly that markup WITH THE RESULT
 * SHOWING, because the hiding rule in predict.css needs `html[data-detail]` and only a running
 * script sets it. A note rendered on a React test of `awaiting` would therefore appear for the one
 * reader who can already see the plot. The placeholder attribute mirrors the gate's own instead:
 * hidden by default, shown only under `[data-detail]` where the result is genuinely waiting.
 *
 * WHY A FRAME NEEDS ONE. Measured on the export of 16001f32, the sentence explaining the emptiness
 * sat 728, 1352 and 1631 px from the three frames repaired with this, in another column. BM-01's,
 * after 82d42a82, sits 287 px away and inside the frame.
 */
export type PredictResponse = Readonly<{ "data-predict-response": "shown" | "awaiting" }>;
export type PredictPlaceholder = Readonly<{ "data-predict-placeholder": "shown" | "awaiting" }>;

/** An ungated plot gets no attribute at all and is unchanged. */
export const placeholderOf = (response?: PredictResponse): PredictPlaceholder | undefined =>
  response === undefined
    ? undefined
    : { "data-predict-placeholder": response["data-predict-response"] };

/**
 * The note inside an empty frame, in that plot's own viewBox coordinates. Two lines rather than
 * one because the narrowest of these frames is 300 units wide and a single line of this text
 * overruns it.
 */
export function AwaitingNote({
  placeholder,
  x,
  y,
}: {
  placeholder: PredictPlaceholder | undefined;
  x: number;
  y: number;
}) {
  if (placeholder === undefined) return null;
  return (
    <>
      <text {...placeholder} x={x} y={y} textAnchor="middle">
        Choose an answer above
      </text>
      <text {...placeholder} x={x} y={y + 18} textAnchor="middle">
        to see the result
      </text>
    </>
  );
}
