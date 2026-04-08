export class VirtualScroller {
  constructor({ root, runway, itemTagName, poolSize = 5, onEndReached }) {
    this.root = root;
    this.runway = runway;
    this.itemTagName = itemTagName;
    this.poolSize = poolSize;
    this.onEndReached = onEndReached;

    this.data = [];
    this.domPool = [];
    this.lastVisibleIndex = -1;
    this.cachedHeight = 0;

    new ResizeObserver((entries) => {
      const newHeight = entries[0].contentRect.height;
      if (newHeight === 0 || newHeight === this.cachedHeight) return;

      this.cachedHeight = newHeight;
      window.requestAnimationFrame(() => this.refresh(true));
    }).observe(this.root);

    this.playObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          entry.target.active =
            entry.isIntersecting && entry.intersectionRatio > 0.75;
        });
      },
      {
        root: this.root,
        threshold: 0.75,
      },
    );

    for (let i = 0; i < this.poolSize; i++) {
      const el = document.createElement(this.itemTagName);
      this.domPool.push(el);
      this.root.appendChild(el);
      this.playObserver.observe(el);
    }

    this.root.addEventListener("scroll", () => this.refresh(), {
      passive: true,
    });
  }

  update(newData) {
    this.data = newData;
    window.requestAnimationFrame(() => {
      this.root.style.setProperty("--total-items", this.data.length);
      this.refresh(true);
    });
  }

  refresh(force = false) {
    if (!this.cachedHeight || !this.data.length) return;

    const visibleIndex = Math.floor(this.root.scrollTop / this.cachedHeight);
    if (!force && visibleIndex === this.lastVisibleIndex) return;
    this.lastVisibleIndex = visibleIndex;

    const start = Math.max(0, visibleIndex - Math.floor(this.poolSize / 2));

    const neededById = new Map();
    for (let i = 0; i < this.poolSize; i++) {
      const dataIndex = start + i;
      if (dataIndex >= 0 && dataIndex < this.data.length) {
        neededById.set(this.data[dataIndex].id, { dataIndex, item: this.data[dataIndex] });
      }
    }

    const free = [];
    for (const el of this.domPool) {
      const slot = neededById.get(el.dataset.id);
      if (slot) {
        neededById.delete(el.dataset.id);
        el.style.display = "";
        el.style.setProperty("--index", slot.dataIndex);
      } else {
        free.push(el);
      }
    }

    for (const slot of neededById.values()) {
      const el = free.shift();
      if (!el) break;
      el.style.display = "";
      el.style.setProperty("--index", slot.dataIndex);
      el.data = slot.item;
    }

    for (const el of free) {
      el.style.display = "none";
    }

    if (visibleIndex >= this.data.length - 3) this.onEndReached?.();
  }
}
