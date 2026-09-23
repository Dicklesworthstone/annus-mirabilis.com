import type { Metadata } from "next";
import { ShelfOpticsPage } from "../../../components/lab/shelfOptics/ShelfOpticsPage.tsx";

export const metadata: Metadata = {
  title: "Fizeau: compare moving-water drag hypotheses",
  description:
    "An interactive reference-model comparison with explicit assumptions, modern calibration and no invented historical measurements.",
  robots: { index: false },
};

export default function Page() {
  return <ShelfOpticsPage instrumentId="shelf-fizeau" />;
}
