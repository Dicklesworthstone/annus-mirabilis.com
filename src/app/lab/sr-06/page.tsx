import type { Metadata } from "next";
import { VelocityCompositionComparison } from "../../../components/lab/sr06/VelocityCompositionLab.tsx";
import { validateSr06Parameters } from "../../../experiments/sr06/parameters.ts";
import { DEFAULT_PREPARED_EXAMPLE } from "../../../experiments/sr06/session.ts";
import labDigests from "../../../generated/lab-source-digests.json";
import "./composition.css";
import { LabFormula } from "../../../components/lab/LabFormula.tsx";

export const metadata: Metadata = {
  title: "Velocity composition",
  description:
    "Why doesn't adding speeds preserve light speed, and what happens when the motions are not along one line?",
};

export default function VelocityCompositionPage() {
  const checked = validateSr06Parameters(DEFAULT_PREPARED_EXAMPLE.parameters);
  if (checked.kind !== "accepted")
    throw new Error("The prepared composition settings are invalid.");
  return (
    <>
      <header className="page-intro">
        <p className="eyebrow">Special relativity · Kinematics §5</p>
        <h1>
          <span>Speeds do not</span> <span>simply add.</span>
        </h1>
        <p className="lead">
          Why doesn't adding speeds preserve light speed, and what happens when the motions are not
          along one line?
        </p>
      </header>
      <VelocityCompositionComparison
        example={{
          ...DEFAULT_PREPARED_EXAMPLE,
          parameters: checked.data,
          sourceDigest: labDigests["sr-06"],
        }}
      />
      <nav className="lab-onward" aria-label="From here">
        <h2>From here</h2>
        <ul>
          <li>
            <a href="/papers/special-relativity/#s5">Read §5 of the 1905 kinematics paper</a>
          </li>
        </ul>
      </nav>
      <section className="reading" id="composition-worked">
        <h2>Worked case (readable without JavaScript)</h2>
        <p>
          Two collinear motions of 0.6c compose to exactly 15/17 of light speed, about 0.882353c,
          not 1.2c. The Galilean sum exceeds light speed; the relativistic composition does not.
        </p>
        <LabFormula lab="sr-06" latex={String.raw`U=\frac{v+w}{1+vw/c^{2}}=\frac{15}{17}c`} />
        <p>
          At a right angle the printed formula gives about 0.768375c. Two successive perpendicular
          boosts of 0.6c give the same speed and a spatial rotation of about 12.6804 degrees. That
          rotation is a kinematic fact of the composition, not a force on a gyroscope.
        </p>
      </section>
    </>
  );
}
