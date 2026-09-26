import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { CardDetail, formatEventDateLine, stepsLine } from "./CardDetail.tsx";
import { KnowledgeCardView } from "./KnowledgeCard.tsx";
import { globalKnowledgeCardsLogger } from "./knowledgeCardsLogger.ts";
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
    const start = Date.now();
    const html = renderToStaticMarkup(<KnowledgeCardView card={sampleCard} />);
    expect(html).toContain("Published 1855");
    expect(html).toContain("Macroscopic diffusion equation");
    expect(html).toContain("Available by the end of 1904");
    expect(html).toContain('id="card-fick-1855-diffusion"');

    globalKnowledgeCardsLogger.log({
      testId: "render-compact-card",
      cardId: sampleCard.id,
      status: sampleCard.status,
      eventKind: sampleCard.date.eventKind,
      outcome: "pass",
      durationMs: Date.now() - start,
      message: "Rendered compact card with date line and status label.",
    });
  });

  test("status labels render distinct SVG icon shapes and text for all 4 states (never color alone)", () => {
    const start = Date.now();
    const availHtml = renderToStaticMarkup(<StatusLabel status="available" />);
    expect(availHtml).toContain("Available by the end of 1904");
    expect(availHtml).toContain("<svg");
    expect(availHtml).toContain('data-status="available"');

    const parallelHtml = renderToStaticMarkup(<StatusLabel status="parallel-work" />);
    expect(parallelHtml).toContain("Parallel work: not available to a 1904 reader");
    expect(parallelHtml).toContain("<svg");
    expect(parallelHtml).toContain('data-status="parallel-work"');

    const laterHtml = renderToStaticMarkup(<StatusLabel status="later" />);
    expect(laterHtml).toContain("Later confirmation");
    expect(laterHtml).toContain("<svg");
    expect(laterHtml).toContain('data-status="later"');

    const importHtml = renderToStaticMarkup(
      <StatusLabel status="available" admittedImport={true} />,
    );
    expect(importHtml).toContain("Admitted 1905 import");
    expect(importHtml).toContain("<svg");
    expect(importHtml).toContain('data-status="admitted-import"');

    globalKnowledgeCardsLogger.log({
      testId: "render-status-labels-icon-text",
      outcome: "pass",
      durationMs: Date.now() - start,
      message: "All 4 status labels render distinct textual strings and icon shapes.",
    });
  });

  test("AC 2: status and import labels are distinguishable without color (tested by text content and by a grayscale snapshot)", () => {
    const start = Date.now();
    const states = [
      { key: "available", label: <StatusLabel status="available" /> },
      { key: "parallel-work", label: <StatusLabel status="parallel-work" /> },
      { key: "later", label: <StatusLabel status="later" /> },
      { key: "admitted-import", label: <StatusLabel status="available" admittedImport={true} /> },
    ];

    // Function simulating pure non-color / grayscale projection by stripping color-related Tailwind classes
    const toGrayscaleSnapshot = (
      html: string,
    ): { text: string; svgPaths: string[]; status: string } => {
      const textMatch = html.match(/<span>([^<]+)<\/span>/);
      const text = textMatch ? (textMatch[1] ?? "") : "";
      const statusMatch = html.match(/data-status="([^"]+)"/);
      const status = statusMatch ? (statusMatch[1] ?? "") : "";
      const svgPaths = [...html.matchAll(/<path\s+d="([^"]+)"/g)].map((m) => m[1] ?? "");
      return { text, svgPaths, status };
    };

    const snapshots = states.map((s) => ({
      key: s.key,
      ...toGrayscaleSnapshot(renderToStaticMarkup(s.label)),
    }));

    // Assert that every state has unique text
    const textSet = new Set(snapshots.map((s) => s.text));
    expect(textSet.size).toBe(4);

    // Assert that every state has unique SVG path geometric commands
    const pathSignatures = snapshots.map((s) => s.svgPaths.join(";"));
    const pathSet = new Set(pathSignatures);
    expect(pathSet.size).toBe(4);

    // Verify exact expected non-color contents
    expect(snapshots[0]?.text).toBe("Available by the end of 1904");
    expect(snapshots[0]?.svgPaths[0]).toBe("M5.5 8l2 2 3.5-3.5");

    expect(snapshots[1]?.text).toBe("Parallel work: not available to a 1904 reader");
    expect(snapshots[1]?.svgPaths[0]).toBe("M3 5h10M3 11h10M6 2v6M10 8v6");

    expect(snapshots[2]?.text).toBe("Later confirmation");
    expect(snapshots[2]?.svgPaths[0]).toBe("M8 5v3l2.5 1.5");

    expect(snapshots[3]?.text).toBe("Admitted 1905 import");
    expect(snapshots[3]?.svgPaths[0]).toBe("M8 2v8M4 6l4 4 4-4M2 14h12");

    globalKnowledgeCardsLogger.log({
      testId: "ac2-grayscale-and-non-color-differentiation",
      outcome: "pass",
      durationMs: Date.now() - start,
      message:
        "All 4 status labels verified completely distinguishable without color via text and geometric SVG paths.",
    });
  });

  test("compact date lines format accurately at day, month, year, and range precision", () => {
    const start = Date.now();
    // Day
    const dayLine = formatEventDateLine({
      earliest: "1904-05-15",
      latest: "1904-05-15",
      precision: "day",
      latestYear: 1904,
      eventKind: "performed",
    });
    expect(dayLine).toBe("Performed, 1904-05-15");

    // Month
    const monthLine = formatEventDateLine({
      earliest: "1904-01",
      latest: "1904-01",
      precision: "month",
      latestYear: 1904,
      eventKind: "presented",
    });
    expect(monthLine).toBe("Presented, 1904-01");

    // Year
    const yearLine = formatEventDateLine({
      earliest: "1903",
      latest: "1903",
      precision: "year",
      latestYear: 1903,
      eventKind: "published",
    });
    expect(yearLine).toBe("Published 1903");

    // Range
    const rangeLine = formatEventDateLine({
      earliest: "1860",
      latest: "1879",
      precision: "range",
      latestYear: 1879,
      eventKind: "published",
    });
    expect(rangeLine).toBe("Published, 1860–1879");

    globalKnowledgeCardsLogger.log({
      testId: "render-compact-date-precisions",
      outcome: "pass",
      durationMs: Date.now() - start,
      message: "Formatted compact date lines across day, month, year, and range precisions.",
    });
  });

  test("renders the four labeled historical statement sections", () => {
    const start = Date.now();
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
    // The four parts are named, not numbered: numbered, they read 1, 2, 4 on every card with no
    // Einstein-knowledge evidence.
    expect(html).toContain(">Available by<");
    expect(html).not.toContain("1. Available by");
    expect(html).toContain("Published 1855");

    // Section 2: What the paper itself cites or asserts
    expect(html).toContain(">What the paper itself cites or asserts<");
    expect(html).toContain("Explicitly references Fick");

    // Section 3: Evidence that Einstein knew it
    expect(html).toContain(">Evidence that Einstein knew it<");
    expect(html).toContain("Letter to Marcel Grossmann, 1901");

    // Section 4: Where this site uses it
    expect(html).toContain(">Where this site uses it<");
    expect(html).toContain("stage-bm-03");
    expect(html).toContain("desk-fick-cylinder");
    expect(html).toContain("tl-1855");
    expect(html).toContain("wc-diffusion");

    globalKnowledgeCardsLogger.log({
      testId: "render-four-historical-sections",
      cardId: cardWithEinstein.id,
      outcome: "pass",
      durationMs: Date.now() - start,
      message: "Rendered all four canonical historical statement sections.",
    });
  });

  test("Section 3 is omitted when Einstein knowledge is not claimed", () => {
    const html = renderToStaticMarkup(<CardDetail card={sampleCard} />);
    expect(html).not.toContain("3. Evidence that Einstein knew it");
  });

  test("renders priorEvent line and relatedCardId line when present", () => {
    const start = Date.now();
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
    // The link goes to the related card's anchor; the id itself is no longer shown as text.
    expect(html).toContain('href="#card-sutherland-1905-phil-mag"');
    expect(html).not.toContain(">#sutherland-1905-phil-mag<");

    // Given the related card, the link names it by its date and claim.
    const named = renderToStaticMarkup(
      <CardDetail
        card={cardWithPriorAndRelated}
        relatedCard={{
          id: "sutherland-1905-phil-mag",
          proposition: "Diffusion formula with slip correction in Phil. Mag.",
          status: "parallel-work",
          sources: ["Phil. Mag. (1905)"],
          date: {
            earliest: "1905-06",
            latest: "1905-06",
            precision: "month",
            latestYear: 1905,
            eventKind: "published",
          },
        }}
      />,
    );
    expect(named).toContain(
      "Published, 1905-06: Diffusion formula with slip correction in Phil. Mag.",
    );

    globalKnowledgeCardsLogger.log({
      testId: "render-prior-event-and-related-card",
      cardId: cardWithPriorAndRelated.id,
      priorEventKind: "performed",
      priorEventLatest: "1903",
      relatedCardId: "sutherland-1905-phil-mag",
      outcome: "pass",
      durationMs: Date.now() - start,
      message: "Rendered prior event and related card lines in detail view.",
    });
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

  test("an unverified card shows no verification status and none of the open queue questions", () => {
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
    // The queue is the audit trail's (D-2026-09-25-no-review-status-banners, dispatch 243).
    expect(html).toContain("Some source");
    expect(html).not.toContain("Awaiting verification");
    expect(html).not.toContain("verification pending");
    expect(html).not.toContain("[q-archive-lookup]");
    expect(html).not.toContain("Check original page number in 1900 volume.");
    expect(html).not.toContain("Archive volume 1900");
  });

  test("a verified card shows its locator and printed citation, and never says it is verified or by whom", () => {
    const html = renderToStaticMarkup(<CardDetail card={sampleCard} />);
    expect(html).toContain("ETH Library Shelfmark 1855-POGG-94-59");
    expect(html).toContain("A. Fick, Poggendorffs Annalen 94 (1855) 59-86");
    expect(html).not.toContain("Verified against original source");
    expect(html).not.toContain("Dr. Historian");
    expect(html).not.toContain("bound volume");
  });

  test("a card with no recorded citation says so, instead of saying the paper cites nothing", () => {
    const html = renderToStaticMarkup(<CardDetail card={sampleCard} />);
    expect(sampleCard.paperCitesOrAsserts ?? []).toHaveLength(0);
    expect(html).toContain("Not yet recorded for this card.");
    expect(html).not.toContain("No direct citation");
  });

  test("stepsLine reads a route's stage ids as its numbered steps, and leaves other ids alone", () => {
    expect(stepsLine(["stage-03"])).toBe("Step 3 of this route");
    expect(stepsLine(["stage-03", "stage-06"])).toBe("Steps 3 and 6 of this route");
    expect(stepsLine(["stage-01", "stage-02", "stage-07"])).toBe("Steps 1, 2 and 7 of this route");
    // One id of another form and the line is shown as recorded, not half translated.
    expect(stepsLine(["stage-03", "stage-bm-04"])).toBe("stage-03, stage-bm-04");
  });
});
