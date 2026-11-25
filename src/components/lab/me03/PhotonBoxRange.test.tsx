import { expect, test } from "bun:test";
import { Window } from "happy-dom";
import { renderToStaticMarkup } from "react-dom/server";
import { ME03_DEFAULTS } from "../../../experiments/me03/definition.ts";
import { createMe03Session } from "../../../experiments/me03/session.ts";
import { BoundaryLedgerLab } from "./BoundaryLedgerLab.tsx";

test("an unrepresentable initial photon-box case renders a repair without invalid SVG or scale", () => {
  const session = createMe03Session("unrepresentable-box", {
    ...ME03_DEFAULTS,
    mode: "box-1906",
    boxLength: Number.MIN_VALUE,
  });
  const html = renderToStaticMarkup(
    <BoundaryLedgerLab session={session} restoreFromLocation={false} showComparison={false} />,
  );
  expect(html).toContain("data-photon-box-unavailable");
  expect(html).toContain("underflow");
  expect(html).toContain("Change the box or pulse settings");
  expect(html).not.toContain('data-testid="photon-box-plot"');
  const window = new Window();
  window.document.body.innerHTML = html;
  const calculation = window.document.querySelector(".lab-results");
  expect(calculation).not.toBeNull();
  expect(calculation?.textContent).not.toContain("NaN");
  expect(calculation?.querySelector("svg")).toBeNull();
  window.close();
  expect(html).not.toContain("CM: Exactly Fixed");
});
