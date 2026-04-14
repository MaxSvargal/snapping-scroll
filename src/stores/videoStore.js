import { reactive } from "../lib/reactive.js";
import { fetchVideos } from "../services/api.js";

/**
 * @typedef {Object} StoreAction
 * @property {'TOGGLE_LIKE'|'TOGGLE_FOLLOW'} type
 * @property {string} id - VideoModel id to target
 */

/**
 * Reactive store holding videos.
 * Uses reactive() proxy - enables direct property mutation without recreating objects.
 * @type {{ videos: Array }}
 */
export const videoStore = reactive({ videos: [] });

/**
 * Fetches and appends new videos to the reactive store.
 * @returns {Promise<void>}
 */
export async function loadMore() {
  const newVideos = await fetchVideos();
  videoStore.videos = [...videoStore.videos, ...newVideos];
}

/**
 * Dispatches an action (like, follow) and updates the reactive store.
 *
 * @param {StoreAction} action - { type: 'TOGGLE_LIKE'|'TOGGLE_FOLLOW', id: videoId }
 * @returns {void}
 * @example
 * dispatch({ type: 'TOGGLE_LIKE', id: 'video_1' });
 * // Directly mutates the video object in place - no object recreation needed
 */
export function dispatch(action) {
  const video = videoStore.videos.find((v) => v.id === action.id);
  if (!video) return;

  switch (action.type) {
    case "TOGGLE_LIKE": {
      const nowLiked = !video.isLiked;
      video.isLiked = nowLiked;
      video.likes = video.likes + (nowLiked ? 1 : -1);
      break;
    }
    case "TOGGLE_FOLLOW":
      video.isFollowing = !video.isFollowing;
      break;
  }
}
