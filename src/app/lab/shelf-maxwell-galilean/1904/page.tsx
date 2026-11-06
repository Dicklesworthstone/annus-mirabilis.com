import type { Metadata } from "next";
import { HistoricalShelfPage } from "../../../../components/lab/shelf/HistoricalShelfPage.tsx";

export const metadata: Metadata = {
  title: "1904: changing coordinates in the wave equation",
  description:
    "Test the scalar wave equation under Galilean and Lorentz's 1904 substitutions. Compare forward and backward wave residuals without a numerical light-speed calibration.",
  alternates: { canonical: "/lab/shelf-maxwell-galilean/1904/" },
  robots: { index: false, follow: true },
};

export default function Page() {
  return <HistoricalShelfPage instrumentId="shelf-maxwell-galilean" />;
}
