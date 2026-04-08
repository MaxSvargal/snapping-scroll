export class VirtualScroller {
  constructor({ root, itemTagName, onEndReached, onElementCreated }) {
    this.root = root;
    this.itemTagName = itemTagName;
    this.onEndReached = onEndReached;
    this.onElementCreated = onElementCreated;

    this.data = [];
    this.elements = new Map();
    this.lastVisibleIndex = -1;
    this.cachedHeight = 0;
    this.pending = false;
    this.loading = false;

    new ResizeObserver((entries) => {
      const newHeight = entries[0].contentRect.height;
      if (newHeight === 0 || newHeight === this.cachedHeight) return;

      this.cachedHeight = newHeight;
      window.requestAnimationFrame(() => this.refresh(true));
    }).observe(this.root);

    this.playObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const ratio = entry.intersectionRatio;
          if (ratio > 0.8) entry.target.active = true;
          else if (ratio < 0.6) entry.target.active = false;
        });
      },
      {
        root: this.root,
        threshold: [0.6, 0.8],
      },
    );

    this.root.addEventListener("scroll", () => {
      if (this.pending) return;
      this.pending = true;
      requestAnimationFrame(() => {
        this.pending = false;
        this.refresh();
      });
    }, { passive: true });
  }

  update(newData) {
    const prevLen = this.data.length;
    this.data = newData;
    window.requestAnimationFrame(() => {
      if (prevLen !== newData.length) {
        this.root.style.setProperty("--total-items", this.data.length);
        this.refresh(true);
      } else {
        for (const [i, el] of this.elements.entries()) {
          el.data = this.data[i];
        }
      }
    });
  }

  refresh(force = false) {
    if (!this.cachedHeight || !this.data.length) return;

    const visibleIndex = Math.floor(this.root.scrollTop / this.cachedHeight);
    if (!force && visibleIndex === this.lastVisibleIndex) return;
    this.lastVisibleIndex = visibleIndex;

    const bufferSize = 2;
    const start = Math.max(0, visibleIndex - bufferSize);
    const end = Math.min(this.data.length, visibleIndex + 1 + bufferSize);

    const indicesToKeep = new Set();

    for (let i = start; i < end; i++) {
      indicesToKeep.add(i);

      if (!this.elements.has(i)) {
        const el = document.createElement(this.itemTagName);
        el.style.setProperty("--index", i);
        this.onElementCreated?.(el);
        el.data = this.data[i];
        this.root.appendChild(el);
        this.elements.set(i, el);
        this.playObserver.observe(el);
      }
    }

    for (const [index, el] of this.elements.entries()) {
      if (!indicesToKeep.has(index)) {
        el.remove();
        this.playObserver.unobserve(el);
        this.elements.delete(index);
      }
    }

    if (!this.loading && visibleIndex >= this.data.length - 3) {
      this.loading = true;
      Promise.resolve(this.onEndReached?.()).finally(() => {
        this.loading = false;
      });
    }
  }
}
