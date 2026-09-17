import type { Metadata } from "next";
import { OfflineChapterLinks } from "../../../platform/offline/OfflineChapterLinks.tsx";
import { PaperReader } from "../../../reader/PaperReader";
export const metadata: Metadata = {
  title: "Read the Brownian displacement argument",
  description:
    "An explanatory preview with linked foundations and three working laboratories; source transcription and translation remain in preparation.",
  alternates: { canonical: "https://annus-mirabilis.com/papers/brownian-motion/" },
};
export default function Page() {
  return (
    <>
      <PaperReader />
      <OfflineChapterLinks paperId="brownian-motion" />
    </>
  );
}
