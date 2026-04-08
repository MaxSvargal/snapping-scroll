import { fetchVideos } from "../services/api.js";

export class VideoStore extends EventTarget {
  constructor() {
    super();
    this.state = { videos: [] };
  }

  #notify() {
    this.dispatchEvent(
      new CustomEvent("statechange", {
        detail: this.state.videos,
      }),
    );
  }

  async loadMore() {
    const newVideos = await fetchVideos();
    this.state.videos = [...this.state.videos, ...newVideos];
    this.#notify();
  }

  dispatch(action) {
    const video = this.state.videos.find((v) => v.id === action.id);
    if (!video) return;

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

export const store = new VideoStore();
