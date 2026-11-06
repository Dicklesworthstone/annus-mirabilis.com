/** Search can reopen the current fragment without the browser firing hashchange. */
export const SEARCH_NAVIGATION_EVENT = "am:search-navigation";

export function announceSearchNavigation(href: string): void {
  window.dispatchEvent(new CustomEvent(SEARCH_NAVIGATION_EVENT, { detail: { href } }));
}
