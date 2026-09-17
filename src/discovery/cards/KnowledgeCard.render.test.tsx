import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { CardDetail } from "./CardDetail.tsx";
import { KnowledgeCardView } from "./KnowledgeCard.tsx";
import { StatusLabel } from "./StatusLabel.tsx";
import type { KnowledgeCard, VerificationQueueItem } from "./types.ts";

describe("am-disc-knowledge-cards-iw8j: KnowledgeCard and CardDetail rendering", () => {
  const sampleCard: KnowledgeCard = {
    id: "fick-1855-diffusion",
    proposition: "Macroscopic diffusion equation relating concentration gradient to matter flux.",
    status: "available",
    limits:
      "Applies to macroscopic concentrations in continuous media without molecular granularity.",
    sources: [{ title: "Pogg. Ann. 94", locator: "p. 59", date: "1855" }],
    date: {
      earliest: "1855",
      latest: "1855",
      precision: "year",
      latestYear: 1855,
      eventKind: "published",
    },
    admittedStages: ["stage-bm-03"],
    verification: {
      verifiedBy: "Dr. Historian",
      verifierKind: "human",
      date: "2026-08-15",
      method: "bound volume",
      evidenceLocator: "ETH Library Shelfmark 1855-POGG-94-59",
      printedCitation: "A. Fick, Poggendorffs Annalen 94 (1855) 59-86",
    },
  };

  test("renders compact card with date line, proposition, and status label", () => {
    const html = renderToStaticMarkup(<KnowledgeCardView card={sampleCard} />);
    expect(html).toContain("Published 1855");
    expect(html).toContain("Macroscopic diffusion equation");
    expect(html).toContain("Available by the end of 1904");
    expect(html).toContain('id="card-fick-1855-diffusion"');
  });

  test("status labels render distinct SVG icon shapes and text for all 4 states", () => {
    const availHtml = renderToStaticMarkup(<StatusLabel status="available" />);
    expect(availHtml).toContain("Available by the end of 1904");
    expect(availHtml).toContain("<svg");

    const parallelHtml = renderToStaticMarkup(<StatusLabel status="parallel-work" />);
    expect(parallelHtml).toContain("Parallel work: not available to a 1904 reader");
    expect(parallelHtml).toContain("<svg");

    const laterHtml = renderToStaticMarkup(<StatusLabel status="later" />);
    expect(laterHtml).toContain("Later confirmation");
    expect(laterHtml).toContain("<svg");

    const importHtml = renderToStaticMarkup(
      <StatusLabel status="available" admittedImport={true} />,
    );
    expect(importHtml).toContain("Admitted 1905 import");
    expect(importHtml).toContain("<svg");
  });

  test("renders the four labeled historical statement sections", () => {
    const cardWithEinstein: KnowledgeCard = {
      ...sampleCard,
      claimsEinsteinKnew: true,
      einsteinKnowledgeEvidence: ["Letter to Marcel Grossmann, 1901"],
      paperCitesOrAsserts: [
        { paper: "ap-17-549", ids: ["p2-s3"], note: "Explicitly references Fick's law" },
      ],
    };

    const backlinks = {
      stageIds: ["stage-bm-03"],
      deskObjectIds: ["desk-fick-cylinder"],
      timelineEntryIds: ["tl-1855"],
      worldCheckIds: ["wc-diffusion"],
    };

    const html = renderToStaticMarkup(<CardDetail card={cardWithEinstein} backlinks={backlinks} />);

    // Section 1: Available by
    expect(html).toContain("1. Available by");
    expect(html).toContain("Published 1855");

    // Section 2: What the paper itself cites or asserts
    expect(html).toContain("2. What the paper itself cites or asserts");
    expect(html).toContain("Explicitly references Fick");

    // Section 3: Evidence that Einstein knew it
    expect(html).toContain("3. Evidence that Einstein knew it");
    expect(html).toContain("Letter to Marcel Grossmann, 1901");

    // Section 4: Where this site uses it
    expect(html).toContain("4. Where this site uses it");
    expect(html).toContain("stage-bm-03");
    expect(html).toContain("desk-fick-cylinder");
    expect(html).toContain("tl-1855");
    expect(html).toContain("wc-diffusion");
  });

  test("Section 3 is omitted when Einstein knowledge is not claimed", () => {
    const html = renderToStaticMarkup(<CardDetail card={sampleCard} />);
    expect(html).not.toContain("3. Evidence that Einstein knew it");
  });

  test("renders priorEvent line and relatedCardId line when present", () => {
    const cardWithPriorAndRelated: KnowledgeCard = {
      id: "sutherland-1904-dunedin",
      proposition: "Diffusion formula presented at Dunedin.",
      status: "available",
      sources: ["AAAS 1904"],
      date: {
        earliest: "1904-01",
        latest: "1904-01",
        precision: "month",
        latestYear: 1904,
        eventKind: "presented",
      },
      priorEvent: {
        eventKind: "performed",
        earliest: "1903",
        latest: "1903",
        precision: "year",
      },
      relatedCardId: "sutherland-1905-phil-mag",
    };

    const html = renderToStaticMarkup(<CardDetail card={cardWithPriorAndRelated} />);
    expect(html).toContain("Prior event: ");
    expect(html).toContain("Performed 1903");
    expect(html).toContain("Related card: ");
    expect(html).toContain("#sutherland-1905-phil-mag");
  });

  test("parallel-work card renders parallelWorkBasis in status explanation", () => {
    const parallelCard: KnowledgeCard = {
      id: "sutherland-1905-phil-mag",
      proposition: "Diffusion formula with slip correction in Phil. Mag.",
      status: "parallel-work",
      parallelWorkBasis:
        "The June 1905 Philosophical Magazine publication falls between Annalen's receipt of Einstein's paper on 11 May 1905 and its publication on 18 July 1905.",
      sources: ["Phil. Mag. (1905)"],
      date: {
        earliest: "1905-06",
        latest: "1905-06",
        precision: "month",
        latestYear: 1905,
        eventKind: "published",
      },
    };

    const html = renderToStaticMarkup(<CardDetail card={parallelCard} />);
    expect(html).toContain("not available to a 1904 reader");
    expect(html).toContain("The June 1905 Philosophical Magazine publication falls between");
  });

  test("unverified card renders Awaiting verification with open queue questions", () => {
    const unverifiedCard: KnowledgeCard = {
      id: "unverified-card",
      proposition: "Unverified premise.",
      status: "available",
      sources: ["Some source"],
      date: {
        earliest: "1900",
        latest: "1900",
        precision: "year",
        latestYear: 1900,
        eventKind: "published",
      },
    };

    const openQueue: VerificationQueueItem[] = [
      {
        id: "q-archive-lookup",
        question: "Check original page number in 1900 volume.",
        cards: ["unverified-card"],
        sourceToConsult: "Archive volume 1900",
        landsIn: "sources",
        status: "open",
      },
    ];

    const html = renderToStaticMarkup(
      <CardDetail card={unverifiedCard} openQueueItems={openQueue} />,
    );
    expect(html).toContain("Awaiting verification");
    expect(html).toContain("[q-archive-lookup]");
    expect(html).toContain("Check original page number in 1900 volume.");
    expect(html).toContain("Archive volume 1900");
  });

  test("verified card renders verification summary with method and locator", () => {
    const html = renderToStaticMarkup(<CardDetail card={sampleCard} />);
    expect(html).toContain("Verified against original source");
    expect(html).toContain("Dr. Historian");
    expect(html).toContain("bound volume");
    expect(html).toContain("ETH Library Shelfmark 1855-POGG-94-59");
    expect(html).toContain("A. Fick, Poggendorffs Annalen 94 (1855) 59-86");
  });
});
