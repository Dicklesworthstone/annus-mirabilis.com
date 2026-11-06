import type { Metadata } from "next";
import { HistoricalModeAllocationLab } from "../../../../components/lab/HistoricalModeAllocationLab.tsx";

export const metadata: Metadata = {
  title: "Classical energy sharing: the 1904 reconstruction",
  description:
    "Widen a finite radiation frequency range, compare energy shares with an unspecified coefficient, and read Planck's printed molecular number from 1901.",
  alternates: { canonical: "/lab/lq-02/1904/" },
  robots: { index: false },
};

export default function HistoricalModeAllocationPage() {
  return (
    <>
      <header className="page-intro">
        <p className="eyebrow">The 1904 desk · A radiation spectrum</p>
        <h1>Follow equal energy sharing to its limit.</h1>
        <p className="lead">
          This reconstruction asks what follows if classical energy sharing is extended to every
          admitted frequency. Absolute energies retain an unspecified coefficient; relative energies
          and shares can still be calculated. Planck's molecular-number estimate is displayed as a
          separate result already printed in 1901.
        </p>
      </header>
      <HistoricalModeAllocationLab />
      <nav className="lab-onward" aria-label="From the 1904 allocation">
        <a href="/1904/#object-spectrum">Return to the radiation spectrum on the 1904 desk</a>
      </nav>
    </>
  );
}
