export class VirtualScroller {
  constructor({ root, itemTagName, poolSize = 5, onEndReached, onElementCreated }) {
    this.root = root;
    this.itemTagName = itemTagName;
    this.poolSize = poolSize;
    this.onEndReached = onEndReached;
    this.onElementCreated = onElementCreated;

    this.data = [];
    this.domPool = [];
    this.lastVisibleIndex = -1;
    this.cachedHeight = 0;
    this.loading = false;
    this.pending = false;

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

    // Pre-create fixed pool of elements
    for (let i = 0; i < this.poolSize; i++) {
      const el = document.createElement(this.itemTagName);
      el.style.visibility = 'hidden';
      this.onElementCreated?.(el);
      this.root.appendChild(el);
      this.domPool.push(el);
      this.playObserver.observe(el);
    }

    // scrollend driver with fallback
    const onScrollEnd = () => {
      if (this.pending) return;
      this.pending = true;
      requestAnimationFrame(() => {
        this.pending = false;
        this.refresh();
      });
    };

    if ("onscrollend" in this.root) {
      this.root.addEventListener("scrollend", onScrollEnd);
    } else {
      // Fallback for browsers without scrollend
      let scrollTimer;
      this.root.addEventListener(
        "scroll",
        () => {
          clearTimeout(scrollTimer);
          scrollTimer = setTimeout(onScrollEnd, 150);
        },
        { passive: true },
      );
    }
  }

  update(newData) {
    this.data = newData;
    window.requestAnimationFrame(() => {
      this.root.style.setProperty("--total-items", this.data.length);
      this.refresh(true);
    });
  }

  refresh(force = false) {
    if (!this.cachedHeight) return;

    const visibleIndex = Math.floor(this.root.scrollTop / this.cachedHeight);
    if (!force && visibleIndex === this.lastVisibleIndex) return;
    this.lastVisibleIndex = visibleIndex;

    const half = Math.floor(this.poolSize / 2);
    const start = Math.max(0, visibleIndex - half);

    const neededById = new Map();
    for (let i = 0; i < this.poolSize; i++) {
      const dataIndex = start + i;
      if (dataIndex >= 0 && dataIndex < this.data.length) {
        const item = this.data[dataIndex];
        neededById.set(item.id, { dataIndex, item });
      }
    }

    const free = [];
    for (const el of this.domPool) {
      const itemId = el.dataset.id;
      const slot = neededById.get(itemId);

      if (slot) {
        neededById.delete(itemId);
        el.style.visibility = '';
        el.style.setProperty("--index", slot.dataIndex);
      } else {
        free.push(el);
      }
    }

    for (const slot of neededById.values()) {
      const el = free.shift();
      if (!el) break;
      el.style.visibility = '';
      el.style.setProperty("--index", slot.dataIndex);
      el.dataset.id = slot.item.id;
      el.data = slot.item;
    }

    for (const el of free) {
      el.style.visibility = 'hidden';
    }

    if (!this.loading && this.data.length > 0 && visibleIndex >= this.data.length / 2) {
      this.loading = true;
      Promise.resolve(this.onEndReached?.()).finally(() => {
        this.loading = false;
      });
    }
  }
}
