/**
 * ME-01'S LEDGER TABLE (am-jioj), read from the rendered page rather than from the manifest that
 * promises it. `content/experiments/me-01.yaml` declares a view `table-two-ledgers` of kind `table`,
 * and two of its four actions tell a reader to "read the moving ledger values in the table" and to
 * "read highlighted cancellation in the ledger table". Measured at HEAD before this file existed:
 * `git show HEAD:src/components/lab/me01/TwoLedgersPlot.tsx | grep -c '<table'` gave 0, and the same
 * for the lab component. The accounts were a two-item definition list.
 *
 * So the assertions here are about the DOM a reader gets: a table carrying the declared view id,
 * whose cells hold the accepted snapshot's own values, formatted as the drawing formats them. A
 * symbolic line shows the symbol the snapshot names, never a number it does not have.
 */
import { describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { ME01_DEFAULTS } from "../../../experiments/me01/definition.ts";
// From the experiment's session layer, which is where TwoLedgersLab itself gets it. A `.tsx`
// may not import src/physics/reference/** at all (noPhysicsInComponents): the experiment owns
// the call and the component consumes the result, and a test of the component tests the same
// seam the product uses.
import { evaluateMe01 } from "../../../experiments/me01/session.ts";
import { exportMarkup } from "../../../testing/exportMarkup.ts";
import { fixed } from "../presentation.ts";
import { TwoLedgersPlot } from "./TwoLedgersPlot.tsx";

async function ledgerDocument(parameters = ME01_DEFAULTS) {
  const evaluation = evaluateMe01(parameters);
  const markup = await exportMarkup(
    <TwoLedgersPlot parameters={parameters} evaluation={evaluation} clipId="test-clip" />,
  );
  const { document } = new Window();
  document.body.innerHTML = markup;
  return { document, evaluation };
}

describe("me-01's two accounts are the table its manifest declares", () => {
  test("the declared view renders as a table, with a caption and row headers", async () => {
    const { document } = await ledgerDocument();
    const table = document.querySelector('table[data-view="table-two-ledgers"]');
    if (!table) throw new Error("me-01 renders no table carrying the declared view id");
    expect(table.querySelector("caption")?.textContent ?? "").toContain("units of the emitted");
    // Two accounts of one emission: the column heads name the frames, and each row names its line.
    const columns = [...table.querySelectorAll('thead th[scope="col"]')].map((th) =>
      th.textContent?.trim(),
    );
    expect(columns.length).toBe(3);
    expect(columns[1]?.toLowerCase()).toContain("rest frame");
    expect(columns[2]?.toLowerCase()).toContain("moving frame");
    const rows = [...table.querySelectorAll('tbody th[scope="row"]')];
    expect(rows.length).toBeGreaterThan(4);
  });

  test("every cell is the accepted snapshot's own value, in units of L", async () => {
    const { document, evaluation } = await ledgerDocument();
    const cell = (output: string) =>
      document.querySelector(`table[data-view="table-two-ledgers"] [data-output="${output}"]`);
    const L = ME01_DEFAULTS.emittedEnergyRestFrame;
    const asDrawn = (value: number) => `${fixed(value / L, 4)} L`;
    // The numbers a reader is told to read: the moving frame's light, and each pulse.
    for (const output of [
      "movingBalanceLight",
      "pulse1Moving",
      "pulse2Moving",
      "pulseSumMoving",
      "restBalanceLight",
    ] as const) {
      const result = evaluation[output];
      if (result.status !== "value" || typeof result.value !== "number")
        throw new Error(`${output} is not a value at the defaults, so this test asserts nothing`);
      expect([output, cell(output)?.textContent?.trim()]).toEqual([output, asDrawn(result.value)]);
    }
    // The two pulses are the moving frame's light: the identity the tilt action promises stays
    // readable in the table rather than only in the drawing's labels.
    const sum = evaluation.pulseSumMoving;
    const balance = evaluation.movingBalanceLight;
    if (sum.status !== "value" || balance.status !== "value")
      throw new Error("no values to compare");
    expect(sum.value).toBeCloseTo(balance.value as number, 12);
  });

  test("a line the kernel returns as symbolic shows its symbol, not a number", async () => {
    const { document, evaluation } = await ledgerDocument();
    const symbolic = (
      ["restBodyBefore", "restBodyAfter", "movingBodyBefore", "movingBodyAfter"] as const
    )
      .map((output) => ({ output, result: evaluation[output] }))
      .filter(({ result }) => result.status === "symbolic");
    // Non-vacuity on purpose: the body's energies are unspecified in this argument, and a run where
    // they came back as numbers would silently skip every assertion below.
    expect(symbolic.length).toBe(4);
    for (const { output, result } of symbolic) {
      const cell = document.querySelector(
        `table[data-view="table-two-ledgers"] [data-output="${output}"]`,
      );
      expect([output, cell?.getAttribute("data-status")]).toEqual([output, "symbolic"]);
      const symbols = result.status === "symbolic" ? result.unspecifiedSymbols : [];
      expect([output, cell?.textContent?.trim()]).toEqual([output, symbols.join(", ")]);
      expect([output, /\d/.test(cell?.textContent ?? "")]).toEqual([output, false]);
    }
    console.log(
      `me-01 ledger table: ${document.querySelectorAll('table[data-view="table-two-ledgers"] tbody tr').length} rows, ${symbolic.length} of them symbolic in both frames`,
    );
  });
});
