import "./style.css";
import "./components/ReelItem.js";
import { VirtualScroller } from "./core/VirtualScroller.js";
import { store } from "./stores/videoStore.js";

const scroller = new VirtualScroller({
  root: document.getElementById("videos"),
  runway: document.getElementById("runway"),
  itemTagName: "reel-item",
  poolSize: 5,
  renderItem: (element, data) => {
    element.data = data;
    element.onAction = (action) => store.dispatch(action);
  },
  onEndReached: () => store.loadMore(),
});

store.addEventListener("statechange", (event) =>
  scroller.updateData(event.detail),
);

store.loadMore();
