import type { Metadata } from "next";
import { LightThreadLab } from "../../../components/lab/lightThread/LightThreadLab.tsx";
import labDigests from "../../../generated/lab-source-digests.json";

export const metadata: Metadata = {
  title: "The light thread: quantum energy, relativity, and inertia",
  description:
    "Follow a light pulse across three papers, compare energy and frequency between observers, and distinguish pulse energy from system invariant mass.",
  alternates: { canonical: "/lab/light-thread/" },
};

export default function LightThreadPage() {
  return (
    <>
      <header className="page-intro">
        <p className="eyebrow">Connections among the papers · Modern synthesis</p>
        <h1>One pulse, three questions.</h1>
        <p className="lead">
          What is its quantum energy? What does another observer measure? What changes when a body
          emits light?
        </p>
      </header>
      <LightThreadLab sourceDigest={labDigests["light-thread"]} />
      {/* After the instrument, not in the hero (dispatch 268): in the hero they put it 607px down
          at 1440. Every sentence is kept. */}
      <div className="reading">
        <p>
          The light-quanta paper does not establish relativity. The September mass–energy argument
          does not require quanta. This laboratory connects their consequences without turning one
          paper’s conclusion into another’s hidden premise.
        </p>
        <p>
          <a href="/connections/">Open the connections between the papers</a>
        </p>
      </div>
    </>
  );
}
