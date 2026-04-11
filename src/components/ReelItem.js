import { Component, cssFrom, htmlFrom } from "../lib/Component.js";
import { signal } from "../lib/signals.js";
import reelItemCss from "./ReelItem.css?raw";
import reelItemHtml from "./ReelItem.html?raw";

const DOUBLE_TAP_THRESHOLD_MS = 300;
const PROGRESS_THRESHOLD = 0.5;

/**
 * Custom element for a single video card in the reel feed.
 * @element reel-item
 * @extends {Component}
 * @property {((action: import('../stores/videoStore.js').StoreAction) => void) | undefined} onAction
 *   Assigned by the consumer to receive user interaction actions (like, follow).
 */
export class ReelItem extends Component {
  static styles = cssFrom(reelItemCss);
  static template = htmlFrom(reelItemHtml);

  #rVFCId = null;
  #isActive = false;
  #lastTap = 0;
  #pendingData = null;
  #tapTimeout = null;
  #timeUpdateListener = null;
  #_currentLikes = 0;

  constructor() {
    super();
    this._onVisibilityChange = () => this.#handleVisibilityChange();
  }

  onInit() {
    this.state = {
      username: signal(""),
      avatar: signal(""),
      description: signal(""),
      category: signal(""),
      likes: signal("0"),
      isLiked: signal(false),
      isFollowing: signal(false),
      followBtnText: signal("+"),
      progress: signal("0%"),
      isDescExpanded: signal(false),
      isHeartAnimating: signal(false),
      heartLeft: signal("0px"),
      heartTop: signal("0px"),
      isLikeAnimating: signal(false),
    };

    this.video = this.shadowRoot.querySelector(".reels-video");

    this.shadowRoot
      .querySelector(".floating-heart")
      .addEventListener("animationend", () => {
        this.state.isHeartAnimating.value = false;
      });

    document.addEventListener("visibilitychange", this._onVisibilityChange);
    this.#bindEvents();

    if (this.#pendingData) {
      const pending = this.#pendingData;
      this.#pendingData = null;
      this.data = pending;
    }
  }

  disconnectedCallback() {
    document.removeEventListener("visibilitychange", this._onVisibilityChange);
    clearTimeout(this.#tapTimeout);
    this.#pause();
  }

  /**
   * Assigns a video model. A new `id` triggers a full reload (src + all UI fields);
   * the same id patches only changed reactive fields (likes, isLiked, isFollowing).
   * Passing `null` pauses playback.
   * @param {import('../services/api.js').VideoModel | null} model
   */
  set data(model) {
    if (!this.video) {
      if (model) this.#pendingData = model;
      return;
    }

    if (!model) {
      this.#pause();
      return;
    }

    const isNewItem = !this._id || this._id !== model.id;
    if (isNewItem) {
      this.#setItemData(model);
    }

    this.#updateState(model);
  }

  #updateState(model) {
    this.state.likes.value = this.#formatCount(model.likes);
    this.state.isLiked.value = model.isLiked;
    this.state.isFollowing.value = model.isFollowing;
    this.state.followBtnText.value = this.state.isFollowing.value ? "✓" : "+";
  }

  #setItemData(model) {
    this._id = model.id;
    this.#_currentLikes = model.likes;

    this.state.avatar.value = model.avatar;
    this.state.username.value = model.username;
    this.state.description.value = model.description;
    this.state.category.value = model.category;

