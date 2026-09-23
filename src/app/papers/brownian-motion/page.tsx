import { OfflineChapterLinks } from "../../../platform/offline/OfflineChapterLinks.tsx";
import { PaperReader } from "../../../reader/PaperReader";
import { paperMetadata } from "../../../reader/paperRoutes.ts";
// The same metadata the other three papers take from paperMetadata: the paper's own title and
// description, its canonical address and export links, and its share card. This page wrote its
// own, which said the source transcription was still in preparation after the German text was set.
export function generateMetadata() {
  return paperMetadata({ paperId: "brownian-motion" });
}
export default function Page() {
  return (
    <>
      <PaperReader />
      <OfflineChapterLinks paperId="brownian-motion" />
    </>
  );
}
