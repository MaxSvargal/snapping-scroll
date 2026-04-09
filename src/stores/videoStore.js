import { fetchVideos } from "../services/api.js";

/**
 * @typedef {Object} StoreAction
 * @property {'TOGGLE_LIKE'|'TOGGLE_FOLLOW'} type
 * @property {string} id - VideoModel id to target
 */

/**
 * @event VideoStore#statechange
 * @type {CustomEvent<import('../services/api.js').VideoModel[]>}
 */

/**
 * Reactive store for the video feed. Extends EventTarget for zero-dependency eventing.
 * @extends {EventTarget}
 * @fires VideoStore#statechange
 */
export class VideoStore extends EventTarget {
  constructor() {
    super();
    this.state = { videos: [] };
  }

  /** @private @fires VideoStore#statechange */
  #notify() {
    this.dispatchEvent(
      new CustomEvent("statechange", {
        detail: this.state.videos,
      }),
    );
  }

  /** @returns {Promise<void>} */
  async loadMore() {
    const newVideos = await fetchVideos();
    this.state.videos.push(...newVideos);
    this.#notify();
  }

  /**
   * @param {StoreAction} action
   * @returns {void}
   */
  dispatch(action) {
    const i = this.state.videos.findIndex((v) => v.id === action.id);
    if (i === -1) return;

    const video = this.state.videos[i];

    switch (action.type) {
      case "TOGGLE_LIKE":
        video.isLiked = !video.isLiked;
        video.likes += video.isLiked ? 1 : -1;
        break;
      case "TOGGLE_FOLLOW":
        video.isFollowing = !video.isFollowing;
        break;
    }

    this.#notify();
  }
}

/** @type {VideoStore} */
export const store = new VideoStore();
