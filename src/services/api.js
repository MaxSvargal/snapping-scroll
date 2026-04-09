/**
 * @typedef {Object} VideoModel
 * @property {string} id
 * @property {string} src - filename relative to origin (no leading slash)
 * @property {string} username
 * @property {string} avatar - absolute avatar URL
 * @property {string} description
 * @property {string} category
 * @property {number} likes
 * @property {boolean} isLiked
 * @property {boolean} isFollowing
 */

const VIDEOS = [
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

let globalIdCounter = 0;

/**
 * Simulates a network fetch (~300 ms) and resolves with one batch of videos.
 * @returns {Promise<VideoModel[]>}
 */
export async function fetchVideos() {
  return new Promise((resolve) => {
    setTimeout(() => {
      const formattedVideos = VIDEOS.map((src) => {
        globalIdCounter++;
        return {
          id: `video_${globalIdCounter}`,
          src: src,
          username: `@creator_${globalIdCounter}`,
          avatar: `https://i.pravatar.cc/150?u=${globalIdCounter + 10}`,
          description:
            "Experience the beauty of this amazing moment. Tap to read more about what's happening...",
          category: "Entertainment",
          likes: Math.floor(Math.random() * 100000),
          isLiked: false,
          isFollowing: false,
        };
      });
      resolve(formattedVideos);
    }, 300);
  });
}
