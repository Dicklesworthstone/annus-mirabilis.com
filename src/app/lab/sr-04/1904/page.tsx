import type { Metadata } from "next";
import { HistoricalGalileanLab } from "../../../../components/lab/sr04/HistoricalGalileanLab.tsx";

export const metadata: Metadata = {
  title: "The Galilean map in the 1904 workspace",
  description:
    "Compare an ordinary change of frame with its prediction for two light rays, keeping light speed symbolic.",
  robots: { index: false, follow: true },
  alternates: { canonical: "/lab/sr-04/1904/" },
};
export default function HistoricalGalileanPage() {
  return (
    <>
      <header className="page-intro">
        <p className="eyebrow">The 1904 workspace</p>
        <h1>What velocity would a moving observer assign?</h1>
      </header>
      <HistoricalGalileanLab restoreSettingsFromUrl />
      <p>
        <a href="/1904/#object-clocks">Return to the pair of clocks</a>
      </p>
    </>
  );
}
