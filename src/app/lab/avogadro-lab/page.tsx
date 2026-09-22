import type { Metadata } from "next";
import { AvogadroLab } from "../../../components/lab/avogadro/AvogadroLab.tsx";

export const metadata: Metadata = {
  title: "Three ways to infer the molecular number",
  description:
    "Compare radiation constants, Brownian displacement, and joint viscosity–diffusion inference without hiding their different assumptions and provenance.",
  alternates: { canonical: "/lab/avogadro-lab/" },
};

export default function AvogadroPage() {
  return (
    <>
      <header className="page-intro">
        <p className="eyebrow">Cross-paper connection · Molecular-dimensions companion preview</p>
        <h1>Three routes toward a molecular number.</h1>
        <p className="lead">
          Radiation, visible particle motion, and the viscosity of a solution ask different
          questions. Compare what each needs before it can supply a number.
        </p>
        <p>
          The dissertation is a companion to the four papers, not a fifth paper in the edition. This
          preview makes the mathematical comparison interactive without presenting illustrative
          settings as historical observations.
        </p>
        <p>
          <a href="/connections">Return to connections among the papers →</a>
        </p>
      </header>
      <AvogadroLab />
    </>
  );
}
