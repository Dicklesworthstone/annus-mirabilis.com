import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { ResultStatusPresentation } from "../../visuals/kit/ResultStatusPresentation.tsx";
import { createContainer, installDom, removeContainer, uninstallDom } from "../reactDom.ts";

beforeEach(async () => {
  await installDom();
});

afterEach(async () => {
  await uninstallDom();
});

describe("ResultStatusPresentation (am-inst-2d-view-kit-u75r)", () => {
  test("passes children through when status is 'value' or 'analytic-limit'", async () => {
    const container = createContainer();
    const root = createRoot(container);

    try {
      await act(() => {
        root.render(
          createElement(
            ResultStatusPresentation,
            { status: "value" },
            createElement("div", { id: "child-node" }, "Rendered Chart"),
          ),
        );
      });

      expect(container.querySelector("#child-node")?.textContent).toBe("Rendered Chart");

      await act(() => {
        root.render(
          createElement(
            ResultStatusPresentation,
            { status: "analytic-limit" },
            createElement("div", { id: "child-node-2" }, "Point Dist Chart"),
          ),
        );
      });

      expect(container.querySelector("#child-node-2")?.textContent).toBe("Point Dist Chart");
    } finally {
      await act(() => {
        root.unmount();
      });
      removeContainer(container);
    }
  });

  test("renders non-breaking descriptive notices when status is outside domain or diverged", async () => {
    const container = createContainer();
    const root = createRoot(container);

    try {
      await act(() => {
        root.render(
          createElement(
            ResultStatusPresentation,
            { status: "outside-domain" },
            createElement("div", { id: "should-not-render" }, "Hidden Chart"),
          ),
        );
      });

      expect(container.querySelector("#should-not-render")).toBeNull();
      const notice = container.querySelector('[data-result-status="outside-domain"]');
      expect(notice).not.toBeNull();
      expect(notice?.textContent).toContain("Outside physical or model domain");

      await act(() => {
        root.render(
          createElement(
            ResultStatusPresentation,
            { status: "divergent" },
            createElement("div", { id: "should-not-render" }, "Hidden Chart"),
          ),
        );
      });

      const divNotice = container.querySelector('[data-result-status="divergent"]');
      expect(divNotice?.textContent).toContain("Model prediction diverges");
    } finally {
      await act(() => {
        root.unmount();
      });
      removeContainer(container);
    }
  });
});
