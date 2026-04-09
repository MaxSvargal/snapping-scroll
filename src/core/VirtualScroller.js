/**
 * @typedef {Object} VirtualScrollerOptions
 * @property {HTMLElement} root - scrollable container; must have a fixed height
 * @property {string} itemTagName - custom element tag name to instantiate per item
 * @property {number} [buffer=2] - items to keep mounted above and below the visible window
 * @property {() => (void|Promise<void>)} [onEndReached] - called when scroll passes the 50% data midpoint; guarded by a `loading` flag
 * @property {(el: HTMLElement) => void} [onElementCreated] - hook called after an element is created, before data is assigned
 */

/**
 * Manages a windowed set of DOM elements for a vertically-paged scroll container.
 */
export class VirtualScroller {
  /** @param {VirtualScrollerOptions} options */
  constructor({
    root,
    itemTagName,
    buffer = 2,
    onEndReached,
    onElementCreated,
  }) {
    this.root = root;
    this.itemTagName = itemTagName;
    this.buffer = buffer;
    this.onEndReached = onEndReached;
    this.onElementCreated = onElementCreated;

    this.data = [];
    this.elements = new Map();
    this.lastVisibleIndex = -1;
    this.cachedHeight = 0;
    this.pending = false;
    this.loading = false;

    new ResizeObserver(([entry]) => {
      const h = entry.contentRect.height;
      if (h && h !== this.cachedHeight) {
        this.cachedHeight = h;
        requestAnimationFrame(() => this.refresh(true));
      }
    }).observe(this.root);

    this.playObserver = new IntersectionObserver(
      (entries) => {
        for (const { target, intersectionRatio: r } of entries) {
          if (r > 0.8) target.active = true;
          else if (r < 0.6) target.active = false;
        }
      },
      { root, threshold: [0.6, 0.8] },
    );

    this.root.addEventListener(
      "scroll",
      () => {
        if (this.pending) return;
        this.pending = true;
        requestAnimationFrame(() => {
          this.pending = false;
          this.refresh();
        });
      },
      { passive: true },
    );
  }

  /**
   * Replaces the dataset. If the array grew, remounts with a forced refresh;
   * otherwise patches data in-place on currently mounted elements.
   * @param {import('../services/api.js').VideoModel[]} newData
   * @returns {void}
   */
  update(newData) {
    const grew = newData.length !== this.data.length;
    this.data = newData;
    if (grew) {
      this.root.style.setProperty("--total-items", newData.length);
      requestAnimationFrame(() => this.refresh(true));
    } else {
      for (const [i, el] of this.elements) el.data = newData[i];
    }
  }

  /**
   * Recalculates the visible window and mounts/unmounts elements accordingly.
   * @param {boolean} [force=false] - when true, remounts even if the visible index is unchanged
   * @returns {void}
   */
  refresh(force = false) {
    if (!this.cachedHeight || !this.data.length) return;

    const visible = Math.floor(this.root.scrollTop / this.cachedHeight);
    if (!force && visible === this.lastVisibleIndex) return;
    this.lastVisibleIndex = visible;

    const start = Math.max(0, visible - this.buffer);
    const end = Math.min(this.data.length, visible + 1 + this.buffer);
    const keep = new Set();

    for (let i = start; i < end; i++) {
      keep.add(i);
      if (!this.elements.has(i)) this.#mount(i);
    }

    for (const [i, el] of this.elements) {
      if (!keep.has(i)) this.#unmount(i, el);
    }

    if (!this.loading && visible >= this.data.length / 2) {
      this.loading = true;
      Promise.resolve(this.onEndReached?.()).finally(() => {
        this.loading = false;
      });
    }
  }

  /**
   * @private
   * @param {number} i - data index to mount
   */
  #mount(i) {
    const el = document.createElement(this.itemTagName);
    el.style.setProperty("--index", i);
    this.onElementCreated?.(el);
    el.data = this.data[i];
    this.root.appendChild(el);
    this.elements.set(i, el);
    this.playObserver.observe(el);
  }

  /**
   * @private
   * @param {number} i
   * @param {HTMLElement} el
   */
  #unmount(i, el) {
    el.remove();
    this.playObserver.unobserve(el);
    this.elements.delete(i);
  }
}
