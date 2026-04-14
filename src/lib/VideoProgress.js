/**
 * Tracks video playback progress and reports updates.
 * Automatically chooses between requestVideoFrameCallback (preferred) and timeupdate (fallback).
 */
export class VideoProgress {
  #video;
  #onProgress;
  #threshold;
  #rVFCId = null;
  #timeUpdateListener = null;

  /**
   * @param {HTMLVideoElement} video - the video element to track
   * @param {(percent: number) => void} onProgress - called with progress percentage (0-100)
   * @param {number} [threshold=0.5] - minimum % change to trigger callback
   */
  constructor(video, onProgress, threshold = 0.5) {
    this.#video = video;
    this.#onProgress = onProgress;
    this.#threshold = threshold;
  }

  /**
   * Start tracking video progress
   */
  start() {
    this.stop();

    if (
      this.#video &&
      typeof this.#video.requestVideoFrameCallback === "function"
    ) {
      this.#startWithFrameCallback();
    } else {
      this.#startWithTimeUpdate();
    }
  }

  /**
   * Stop tracking video progress
   */
  stop() {
    if (this.#rVFCId) {
      this.#video?.cancelVideoFrameCallback(this.#rVFCId);
      this.#rVFCId = null;
    }

    if (this.#timeUpdateListener) {
      this.#video?.removeEventListener("timeupdate", this.#timeUpdateListener);
      this.#timeUpdateListener = null;
    }
  }

  #startWithFrameCallback() {
    let lastProgress = 0;
    const frame = (_now, meta) => {
      if (!this.#video.duration) {
        this.#rVFCId = this.#video.requestVideoFrameCallback(frame);
        return;
      }

      const progress = (meta.mediaTime / this.#video.duration) * 100;
      if (Math.abs(progress - lastProgress) > this.#threshold) {
        this.#onProgress(progress);
        lastProgress = progress;
      }
      this.#rVFCId = this.#video.requestVideoFrameCallback(frame);
    };
    this.#rVFCId = this.#video.requestVideoFrameCallback(frame);
  }

  #startWithTimeUpdate() {
    this.#timeUpdateListener = () => {
      if (!this.#video.duration) return;
      const progress = (this.#video.currentTime / this.#video.duration) * 100;
      this.#onProgress(progress);
    };
    this.#video?.addEventListener("timeupdate", this.#timeUpdateListener);
  }

  /**
   * Clean up resources (call on component disconnect)
   */
  cleanup() {
    this.stop();
  }
}
