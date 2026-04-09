import { signal } from "../lib/signals.js";
import { fetchVideos } from "../services/api.js";

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
 * @param {StoreAction} action
 * @returns {void}
 */
export function dispatch(action) {
  const i = videos.value.findIndex((v) => v.id === action.id);
  if (i === -1) return;

  const updated = [...videos.value];
  const video = updated[i];

  switch (action.type) {
    case "TOGGLE_LIKE":
      video.isLiked = !video.isLiked;
      video.likes += video.isLiked ? 1 : -1;
      break;
    case "TOGGLE_FOLLOW":
      video.isFollowing = !video.isFollowing;
      break;
  }

  videos.value = updated;
}
