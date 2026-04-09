import { effect } from "./signals.js";

export class Component extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.state = {};

    if (this.constructor.styles) {
      const sheets = Array.isArray(this.constructor.styles)
        ? this.constructor.styles
        : [this.constructor.styles];
      this.shadowRoot.adoptedStyleSheets = sheets;
    }

    if (this.constructor.template) {
      this.shadowRoot.appendChild(
        this.constructor.template.content.cloneNode(true),
      );
    }
  }

  connectedCallback() {
    this.onInit();
    this._setupActions();
    this._mapBindings();
  }

  // Developer hook
  onInit() {}

  // Automatically delegates all clicks based on data-action="methodName"
  _setupActions() {
    this.shadowRoot.addEventListener("click", (e) => {
      const target = e.target.closest("[data-action]");
      if (target) {
        const actionName = target.dataset.action;
        if (typeof this[actionName] === "function") {
          this[actionName](e, target);
        }
      }
    });
  }

  // Uses TreeWalker (Fastest DOM traversal) to map surgical updates
  _mapBindings() {
    const walker = document.createTreeWalker(
      this.shadowRoot,
      NodeFilter.SHOW_ELEMENT,
    );
    let node;

    while ((node = walker.nextNode())) {
      const el = node;
      const bindAttr = el.getAttribute("data-bind");
      if (!bindAttr) continue;

      // Supports multiple bindings like: data-bind="text:name class:active:isOnline"
      const bindings = bindAttr.split(" ");

      bindings.forEach((binding) => {
        const [type, key, extra] = binding.split(":");

        // This is the Magic: We create an isolated, surgical effect for THIS specific node.
        // If state[key] changes, ONLY this 3-line function runs.
        effect(() => {
          const signalTarget = this.state[key];
          if (!signalTarget) return;

          const val = signalTarget.value;

          if (type === "text") {
            if (el.textContent !== String(val)) el.textContent = val;
          } else if (type === "class") {
            el.classList.toggle(extra, !!val);
          } else if (type === "attr") {
            if (typeof val === "boolean") {
              val ? el.setAttribute(extra, "") : el.removeAttribute(extra);
            } else {
              el.setAttribute(extra, val);
            }
          }
        });
      });
    }
  }
}

// Create CSSStyleSheet from a raw CSS string (e.g., from Vite ?raw import)
export const cssFrom = (rawString) => {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(rawString);
  return sheet;
};

// Create HTMLTemplateElement from a raw HTML string (e.g., from Vite ?raw import)
export const htmlFrom = (rawString) => {
  const tmpl = document.createElement("template");
  tmpl.innerHTML = rawString;
  return tmpl;
};
