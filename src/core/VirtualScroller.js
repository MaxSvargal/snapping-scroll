export class VirtualScroller {
  constructor({
    root,
    itemTagName,
    onEndReached,
    onElementCreated,
    poolSize = 5,
  }) {
    this.root = root;
    this.itemTagName = itemTagName;
    this.onEndReached = onEndReached;
    this.onElementCreated = onElementCreated;

    this.data = [];
    this.pool = [];
    this.itemHeight = 0;
    this.lastRefreshIndex = -1;
    this.loading = false;

    this.runway = document.createElement("div");
    this.runway.className = "runway";
    this.root.appendChild(this.runway);

    for (let i = 0; i < poolSize; i++) {
      const el = document.createElement(itemTagName);
      this.onElementCreated?.(el);
      this.root.appendChild(el);
      this.pool.push(el);
    }

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

    this.pool.forEach((el) => this.playObserver.observe(el));

    window.addEventListener("resize", () => {
      const newHeight = this.root.clientHeight;
      if (newHeight !== this.itemHeight) {
        this.itemHeight = newHeight;
        this.#refresh();
      }
    });

    const onScrollEnd = () => this.#refresh();

    if ("onscrollend" in this.root) {
      this.root.addEventListener("scrollend", onScrollEnd);
    } else {
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
    const prevLen = this.data.length;
    this.data = newData;

    window.requestAnimationFrame(() => {
      this.root.style.setProperty("--total-items", this.data.length);
      this.runway.style.height = `calc(var(--total-items) * 100%)`;

      if (prevLen !== newData.length) {
        this.#refresh();
      } else {
        this.pool.forEach((el) => {
          if (el._id) {
            const dataIndex = this.data.findIndex((d) => d.id === el._id);
            if (dataIndex !== -1) {
              el.data = this.data[dataIndex];
            }
          }
        });
      }
    });
  }

  #refresh() {
    if (!this.itemHeight || !this.data.length) return;

    const index = (this.root.scrollTop / this.itemHeight) | 0;
    if (index === this.lastRefreshIndex) return;
    this.lastRefreshIndex = index;

    const half = (this.pool.length / 2) | 0;
    const start = Math.max(0, index - half);

    this.pool.forEach((el, i) => {
      const dataIndex = start + i;
      const data = this.data[dataIndex];

      if (!data) {
        el.style.visibility = "hidden";
        return;
      }

      el.style.visibility = "";

      if (el._id !== data.id) {
        el._id = data.id;
        el.data = data;
        el.style.setProperty("--index", dataIndex);
      }
    });

    this.pool.forEach((el, i) => {
      const dataIndex = start + i;
      const isNearActive = Math.abs(dataIndex - index) <= 1;
      el.style.willChange = isNearActive ? "transform" : "auto";
    });

    if (!this.loading && index >= this.data.length - 3) {
      this.loading = true;
      Promise.resolve(this.onEndReached?.()).finally(() => {
        this.loading = false;
      });
    }
  }
}
