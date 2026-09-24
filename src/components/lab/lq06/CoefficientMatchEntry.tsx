"use client";

import { useEffect, useState } from "react";
import { prepareLinkedCoefficientExample } from "../../../experiments/lq06/linkedSettings.ts";
import {
  type DecodedLq06Settings,
  decodeLq06Settings,
} from "../../../experiments/lq06/permalink.ts";
import type { PreparedLq06Example } from "../../../experiments/lq06/session.ts";
import { readablePowers } from "../presentation.ts";
import { CoefficientMatchComparison } from "./CoefficientMatchLab.tsx";

/**
 * A supplied value exactly as the link carries it, with its power of ten written as a reader writes
 * one. String() printed "9.055615e-9" for the default energy and "1e+300" for an extreme frequency.
 */
function exactNumber(value: number): string {
  return readablePowers(String(value)).replace(/^-/, "−");
}

/** The existing permalink codec must reach the actual route. Links stage a complete parameter
 * set and never silently substitute it for the server-rendered worked example. */
export function CoefficientMatchEntry({ example }: { example: PreparedLq06Example }) {
  const [shared, setShared] = useState<DecodedLq06Settings>({ kind: "absent" });
  const [activeExample, setActiveExample] = useState(example);
  const [message, setMessage] = useState("");
  useEffect(() => {
    setShared(decodeLq06Settings(window.location.search));
  }, []);
  function apply() {
    if (shared.kind !== "settings") return;
    const prepared = prepareLinkedCoefficientExample(example, shared.parameters);
    if (prepared.kind !== "accepted") {
      setShared({ kind: "invalid", message: prepared.message });
      return;
    }
    setActiveExample(prepared.example);
    setShared({ kind: "absent" });
    setMessage(
      "Linked settings were applied as a new calculation. The controls below may now change them.",
    );
  }
  return (
    <>
      {shared.kind === "settings" && (
        <aside className="notice" data-coefficient-shared-settings>
          <h2>A linked radiation state is ready</h2>
          <p>
            The default worked example is still displayed. Applying the link starts a new
            calculation with the exact supplied values, not the rounded numbers printed in the
            controls.
          </p>
          <dl>
            <dt>Radiation energy (J)</dt>
            <dd>{exactNumber(shared.parameters.radiationEnergy)}</dd>
            <dt>Frequency (Hz)</dt>
            <dd>{exactNumber(shared.parameters.frequency)}</dd>
            <dt>Constant set</dt>
            <dd>{shared.parameters.constantSetId}</dd>
          </dl>
          <button type="button" onClick={apply}>
            Apply linked coefficient settings
          </button>{" "}
          <button type="button" className="secondary" onClick={() => setShared({ kind: "absent" })}>
            Keep the worked example
          </button>
        </aside>
      )}
      {shared.kind === "invalid" && (
        <p role="alert" className="notice">
          {shared.message}
        </p>
      )}
      <p role="status" aria-live="polite">
        {message}
      </p>
      <CoefficientMatchComparison example={activeExample} />
    </>
  );
}
