import {
  FACSIMILE_UPDATED_EVENT,
  type NativeFacsimileClient,
  type NativeFacsimileStatus,
  nativeFacsimileClient,
  parseNativeFacsimileStatus,
} from "../../platform/app-bridge/facsimiles.ts";
import { type FacsimileDocument, facsimilePdfHref } from "./document.ts";

const size = (bytes: number) =>
  bytes < 1_000_000
    ? `${Math.ceil(bytes / 1000).toLocaleString()} KB`
    : `${(bytes / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 1 })} MB`;

/** Enhances only the app: web links and the static source-page directory retain their behavior. */
export function mountNativeFacsimileDownload(
  root: HTMLElement,
  source: FacsimileDocument,
  suppliedClient?: NativeFacsimileClient | null,
): () => void {
  const window = root.ownerDocument.defaultView;
  if (!window) return () => {};
  const client =
    suppliedClient === undefined ? nativeFacsimileClient(window, source) : suppliedClient;
  if (!client) return () => {};
  const panel = root.querySelector<HTMLElement>("[data-native-facsimile]");
  const status = root.querySelector<HTMLElement>("[data-native-facsimile-status]");
  const button = root.querySelector<HTMLButtonElement>("[data-native-facsimile-request]");
  const progress = root.querySelector<HTMLProgressElement>("[data-native-facsimile-progress]");
  if (!panel || !status || !button || !progress) return () => {};
  const links = [
    ...root.querySelectorAll<HTMLAnchorElement>(
      "[data-facsimile-direct], [data-facsimile-download]",
    ),
  ];
  const frame = root.querySelector<HTMLIFrameElement>("[data-facsimile-frame]");
  let active = true;
  let generation = 0;
  let pending = false;
  let current: NativeFacsimileStatus | null = null;
  panel.hidden = false;

  const draw = () => {
    const verified = current?.state === "verified";
    root.dataset.nativeFacsimileState = current?.state ?? "checking";
    for (const link of links) {
      if (verified) {
        link.removeAttribute("aria-disabled");
        link.removeAttribute("tabindex");
      } else {
        link.setAttribute("aria-disabled", "true");
        link.tabIndex = -1;
      }
    }
    if (frame) {
      frame.hidden = !verified;
      if (verified) {
        const selected = Number(root.dataset.facsimilePdfPage) || 1;
        const href = facsimilePdfHref(source, selected);
        if (frame.getAttribute("src") !== href) frame.setAttribute("src", href);
      } else frame.removeAttribute("src");
    }
    button.hidden = verified || current?.state === "unavailable";
    button.disabled = pending || current?.state === "downloading";
    progress.hidden = current?.state !== "downloading";
    progress.value = current?.progress ?? 0;
    progress.setAttribute(
      "aria-label",
      `PDF download: ${Math.round((current?.progress ?? 0) * 100)} percent`,
    );
    if (!current) {
      status.textContent = pending
        ? "Checking the original PDF on this device…"
        : "The PDF download status could not be checked. Try again.";
      button.textContent = "Check download status";
      return;
    }
    const amount = current.bytesExpected > 0 ? ` (${size(current.bytesExpected)})` : "";
    button.textContent =
      current.state === "failed" ? `Retry PDF download${amount}` : `Download original PDF${amount}`;
    switch (current.state) {
      case "not-downloaded":
        status.textContent = `The original PDF${amount} is available to download for offline reading.`;
        break;
      case "downloading":
        status.textContent = `Downloading the original PDF: ${size(current.bytesReceived)} of ${size(current.bytesExpected)}.`;
        break;
      case "verified":
        status.textContent = `The original PDF${amount} is verified and ready to open offline.`;
        break;
      case "failed":
        status.textContent = current.reason || "The PDF could not be downloaded. You can retry.";
        break;
      case "evicted":
        status.textContent = `This device cleared the saved PDF${amount}. Download it again to open it offline.`;
        break;
      case "unavailable":
        status.textContent =
          current.reason ||
          "This edition does not offer this PDF for download. See the source receipt below.";
        break;
    }
  };
  const refresh = async (requestDownload: boolean) => {
    if (!active || pending) return;
    const ticket = ++generation;
    pending = true;
    draw();
    try {
      const result = await (requestDownload ? client.request() : client.status());
      if (!active || ticket !== generation) return;
      current = result;
    } catch {
      // Injected clients and a failed host are treated like the bounded bridge client.
      if (!active || ticket !== generation) return;
      current = null;
    } finally {
      if (active && ticket === generation) {
        pending = false;
        draw();
      }
    }
  };
  const update = (event: Event) => {
    const value = parseNativeFacsimileStatus((event as CustomEvent<unknown>).detail, source);
    if (!active || !value) return;
    generation++; // A late status response cannot roll back a newer completion/progress event.
    pending = false;
    current = value;
    draw();
  };
  const request = () => {
    void refresh(current !== null && current.state !== "unavailable");
  };
  const guardPdf = (event: MouseEvent) => {
    if (current?.state === "verified") return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const link = target.closest("[data-facsimile-direct], [data-facsimile-download]");
    if (!link || !root.contains(link)) return;
    event.preventDefault();
    button.focus();
  };
  const visible = () => {
    if (root.ownerDocument.visibilityState === "visible") void refresh(false);
  };
  button.addEventListener("click", request);
  root.addEventListener("click", guardPdf);
  window.addEventListener(FACSIMILE_UPDATED_EVENT, update);
  root.ownerDocument.addEventListener("visibilitychange", visible);
  draw();
  void refresh(false);
  return () => {
    active = false;
    generation++;
    button.removeEventListener("click", request);
    root.removeEventListener("click", guardPdf);
    window.removeEventListener(FACSIMILE_UPDATED_EVENT, update);
    root.ownerDocument.removeEventListener("visibilitychange", visible);
    panel.hidden = true;
  };
}
