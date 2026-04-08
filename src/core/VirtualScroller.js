export class VirtualScroller {
  constructor({ root, runway, itemTagName, poolSize = 5, onEndReached }) {
    this.root = root;
    this.runway = runway;
    this.itemTagName = itemTagName;
    this.poolSize = poolSize;
    this.onEndReached = onEndReached;

    this.data = [];
    this.domPool = [];
    this.lastBaseIndex = -1;
    this.cachedHeight = 0;

    new ResizeObserver((entries) => {
      const newHeight = entries[0].contentRect.height;
      if (newHeight === 0 || newHeight === this.cachedHeight) return;

      this.cachedHeight = newHeight;
      window.requestAnimationFrame(() => this.refresh(true));
    }).observe(this.root);

    for (let i = 0; i < this.poolSize; i++) {
      const el = document.createElement(this.itemTagName);
      this.domPool.push(el);
      this.root.appendChild(el);
    }

    this.root.addEventListener("scroll", () => this.refresh(), {
      passive: true,
    });
  }

  update(newData) {
    this.data = newData;
    // Decouple property update from layout pass
    window.requestAnimationFrame(() => {
      this.root.style.setProperty("--total-items", this.data.length);
      this.refresh(true);
    });
  }

  refresh(force = false) {
    if (!this.cachedHeight || !this.data.length) return;

    const index = Math.round(this.root.scrollTop / this.cachedHeight);
    if (!force && index === this.lastBaseIndex) return;
    this.lastBaseIndex = index;

    const start = Math.max(0, index - 1);
    const end = Math.min(this.data.length - 1, index + 2);

    for (let i = start; i <= end; i++) {
      const el = this.domPool[i % this.poolSize];
      el.style.setProperty("--index", i);
      el.data = this.data[i];
      el.active = i === index;
    }

    if (end >= this.data.length - 2) this.onEndReached?.();
  }
}
