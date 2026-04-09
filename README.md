# Snapping Scroll Demo

A vertical video reel with a virtual scroller, built with vanilla JS Web Components and no dependencies.

## Architecture

### Virtual Scroller ([src/core/VirtualScroller.js](src/core/VirtualScroller.js))

Mounts and unmounts DOM elements as the user scrolls, keeping only a small window of items alive at a time:

```js
const scroller = new VirtualScroller({
  root: document.getElementById("videos"),
  itemTagName: "reel-item",
  buffer: 2, // items to render beyond the visible one
  onEndReached: () => store.loadMore(),
  onElementCreated: (el) => {
    el.onAction = (action) => store.dispatch(action);
  },
});
```

Key design decisions:

- **O(1) observer pool** — a single shared `IntersectionObserver` (with thresholds `[0.6, 0.8]`) drives play/pause for all mounted elements, rather than one observer per item.
- **Index-based positioning** — each item receives a `--index` CSS custom property; pixel offsets are computed in CSS (`calc(var(--index) * 100vh)`), avoiding JS layout reads on scroll.
- **Debounced scroll** — a `pending` flag coalesces scroll events into one `requestAnimationFrame` pass per frame.
- **Lazy loading** — `onEndReached` fires when the visible index passes the halfway point of the loaded data.

### Reel Item ([src/components/ReelItem.js](src/components/ReelItem.js))

A custom element (`<reel-item>`) that manages a single video card:

```js
const el = new ReelItem();
el.onAction = jest.fn();
el.data = video; // fully testable without a DOM scroller
```

- Clones an HTML `<template id="reel-item">` in `connectedCallback`, keeping markup out of JS.
- Separates play/pause from data: setting `el.active = true/false` controls playback; setting `el.data = model` updates content.
- **Progress tracking** uses `requestVideoFrameCallback` where available, falling back to `timeupdate`. Updates are skipped when the delta is below `PROGRESS_THRESHOLD` (0.5%) to reduce style mutations.
- **Gesture handling** distinguishes single-tap (play/pause toggle) from double-tap (like) using a `DOUBLE_TAP_THRESHOLD_MS` (300 ms) window.
- Pending data set before `connectedCallback` is buffered in `#pendingData` and applied once the element is initialized.

### Video Store ([src/stores/videoStore.js](src/stores/videoStore.js))

Extends the native `EventTarget` for zero-dependency reactive state:

```js
store.addEventListener("statechange", (e) => {
  scroller.update(e.detail); // e.detail is the full videos array
});
```

- `loadMore()` fetches and appends new videos, then calls `#notify()`.
- `dispatch(action)` handles `TOGGLE_LIKE` and `TOGGLE_FOLLOW` by mutating the relevant item in place and emitting `statechange`.
- Completely decoupled from the DOM — unit-testable in isolation.

### Entry Point ([src/index.js](src/index.js))

Wires the three layers together in ~15 lines:

```js
store.addEventListener("statechange", (e) => scroller.update(e.detail));
store.loadMore(); // triggers initial fetch → statechange → scroller.update
```

Data flows in one direction: `VideoStore` → `VirtualScroller` → `ReelItem`. Actions flow back via the `onAction` callback set on each element at creation time.

## How to install

```sh
$ bun install | npm install | pnpm install
```

### How to build

```sh
$ bun run build | npm run build | pnpm build
```

### How to run

```sh
$ bun run dev | npm run dev | pnpm dev
```
