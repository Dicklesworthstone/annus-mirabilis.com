import type { Metadata } from "next";
import { LabFormula } from "../../../components/lab/LabFormula.tsx";
import { LabInlineTerms } from "../../../components/lab/LabInlineTerms.tsx";
import { TwoLedgersComparison } from "../../../components/lab/me01/TwoLedgersLab.tsx";
import { DEFAULT_PREPARED_EXAMPLE } from "../../../experiments/me01/session.ts";
import labDigests from "../../../generated/lab-source-digests.json";

export const metadata: Metadata = {
  title: "Opposite pulses and two ledgers",
  description:
    "If a body at rest emits two equal pulses of light in opposite directions, what do the energy accounting books of two different inertial observers force you to conclude about the body's energy of motion?",
};

export default function TwoLedgersPage() {
  // The example names its host source by digest (scripts/generate-lab-digests.mjs).
  const example = { ...DEFAULT_PREPARED_EXAMPLE, sourceDigest: labDigests["me-01"] };

  return (
    <>
      <LabInlineTerms lab="me-01" />
      <header className="page-intro">
        <p className="eyebrow">Mass–Energy · The two-ledger derivation</p>
        <h1>
          <span>Opposite pulses</span> <span>and two energy ledgers.</span>
        </h1>
        <p className="lead">
          If a body at rest emits two equal pulses of light in opposite directions, what do the
          energy accounting books of two different inertial observers force you to conclude about
          the body&apos;s energy of motion?
        </p>
      </header>

      <TwoLedgersComparison example={example} />
      <nav className="lab-onward" aria-label="From here">
        <h2>From here</h2>
        <ul>
          <li>
            <a href="/papers/mass-energy/#arg-me-two-ledgers">
              {" "}
              Read the two-ledger argument (explanatory preview){" "}
            </a>
          </li>
        </ul>
      </nav>

      <section className="reading" id="two-ledgers-argument">
        <p className="eyebrow">Open the derivation</p>
        <h2>The imported light-energy transformation</h2>
        <p>
          Einstein imports a result proven in &sect;8 of his third 1905 paper (Special Relativity).
          When light of energy <var>l</var> is emitted in the stationary system at an angle{" "}
          <var>&phi;</var> to the direction of relative motion, an observer moving past at speed{" "}
          <var>v</var> measures its energy <var>l*</var> as:
        </p>
        <LabFormula
          lab="me-01"
          latex={String.raw`l^* = l \frac{1 - \frac{v}{V}\cos\varphi}{\sqrt{1 - \left(\frac{v}{V}\right)^2}}`}
        />
        <p>
          In modern notation with &beta; = v/c and the Lorentz factor &gamma; = 1/&radic;(1 &minus;
          &beta;²):
        </p>
        <LabFormula lab="me-01" latex={String.raw`l^* = l\,\gamma\,(1 - \beta\cos\varphi)`} />

        <h2>The two accounting sheets: rest frame and moving frame</h2>
        <p>
          Let the body at rest have initial internal energy <var>E₀</var>. It emits two equal light
          pulses of energy <var>L/2</var> in opposite directions (<var>&phi;</var> and{" "}
          <var>&phi; + 180&deg;</var>). Conservation of energy in the stationary frame requires:
        </p>
        <LabFormula
          lab="me-01"
          latex={String.raw`\begin{gathered}E_0 = E_1 + \frac{1}{2}L + \frac{1}{2}L = E_1 + L \\ \implies E_0 - E_1 = L\end{gathered}`}
        />
        <p>
          Now consider the same physical event as measured by an observer moving at speed{" "}
          <var>v</var>. The initial energy of the body in this frame is <var>H₀</var>. The two
          pulses have energies:
        </p>
        <LabFormula
          lab="me-01"
          latex={String.raw`\begin{gathered}\text{Pulse 1} = \frac{1}{2}L\,\gamma\,(1 - \beta\cos\varphi), \\ \text{Pulse 2} = \frac{1}{2}L\,\gamma\,(1 + \beta\cos\varphi)\end{gathered}`}
        />
        <p>
          When the two pulse energies are added together, the angle terms{" "}
          <var>&minus;&beta; cos &phi;</var> and <var>+&beta; cos &phi;</var> cancel identically:
        </p>
        <LabFormula
          lab="me-01"
          latex={String.raw`\begin{aligned}&\text{Total moving light} \\ &\quad = \frac{1}{2}L\,\gamma\,(1 - \beta\cos\varphi) \\ &\qquad + \frac{1}{2}L\,\gamma\,(1 + \beta\cos\varphi) \\ &\quad = \gamma L\end{aligned}`}
        />
        <p>Energy conservation in the moving frame therefore gives:</p>
        <LabFormula
          lab="me-01"
          latex={String.raw`\begin{gathered}H_0 = H_1 + \gamma L \\ \implies H_0 - H_1 = \gamma L\end{gathered}`}
        />

        <h2>The subtraction: removing the unknown internal energies</h2>
        <p>
          Neither <var>E₀</var> nor <var>H₀</var> is known. But subtracting the stationary-system
          balance from the moving-system balance completely eliminates the body&apos;s unknown
          internal rest energy:
        </p>
        <LabFormula
          lab="me-01"
          latex={String.raw`\begin{aligned}&(H_0 - E_0) - (H_1 - E_1) \\ &\qquad = \gamma L - L \\ &\qquad = L\,(\gamma - 1)\end{aligned}`}
        />

        <h2>Identifying the kinetic energy drop</h2>
        <p>
          The difference between a body&apos;s energy in a moving system and its energy in the rest
          system differs from its kinetic energy <var>K</var> only by an additive constant{" "}
          <var>C</var>:
        </p>
        <LabFormula lab="me-01" latex="H - E = K + C" />
        <p>
          Under Einstein&apos;s source premise that the constant <var>C</var> does not alter upon
          the emission of light (<var>C = C&apos;</var>), substituting this relation yields:
        </p>
        <LabFormula
          lab="me-01"
          latex={String.raw`\begin{aligned}(K_0 + C) - (K_1 + C) &= K_0 - K_1 \\ &= L\,(\gamma - 1)\end{aligned}`}
        />
        <p>
          The body&apos;s energy of motion drops by <var>L(&gamma; &minus; 1)</var> while its speed
          remains unchanged.
        </p>

        <div className="actions">
          <a className="button" href="/lab/me-02/">
            Open the small-speed coefficient laboratory
          </a>
          <a href="/papers/mass-energy/#entry-mass-energy">
            Start with two concrete energy accounts
          </a>
        </div>
      </section>
    </>
  );
}
