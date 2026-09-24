import type { Metadata } from "next";
import { ShelfOpticsPage } from "../../../components/lab/shelfOptics/ShelfOpticsPage.tsx";

export const metadata: Metadata = {
  title: "Compare Galilean and Lorentz wave-equation residuals",
  description:
    "Galilean and Lorentz coordinates substituted into the same plane light wave: what each leaves over in the wave equation as the frame's speed changes.",
  robots: { index: false },
};

export default function Page() {
  return <ShelfOpticsPage instrumentId="shelf-maxwell-galilean" />;
}
