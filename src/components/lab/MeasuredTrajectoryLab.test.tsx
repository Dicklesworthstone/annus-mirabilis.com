import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MeasuredTrajectoryLab } from "./MeasuredTrajectoryLab.tsx";

describe("MeasuredTrajectoryLab readiness contract", () => {
  test("laboratory root declares data-ready for harness synchronization", () => {
    const html = renderToStaticMarkup(<MeasuredTrajectoryLab />);

    // data-ready signals readiness to the browser test harness
    expect(html).toContain("data-ready");
    expect(html).toContain('data-ready="false"');
    expect((html.match(/data-ready=/g) ?? []).length).toBe(1);
  });
});
