import { afterEach, beforeEach, expect, test } from "bun:test";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { LowSpeedExplorer } from "../equations/derivations/LowSpeedExplorer.tsx";
import type { LowSpeedProofView } from "../equations/derivations/lowSpeedView.ts";
import generated from "../generated/mass-energy-low-speed.json";
import { MassEnergyLowSpeed } from "../reader/MassEnergyLowSpeed.tsx";
import { createContainer, installDom, removeContainer, uninstallDom } from "./reactDom.ts";

const proof=generated as LowSpeedProofView;
beforeEach(installDom);
afterEach(uninstallDom);
const states=(container:HTMLElement)=>[...container.querySelectorAll("[data-low-speed-step]")].map(e=>e.getAttribute("data-low-speed-state"));
const math=(container:HTMLElement)=>[...container.querySelectorAll("math")].map(e=>e.outerHTML);
async function mounted(element:ReactNode,check:(container:HTMLElement)=>Promise<void>) {
  const container=createContainer(), root=createRoot(container);
  try {await act(async()=>{root.render(element);});await check(container);}
  finally {await act(async()=>{root.unmount();});removeContainer(container);}
}
async function toggle(container:HTMLElement,id:string) {
  await act(async()=>{container.querySelector<HTMLInputElement>(`[data-low-speed-premise="${id}"]`)!.click();});
}

test("the entire low-speed argument is static MathML and text, without a required answer",()=>{
  const shell=document.createElement("div");shell.innerHTML=renderToStaticMarkup(<MassEnergyLowSpeed />);
  expect(shell.querySelector("#me-low-speed-derivation")).not.toBeNull();
  expect(states(shell)).toEqual(Array(5).fill("supported"));
  expect(shell.querySelectorAll("math").length).toBe(8);
  expect(shell.querySelector<HTMLFieldSetElement>("fieldset")!.disabled).toBe(true);
  expect(shell.querySelectorAll("table tbody tr").length).toBe(9);
  expect(shell.textContent).toContain("original quotient is still undefined");
  expect(shell.textContent).toContain("additional physical premise");
  expect(shell.textContent).toContain("does not assign either absolute body energy");
  expect(shell.querySelector('[data-low-speed-step="identify"]')?.closest("[hidden]")).toBeNull();
});

test("removing the inertia premise leaves the mathematical limit supported and the equations unchanged",async()=>{
  await mounted(<LowSpeedExplorer proof={proof} restoreSettings={false} />,async container=>{
    const before=math(container);
    await toggle(container,"inertia");
    expect(states(container)).toEqual(["supported","supported","supported","supported","blocked"]);
    expect(math(container)).toEqual(before);
    expect(container.querySelector("[data-low-speed-status]")?.textContent).toContain("not established");
    expect(container.querySelector("[data-low-speed-share]")?.getAttribute("href")).toContain("mel-off=inertia");
    await toggle(container,"inertia");
    expect(states(container)).toEqual(Array(5).fill("supported"));
  });
});

test("removing the offset premise blocks the kinetic interpretation but cannot erase the pure limit",async()=>{
  await mounted(<LowSpeedExplorer proof={proof} restoreSettings={false} />,async container=>{
    const before=math(container);await toggle(container,"offset");
    expect(states(container)).toEqual(["supported","blocked","blocked","supported","blocked"]);
    expect(math(container)).toEqual(before);
    expect(container.querySelector('[data-low-speed-step="kinetic"]')?.textContent).toContain("same offset");
  });
});

test("retained order changes the real formula and omitted term, never the limit or premises",async()=>{
  await mounted(<LowSpeedExplorer proof={proof} restoreSettings={false} />,async container=>{
    const before=math(container), select=container.querySelector<HTMLSelectElement>("[data-low-speed-order]")!;
    await act(async()=>{select.value="6";select.dispatchEvent(new Event("change",{bubbles:true}));});
    const after=math(container);
    expect(after[1]).not.toBe(before[1]);
    expect(after.filter((_,i)=>i!==1)).toEqual(before.filter((_,i)=>i!==1));
    expect(container.querySelector("[data-leading-omitted]")?.textContent).toContain("35/128");
    expect(container.querySelector("[data-leading-omitted]")?.textContent).toContain("power 8");
    expect(states(container)).toEqual(Array(5).fill("supported"));
    expect(container.querySelector("[data-low-speed-share]")?.getAttribute("href")).toContain("mel-order=6");
  });
});

test("shared settings open the disclosure, restore only the opted-in instance, and keep distinct controls",async()=>{
  window.history.replaceState({},"","/papers/mass-energy/?mel=1&mel-order=4&mel-off=inertia");
  await mounted(<><MassEnergyLowSpeed /><LowSpeedExplorer proof={proof} restoreSettings={false} /></>,async container=>{
    const instances=container.querySelectorAll<HTMLElement>("[data-low-speed-proof]");
    expect(states(instances[0]!)).toEqual(["supported","supported","supported","supported","blocked"]);
    expect(states(instances[1]!)).toEqual(Array(5).fill("supported"));
    expect(container.querySelector<HTMLDetailsElement>("[data-low-speed-disclosure]")!.open).toBe(true);
    expect(instances[0]!.querySelector<HTMLSelectElement>("[data-low-speed-order]")!.value).toBe("4");
    expect(instances[1]!.querySelector<HTMLSelectElement>("[data-low-speed-order]")!.value).toBe("2");
    const ids=[...container.querySelectorAll("[id]")].map(e=>e.id);expect(new Set(ids).size).toBe(ids.length);
    for(const label of container.querySelectorAll<HTMLLabelElement>("label")) expect(container.querySelector(`[id="${label.htmlFor}"]`)).not.toBeNull();
  });
});

test("an ambiguous shared order displays a notice without inventing a selected state",async()=>{
  window.history.replaceState({},"","/papers/mass-energy/?mel=1&mel-order=2&mel-order=6&mel-off=offset");
  await mounted(<LowSpeedExplorer proof={proof} />,async container=>{
    expect(states(container)).toEqual(Array(5).fill("supported"));
    expect(container.querySelector<HTMLSelectElement>("[data-low-speed-order]")!.value).toBe("2");
    expect(container.textContent).toContain("unsupported or ambiguous");
  });
});
