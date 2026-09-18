import {afterEach,beforeEach,expect,test} from "bun:test";
import {act} from "react";
import "../equations/missingStep/register.ts";
import {closeDirectOpenDialog,openFromSearch,openFromTrigger} from "../reader/stack/mountDirectOpen.ts";
import {deserializeStackState} from "../reader/stack/history.ts";
import {topFrame,EMPTY_STACK_STATE} from "../reader/stack/stackStore.ts";
import {installDom,uninstallDom} from "./reactDom.ts";
beforeEach(installDom);
afterEach(async()=>{await act(async()=>{closeDirectOpenDialog(document);await Promise.resolve();});await uninstallDom();});
function setup(){
 history.replaceState({unrelated:"keep"},"","/papers/brownian-motion/s4/?detail=2&lens=modern&extra=keep#arg-bm-independent-steps");
 document.documentElement.dataset.detail="2";document.documentElement.dataset.view="reading";
 const reader=document.createElement("div");reader.dataset.readerRoot="";reader.dataset.view="reading";
 reader.innerHTML='<article class="reader-passage" id="arg-bm-independent-steps" tabindex="-1"><p class="passage-question">Why average squares?</p><a id="cross-trigger" data-selection-id="crossTerm">Explain cross term</a></article>';
 document.body.append(reader);return reader.querySelector<HTMLElement>("#cross-trigger")!;
}
test("trigger descent captures passage, selected subtree and current reading settings",async()=>{
 const trigger=setup();await act(async()=>{expect(openFromTrigger(document,trigger,"derivation-step:bm-variance-cross")).toBe(true);});
 const frame=topFrame(deserializeStackState(history.state.annusClarification.stack)??EMPTY_STACK_STATE);
 expect(frame?.anchor).toBe("arg-bm-independent-steps");expect(frame?.selectionId).toBe("crossTerm");
 expect(frame?.detail).toBe(2);expect(frame?.perspective).toBe("modern");expect(frame?.question).toBe("Why average squares?");
 expect(history.state.unrelated).toBe("keep");expect(location.search).toContain("extra=keep");
 expect(document.querySelector("dialog[open] [data-missing-step]")?.getAttribute("data-missing-step")).toBe("bm-variance-cross");
});
test("direct links have a readable compass and close without leaving the source passage",async()=>{
 setup();await act(async()=>{openFromSearch(document,"?open=derivation-step:bm-variance-cross");});
 await act(async()=>{document.querySelector<HTMLButtonElement>("[data-compass-return]")?.click();await Promise.resolve();});
 expect(document.querySelector("dialog[open]")).toBeNull();expect(location.hash).toBe("#arg-bm-independent-steps");expect(location.search).toContain("extra=keep");
});
test("invalid and duplicate targets do not open a dialog or rewrite history",()=>{
 setup();const before=location.href;
 expect(openFromSearch(document,"?open=derivation-step:missing")).toBe(false);
 expect(openFromSearch(document,"?open=derivation-step:bm-variance-cross&open=term:x")).toBe(false);
 expect(location.href).toBe(before);expect(document.querySelector("dialog[open]")).toBeNull();
});
test("a same-turn close and reopen retains the replacement root",async()=>{
 setup();await act(async()=>{
  openFromSearch(document,"?open=derivation-step:bm-variance-cross");closeDirectOpenDialog(document);
  openFromSearch(document,"?open=derivation-step:bm-variance-expand");await Promise.resolve();
 });
 expect(document.querySelectorAll("dialog[open]").length).toBe(1);
 expect(document.querySelector("dialog[open] [data-missing-step]")?.getAttribute("data-missing-step")).toBe("bm-variance-expand");
});
