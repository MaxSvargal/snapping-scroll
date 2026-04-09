# Snapping Scroll Demo

A vertical paging flat video list with a virtual snap-scolling.

## Branches

This repo evolves through three versions:

### [`original`](https://github.com/MaxSvargal/rabata-test-task/tree/original) — Initial implementation

Hand-written JS virtual scrolling, 196 LOC. Shared observer pool and RAF debouncing.

### [`minimal-perfomanced`](https://github.com/MaxSvargal/rabata-test-task/tree/minimal-perfomanced) — Performance optimizations

Refactored into 5 modular files (614 LOC) adding key optimizations: hysteresis thresholds (0.6/0.8 prevents jitter), progress bar throttling (>0.5% delta reduces ~80% reflows), CSS custom properties for positioning, better event handling, double tap to like, preload and sync video with browser render.

### [`main`](https://github.com/MaxSvargal/rabata-test-task/tree/main) — Production-ready

Fully abstracted (672 LOC) with Component base class, signals reactive system, template decomposition (.js/.html/.css separate).
Reusable patterns, clear lifecycle management, excellent testability, comprehensive documentation.

## Architecture

### Virtual Scroller ([src/core/VirtualScroller.js](src/core/VirtualScroller.js))

Manages DOM elements as the user scrolls, keeping only a small window of items alive. **Critically, it doesn't know or care about videos**—the tag name is passed in, callbacks are inverted.

```js
const scroller = new VirtualScroller({
  root: document.getElementById("videos"),
  itemTagName: "reel-item", // could be "photo-card", "audio-track", anything
  buffer: 2, // items to render beyond the visible one
  onEndReached: () => store.loadMore(),
  onElementCreated: (el) => {
    el.onAction = (action) => store.dispatch(action); // element is a blackbox
  },
});
```

**Key decisions:**

- **O(1) observer pool** — single shared `IntersectionObserver` for all items. One per item is expensive; sharing keeps memory constant.
- **Index-based positioning** — `--index` CSS custom property avoids JS layout reads on scroll.
- **Debounced scroll** — `pending` flag batches scroll events into one `requestAnimationFrame` pass.
- **Lazy loading at 50%** — fires early enough to fetch before user reaches empty items.
- **Generalized API** — accepts any tag name, mounts/unmounts its children, invokes callbacks. Scales from 100→100k items.

### Reel Item ([src/components/ReelItem.js](src/components/ReelItem.js))

A custom element (`<reel-item>`) that manages a single video card with reactive state:

```js
export class ReelItem extends Component {
  static styles = cssFrom(reelItemCss);
  static template = htmlFrom(reelItemHtml);

  set data(model) {
    if (!model) {
      this.#pause();
      return;
    }
    const isNewItem = !this._id || this._id !== model.id;
    if (isNewItem) this.#setItemData(model);
    this.#updateState(model);
  }

  set active(isActive) {
    this.#isActive === isActive ? this.#play() : this.#pause();
  }
}
```

**Why separate `data` and `active` properties?**

- **Decoupled concerns** — data updates (likes, username) don't re-initialize the video element
- **Testable** — set `.data` and check the DOM without mounting in a scroller
- **Efficient** — toggling active reuses the same video src; only state signals update

**Progress tracking design:**

- Uses `requestVideoFrameCallback` (native, per-frame) where available
- Falls back to `timeupdate` (sparse) for older browsers
- Skips updates when delta < 0.5% to minimize style thrashing
- **Why?** RVF gives pixel-perfect progress bars; timeout fallback is reliable

**Gesture handling:**

- Single-tap (within 300ms, no other tap) → play/pause toggle
- Double-tap (two taps < 300ms apart) → like + floating heart animation
- **Why this window?** 300ms matches TikTok/Instagram UX; faster feels jittery, slower feels delayed

### Micro-Framework

#### Signal-Based Reactivity ([src/lib/signals.js](src/lib/signals.js))

A minimal **zero-dependency** reactive system using native JavaScript:

```js
export function signal(initialValue) {
  return {
    get value() {
      if (activeEffect) subscribers.add(activeEffect);
      return value;
    },
    set value(newValue) {
      if (value !== newValue) {
        value = newValue;
        subscribers.forEach((sub) => sub());
      }
    },
  };
}
```

**Why signals?** No virtual DOM, no dependency arrays. Read a signal in an effect → auto-subscribes. Updates batch via microtasks. ~50 lines. Reusable: works for stores, animations, form state—not just videos.

#### Component Base Class ([src/lib/Component.js](src/lib/Component.js))

All custom elements extend a shared base that handles lifecycle, shadow DOM setup, and data binding:

```js
export class Component extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    // Adopt CSS sheets and clone template
  }

  _mapBindings() {
    // TreeWalker scans shadow DOM once for data-bind attributes
    // Creates surgical effects for each binding (text:key, class:key:classname, etc.)
  }
}
```

**Why this base class?** Declarative binding (`data-bind="text:name"`), action delegation (`data-action="like"`), and adopted stylesheets. No per-instance CSS duplication. Reusable: `ReelItem`, a photo card, an audio player all use the same lifecycle + binding.

### Video Store ([src/stores/videoStore.js](src/stores/videoStore.js))

Signal-based store: `videos` signal + `loadMore()` / `dispatch(action)` functions.

```js
import { videos, loadMore, dispatch } from "./stores/videoStore.js";

await loadMore(); // fetch & append
dispatch({ type: "TOGGLE_LIKE", id: "video-1" }); // mutate & update signal
```

Immutable updates (`videos.value = [...]`) make state changes explicit. No EventTarget boilerplate; signals auto-subscribe. **Independent of UI:** test without components, swap the UI, reuse the store.

### Entry Point ([src/index.js](src/index.js))

Orchestration: wire store + scroller + effects.

```js
effect(() => scroller.update(videos.value)); // signal → scroller
scroller.onElementCreated = (el) => {
  el.onAction = dispatch;
}; // item → store
loadMore(); // trigger
```

**Data:** `videos` → effect → scroller mounts items. **Actions:** item calls `onAction` → dispatch → store updates signal → effect re-runs.

Minimal coupling: `VirtualScroller` and `videoStore` never touch. Entry point is the only meeting place.

## Design: Generalized Tools vs. Application Code

Separates reusable patterns (signals, Component, VirtualScroller) from video-specific logic (store, ReelItem, entry point).

| Module                    | Purpose                           | Reusable?             |
| ------------------------- | --------------------------------- | --------------------- |
| `lib/signals.js`          | Reactive primitives               | Any project           |
| `lib/Component.js`        | Web Component lifecycle + binding | Any Web Component app |
| `core/VirtualScroller.js` | Virtual windowing                 | Any large list        |
| `stores/videoStore.js`    | Video state + actions             | Domain-specific       |
| `components/ReelItem.js`  | Video UI + gestures               | Domain-specific       |
| `index.js`                | Orchestration                     | Domain-specific       |

`VirtualScroller` doesn't know about videos—pass any tag name (`"photo-card"`, `"audio-track"`), mount/unmount it, invoke callbacks. When generalized tools ignore domain logic:

- **Testable**: Mock items in `VirtualScroller`. Test signals without DOM.
- **Reusable**: Build a photo feed using the same `signals`, `Component`, and `VirtualScroller`.
- **Maintainable**: Fix gesture logic in `ReelItem`; fix scrolling in `VirtualScroller`. No mixing.

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
