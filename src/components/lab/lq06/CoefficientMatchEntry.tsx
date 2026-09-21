"use client";

import { useEffect, useState } from "react";
import { decodeLq06Settings, type DecodedLq06Settings } from "../../../experiments/lq06/permalink.ts";
import { prepareLinkedCoefficientExample } from "../../../experiments/lq06/linkedSettings.ts";
import type { PreparedLq06Example } from "../../../experiments/lq06/session.ts";
import { CoefficientMatchComparison } from "./CoefficientMatchLab.tsx";

/** The existing permalink codec must reach the actual route. Links stage a complete parameter
 * set and never silently substitute it for the server-rendered worked example. */
export function CoefficientMatchEntry({ example }: { example: PreparedLq06Example }) {
  const [shared, setShared] = useState<DecodedLq06Settings>({ kind: "absent" });
  const [activeExample, setActiveExample] = useState(example);
  const [message, setMessage] = useState("");
  useEffect(() => { setShared(decodeLq06Settings(window.location.search)); }, []);
  function apply() {
    if (shared.kind !== "settings") return;
    const prepared = prepareLinkedCoefficientExample(example, shared.parameters);
    if (prepared.kind !== "accepted") { setShared({ kind: "invalid", message: prepared.message }); return; }
    setActiveExample(prepared.example);
    setShared({ kind: "absent" });
    setMessage("Linked settings were applied as a new calculation. The controls below may now change them.");
  }
  return <>
    {shared.kind === "settings" && <aside className="notice" data-coefficient-shared-settings>
      <h2>A linked radiation state is ready</h2>
      <p>The default worked example is still displayed. Applying the link starts a new calculation
        with the exact supplied values, not the rounded numbers printed in the controls.</p>
      <dl><dt>Radiation energy (J)</dt><dd>{String(shared.parameters.radiationEnergy)}</dd>
        <dt>Frequency (Hz)</dt><dd>{String(shared.parameters.frequency)}</dd>
        <dt>Constant set</dt><dd>{shared.parameters.constantSetId}</dd></dl>
      <button type="button" onClick={apply}>Apply linked coefficient settings</button>{" "}
      <button type="button" className="secondary" onClick={() => setShared({ kind: "absent" })}>Keep the worked example</button>
    </aside>}
    {shared.kind === "invalid" && <p role="alert" className="notice">{shared.message}</p>}
    <p role="status" aria-live="polite">{message}</p>
    <CoefficientMatchComparison example={activeExample} />
  </>;
}
