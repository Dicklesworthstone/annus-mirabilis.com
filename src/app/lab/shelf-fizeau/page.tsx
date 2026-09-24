import type { Metadata } from "next";
import { ShelfOpticsPage } from "../../../components/lab/shelfOptics/ShelfOpticsPage.tsx";

export const metadata: Metadata = {
  title: "Fizeau: compare moving-water drag hypotheses",
  description:
    "Light through moving water under no drag, full drag and Fresnel's partial drag: which fringe predictions change when the flow reverses, and by how much. Modern constants; no invented 1851 readings.",
  robots: { index: false },
};

export default function Page() {
  return <ShelfOpticsPage instrumentId="shelf-fizeau" />;
}
