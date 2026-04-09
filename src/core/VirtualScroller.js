export class VirtualScroller {
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

  #mount(i) {
    const el = document.createElement(this.itemTagName);
    el.style.setProperty("--index", i);
    this.onElementCreated?.(el);
    el.data = this.data[i];
    this.root.appendChild(el);
    this.elements.set(i, el);
    this.playObserver.observe(el);
  }

  #unmount(i, el) {
    el.remove();
    this.playObserver.unobserve(el);
    this.elements.delete(i);
  }
}
