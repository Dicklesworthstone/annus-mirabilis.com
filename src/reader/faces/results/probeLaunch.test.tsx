import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ProbeLink } from "./ResultCard.tsx";
import { resultCardsFor } from "./fromRecords.ts";
import type { ProbeRef } from "./types.ts";

const probe: Extract<ProbeRef, { kind: "instrument" }> = {
  kind: "instrument",
  instrumentId: "me-01",
  presetOrModeId: "me-01-rest-frame",
  presetLabel: "Stationary observer",
  question: "What does the body lose?",
};

describe("a result's probe reaches its authored scientific question", () => {
  test("the production projection carries the resolved rest-frame launch", async () => {
    const cards = await resultCardsFor("mass-energy");
    const selected = cards?.flatMap((card) => card.probes).find(
      (item) => item.kind === "instrument" && item.presetOrModeId === probe.presetOrModeId,
    );
    expect(selected?.kind).toBe("instrument");
    if (selected?.kind !== "instrument") return;
    expect(selected.launch?.status).toBe("ready");
    const html = renderToStaticMarkup(<ProbeLink probe={selected} />);
    expect(html).toContain("/lab/me-01/?tape=");
    expect(html).toContain('data-probe-launch="session"');
    expect(html).not.toContain("Choose the preset");
  });

  test("a worker form says that the reader must apply the loaded settings", () => {
    const html = renderToStaticMarkup(
      <ProbeLink
        probe={{
          ...probe,
          launch: {
            status: "ready",
            instrumentId: "me-01",
            href: "/lab/me-01/?tape=bounded",
            kind: "form",
          },
        }}
      />,
    );
    expect(html).toContain("load into the form");
    expect(html).toContain("Apply them in the laboratory to calculate");
    expect(html).not.toContain("replayed");
  });

  test("an unresolved, cross-laboratory or unsafe launch keeps the honest manual route", () => {
    const launches: (typeof probe.launch)[] = [
      undefined,
      { status: "unavailable", instrumentId: "me-01", reason: "No settings loader." },
      { status: "ready", instrumentId: "sr-03", href: "/lab/sr-03/?tape=other", kind: "session" },
      { status: "ready", instrumentId: "me-01", href: "https://example.org/", kind: "session" },
    ];
    for (const launch of launches) {
      const html = renderToStaticMarkup(<ProbeLink probe={{ ...probe, launch }} />);
      expect(html).toContain('href="/lab/me-01/"');
      expect(html).toContain("Choose the preset");
      expect(html).toContain('data-probe-launch="default"');
    }
  });

  test("a teaching tape opens its published walkthrough instead of the catalogue", () => {
    const html = renderToStaticMarkup(
      <ProbeLink
        probe={{ kind: "tape", tapeId: "the-two-pulses", question: "Compare the ledgers" }}
      />,
    );
    expect(html).toContain('href="/tapes/the-two-pulses/"');
    expect(html).toContain("Open the walkthrough");
    expect(html).not.toContain("/lab?tape=");
  });
});
