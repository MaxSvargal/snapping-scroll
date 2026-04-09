/** @module index Bootstraps the app: wires VideoStore → VirtualScroller → ReelItem. */
import "./style.css";

import { videos, loadMore, dispatch } from "./stores/videoStore.js";
import { effect } from "./lib/signals.js";
import { VirtualScroller } from "./core/VirtualScroller.js";
import { ReelItem } from "./components/ReelItem.js";

customElements.define("reel-item", ReelItem);

const scroller = new VirtualScroller({
  root: document.getElementById("videos"),
  itemTagName: "reel-item",
  onEndReached: () => loadMore(),
  onElementCreated: (el) => {
    el.onAction = (action) => dispatch(action);
  },
});

effect(() => scroller.update(videos.value));

loadMore();
