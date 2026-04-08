export class VirtualScroller {
  constructor({
    root,
    runway,
    itemTagName,
    poolSize = 5,
    renderItem,
    onEndReached,
  }) {
    this.root = root;
    this.runway = runway;
    this.itemTagName = itemTagName;
    this.poolSize = poolSize;
    this.renderItem = renderItem;
    this.onEndReached = onEndReached;

    this.domPool = [];
    this.data = [];
    this.lastBaseIndex = -1;
    this.isFetching = false;

    this.itemHeight = 0;
    this.minScroll = 0;
    this.maxScroll = 0;

    this.#initResizeObserver();
    this.#initPool();
    this.#bindScroll();
  }

  updateData(newData) {
    this.data = newData;
    this.isFetching = false;
    this.#render(true);
  }

  #initResizeObserver() {
    let animationFrameId = null;

    const observer = new ResizeObserver((entries) => {
      const newHeight = entries[0].contentRect.height;
      if (newHeight === 0 || newHeight === this.itemHeight) return;

      this.itemHeight = newHeight;

      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      animationFrameId = window.requestAnimationFrame(() => this.#render(true));
    });

    observer.observe(this.root);
  }

  #initPool() {
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < this.poolSize; i++) {
      const el = document.createElement(this.itemTagName);
      this.domPool.push({ element: el, currentIndex: -1 });
      fragment.appendChild(el);
    }
    this.root.appendChild(fragment);
  }

  #bindScroll() {
    let ticking = false;

    this.root.addEventListener(
      "scroll",
      () => {
        const scrollTop = this.root.scrollTop;
        if (scrollTop >= this.minScroll && scrollTop < this.maxScroll) return;

        if (!ticking) {
          window.requestAnimationFrame(() => {
            this.#render(false, scrollTop);
            ticking = false;
          });
          ticking = true;
        }
      },
      { passive: true },
    );
  }

  #render(force = false, scrollTop = this.root.scrollTop) {
    if (this.data.length === 0 || !this.itemHeight) return;

    const currentBaseIndex = Math.floor(scrollTop / this.itemHeight);

    if (!force && currentBaseIndex === this.lastBaseIndex) return;

    this.lastBaseIndex = currentBaseIndex;
    this.minScroll = currentBaseIndex * this.itemHeight;
    this.maxScroll = (currentBaseIndex + 1) * this.itemHeight;

    const startIndex = Math.max(0, currentBaseIndex - 1);
    const endIndex = Math.min(this.data.length - 1, currentBaseIndex + 2);

    this.runway.style.height = `${this.data.length * this.itemHeight}px`;

    for (let i = startIndex; i <= endIndex; i++) {
      const poolIndex = i % this.poolSize;
      const node = this.domPool[poolIndex];

      if (node.currentIndex !== i || force) {
        node.currentIndex = i;
        node.element.style.transform = `translateY(${i * this.itemHeight}px)`;
        this.renderItem(node.element, this.data[i]);
      }
    }

    if (endIndex >= this.data.length - 2 && !this.isFetching) {
      this.isFetching = true;
      this.onEndReached();
    }
  }
}
