import type { Metadata } from "next";
import { HistoricalShelfPage } from "../../../../components/lab/shelf/HistoricalShelfPage.tsx";

export const metadata: Metadata = {
  title: "1904: contraction and the ether-wind comparison",
  description:
    "Compare round-trip light times and quarter-turn fringe shifts with and without contraction, using dimensionless speed ratios and illustrative settings.",
  alternates: { canonical: "/lab/shelf-michelson-morley/1904/" },
  robots: { index: false, follow: true },
};

export default function Page() {
  return <HistoricalShelfPage instrumentId="shelf-michelson-morley" />;
}
