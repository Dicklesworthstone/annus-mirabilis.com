import type { Metadata } from "next";
import { HistoricalShelfPage } from "../../../../components/lab/shelf/HistoricalShelfPage.tsx";

export const metadata: Metadata = {
  title: "1904: light in moving water",
  description:
    "Compare no drag, complete drag and Fresnel's partial drag at the same flow, path and wavelength. Reverse the flow and inspect the predicted fringe shifts.",
  alternates: { canonical: "/lab/shelf-fizeau/1904/" },
  robots: { index: false, follow: true },
};

export default function Page() {
  return <HistoricalShelfPage instrumentId="shelf-fizeau" />;
}
