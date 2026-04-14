import { effect } from "./signals.js";

/**
 * Base class for reactive web components with declarative DOM binding and event wiring.
 *
 * Lifecycle: constructor → connectedCallback (_mapRefs → onInit → _setupActions → _setupEvents → _mapBindings) → disconnectedCallback (onDisconnect → abort all listeners)
 *
 * ## In Templates (HTML)
 * - `data-ref="name"` → access via `this.refs.name`
 * - `data-event="eventName:methodName"` → auto-wire event to method (space-separated for multiple)
 * - `data-action="methodName"` → auto-wire click to method
 * - `data-bind="text:state class:className:state attr:name:state style:prop:state"` → auto-sync signal to DOM
 *
 * ## In Component Code
 * - Override `onInit()` to set up state and listeners (runs after refs are mapped)
 * - Use `this.listenTo(target, event, handler)` for listeners that auto-cleanup on disconnect
 * - Override `onDisconnect()` for additional cleanup (listeners already removed)
 *
 * @extends {HTMLElement}
 */
export class Component extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.state = {};
    this.refs = {};

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
    this._abortController = new AbortController();
    this._mapRefs();
    this.onInit();
    this._setupActions();
    this._setupEvents();
    this._mapBindings();
  }

  disconnectedCallback() {
    this.onDisconnect?.();
    this._abortController?.abort();
  }

  /**
   * Override to initialize state, listeners, and utilities.
   * Runs after refs are mapped, safe to use `this.refs`.
   * @example
   * onInit() {
   *   this.state = { count: signal(0) };
   *   this.listenTo(document, "visibilitychange", () => { ... });
   * }
   */
  onInit() {}

  /**
   * Override for cleanup of external utilities.
   * Listeners registered via `listenTo()` are auto-removed before this runs.
   * @example
   * onDisconnect() {
   *   this.myUtility?.cleanup();
   * }
   */
  onDisconnect() {}

  /**
   * Add listener that auto-removes on component disconnect.
   * @param {EventTarget} target - Element, window, or document
   * @param {string} eventName - Event name (e.g., "click", "resize", "visibilitychange")
   * @param {Function} handler - Event handler (receives event)
   * @example
   * onInit() {
   *   this.listenTo(window, "resize", () => this.#recalculate());
   *   this.listenTo(document, "keydown", (e) => this.#handleKey(e));
   * }
   */
  listenTo(target, eventName, handler) {
    target.addEventListener(eventName, handler, {
      signal: this._abortController.signal,
    });
  }

  /**
   * @private
   * Auto-wires all clicks to methods via `data-action="methodName"`.
   * Not called manually.
   */
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

  /**
   * @private
   * Populates `this.refs` from `data-ref="name"` attributes.
   * Called automatically before `onInit()`, so refs are safe to use there.
   * Not called manually.
   */
  _mapRefs() {
    const walker = document.createTreeWalker(
      this.shadowRoot,
      NodeFilter.SHOW_ELEMENT,
    );
    let node;
    while ((node = walker.nextNode())) {
      const refName = node.getAttribute("data-ref");
      if (refName) this.refs[refName] = node;
    }
  }

  /**
   * @private
   * Auto-wires element events via `data-event="eventName:methodName"` (space-separated for multiple).
   * Listeners auto-cleanup on disconnect via AbortController signal.
   * Called automatically after `onInit()`.
   * Not called manually.
   * @example HTML
   * <video data-event="canplay:onReady pointerdown:onPointerDown pointerup:onPointerUp" />
   * @example JS
   * onReady(event, video) { console.log("video ready"); }
   * onPointerDown(event, video) { console.log("pointer down"); }
   * onPointerUp(event, video) { console.log("pointer up"); }
   */
  _setupEvents() {
    const signal = this._abortController.signal;
    const walker = document.createTreeWalker(
      this.shadowRoot,
      NodeFilter.SHOW_ELEMENT,
    );
    let node;
    while ((node = walker.nextNode())) {
      const eventAttr = node.getAttribute("data-event");
      if (!eventAttr) continue;

      const el = node;
      eventAttr.split(" ").forEach((binding) => {
        const [eventName, methodName] = binding.split(":");
        if (typeof this[methodName] === "function") {
          el.addEventListener(eventName, (e) => this[methodName](e, el), {
            signal,
          });
        }
      });
    }
  }

  /**
   * @private
   * Auto-syncs signal state to DOM via `data-bind` attributes.
   * Uses surgical effects so each binding only updates its specific node.
   * Called automatically after `_setupEvents()`.
   * Not called manually.
   * @example
   * <span data-bind="text:count" />
   * <button data-bind="class:active:isActive disabled:isDisabled" />
   * // this.state.count.value = 5 → span.textContent = "5"
   * // this.state.isActive.value = true → button.classList.add("active")
   */
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
          } else if (type === "style") {
            el.style[extra] = val;
          }
        });
      });
    }
  }
}

/**
 * Create a CSSStyleSheet from a raw CSS string (for use with `static styles`).
 * Typically used with Vite's `?raw` import.
 * @param {string} rawString - CSS text
 * @returns {CSSStyleSheet}
 * @example
 * import styles from "./MyComponent.css?raw";
 * export class MyComponent extends Component {
 *   static styles = cssFrom(styles);
 * }
 */
export const cssFrom = (rawString) => {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(rawString);
  return sheet;
};

/**
 * Create an HTMLTemplateElement from a raw HTML string (for use with `static template`).
 * Typically used with Vite's `?raw` import.
 * @param {string} rawString - HTML text
 * @returns {HTMLTemplateElement}
 * @example
 * import html from "./MyComponent.html?raw";
 * export class MyComponent extends Component {
 *   static template = htmlFrom(html);
 * }
 */
export const htmlFrom = (rawString) => {
  const tmpl = document.createElement("template");
  tmpl.innerHTML = rawString;
  return tmpl;
};
