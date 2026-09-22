/**
 * The "Experiment settings" drawer that AGENTS.md asks every instrument for: "A scene begins
 * with a useful question and a stable default, not a dense control panel; advanced controls
 * sit in an 'Experiment settings' drawer."
 *
 * Before this existed, /lab/bm-01/ opened on an eleven-field form: temperature, viscosity,
 * radius, tracer count, time resolution, recording length, observation time, a 64-bit seed
 * and three selects, ahead of the one-tap actions that answer the page's own question. The
 * drawer is closed by default. The instrument's primary actions stay outside it.
 *
 * `contents` names what is inside, in the reader's words, so a closed drawer still says what
 * it holds instead of hiding it.
 *
 * It is a native <details>: it opens without JavaScript, the summary is a real control with
 * a 44px target, and the fields inside keep their labels and form membership.
 */

import type { ReactNode } from "react";
import "./labShell.css";

export function ExperimentSettings({
  contents,
  children,
}: {
  readonly contents: string;
  readonly children: ReactNode;
}) {
  return (
    <details className="experiment-settings">
      <summary>
        Experiment settings <span className="experiment-settings-contents">{contents}</span>
      </summary>
      <div className="experiment-settings-body">{children}</div>
    </details>
  );
}
