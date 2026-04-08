import "./style.css";
import "./reel-item.js";

const videos = [
  "-1381854028232193089.MP4",
  "-2466797579047759691.MP4",
  "-2635594312504430960.MP4",
  "-425148686832983381.MP4",
  "-6974447037748169156.MP4",
  "3698940505591559678.MP4",
  "3746059563046546718.MP4",
  "6702137189532704568.MP4",
  "6737137111559968548.MP4",
  "7578542087815133230.MP4",
  "7870372071727092435.MP4",
];

const allVideos = [...videos];
const POOL_SIZE = 5;
const domPool = [];
let lastBaseIndex = -1;

const playPauseObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      const reel = entry.target;
      if (entry.isIntersecting) reel.playVideo();
      else reel.pauseVideo();
    });
  },
  { threshold: 0.45 },
);

function initializePool(root, itemHeight) {
  const fragment = document.createDocumentFragment();

  for (let i = 0; i < POOL_SIZE; i++) {
    const reel = document.createElement("reel-item");
    reel.style.height = `${itemHeight}px`;
    playPauseObserver.observe(reel);
    domPool.push({ element: reel, currentIndex: -1 });
    fragment.appendChild(reel);
  }

  root.appendChild(fragment);
}

export function renderVirtualList(force = false) {
  const root = document.getElementById("videos");
  const runway = document.getElementById("runway");
  const itemHeight = root.clientHeight || window.innerHeight;
  const scrollTop = root.scrollTop;
  const currentBaseIndex = Math.floor(scrollTop / itemHeight);

  if (!force && currentBaseIndex === lastBaseIndex) return;
  lastBaseIndex = currentBaseIndex;

  const startIndex = Math.max(0, currentBaseIndex - 1);
  const endIndex = Math.min(allVideos.length - 1, currentBaseIndex + 2);

  runway.style.height = `${allVideos.length * itemHeight}px`;

  for (let i = startIndex; i <= endIndex; i++) {
    const poolIndex = i % POOL_SIZE;
    const node = domPool[poolIndex];

    if (node.currentIndex !== i) {
      node.currentIndex = i;
      node.element.style.transform = `translateY(${i * itemHeight}px)`;
      node.element.updateData(i, allVideos[i]);
    }
  }

  if (endIndex >= allVideos.length - 2) {
    allVideos.push(...videos);
    renderVirtualList(true);
  }
}

export function initVideos() {
  const root = document.getElementById("videos");
  const itemHeight = root.clientHeight || window.innerHeight;

  initializePool(root, itemHeight);

  let ticking = false;
  root.addEventListener(
    "scroll",
    () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          renderVirtualList();
          ticking = false;
        });
        ticking = true;
      }
    },
    { passive: true },
  );

  renderVirtualList(true);
}

initVideos();
