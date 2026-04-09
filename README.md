# Snapping Scroll Demo

- The virtual infinite list scroller uses a fixed pool of DOM elements and only updates a single element with only GPU accelerated attributes after transforms complete, reducing unnecessary DOM operations and minimum observers static pool O(1).
- Uses unidirectional data flow instead of direct DOM manipulation. The DataStore extends EventTarget to reuse the native event system.
- ReelItem is a custom component that is easy to test, for example: `const el = new ReelItem(); el.onAction = jest.fn(); el.data = video`. It uses an HTML `<template>` to avoid embedding markup in JavaScript.
- VideoStore can be tested independently of the DOM.
- Layout read values are cached to avoid recalculating layout on every frame by accessing `clientHeight` and `scrollTop` only once.
- Avoids JavaScript-based height calculations by using CSS variables instead. This makes it easier to handle screen rotations and browser resizing using native CSS rather than JS.
- Offsets are calculated using item indices rather than raw pixel values.

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
