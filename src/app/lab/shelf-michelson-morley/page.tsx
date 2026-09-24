import type { Metadata } from "next";
import { ShelfOpticsPage } from "../../../components/lab/shelfOptics/ShelfOpticsPage.tsx";

export const metadata: Metadata = {
  title: "Michelson–Morley: compare optical path models",
  description:
    "The fringe shift a rotated Michelson–Morley interferometer should show, with and without longitudinal contraction, and what a null result can decide. Modern constants; no invented 1887 readings.",
  robots: { index: false },
};

export default function Page() {
  return <ShelfOpticsPage instrumentId="shelf-michelson-morley" />;
}
