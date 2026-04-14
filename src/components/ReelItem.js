import { Component, cssFrom, htmlFrom } from "../lib/Component.js";
import { signal } from "../lib/signals.js";
import { GestureDetector } from "../lib/GestureDetector.js";
import { VideoProgress } from "../lib/VideoProgress.js";
import reelItemCss from "./ReelItem.css?raw";
import reelItemHtml from "./ReelItem.html?raw";

const DOUBLE_TAP_THRESHOLD_MS = 300;

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

  #isActive = false;
  #pendingData = null;
  #_currentLikes = 0;
  #videoProgress = null;

  #gestureDetector = new GestureDetector(
    () => this.#handleSingleTap(),
    (e) => this.#handleDoubleTap(e),
    DOUBLE_TAP_THRESHOLD_MS,
  );

  state = {
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

  onInit() {
    this.listenTo(document, "visibilitychange", () =>
      this.#handleVisibilityChange(),
    );

    this.#videoProgress = new VideoProgress(this.refs.video, (percent) => {
      this.state.progress.value = `${percent}%`;
    });

    if (this.#pendingData) {
      const pending = this.#pendingData;
      this.#pendingData = null;
      this.data = pending;
    }
  }

  onDisconnect() {
    this.#gestureDetector?.cleanup();
    this.#videoProgress?.cleanup();
    this.#pause();
  }

  /**
   * Assigns a video model. A new `id` triggers a full reload (src + all UI fields);
   * the same id patches only changed reactive fields (likes, isLiked, isFollowing).
   * Passing `null` pauses playback.
   * @param {import('../services/api.js').VideoModel | null} model
   */
  set data(model) {
    if (!this.refs.video) {
      this.#pendingData = model ?? this.#pendingData;
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
    if (this.refs.video.src !== newSrc) {
      this.refs.video.pause();
      this.#videoProgress?.stop();
      this.refs.video.removeAttribute("src");
      this.refs.video.load();
      this.refs.video.src = newSrc;
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
    if (!this.refs.video || this.refs.video.readyState < 2) return;
    const playPromise = this.refs.video.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        this.refs.video.muted = true;
        this.refs.video.play().catch(() => {});
      });
    }
    this.#videoProgress?.start();
  }

  #pause() {
    this.refs.video?.pause();
    this.#videoProgress?.stop();
  }

  #handleVisibilityChange() {
    if (document.hidden) this.#videoProgress?.stop();
    else if (this.#isActive) this.#videoProgress?.start();
  }

  // Called by data-event="animationend:onHeartAnimationEnd" on .floating-heart
  onHeartAnimationEnd() {
    this.state.isHeartAnimating.value = false;
  }

  // Called by data-event="canplay:onVideoCanPlay" on video
  onVideoCanPlay() {
    if (this.#isActive) this.#play();
  }

  // Called by data-event="pointerdown:onVideoPointerDown" on video
  onVideoPointerDown(e) {
    this.#gestureDetector?.handlePointerDown(e);
  }

  // Called by data-event="pointerup:onVideoPointerUp" on video
  onVideoPointerUp(e) {
    this.#gestureDetector?.handlePointerUp(e);
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
    if (this.refs.video?.duration)
      this.refs.video.currentTime = pos * this.refs.video.duration;
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
    this.refs.video.paused ? this.#play() : this.#pause();
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
