/**
 * Focus Management and Restoration Bun Test Suite.
 *
 * Spec: AGENTS.md §10.1 and am-a11y-baseline-1cg5
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
  clearFocusStack,
  getFocusableElements,
  getFocusStackDepth,
  popFocusScope,
  pushFocusScope,
  trapFocus,
} from "../../a11y/focus.ts";
import { installDom, uninstallDom } from "../reactDom.ts";

describe("Focus Management Stack and Restoration (am-a11y-baseline-1cg5)", () => {
  beforeEach(async () => {
    await installDom();
    clearFocusStack();
    document.body.innerHTML = "";
  });

  afterEach(async () => {
    clearFocusStack();
    document.body.innerHTML = "";
    await uninstallDom();
  });

  it("identifies focusable elements accurately within container", () => {
    const container = document.createElement("div");
    container.innerHTML = `
      <button id="btn1">Button 1</button>
      <a href="#test" id="link1">Link 1</a>
      <input type="text" id="input1" />
      <button disabled id="disabledBtn">Disabled</button>
      <div tabindex="-1" id="ignoredDiv">Not focusable</div>
      <div tabindex="0" id="focusableDiv">Focusable div</div>
    `;
    document.body.appendChild(container);

    const focusables = getFocusableElements(container);
    const ids = focusables.map((el) => el.id);
    expect(ids).toEqual(["btn1", "link1", "input1", "focusableDiv"]);
  });

  it("pushes focus scope and moves focus to first element, then restores on pop", () => {
    const triggerBtn = document.createElement("button");
    triggerBtn.id = "trigger";
    document.body.appendChild(triggerBtn);
    triggerBtn.focus();

    const modal = document.createElement("div");
    modal.id = "modal1";
    modal.innerHTML = `
      <button id="modalClose">Close</button>
      <button id="modalSubmit">Submit</button>
    `;
    document.body.appendChild(modal);

    expect(getFocusStackDepth()).toBe(0);

    // Push scope
    pushFocusScope(modal, triggerBtn);
    expect(getFocusStackDepth()).toBe(1);
    expect(document.activeElement?.id).toBe("modalClose");

    // Pop scope -> restores focus to triggerBtn
    const restored = popFocusScope();
    expect(restored).toBe(triggerBtn);
    expect(document.activeElement).toBe(triggerBtn);
    expect(getFocusStackDepth()).toBe(0);
  });

  it("supports nested focus scopes (e.g. clarification popover over modal overlay)", () => {
    const mainBtn = document.createElement("button");
    mainBtn.id = "mainBtn";
    document.body.appendChild(mainBtn);

    const modal = document.createElement("div");
    modal.innerHTML = `<button id="modalBtn">Open Popover</button>`;
    document.body.appendChild(modal);

    const popover = document.createElement("div");
    popover.innerHTML = `<button id="popoverClose">Close Clarification</button>`;
    document.body.appendChild(popover);

    // Scope 1: modal
    pushFocusScope(modal, mainBtn);
    expect(getFocusStackDepth()).toBe(1);
    const modalBtn = document.getElementById("modalBtn") as HTMLElement;

    // Scope 2: nested popover
    pushFocusScope(popover, modalBtn);
    expect(getFocusStackDepth()).toBe(2);
    expect(document.activeElement?.id).toBe("popoverClose");

    // Pop scope 2 -> restores to modalBtn
    popFocusScope();
    expect(getFocusStackDepth()).toBe(1);
    expect(document.activeElement?.id).toBe("modalBtn");

    // Pop scope 1 -> restores to mainBtn
    popFocusScope();
    expect(getFocusStackDepth()).toBe(0);
    expect(document.activeElement?.id).toBe("mainBtn");
  });

  it("traps Tab key within active container bounds", () => {
    const container = document.createElement("div");
    container.innerHTML = `
      <button id="first">First</button>
      <button id="second">Second</button>
      <button id="last">Last</button>
    `;
    document.body.appendChild(container);

    const first = document.getElementById("first") as HTMLElement;
    const last = document.getElementById("last") as HTMLElement;

    // Focus on last, press Tab -> should wrap to first
    last.focus();
    let defaultPrevented = false;
    const forwardTab = new KeyboardEvent("keydown", {
      key: "Tab",
      shiftKey: false,
    });
    forwardTab.preventDefault = () => {
      defaultPrevented = true;
    };

    trapFocus(forwardTab, container);
    expect(defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);

    // Focus on first, press Shift+Tab -> should wrap to last
    first.focus();
    defaultPrevented = false;
    const backwardTab = new KeyboardEvent("keydown", {
      key: "Tab",
      shiftKey: true,
    });
    backwardTab.preventDefault = () => {
      defaultPrevented = true;
    };

    trapFocus(backwardTab, container);
    expect(defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(last);
  });
});
