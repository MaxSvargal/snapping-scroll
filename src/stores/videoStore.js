import { signal } from "../lib/signals.js";
import { fetchVideos, createVideoModel } from "../services/api.js";

/**
 * @typedef {Object} StoreAction
 * @property {'TOGGLE_LIKE'|'TOGGLE_FOLLOW'} type
 * @property {string} id - VideoModel id to target
 */

/**
 * Reactive signal holding the array of videos.
 * @type {ReturnType<typeof signal>}
 */
export const videos = signal([]);

/**
 * Fetches and appends new videos to the reactive store.
 * @returns {Promise<void>}
 */
export async function loadMore() {
  const newVideos = await fetchVideos();
  videos.value = [...videos.value, ...newVideos];
}

/**
 * Dispatches an action (like, follow) and updates the reactive store.
 *
 * @param {StoreAction} action - { type: 'TOGGLE_LIKE'|'TOGGLE_FOLLOW', id: videoId }
 * @returns {void}
 * @example
 * dispatch({ type: 'TOGGLE_LIKE', id: 'video_1' });
 * // Finds video, captures new isLiked state, creates new object with correct likes count via factory
 */
export function dispatch(action) {
  const i = videos.value.findIndex((v) => v.id === action.id);
  if (i === -1) return;

  const updated = [...videos.value];
  const video = updated[i];

  switch (action.type) {
    case "TOGGLE_LIKE": {
      const nowLiked = !video.isLiked;
      updated[i] = createVideoModel({
        ...video,
        isLiked: nowLiked,
        likes: video.likes + (nowLiked ? 1 : -1),
      });
      break;
    }
    case "TOGGLE_FOLLOW":
      updated[i] = createVideoModel({
        ...video,
        isFollowing: !video.isFollowing,
      });
      break;
  }

  videos.value = updated;
}
