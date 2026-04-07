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

const playPauseObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      const video = entry.target;
      if (entry.isIntersecting && video.getAttribute("src"))
        video.play().catch((err) => console.error("Autoplay failed:", err));
      else video.pause();
    });
  },
  { threshold: 0.6 },
);

function initializePool(root, itemHeight) {
  const fragment = document.createDocumentFragment();

  for (let i = 0; i < POOL_SIZE; i++) {
    const section = document.createElement("section");
    section.style.height = `${itemHeight}px`;

    const video = document.createElement("video");
    video.loop = true;
    video.muted = true;
    video.playsInline = true;

    section.appendChild(video);
    fragment.appendChild(section);

    playPauseObserver.observe(video);

    domPool.push({ section, video, currentIndex: -1 });
  }

  root.appendChild(fragment);
}

export function renderVirtualList() {
  const root = document.getElementById("videos");
  const runway = document.getElementById("runway");
  const itemHeight = root.clientHeight || window.innerHeight;
  const scrollTop = root.scrollTop;

  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - 1);
  const endIndex = Math.min(
    allVideos.length - 1,
    Math.floor((scrollTop + itemHeight) / itemHeight) + 2,
  );

  runway.style.height = `${allVideos.length * itemHeight}px`;

  for (let i = startIndex; i <= endIndex; i++) {
    const poolIndex = i % POOL_SIZE;
    const node = domPool[poolIndex];

    if (node.currentIndex !== i) {
      node.currentIndex = i;
      node.section.style.transform = `translateY(${i * itemHeight}px)`;
      node.video.src = `/${allVideos[i]}`;
    }
  }

  if (endIndex >= allVideos.length - 2) {
    allVideos.push(...videos);
    renderVirtualList();
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
          console.log("rerender!");
          renderVirtualList();
          ticking = false;
        });
        ticking = true;
      }
    },
    { passive: true },
  );

  renderVirtualList();
}
