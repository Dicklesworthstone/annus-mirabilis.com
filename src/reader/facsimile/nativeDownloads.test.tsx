import { afterEach, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  FACSIMILE_UPDATED_EVENT,
  type NativeFacsimileStatus,
} from "../../platform/app-bridge/facsimiles.ts";
import { installDom, uninstallDom } from "../../testing/reactDom.ts";
import { mountFacsimileReader } from "./controller.ts";
import type { FacsimileDocument } from "./document.ts";
import { FacsimilePanel } from "./FacsimilePanel.tsx";
import { mountNativeFacsimileDownload } from "./nativeDownloads.ts";

const source: FacsimileDocument = {
  paperId: "mass-energy",
  key: "ap-18-639",
  pdfUrl: "/papers/pdfs/ap-18-639.pdf",
  sha256: "a".repeat(64),
  originUrl: "https://archive.org/source.pdf",
  acquisitionDate: "2026-09-18",
  rightsStatus: "scan-open-terms",
  scanInstitution: null,
  termsUrl: null,
  inventoryStatus: "draft",
  units: [],
  pages: [639, 640, 641].map((printedPage, index) => ({ printedPage, pdfPage: index + 1 })),
};
const state = (value: NativeFacsimileStatus["state"]): NativeFacsimileStatus => ({
  key: source.key,
  state: value,
  bytesExpected: 1_200_000,
  bytesReceived: value === "verified" ? 1_200_000 : 0,
  progress: value === "verified" ? 1 : 0,
  ...(value === "verified" ? { path: source.pdfUrl } : {}),
});
let cleanup: (() => void) | undefined;
afterEach(async () => {
  cleanup?.();
  cleanup = undefined;
  await uninstallDom();
});
async function root() {
  await installDom();
  // An inert srcdoc keeps this bridge/navigation test independent of PDF network rendering.
  const template = document.createElement("template");
  template.innerHTML = renderToStaticMarkup(
    <FacsimilePanel
      document={source}
      title="Mass and energy"
      faceHref="/papers/mass-energy/view/facsimile/"
      explanationHref="/papers/mass-energy/"
    />,
  );
  const frame = template.content.querySelector("iframe");
  if (frame) frame.srcdoc = "<!doctype html><title>PDF frame fixture</title>";
  document.body.appendChild(template.content);
  const element = document.querySelector<HTMLElement>("[data-facsimile-reader]");
  expect(element).not.toBeNull();
  return element as HTMLElement;
}
async function settle() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}
function update(value: unknown) {
  window.dispatchEvent(new CustomEvent(FACSIMILE_UPDATED_EVENT, { detail: value }));
}

test("the app checks size and status without downloading; a reader action starts the download", async () => {
  const element = await root();
  let statusCalls = 0;
  let requests = 0;
  cleanup = mountNativeFacsimileDownload(element, source, {
    async status() {
      statusCalls++;
      return state("not-downloaded");
    },
    async request() {
      requests++;
      return state("downloading");
    },
  });
  await settle();
  expect(statusCalls).toBe(1);
  expect(requests).toBe(0);
  const button = element.querySelector<HTMLButtonElement>("[data-native-facsimile-request]");
  expect(button?.textContent).toContain("1.2 MB");
  expect(element.querySelector("iframe")?.hasAttribute("src")).toBe(false);
  const link = element.querySelector<HTMLAnchorElement>("[data-facsimile-direct]");
  const click = new MouseEvent("click", { bubbles: true, cancelable: true });
  link?.dispatchEvent(click);
  expect(click.defaultPrevented).toBe(true);
  expect(requests).toBe(0);
  button?.click();
  await settle();
  expect(requests).toBe(1);
  expect(button?.disabled).toBe(true);
  update({ ...state("downloading"), bytesReceived: 600_000, progress: 0.5 });
  expect(element.querySelector<HTMLProgressElement>("progress")?.value).toBe(0.5);
  update(state("verified"));
  expect(link?.hasAttribute("aria-disabled")).toBe(false);
  expect(element.querySelector<HTMLIFrameElement>("iframe")?.hidden).toBe(false);
  expect(element.querySelector("iframe")?.getAttribute("src")).toContain(source.pdfUrl);
  expect(element.textContent).toContain("verified and ready to open offline");
});

test("a newer native completion wins over a delayed initial status response", async () => {
  const element = await root();
  let reply: ((value: NativeFacsimileStatus) => void) | undefined;
  cleanup = mountNativeFacsimileDownload(element, source, {
    status: () =>
      new Promise((resolve) => {
        reply = resolve;
      }),
    request: async () => state("downloading"),
  });
  update(state("verified"));
  reply?.(state("not-downloaded"));
  await settle();
  expect(element.dataset.nativeFacsimileState).toBe("verified");
  update({ ...state("failed"), key: "ap-17-891" });
  expect(element.dataset.nativeFacsimileState).toBe("verified");
});

test("eviction and failure offer a retry while page changes cannot load an unavailable PDF", async () => {
  const element = await root();
  const native = mountNativeFacsimileDownload(element, source, {
    status: async () => state("verified"),
    request: async () => state("downloading"),
  });
  const reader = mountFacsimileReader(element, source, 1, "/papers/mass-energy/view/facsimile/");
  cleanup = () => {
    reader();
    native();
  };
  await settle();
  update(state("evicted"));
  element.querySelector<HTMLButtonElement>("[data-facsimile-next]")?.click();
  expect(element.dataset.facsimilePdfPage).toBe("2");
  expect(element.querySelector("iframe")?.hasAttribute("src")).toBe(false);
  expect(element.textContent).toContain("device cleared the saved PDF");
  update({ ...state("failed"), reason: "The downloaded PDF did not match its pinned digest." });
  expect(element.textContent).toContain("did not match its pinned digest");
  expect(element.querySelector("[data-native-facsimile-request]")?.textContent).toContain("Retry");
  update(state("verified"));
  expect(element.querySelector("iframe")?.getAttribute("src")).toContain("#page=2");
});

test("cleanup ignores late replies and events, and a browser receives no native enhancement", async () => {
  const element = await root();
  const original = element.innerHTML;
  mountNativeFacsimileDownload(element, source, null)();
  expect(element.innerHTML).toBe(original);
  let reply: ((value: NativeFacsimileStatus) => void) | undefined;
  const unmount = mountNativeFacsimileDownload(element, source, {
    status: () =>
      new Promise((resolve) => {
        reply = resolve;
      }),
    request: async () => state("downloading"),
  });
  unmount();
  const stopped = element.innerHTML;
  reply?.(state("verified"));
  update(state("verified"));
  await settle();
  expect(element.innerHTML).toBe(stopped);
});
