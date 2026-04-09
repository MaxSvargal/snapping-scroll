/** @module index Bootstraps the app: wires VideoStore → VirtualScroller → ReelItem. */
import "./style.css";

import { store } from "./stores/videoStore.js";
import { VirtualScroller } from "./core/VirtualScroller.js";
import { ReelItem } from "./components/ReelItem.js";

customElements.define("reel-item", ReelItem);

const scroller = new VirtualScroller({
  root: document.getElementById("videos"),
  itemTagName: "reel-item",
  onEndReached: () => store.loadMore(),
  onElementCreated: (el) => {
    el.onAction = (action) => store.dispatch(action);
  },
});

store.addEventListener("statechange", (e) => {
  scroller.update(e.detail);
});

store.loadMore();
