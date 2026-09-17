import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { ShowTheCode } from "../components/lab/ShowTheCode.tsx";
import { getKernelListingsForInstrument } from "../content/kernel/listings.ts";
import { KERNEL_BEAD_ID } from "../content/kernel/types.ts";
import { getLogger } from "./log/logger.ts";
import { createContainer, installDom, removeContainer, uninstallDom } from "./reactDom.ts";

const logger = getLogger("show-the-code");

beforeEach(async () => {
  await installDom();
});

afterEach(async () => {
  await uninstallDom();
});

describe("traceIndependence: trace table is invariant to runtime snapshot advances", () => {
  test("mounting BM-01 disclosure, advancing snapshot state, and asserting trace rows and markup remain unchanged", async () => {
    const container = createContainer();
    const root = createRoot(container);

    const listings = getKernelListingsForInstrument("bm-01");
    expect(listings.length).toBeGreaterThan(0);
    const stokesListing = listings.find((l) => l.exportName === "stokesEinsteinD");
    expect(stokesListing).toBeDefined();
    expect(stokesListing?.trace).toBeDefined();

    // Initial snapshot state (snapshot 1)
    await act(async () => {
      root.render(
        <ShowTheCode
          listings={listings}
          producedCurrentSnapshot={false}
          snapshotFunctionName="stokesEinsteinD"
          snapshotSourceDigest={stokesListing?.sourceHash}
          uid="test-trace-indep"
        />,
      );
    });

    const initialTable = container.querySelector(".kernel-trace");
    expect(initialTable).not.toBeNull();
    const initialTableHtml = initialTable?.outerHTML;
    const initialRows = Array.from(container.querySelectorAll(".kernel-trace tbody tr")).map(
      (tr) => tr.textContent,
    );
    expect(initialRows.length).toBeGreaterThanOrEqual(5);

    // Advance to a new accepted snapshot (snapshot 2: simulated time elapsed, new snapshot version, producedCurrentSnapshot true)
    await act(async () => {
      root.render(
        <ShowTheCode
          listings={listings}
          producedCurrentSnapshot={true}
          snapshotFunctionName="stokesEinsteinD"
          snapshotSourceDigest={stokesListing?.sourceHash}
          uid="test-trace-indep"
        />,
      );
    });

    const secondTable = container.querySelector(".kernel-trace");
    const secondTableHtml = secondTable?.outerHTML;
    const secondRows = Array.from(container.querySelectorAll(".kernel-trace tbody tr")).map(
      (tr) => tr.textContent,
    );

    expect(secondTableHtml).toBe(initialTableHtml);
    expect(secondRows).toEqual(initialRows);

    // Advance to another snapshot with different function and parameters
    await act(async () => {
      root.render(
        <ShowTheCode
          listings={listings}
          producedCurrentSnapshot={true}
          snapshotFunctionName="rmsDisplacement"
          snapshotSourceDigest={stokesListing?.sourceHash}
          uid="test-trace-indep"
        />,
      );
    });

    const thirdTable = container.querySelector(".kernel-trace");
    const thirdTableHtml = thirdTable?.outerHTML;
    const thirdRows = Array.from(container.querySelectorAll(".kernel-trace tbody tr")).map(
      (tr) => tr.textContent,
    );

    expect(thirdTableHtml).toBe(initialTableHtml);
    expect(thirdRows).toEqual(initialRows);

    await act(async () => {
      root.unmount();
    });
    removeContainer(container);

    logger.log({
      testId: "trace-independence-snapshot-advance",
      beadId: KERNEL_BEAD_ID,
      instrumentId: "bm-01",
      outcome: "passed",
      message:
        "Trace markup and values remain byte-identical across multiple accepted snapshot advancements",
      extra: {
        traceRowCount: initialRows.length,
        function: "stokesEinsteinD",
      },
    });
  });
});