    const newSrc = window.location.origin + `/${model.src}`;
    if (this.video.src !== newSrc) {
      this.video.pause();
      this.#stopProgressLoop();
      this.video.removeAttribute("src");
      this.video.load();
      this.video.src = newSrc;
    }
  }

  /**
   * `true` starts playback and the progress loop (respects `readyState`);
   * `false` pauses and stops the progress loop.
   * @param {boolean} isActive
   */
  set active(isActive) {
    if (this.#isActive === isActive) return;
    this.#isActive = isActive;
    isActive ? this.#play() : this.#pause();
  }

  #play() {
    if (!this.video || this.video.readyState < 2) return;
    const playPromise = this.video.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        this.video.muted = true;
        this.video.play().catch(() => {});
      });
    }
    this.#startProgressLoop();
  }

  #pause() {
    this.video?.pause();
    this.#stopProgressLoop();
  }

  #handleVisibilityChange() {
    if (document.hidden) this.#stopProgressLoop();
    else if (this.#isActive) this.#startProgressLoop();
  }

  #startProgressLoop() {
    this.#stopProgressLoop();

    if (
      this.video &&
      typeof this.video.requestVideoFrameCallback === "function"
    ) {
      let lastProgress = 0;
      const frame = (_now, meta) => {
        if (!this.video.duration) {
          this.#rVFCId = this.video.requestVideoFrameCallback(frame);
          return;
        }

        const progress = (meta.mediaTime / this.video.duration) * 100;
        if (Math.abs(progress - lastProgress) > PROGRESS_THRESHOLD) {
          this.state.progress.value = `${progress}%`;
          lastProgress = progress;
        }
        this.#rVFCId = this.video.requestVideoFrameCallback(frame);
      };
      this.#rVFCId = this.video.requestVideoFrameCallback(frame);
    } else {
      this.#timeUpdateListener = () => {
        if (!this.video.duration) return;
        const progress = (this.video.currentTime / this.video.duration) * 100;
        this.state.progress.value = `${progress}%`;
      };
      this.video?.addEventListener("timeupdate", this.#timeUpdateListener);
    }
  }

  #stopProgressLoop() {
    if (this.#rVFCId) {
      this.video?.cancelVideoFrameCallback(this.#rVFCId);
      this.#rVFCId = null;
    }
    if (this.#timeUpdateListener) {
      this.video?.removeEventListener("timeupdate", this.#timeUpdateListener);
      this.#timeUpdateListener = null;
    }
  }

  #bindEvents() {
    this.#setupVideoLifecycleEvents();
    this.#setupGestureHandling();
  }

  #setupVideoLifecycleEvents() {
    this.video?.addEventListener("canplay", () => {
      if (this.#isActive) this.#play();
    });
  }

  #setupGestureHandling() {
    this.video?.addEventListener("pointerdown", (e) => {
      const tapLength = performance.now() - this.#lastTap;
      if (tapLength < DOUBLE_TAP_THRESHOLD_MS && tapLength > 0) {
        e.preventDefault();
      }
    });

    this.video?.addEventListener("pointerup", (e) => {
      const tapLength = performance.now() - this.#lastTap;
      if (tapLength < DOUBLE_TAP_THRESHOLD_MS && tapLength > 0) {
        clearTimeout(this.#tapTimeout);
        this.#handleDoubleTap(e);
      } else {
        clearTimeout(this.#tapTimeout);
        this.#tapTimeout = setTimeout(
          () => this.#handleSingleTap(),
          DOUBLE_TAP_THRESHOLD_MS,
        );
      }
      this.#lastTap = performance.now();
    });
  }

  #updateLikeState() {
    const isNowLiked = !this.state.isLiked.value;
    this.state.isLiked.value = isNowLiked;
    this.#_currentLikes = (this.#_currentLikes || 0) + (isNowLiked ? 1 : -1);
    this.state.likes.value = this.#formatCount(this.#_currentLikes);
    if (isNowLiked) this.#triggerLikeAnimation();
  }

  toggleLike() {
    this.#updateLikeState();
    this.onAction?.({ type: "TOGGLE_LIKE", id: this._id });
  }

  toggleFollow(e) {
    e.stopPropagation();
    this.state.isFollowing.value = !this.state.isFollowing.value;
    this.state.followBtnText.value = this.state.isFollowing.value ? "✓" : "+";
    this.onAction?.({ type: "TOGGLE_FOLLOW", id: this._id });
  }

  seekVideo(e, target) {
    const rect = target.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    if (this.video?.duration)
      this.video.currentTime = pos * this.video.duration;
  }

  toggleDescription() {
    this.state.isDescExpanded.value = !this.state.isDescExpanded.value;
  }

  #handleDoubleTap(e) {
    this.#updateLikeState();
    this.#showDoubleTapHeart(e.clientX, e.clientY);
    this.onAction?.({ type: "TOGGLE_LIKE", id: this._id });
    e.preventDefault();
  }

  #handleSingleTap() {
    this.video.paused ? this.#play() : this.#pause();
  }

  #triggerLikeAnimation() {
    this.state.isLikeAnimating.value = false;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        this.state.isLikeAnimating.value = true;
      }),
    );
  }

  /**
   * @private
   * @param {number} x - viewport x coordinate of the tap
   * @param {number} y - viewport y coordinate of the tap
   */
  #showDoubleTapHeart(x, y) {
    if (this.state.isHeartAnimating.value) return;
    const rect = this.getBoundingClientRect();
    this.state.heartLeft.value = `${x - rect.left - 40}px`;
    this.state.heartTop.value = `${y - rect.top - 40}px`;
    this.state.isHeartAnimating.value = true;
  }

  /**
   * @private
   * @param {number} num
   * @returns {string}
   */
  #formatCount(num) {
    return num >= 1000 ? (num / 1000).toFixed(1) + "K" : num.toString();
  }
}
