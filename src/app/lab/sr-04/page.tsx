import type { Metadata } from "next";
import { LorentzMapComparison } from "../../../components/lab/sr04/LorentzMapLab.tsx";
import { SR04_DEFAULTS } from "../../../experiments/sr04/definition.ts";
import { evaluateSr04 } from "../../../experiments/sr04/session.ts";

export const metadata: Metadata = {
  title: "Construct the Lorentz map (SR-04)",
};

export default function LorentzMapPage() {
  const example = {
    parameters: SR04_DEFAULTS,
    evaluation: evaluateSr04(SR04_DEFAULTS),
    sourceDigest: "src/physics/reference/kinematics.ts",
  };

  return (
    <>
      <header className="page-intro">
        <p className="eyebrow">Special relativity &middot; The central construction</p>
        <h1>
          Build the map,
          <br />
          don&apos;t receive it.
        </h1>
        <p className="lead">
          What map between two inertial frames keeps both postulates, and what does each
          requirement decide?
        </p>
        <p>
          <a href="/papers/special-relativity/#s3">Read &sect;3&apos;s functional-equation route &rarr;</a>
        </p>
      </header>

      <LorentzMapComparison example={example} />

      <section className="reading" id="lorentz-map-argument">
        <p className="eyebrow">Open the derivation</p>
        <h2>The Galilean shelf step</h2>
        <p>
          The ordinary change of frame, x&prime; = x &minus; vt, works for slow objects: two
          speeds slower than light compose the way ordinary mechanics expects, and the deviation
          from the relativistic result is unmeasurably small. It fails completely for light: a
          ray moving at c in one frame is measured at c &minus; v or c + v in the other, not c.
          That conflict, not an assumed interval, is where the construction starts.
        </p>
        <h2>No answer preinstalled</h2>
        <p>
          The engine above solves only the constraints you enable. The Lorentz factor never
          appears until the branch step fixes it; the Minkowski interval never appears at all in
          the construction, because interval preservation is a modern verification oracle, not a
          1905 premise. Requiring it up front would make the derivation circular.
        </p>

        <div className="actions">
          <a className="button" href="/lab/sr-03/">
            Compare with rod measurement and simultaneity &rarr;
          </a>
        </div>
      </section>
    </>
  );
}
