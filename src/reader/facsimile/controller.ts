/** Progressive enhancement of a complete static source directory.
 * The browser owns PDF rendering. We announce page selection, not rendering success.
 */
import {
  type FacsimileDocument,
  facsimilePageAnchor,
  facsimilePdfHref,
  resolveFacsimileTarget,
} from "./document.ts";

export function mountFacsimileReader(
  root: HTMLElement,
  document: FacsimileDocument,
  initialPdfPage: number,
  faceHref: string,
  options: Readonly<{ preserveReaderHistory?: boolean }> = {},
): () => void {
  const window = root.ownerDocument.defaultView;
  if (!window) return () => {};
  const frame = root.querySelector<HTMLIFrameElement>("[data-facsimile-frame]");
  const form = root.querySelector<HTMLFormElement>("[data-facsimile-form]");
  const input = root.querySelector<HTMLInputElement>("[data-facsimile-page-input]");
  const previous = root.querySelector<HTMLButtonElement>("[data-facsimile-previous]");
  const next = root.querySelector<HTMLButtonElement>("[data-facsimile-next]");
  const status = root.querySelector<HTMLElement>("[data-facsimile-status]");
  const direct = root.querySelector<HTMLAnchorElement>("[data-facsimile-direct]");
  const share = root.querySelector<HTMLButtonElement>("[data-facsimile-share]");
  const shareField = root.querySelector<HTMLInputElement>("[data-facsimile-share-url]");
  const controls = root.querySelector<HTMLFieldSetElement>("[data-facsimile-controls]");
  if (!frame || !form || !input || !previous || !next || !status || !direct || !share || !shareField || !controls) {
    // Static page/PDF links still work if an embedder omits the optional controls.
    return () => {};
  }
  let active = true;
  let selected = initialPdfPage;

  function select(pdfPage: number, writeHistory: boolean) {
    const page = document.pages.find((candidate) => candidate.pdfPage === pdfPage);
    if (!page) return;
    selected = page.pdfPage;
    const href = facsimilePdfHref(document, page.pdfPage);
    if (frame!.getAttribute("src") !== href) frame!.setAttribute("src", href);
    frame!.title = `Original scan: printed page ${page.printedPage}, PDF page ${page.pdfPage} of ${document.pages.length}`;
    direct!.href = href;
    direct!.textContent = `Open printed page ${page.printedPage} in the original PDF`;
    input!.value = String(page.printedPage);
    input!.removeAttribute("aria-invalid");
    previous!.disabled = page.pdfPage === 1;
    next!.disabled = page.pdfPage === document.pages.length;
    root.dataset.facsimilePdfPage = String(page.pdfPage);
    status!.textContent = `Selected printed page ${page.printedPage} (PDF page ${page.pdfPage} of ${document.pages.length}). The embedded display depends on your browser's PDF support.`;
    for (const link of root.querySelectorAll<HTMLAnchorElement>("[data-facsimile-page-link]")) {
      if (link.dataset.facsimilePageLink === String(page.pdfPage)) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    }
    if (writeHistory && !options.preserveReaderHistory) {
      const url = new URL(window!.location.href);
      url.hash = facsimilePageAnchor(page);
      if (url.href !== window!.location.href) {
        try { window!.history.pushState(null, "", url.href); } catch { /* Direct PDF and copyable links remain usable. */ }
      }
    }
    const shared = new URL(faceHref, window!.location.href);
    shared.hash = facsimilePageAnchor(page);
    shareField!.value = shared.href;
  }

  function fromLocation() {
    if (!active) return;
    if (!window!.location.hash) {
      select(initialPdfPage, false);
      return;
    }
    const page = resolveFacsimileTarget(document, window!.location.hash);
    if (page === null) {
      if (options.preserveReaderHistory) return;
      status!.textContent = "No scan-page locator is recorded for this link. The selected page is unchanged; use the page directory below.";
      return;
    }
    select(page, false);
  }
  function submit(event: Event) {
    event.preventDefault();
    const text = input!.value.trim();
    const page = /^\d{1,6}$/.test(text)
      ? document.pages.find((candidate) => String(candidate.printedPage) === text)
      : undefined;
    if (!page) {
      input!.setAttribute("aria-invalid", "true");
      status!.textContent = "Enter a printed page number from the directory below. The selected scan page has not changed.";
      return;
    }
    select(page.pdfPage, true);
  }
  const goPrevious = () => select(selected - 1, true);
  const goNext = () => select(selected + 1, true);
  async function copyLink() {
    const url = shareField!.value;
    try {
      if (!window!.navigator.clipboard?.writeText) throw new Error("clipboard-unavailable");
      await window!.navigator.clipboard.writeText(url);
      if (active && shareField!.value === url) status!.textContent = "Link to the selected source page copied.";
    } catch {
      if (!active || shareField!.value !== url) return;
      shareField!.focus();
      shareField!.select();
      status!.textContent = "Copy the selected source-page link from the field. Clipboard access is not required.";
    }
  }

  const followInlineTarget = (event: MouseEvent) => {
    if (!options.preserveReaderHistory || event.defaultPrevented || event.button !== 0 ||
      event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || !(event.target instanceof Element)) return;
    const link = event.target.closest<HTMLElement>("[data-facsimile-target]");
    if (!link || !root.contains(link)) return;
    const page = resolveFacsimileTarget(document, link.dataset.facsimileTarget ?? "");
    if (page === null) return;
    event.preventDefault();
    select(page, false);
  };

  controls.disabled = false;
  select(initialPdfPage, false);
  fromLocation();
  if (!options.preserveReaderHistory) {
    window.addEventListener("hashchange", fromLocation);
    window.addEventListener("popstate", fromLocation);
  }
  root.addEventListener("click", followInlineTarget);
  form.addEventListener("submit", submit);
  previous.addEventListener("click", goPrevious);
  next.addEventListener("click", goNext);
  share.addEventListener("click", copyLink);
  return () => {
    active = false;
    root.removeEventListener("click", followInlineTarget);
    window.removeEventListener("hashchange", fromLocation);
    window.removeEventListener("popstate", fromLocation);
    form.removeEventListener("submit", submit);
    previous.removeEventListener("click", goPrevious);
    next.removeEventListener("click", goNext);
    share.removeEventListener("click", copyLink);
    controls.disabled = true;
  };
}
