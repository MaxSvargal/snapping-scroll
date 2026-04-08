import "./style.css";

import { store } from "./stores/videoStore.js";
import { VirtualScroller } from "./core/VirtualScroller.js";
import "./components/ReelItem.js";

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
